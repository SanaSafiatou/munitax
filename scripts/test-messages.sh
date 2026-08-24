#!/usr/bin/env bash
# Test end-to-end de la fonctionnalité « Message aux contribuables » :
#   1. L'admin voit la section d'envoi et l'historique (vide au départ).
#   2. Envoi à TOUS les contribuables de sa mairie.
#   3. Le contribuable voit la notification dans son espace ; marquée lue.
#   4. Envoi à une SÉLECTION précise.
#   5. Étanchéité inter-mairies : identifiants d'une autre mairie rejetés,
#      « tous » limité à la seule mairie de l'admin.
#   6. Historique affiché avec dates et compteurs.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="http://localhost:3100"

echo "== 0. Réinitialisation =="
npm run seed --silent >/dev/null 2>&1 && echo "  base réinitialisée"

node --input-type=module <<'NODEEOF'
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const BASE = "http://localhost:3100";
let PASS = 0, FAIL = 0;
const ok = (m) => { PASS++; console.log("  ✓ " + m); };
const ko = (m) => { FAIL++; console.log("  ✗ " + m); };

const db = new Database("data/app.db");
const beoumi = db.prepare("SELECT id FROM mairies WHERE nom='Béoumi'").get();
const bouake = db.prepare("SELECT id FROM mairies WHERE nom='Bouaké'").get();

async function get(url, cookie) {
  const r = await fetch(BASE + url, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { s: r.status, loc: r.headers.get("location"), t: await r.text() };
}

/** Extrait le cookie « session=… » d'une réponse (robuste multi Set-Cookie). */
function cookieSession(r) {
  const liste =
    typeof r.headers.getSetCookie === "function"
      ? r.headers.getSetCookie()
      : [r.headers.get("set-cookie")].filter(Boolean);
  const brute = liste.find((c) => c.startsWith("session=")) ?? "";
  return brute.split(";")[0] || null;
}

function formulaires(html) {
  const out = [];
  for (const f of html.match(/<form\b[\s\S]*?<\/form>/g) ?? []) {
    const m = [...f.matchAll(/name="(\$ACTION_\d+:0)" value="([^"]+)"/g)].pop();
    if (!m) {
      // Actions simples sans argument : <input name="$ACTION_ID_…">
      const id = f.match(/name="(\$ACTION_ID_[0-9a-f]+)"/)?.[1];
      if (id) out.push({ html: f, id });
      continue;
    }
    out.push({
      html: f,
      cle: f.match(/\$ACTION_KEY" value="([^"]+)"/)?.[1],
      ref: [...f.matchAll(/name="(\$ACTION_REF_\d+)"/g)].pop()?.[1],
      champ: m[1],
      valeur: m[2].replaceAll("&quot;", '"'),
    });
  }
  return out;
}

async function posterAction(url, cookie, f, donnees) {
  const fd = new FormData();
  if (f.id) fd.append(f.id, "");
  if (f.ref) fd.append(f.ref, "");
  if (f.champ) {
    fd.append(f.champ, f.valeur);
    fd.append(f.champ.replace(":0", ":1"), "[{}]");
  }
  if (f.cle) fd.append("$ACTION_KEY", f.cle);
  for (const [k, v] of Object.entries(donnees)) {
    for (const item of Array.isArray(v) ? v : [v]) fd.append(k, String(item));
  }
  const r = await fetch(BASE + url, { method: "POST", body: fd, headers: { cookie }, redirect: "manual" });
  return { s: r.status, loc: r.headers.get("location"), cookie: cookieSession(r), t: await r.text() };
}

async function connecter(identifiant, motDePasse, page = "/login") {
  const login = await get(page);
  const fs = formulaires(login.t);
  const f = fs.find((x) => x.html.includes('name="identifiant"')) ?? fs[0];
  const r = await posterAction(page, "", f, { identifiant, mot_de_passe: motDePasse });
  return { cookie: r.cookie?.split(";")[0] ?? null, loc: r.loc, t: r.t };
}

const pageMsg = await get("/admin/contribuables");

// ==================================================== 1. Section d'envoi
console.log("== 1. Page « Contribuables » de l'administrateur ==");
let adm = await connecter("admin.beoumi", "beoumi123");
adm.cookie ? ok("connexion admin Béoumi") : ko("connexion admin impossible");
const page = await get("/admin/contribuables", adm.cookie);
page.s === 200 ? ok("/admin/contribuables accessible") : ko("/admin/contribuables refusée");
page.t.includes("Envoyer un message aux contribuables")
  ? ok("section d'envoi présente")
  : ko("section d'envoi absente");
page.t.includes("Messages déjà envoyés")
  ? ok("historique présent")
  : ko("historique absent");
page.t.includes("Aucun message pour le moment")
  ? ok("historique vide au départ")
  : ko("historique non vide au départ");
const fMsg = formulaires(page.t).find((f) => f.html.includes('name="contenu"'));
fMsg ? ok("formulaire de message trouvé") : ko("formulaire de message introuvable");

// ============================================ 2. Envoi à TOUS (Béoumi)
console.log("== 2. Envoi à tous les contribuables de la mairie ==");
const nbBeoumi = db.prepare("SELECT COUNT(*) AS n FROM contribuables WHERE mairie_id = ? AND actif = 1").get(beoumi.id).n;
const rTous = await posterAction("/admin/contribuables", adm.cookie, fMsg,
  { contenu: "Collecte spéciale samedi : présentez votre carte contribuable.", cible: "tous" });
rTous.t.includes(`Message envoyé à ${nbBeoumi} contribuables`) || db.prepare("SELECT COUNT(*) AS n FROM messages_destinataires").get().n === nbBeoumi
  ? ok(`message diffusé à ${nbBeoumi} contribuables`)
  : ko("diffusion « tous » incorrecte");
const msg1 = db.prepare("SELECT id, mairie_id FROM messages ORDER BY id DESC LIMIT 1").get();
msg1?.mairie_id === beoumi.id ? ok("message rattaché à la bonne mairie") : ko("mauvaise mairie émettrice");
const dest1 = db.prepare("SELECT COUNT(*) AS n FROM messages_destinataires WHERE message_id = ?").get(msg1.id).n;
dest1 === nbBeoumi ? ok(`${dest1} destinataires enregistrés`) : ko("nombre de destinataires incorrect");
const sms1 = db.prepare(
  `SELECT COUNT(*) AS n FROM messages_destinataires d JOIN contribuables c ON c.id = d.contribuable_id
   WHERE d.message_id = ? AND TRIM(COALESCE(c.telephone,'')) != ''`).get(msg1.id).n;
sms1 > 0 ? ok(`${sms1} destinataires joignables par SMS`) : ko("aucun SMS possible alors que des téléphones existent");

// ================================== 3. Côté contribuable : notification
console.log("== 3. Notification dans l'espace contribuable ==");
let cli = await connecter("690000001", "test1234");
cli.cookie ? ok("connexion contribuable testeur") : ko("connexion contribuable impossible");
const esp1 = await get("/contribuable", cli.cookie);
esp1.s === 200 ? ok("espace contribuable accessible") : ko("espace contribuable refusé");
esp1.t.includes("Messages de votre mairie") ? ok("section messages affichée") : ko("section messages absente");
esp1.t.includes("votre carte contribuable")
  ? ok("contenu du message visible")
  : ko("contenu du message absent");
esp1.t.includes("nouveau") ? ok("badge « nouveau » affiché") : ko("badge « nouveau » manquant");
const esp2 = await get("/contribuable", cli.cookie);
esp2.t.includes("Marquer comme lu")
  ? ok("bouton « Marquer comme lu » proposé")
  : ko("bouton « Marquer comme lu » absent");
const fLu = formulaires(esp2.t).find((f) => f.html.includes("Marquer comme lu"));
if (fLu) {
  await posterAction("/contribuable", cli.cookie, fLu, {});
  const esp3 = await get("/contribuable", cli.cookie);
  !esp3.t.includes("nouveau") && esp3.t.includes("déjà lu")
    ? ok("messages marqués lus après clic")
    : ko("marquage lu défaillant");
} else {
  ko("formulaire de marquage introuvable");
}

// ======================================== 4. Envoi à une SÉLECTION
console.log("== 4. Envoi à une sélection précise ==");
const cibles = db.prepare(
  "SELECT id FROM contribuables WHERE mairie_id = ? AND actif = 1 ORDER BY id LIMIT 2").all(beoumi.id);
await posterAction("/admin/contribuables", adm.cookie, fMsg,
  { contenu: "Message ciblé uniquement à deux fiches.", cible: "selection",
    contribuables: cibles.map((c) => c.id) });
const msg2 = db.prepare("SELECT id, mairie_id FROM messages ORDER BY id DESC LIMIT 1").get();
const dest2 = db.prepare(
  "SELECT COUNT(DISTINCT d.contribuable_id) AS n FROM messages_destinataires d WHERE d.message_id = ?").get(msg2.id).n;
dest2 === 2 ? ok("seuls les 2 cochés ont reçu le message") : ko(`sélection incorrecte (${dest2})`);
db.prepare("SELECT COUNT(*) AS n FROM messages WHERE id = ? AND mairie_id = ?").get(msg2.id, beoumi.id).n === 1
  ? ok("sélection restée dans la mairie")
  : ko("fuite hors mairie");

// ============================== 5. Étanchéité inter-mairies (attaque)
console.log("== 5. Étanchéité inter-mairies ==");
const nbMsgAvant = db.prepare("SELECT COUNT(*) AS n FROM messages").get().n;
const idAutreMairie = db.prepare(
  "SELECT id FROM contribuables WHERE mairie_id = ? LIMIT 1").get(bouake.id).id;
await posterAction("/admin/contribuables", adm.cookie, fMsg,
  { contenu: "Tentative d'injection inter-mairies.", cible: "selection", contribuables: [idAutreMairie] });
db.prepare("SELECT COUNT(*) AS n FROM messages").get().n === nbMsgAvant
  ? ok("requête avec identifiants étrangers : aucun message créé")
  : ko("un message a été créé avec un identifiant étranger !");
// Intégrité globale : aucun message ne doit jamais viser un contribuable
// hors de sa mairie émettrice.
const fuite = db.prepare(
  `SELECT COUNT(*) AS n
   FROM messages_destinataires d
   JOIN contribuables c ON c.id = d.contribuable_id
   JOIN messages m ON m.id = d.message_id
   WHERE m.mairie_id != c.mairie_id`).get().n;
fuite === 0 ? ok("intégrité mairie/destinataire vérifiée en base") : ko("FUITE : destinataires hors mairie en base !");

// Admin de Bouaké : « tous » ne doit toucher que Bouaké
let admBk = await connecter("admin.bouake", "bouake123");
const pageBk = await get("/admin/contribuables", admBk.cookie);
const fMsgBk = formulaires(pageBk.t).find((f) => f.html.includes('name="contenu"'));
await posterAction("/admin/contribuables", admBk.cookie, fMsgBk,
  { contenu: "Message de Bouaké à ses seuls contribuables.", cible: "tous" });
const msg3 = db.prepare("SELECT id, mairie_id FROM messages ORDER BY id DESC LIMIT 1").get();
const beoumiTouche = db.prepare(
  "SELECT COUNT(*) AS n FROM messages_destinataires d JOIN contribuables c ON c.id = d.contribuable_id WHERE d.message_id = ? AND c.mairie_id = ?").get(msg3.id, beoumi.id).n;
msg3.mairie_id === bouake.id && beoumiTouche === 0
  ? ok("« tous » de Bouaké ne touche aucun contribuable de Béoumi")
  : ko("FUITE : « tous » a dépassé la mairie !");
// Le contribuable de Béoumi ne doit pas voir le message de Bouaké
const esp3 = await get("/contribuable", cli.cookie);
!esp3.t.includes("Message de Bouaké") ? ok("aucun message d'une autre mairie côté contribuable") : ko("FUITE affichage croisé !");

// Contenu vide refusé
const rVide = await posterAction("/admin/contribuables", admBk.cookie, fMsgBk,
  { contenu: "", cible: "tous" });
db.prepare("SELECT COUNT(*) AS n FROM messages WHERE contenu = ''").get().n === 0
  ? ok("message vide refusé")
  : ko("message vide accepté !");

// ============================================ 6. Historique administrateur
console.log("== 6. Historique côté admin ==");
const hist = await get("/admin/contribuables", adm.cookie);
// React insère des commentaires SSR entre les nœuds de texte : on les retire
// pour comparer le texte réellement affiché.
const texteHist = hist.t.replaceAll("<!-- -->", "");
texteHist.includes("Messages déjà envoyés (") ? ok("compteur d'historique affiché") : ko("compteur absent");
texteHist.includes("Collecte spéciale samedi") ? ok("contenu du 1er message listé") : ko("1er message absent de l'historique");
texteHist.includes("dont ") ? ok("comptage SMS affiché") : ko("comptage SMS absent");
texteHist.includes("déjà lu") || texteHist.includes("0 lu") || texteHist.includes("1 lu")
  ? ok("statut de lecture visible")
  : ko("statut de lecture absent");
texteHist.includes("2 destinataires")
  ? ok("compteur « 2 destinataires » visible pour la sélection")
  : ko("compteur de destinataires erroné");

console.log("");
process.exit(FAIL > 0 ? 1 : 0);
NODEEOF

status=$?
echo ""
[ $status -eq 0 ] && echo "TOUS LES TESTS PASSENT" || echo "ÉCHECS DÉTECTÉS"
exit $status
