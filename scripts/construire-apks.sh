#!/bin/bash
# Construit les APK Android MuniTax (Agent + Contribuable).
# Ces applications sont des lanceurs WebView pointant vers l'URL publique du serveur.
#
# Par défaut, l'URL de production est utilisée (https://munitax.onrender.com).
# Usage :  ./scripts/construire-apks.sh
# Ou avec une autre adresse (ex : tunnel Cloudflare temporaire) :
#          URL_SITE=https://xxxx.trycloudflare.com ./scripts/construire-apks.sh
#
# IMPORTANT : incrémenter VERSION_CODE à chaque reconstruction pour que les
# appareils remplacent bien l'APK précédent.
set -euo pipefail

URL_SITE="${URL_SITE:-${URL_TUNNEL:-https://munitax.onrender.com}}"
VERSION_CODE="4"
VERSION_NAME="1.3"

if [[ ! "$URL_SITE" =~ ^https://[a-zA-Z0-9.-]+(/)?$ ]]; then
  echo "Erreur : URL_SITE invalide (ex : https://munitax.onrender.com)" >&2
  exit 1
fi
# On normalise sans slash final pour concaténation propre des chemins.
URL_SITE="${URL_SITE%/}"

PROJET="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
BT="$SDK/build-tools/36.0.0"
PLAT="$SDK/platforms/android-36/android.jar"
SORTIE="$PROJET/public/apk"
TRAVAIL="$PROJET/apk-builder/.travail"
KEYSTORE="${HOME}/.config/munitax/cle-signature.jks"
KS_PASS="munitax2026"

command -v javac >/dev/null || { echo "JDK requis" >&2; exit 1; }
[[ -x "$BT/aapt2" ]] || { echo "SDK Android introuvable ($BT)" >&2; exit 1; }

mkdir -p "$SORTIE" "$TRAVAIL" "$(dirname "$KEYSTORE")"

if [[ ! -f "$KEYSTORE" ]]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias munitax \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=MuniTax, O=Demonstration Municipale, C=CM" >/dev/null 2>&1
fi

construire_apk() {
  local nom_app="$1" paquet="$2" chemin="$3" fichier="$4"
  local d="$TRAVAIL/$paquet"
  rm -rf "$d"; mkdir -p "$d"/{res/mipmap-anydpi-v26,res/drawable,res/values,gen,classes,dex}

  cat > "$d/AndroidManifest.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="$paquet" android:versionCode="$VERSION_CODE" android:versionName="$VERSION_NAME">
  <uses-sdk android:minSdkVersion="26" android:targetSdkVersion="34"/>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
  <application android:label="$nom_app" android:icon="@mipmap/ic_launcher"
      android:theme="@android:style/Theme.Material.Light.NoActionBar">
    <meta-data android:name="cf.munitax.URL" android:value="${URL_SITE}${chemin}"/>
    <activity android:name=".MainActivity" android:exported="true"
        android:configChanges="orientation|screenSize|keyboardHidden|screenLayout">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
EOF

  cat > "$d/res/values/colors.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources><color name="ic_bg">#065F46</color></resources>
EOF

  cat > "$d/res/drawable/ic_launcher_fg.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#FFFFFF"
      android:pathData="M32,78 L32,50 L42,44 L54,37 L66,44 L76,50 L76,78 Z M40,58 h5 v5 h-5 z M51.5,58 h5 v5 h-5 z M63,58 h5 v5 h-5 z"/>
  <path android:fillColor="#065F46" android:pathData="M50,78 v-11 h8 v11 z"/>
</vector>
EOF

  cat > "$d/res/mipmap-anydpi-v26/ic_launcher.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/ic_bg"/>
  <foreground android:drawable="@drawable/ic_launcher_fg"/>
</adaptive-icon>
EOF

  local classe="${paquet}.MainActivity"
  local fichier_java="${classe//./\/}"
  mkdir -p "$d/src/$(dirname "$fichier_java")"
  cat > "$d/src/$fichier_java.java" <<EOF
package $paquet;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView web;
    private GeolocationPermissions.Callback geoRetour;
    private String geoOrigine;

    @Override
    protected void onCreate(Bundle etat) {
        super.onCreate(etat);
        web = new WebView(this);
        // Fond vert de marque pendant les chargements (évite tout écran blanc
        // apparent, notamment pendant le démarrage à froid du serveur).
        web.setBackgroundColor(0xFF065F46);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setGeolocationEnabled(true);
        web.setWebViewClient(new WebViewClient() {
            // API >= 23 : callback appelé pour les échecs de chargement.
            // Sans lui, un hôte inaccessible laisse la WebView blanche.
            @Override
            public void onReceivedError(WebView vue, WebResourceRequest req,
                    WebResourceError err) {
                if (req.isForMainFrame()) afficherErreur();
            }

            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView vue, int code, String desc, String urlKo) {
                // Compatibilité : ne pas remplacer l'app pour une simple
                // ressource secondaire manquante (favicon…).
                if (urlKo != null && urlKo.startsWith(origine())) afficherErreur();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origine,
                    GeolocationPermissions.Callback retour) {
                if (checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED) {
                    retour.invoke(origine, true, false);
                } else {
                    geoRetour = retour;
                    geoOrigine = origine;
                    requestPermissions(new String[]{
                        android.Manifest.permission.ACCESS_FINE_LOCATION}, 100);
                }
            }
        });
        setContentView(web);
        if (etat == null) web.loadUrl(urlDepart()); else web.restoreState(etat);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] resultats) {
        if (code == 100 && geoRetour != null) {
            boolean accorde = resultats.length > 0
                && resultats[0] == PackageManager.PERMISSION_GRANTED;
            geoRetour.invoke(geoOrigine, accorde, false);
            geoRetour = null;
        }
    }

    private void afficherErreur() {
        String html = "<html><body style='font-family:sans-serif;background:#f1f5f9;"
            + "display:flex;align-items:center;justify-content:center;height:100%;margin:0'>"
            + "<div style='text-align:center;padding:24px'>"
            + "<p style='font-size:20px;font-weight:bold;color:#134e4a'>Connexion impossible</p>"
            + "<p style='color:#64748b;margin-top:8px'>V\u00e9rifiez votre connexion Internet puis r\u00e9essayez.</p>"
            + "<button onclick='location.href=\"" + urlDepart() + "\"' "
            + "style='margin-top:20px;background:#047857;color:white;border:none;border-radius:12px;"
            + "padding:12px 28px;font-size:16px;font-weight:bold'>R\u00e9essayer</button>"
            + "</div></body></html>";
        web.loadData(html, "text/html", "utf-8");
    }

    private String urlDepart() {
        try {
            Bundle md = getPackageManager()
                .getApplicationInfo(getPackageName(), PackageManager.GET_META_DATA).metaData;
            if (md != null) return md.getString("cf.munitax.URL");
        } catch (PackageManager.NameNotFoundException ignorede) { }
        return "$URL_SITE";
    }

    /** Origine (schéma+hôte) de l'URL de départ, pour filtrer les erreurs. */
    private String origine() {
        String u = urlDepart();
        int apresSchema = u.indexOf("://");
        if (apresSchema < 0) return u;
        int slash = u.indexOf('/', apresSchema + 3);
        return slash < 0 ? u : u.substring(0, slash);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
EOF

  ( cd "$d" &&
    "$BT/aapt2" compile --dir res -o flat.zip &&
    "$BT/aapt2" link -o non-signe.apk -I "$PLAT" --manifest AndroidManifest.xml \
        flat.zip --java gen --auto-add-overlay &&
    javac -classpath "$PLAT" -d classes gen/*/*/*.java src/*/*/*.java 2>/dev/null ||
    javac -classpath "$PLAT" -d classes $(find gen src -name '*.java') &&
    "$BT/d8" --release --lib "$PLAT" --output dex $(find classes -name '*.class') &&
    zip -qj non-signe.apk dex/classes.dex &&
    "$BT/zipalign" -f 4 non-signe.apk aligne.apk &&
    "$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" \
        --key-pass "pass:$KS_PASS" --out "$SORTIE/$fichier" aligne.apk
  ) && echo "OK -> $SORTIE/$fichier"
}

construire_apk "MuniTax Agent"        "cf.munitax.agent"     "/login" "MuniTax-Agent.apk"
construire_apk "MuniTax Contribuable" "cf.munitax.client"   "/"      "MuniTax-Contribuable.apk"

echo "Terminé. APK dans $SORTIE"
