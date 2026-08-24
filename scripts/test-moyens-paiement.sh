#!/usr/bin/env bash
# Test end-to-end des moyens de paiement mobile money :
#   1. Disponibilité par mairie (Béoumi : Wave seul ; Bouaké : Wave + Orange).
#   2. Paiement Wave simulé par un agent → référence WV-… + reçu.
#   3. Rejet serveur d'un opérateur non activé pour la mairie (tentative falsifiée).
#   4. Configuration : l'admin Béoumi active Moov Money → disponible chez ses
#      agents sans redéploiement ; clés jamais visibles cross-mairie.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="http://localhost:3100"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo "  ✓ $1"; }
ko() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
verif(){ if [[ "$2" == "$3" ]]; then ok "$1"; else ko "$1 (attendu=$2, obtenu=$3)"; fi; }

# L'identifiant de l'action de connexion change à chaque modification du
# code : on l'extrait dynamiquement depuis la page de connexion.
ACTION_LOGIN=$(curl -s $BASE/login | grep -oE 'id&quot;:&quot;[0-9a-f]+' | head -1 | sed 's/.*&quot;//')

echo "== 0. Réinitialisation et état initial =="
npm run seed --silent >/dev/null 2>&1 && ok "base réinitialisée"

echo "== 1. Écrans agent : opérateurs visibles selon la mairie =="
node --input-type=module <<'NODEEOF' || true
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const BASE = "http://localhost:3100";
let PASS = 0, FAIL = 0;
const ok = (m) => { PASS++; console.log("  ✓ " + m); };
const ko = (m) => { FAIL++; console.log("  ✗ " + m); };

async function get(url, cookie) {
  const r = await fetch(BASE + url, { headers: cookie ? { cookie } : {} });
  return { t: await r.text(), s: r.status, h: r.headers };
}

function champs(html) {
  const cle = html.match(/\$ACTION_KEY" value="([^"]+)"/)?.[1];
  const refs = [...html.matchAll(/name="(\$ACTION_\d+:0)" value="([^"]+)"/g)]
    .map((m) => ({ champ: m[1], valeur: m[2].replaceAll("&quot;", '"') }));
  const dernierRef = [...html.matchAll(/name="(\$ACTION_REF_\d+)"/g)].pop()?.[1];
  return { cle, refs, dernierRef };
}

async function posterAction(url, cookie, f, donnees) {
  const fd = new FormData();
  if (f.dernierRef) fd.append(f.dernierRef, "");
  const d = f.refs.at(-1);
  fd.append(d.champ, d.valeur);
  fd.append(d.champ.replace(":0", ":1"), "[{}]");
  fd.append("$ACTION_KEY", f.cle);
  for (const [k, v] of Object.entries(donnees)) fd.append(k, String(v));
  const r = await fetch(BASE + url, { method: "POST", body: fd, headers: { cookie }, redirect: "manual" });
  return { s: r.status, loc: r.headers.get("location"), h: r.headers, t: await r.text() };
}

async function connecter(identifiant, motDePasse) {
  const login = await get("/login");
  const r = await posterAction("/login", "", champs(login.t),
    { identifiant, mot_de_passe: motDePasse });
  return { cookie: r.h.get("set-cookie")?.split(";")[0], loc: r.loc };
}

const agBm = await connecter("agent1", "agent123");
const agBk = await connecter("agent2", "agent123");
agBm.cookie?.startsWith("session=") ? ok("agent1 connecté") : ko("connexion agent1");
agBk.cookie?.startsWith("session=") ? ok("agent2 connecté") : ko("connexion agent2");

// --- Béoumi : Wave seul ---
const colBm = await get("/agent/collecte/1", agBm.cookie);
colBm.t.includes("Mobile Money")
  ? ok("Agent Béoumi voit le choix Mobile Money")
  : ko("choix Mobile Money absent pour agent1");
colBm.t.includes("Wave")
  ? ok("Agent Béoumi voit Wave (clé configurée)")
  : ko("Wave absent pour agent1");
!colBm.t.includes("Orange Money")
  ? ok("Agent Béoumi ne voit PAS Orange Money (non configuré à Béoumi)")
  : ko("FUITE : Orange Money visible pour agent1");
!colBm.t.includes("MTN Money") && !colBm.t.includes("Moov Money")
  ? ok("Agent Béoumi ne voit ni Moov ni MTN")
  : ko("opérateur non configuré visible pour agent1");

// --- Bouaké : Wave + Orange Money ---
const colBk = await get("/agent/collecte/4", agBk.cookie);
colBk.t.includes("Wave") && colBk.t.includes("Orange Money")
  ? ok("Agent Bouaké voit Wave et Orange Money")
  : ko("opérateurs incorrects pour agent2");
!colBk.t.includes("Moov Money") && !colBk.t.includes("MTN Money")
  ? ok("Agent Bouaké ne voit ni Moov ni MTN")
  : ko("opérateur non configuré visible pour agent2");

// --- paiement Wave simulé par l'agent de Béoumi ---
const db = new Database("data/app.db");

const p1 = await posterAction("/agent/collecte/1", agBm.cookie,
  champs(colBm.t),
  { type_taxe_id: 1, contribuable_id: 3, montant: 1000, moyen: "mobile",
    operateur: "wave", latitude: "", longitude: "" });
const refWave = db.prepare(
  "SELECT reference, reference_mobile FROM paiements ORDER BY id DESC LIMIT 1",
).get();
p1.s === 200 && /^WV-/.test(refWave?.reference_mobile ?? "")
  ? ok(`Paiement Wave enregistré (${refWave.reference}, réf. ${refWave.reference_mobile})`)
  : ko("paiement wave refusé : statut " + p1.s);

// --- tentative falsifiée : MTN n'est PAS activé à Béoumi ---
const nbApresWave = db.prepare("SELECT COUNT(*) n FROM paiements").get().n;
const p2 = await posterAction("/agent/collecte/1", agBm.cookie,
  champs(colBm.t),
  { type_taxe_id: 1, contribuable_id: 3, montant: 1000, moyen: "mobile",
    operateur: "mtn_money", latitude: "", longitude: "" });
p2.t.includes("n'est pas activé") || p2.t.includes("n&#x27;est pas activé")
  ? ok("Opérateur non activé rejeté côté serveur (message affiché)")
  : ko("tentative MTN non rejetée");
db.prepare("SELECT COUNT(*) n FROM paiements").get().n === nbApresWave
  ? ok("La tentative falsifiée n'a créé aucun paiement")
  : ko("un paiement frauduleux a été créé !");

fs_write();
function fs_write() {
  require("node:fs").writeFileSync("/tmp/opencode/mm.json",
    JSON.stringify({ recuWave: p1?.loc ?? null }));
}
console.log(`\n[étape agent] ${PASS} réussis, ${FAIL} échoués`);
process.exitCode = FAIL ? 1 : 0;
NODEEOF

echo "== 2. Paiement Wave en base, reçu et dashboard =="
ID_RECUE=$(node -e "
const db=require('better-sqlite3')('data/app.db');
const r=db.prepare(\"SELECT id FROM paiements WHERE moyen_paiement='wave'\").get();
console.log(r ? r.id : 'NONE');")
if [[ "$ID_RECUE" != "NONE" ]]; then
  ok "paiement wave présent en base (#$ID_RECUE)"
  REF=$(node -e "
const db=require('better-sqlite3')('data/app.db');
console.log(db.prepare('SELECT reference_mobile FROM paiements WHERE id=?').get($ID_RECUE).reference_mobile ?? '');")
  [[ "$REF" == WV-* ]] && ok "référence mobile au format WV-… ($REF)" || ko "référence mobile absente/incorrecte ($REF)"

  KEY=$(curl -s $BASE/login | grep -oE '\$ACTION_KEY" value="[^"]+' | head -1 | sed 's/.*value="//')
  C_AG=$(curl -s -D - -o /dev/null $BASE/login -X POST \
    -F '$ACTION_REF_2=' -F "\$ACTION_2:0={\"id\":\"$ACTION_LOGIN\",\"bound\":\"\$@1\"}" \
    -F '$ACTION_2:1=[{}]' -F "\$ACTION_KEY=$KEY" \
    -F 'identifiant=agent1' -F 'mot_de_passe=agent123' \
    | grep -ioE "set-cookie: session=[^;]+" | head -1 | sed 's/^[Ss]et-[Cc]ookie: //')
  RECU=$(curl -s -b "$C_AG" "$BASE/recu/$ID_RECUE")
  grep -q "Wave" <<<"$RECU" && ok "le reçu affiche « Wave »" || ko "reçu sans mention Wave"
  grep -q "$REF" <<<"$RECU" && ok "le reçu affiche la référence $REF" || ko "référence absente du reçu"
  grep -qi "simulation" <<<"$RECU" && ok "le reçu porte la mention simulation" || ko "mention simulation absente"
else
  ko "aucun paiement wave en base — tests du reçu sautés"
fi

KEY2=$(curl -s $BASE/login | grep -oE '\$ACTION_KEY" value="[^"]+' | head -1 | sed 's/.*value="//')
C_ADM=$(curl -s -D - -o /dev/null $BASE/login -X POST \
  -F '$ACTION_REF_2=' -F "\$ACTION_2:0={\"id\":\"$ACTION_LOGIN\",\"bound\":\"\$@1\"}" \
  -F '$ACTION_2:1=[{}]' -F "\$ACTION_KEY=$KEY2" \
  -F 'identifiant=admin.beoumi' -F 'mot_de_passe=beoumi123' \
  | grep -ioE "set-cookie: session=[^;]+" | head -1 | sed 's/^[Ss]et-[Cc]ookie: //')

DASH=$(curl -s -b "$C_ADM" $BASE/admin)
grep -q "Répartition par moyen de paiement" <<<"$DASH" && ok "section répartition présente sur le dashboard" || ko "section répartition absente"
grep -q "Wave" <<<"$DASH" && ok "dashboard liste Wave dans la répartition" || ko "Wave absent de la répartition"

CSV=$(curl -s -b "$C_ADM" "$BASE/admin/export?periode=tout&moyen=wave")
LIGNES_WAVE=$(grep -c "^REC-" <<<"$CSV" || true)
NB_DB=$(node -e "
const db=require('better-sqlite3')('data/app.db');
console.log(db.prepare(\"SELECT COUNT(*) n FROM paiements WHERE mairie_id=1 AND moyen_paiement='wave'\").get().n);")
verif "export CSV filtré sur Wave = paiements Wave en base" "$NB_DB" "$LIGNES_WAVE"
head -1 <<<"$CSV" | grep -q "Moyen de paiement" && ok "CSV contient la colonne Moyen de paiement" || ko "colonne Moyen absente du CSV"

echo "== 3. Configuration des clés API (admin Béoumi) =="
PAGE_CONF=$(curl -s -b "$C_ADM" $BASE/admin/moyens-paiement)
grep -q "Moov Money" <<<"$PAGE_CONF" && ok "écran de configuration accessible" || ko "écran config introuvable"
grep -q "DEMO-BEOUMI\|DEMO-BOUAKE" <<<"$PAGE_CONF" && ko "FUITE : clé API en clair dans la page" || ok "clés jamais affichées en clair (masquage ••••)"

# La page contient 4 formulaires (un par opérateur) : extraire le numéro
# d'action du PREMIER et reconstruire les 3 champs appariés.
NUM=$(grep -oE 'name="\$ACTION_[0-9]+:0"' <<<"$PAGE_CONF" | head -1 | sed -E 's/.*ACTION_([0-9]+):0.*/\1/')
ACT=$(grep -oE "name=\"\\\$ACTION_${NUM}:0\" value=\"[^\"]+" <<<"$PAGE_CONF" | head -1 | sed 's/.*value="//; s/&quot;/"/g')
CLE_ACT=$(grep -oE '\$ACTION_KEY" value="[^"]+' <<<"$PAGE_CONF" | head -1 | sed 's/.*value="//')
curl -s -b "$C_ADM" $BASE/admin/moyens-paiement -X POST \
  -F "\$ACTION_REF_${NUM}=" -F "\$ACTION_${NUM}:0=$ACT" -F "\$ACTION_${NUM}:1=[{}]" \
  -F "\$ACTION_KEY=$CLE_ACT" \
  -F 'operateur=moov_money' -F 'cle_api=DEMO-CLE-MOOV-BEOUMI-9999' >/dev/null

ACTIF=$(node -e "
const db=require('better-sqlite3')('data/app.db');
console.log(db.prepare(\"SELECT COUNT(*) n FROM mairies_moyens_paiement WHERE mairie_id=1 AND operateur='moov_money'\").get().n);")
verif "clé Moov enregistrée en base pour Béoumi" "1" "$ACTIF"

COL2=$(curl -s -b "${C_AG:-}" $BASE/agent/collecte/1)
grep -q "Moov Money" <<<"$COL2" && ok "Moov Money immédiatement proposé à l'agent (sans redéploiement)" || ko "Moov absent après activation"

echo "== 4. Isolation stricte des clés entre mairies =="
C_ADM_BK=$(curl -s -D - -o /dev/null $BASE/login -X POST \
  -F '$ACTION_REF_2=' -F "\$ACTION_2:0={\"id\":\"$ACTION_LOGIN\",\"bound\":\"\$@1\"}" \
  -F '$ACTION_2:1=[{}]' -F "\$ACTION_KEY=$KEY2" \
  -F 'identifiant=admin.bouake' -F 'mot_de_passe=bouake123' \
  | grep -ioE "set-cookie: session=[^;]+" | head -1 | sed 's/^[Ss]et-[Cc]ookie: //')
CONF_BK=$(curl -s -b "$C_ADM_BK" $BASE/admin/moyens-paiement)
grep -q "DEMO-BEOUMI\|DEMO-CLE-MOOV-BEOUMI" <<<"$CONF_BK" && ko "FUITE : clés Béoumi visibles par Bouaké !" || ok "clés de Béoumi invisibles depuis Bouaké"
grep -q "DEMO-BOUAKE" <<<"$CONF_BK" && ko "FUITE : clé Bouaké en clair dans sa propre page" || ok "Bouaké ne voit que ses clés masquées"

# L'agent Bouaké ne doit pas voir Moov (activé uniquement à Béoumi)
KEY3=$(curl -s $BASE/login | grep -oE '\$ACTION_KEY" value="[^"]+' | head -1 | sed 's/.*value="//')
C_AG_BK=$(curl -s -D - -o /dev/null $BASE/login -X POST \
  -F '$ACTION_REF_2=' -F "\$ACTION_2:0={\"id\":\"$ACTION_LOGIN\",\"bound\":\"\$@1\"}" \
  -F '$ACTION_2:1=[{}]' -F "\$ACTION_KEY=$KEY3" \
  -F 'identifiant=agent2' -F 'mot_de_passe=agent123' \
  | grep -ioE "set-cookie: session=[^;]+" | head -1 | sed 's/^[Ss]et-[Cc]ookie: //')
COL_BK2=$(curl -s -b "$C_AG_BK" $BASE/agent/collecte/4)
grep -q "Moov Money" <<<"$COL_BK2" && ko "FUITE : Moov visible par l'agent de Bouaké après activation à Béoumi !" || ok "l'activation Moov de Béoumi ne déborde pas sur Bouaké"

echo ""
echo "Résultat : $PASS réussis, $FAIL échoués"
[[ $FAIL -eq 0 ]]
