#!/usr/bin/env bash
# Test end-to-end du rôle PROPRIÉTAIRE (super-administrateur) et de la
# gestion des abonnements :
#   1. Espace propriétaire : liste des mairies (nom, statut, échéance,
#      agents) SANS aucune donnée de collecte.
#   2. Création de mairie avec échéance d'abonnement.
#   3. Inscription publique d'une mairie → « en attente », connexion
#      refusée jusqu'à approbation.
#   4. Approbation par le propriétaire → accès immédiat.
#   5. Suspension : connexions refusées, sessions ouvertes coupées,
#      données intactes ; réactivation sans perte.
#   6. Impersonation à sens unique (session d'assistance).
#   7. Paiements hors ligne : déduplication par uuid_client.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="http://localhost:3100"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo "  ✓ $1"; }
ko() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

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

async function get(url, cookie) {
  const r = await fetch(BASE + url, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { s: r.status, loc: r.headers.get("location"), h: r.headers, t: await r.text() };
}

/** Découpe le HTML en formulaires et extrait les champs d'action de chacun. */
function formulaires(html) {
  const out = [];
  for (const f of html.match(/<form\b[\s\S]*?<\/form>/g) ?? []) {
    const m = [...f.matchAll(/name="(\$ACTION_\d+:0)" value="([^"]+)"/g)].pop();
    if (!m) continue;
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
  if (f.ref) fd.append(f.ref, "");
  fd.append(f.champ, f.valeur);
  fd.append(f.champ.replace(":0", ":1"), "[{}]");
  fd.append("$ACTION_KEY", f.cle);
  for (const [k, v] of Object.entries(donnees)) fd.append(k, String(v));
  const r = await fetch(BASE + url, { method: "POST", body: fd, headers: { cookie }, redirect: "manual" });
  return { s: r.status, loc: r.headers.get("location"), cookie: r.headers.get("set-cookie"), t: await r.text() };
}

async function connecter(identifiant, motDePasse, page = "/login") {
  const login = await get(page);
  const fs = formulaires(login.t);
  const f = fs.find((x) => x.html.includes('name="identifiant"')) ?? fs[0];
  const r = await posterAction(page, "", f, { identifiant, mot_de_passe: motDePasse });
  return { cookie: r.cookie?.split(";")[0] ?? null, loc: r.loc, t: r.t };
}

// ============================================================ 1. Dashboard
console.log("== 1. Tableau de bord du propriétaire ==");
let sup = await connecter("super", "super123", "/super/login");
sup.cookie?.startsWith("session=") ? ok("connexion super") : ko("connexion super impossible");

const dash = await get("/super", sup.cookie);
dash.s === 200 ? ok("/super accessible au propriétaire") : ko("/super refusée (" + dash.s + ")");
for (const attendu of ["Béoumi", "Bouaké", "Active", "Échéance abonnement"]) {
  dash.t.includes(attendu) ? ok(`« ${attendu} » affiché`) : ko(`« ${attendu} » manquant`);
}
dash.t.includes("Kouassi") ? ok("responsable affiché") : ko("responsable absent");
!dash.t.includes("Total collecté") ? ok("AUCUNE colonne « Total collecté »") : ko("FUITE : totaux de collecte visibles !");
!dash.t.includes("FCFA") ? ok("aucun montant FCFA sur le dashboard") : ko("FUITE : montants FCFA visibles !");
dash.t.includes("Suspendre") && dash.t.includes("Se connecter")
  ? ok("actions Suspendre / Se connecter présentes")
  : ko("boutons d'action manquants");

// ============================================== 2. Création de mairie
console.log("== 2. Création d'une mairie avec échéance ==");
const echeance = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
const fAjout = formulaires(dash.t).find((f) => f.html.includes('name="date_echeance"'));
const rAjout = await posterAction("/super", sup.cookie, fAjout,
  { nom: "Yamoussoukro", date_echeance: echeance });
rAjout.t.includes("Yamoussoukro") || db.prepare("SELECT 1 FROM mairies WHERE nom='Yamoussoukro'").get()
  ? ok("mairie Yamoussoukro créée")
  : ko("création Yamoussoukro échouée");
const yam = db.prepare("SELECT id, statut, date_echeance_abonnement FROM mairies WHERE nom='Yamoussoukro'").get();
yam?.statut === "active" ? ok("nouvelle mairie active") : ko("statut initial incorrect");
yam?.date_echeance_abonnement > Date.now() ? ok("échéance enregistrée") : ko("échéance non enregistrée");

// ================================ 3. Inscription publique → en attente
console.log("== 3. Inscription publique d'une mairie ==");
const pageInsc = await get("/inscription-mairie");
const fInsc = formulaires(pageInsc.t)[0];
await posterAction("/inscription-mairie", "", fInsc, {
  nom: "Demo-Attente", responsable: "Mme Diarra",
  contact: "+225 75 55 55 55", admin_nom: "Grace Diarra",
});
const attente = db.prepare("SELECT id, statut FROM mairies WHERE nom='Demo-Attente'").get();
attente?.statut === "en_attente"
  ? ok("mairie inscrite au statut « en_attente »")
  : ko("statut d'inscription incorrect : " + attente?.statut);
const admAttente = db.prepare("SELECT id, identifiant FROM agents WHERE mairie_id=?").get(attente.id);
admAttente ? ok(`compte admin créé (${admAttente.identifiant})`) : ko("pas de compte admin créé");

// mot de passe connu pour la suite (copie du hash du compte testeur)
db.prepare("UPDATE agents SET mot_de_passe=(SELECT mot_de_passe FROM contribuables WHERE telephone='690000001') WHERE id=?")
  .run(admAttente.id);

const essai1 = await connecter(admAttente.identifiant, "test1234");
essai1.t.includes("en attente d&#x27;approbation") || essai1.t.includes("en attente d'approbation")
  ? ok("connexion refusée tant que non approuvée")
  : ko("connexion acceptée alors que la mairie est en attente !");
!essai1.cookie ? ok("aucune session ouverte") : ko("session ouverte à tort !");

// ======================================== 4. Approbation par le owner
console.log("== 4. Approbation ==");
const dash2 = await get("/super", sup.cookie);
const fApprouve = formulaires(dash2.t).find(
  (f) => f.html.includes('value="active"') && f.html.includes(`value="${attente.id}"`) && f.html.includes("nouveau_statut"),
);
const rApprouve = await posterAction("/super", sup.cookie, fApprouve,
  { mairie_id: attente.id, nouveau_statut: "active" });
db.prepare("SELECT statut FROM mairies WHERE id=?").get(attente.id).statut === "active"
  ? ok("mairie approuvée (active)")
  : ko("approbation sans effet");

const essai2 = await connecter(admAttente.identifiant, "test1234");
essai2.cookie?.startsWith("session=")
  ? ok("l'admin de la mairie approuvée peut se connecter")
  : ko("connexion toujours refusée après approbation");

// ==================================================== 5. Suspension
console.log("== 5. Suspension / réactivation ==");
const agBk = await connecter("agent2", "agent123");
(await get("/agent", agBk.cookie)).s === 200 ? ok("agent Bouaké actif avant suspension") : ko("agent Bloaké KO avant suspension");

const dash3 = await get("/super", sup.cookie);
const bouakeId = db.prepare("SELECT id FROM mairies WHERE nom='Bouaké'").get().id;
const fSuspend = formulaires(dash3.t).find(
  (f) => f.html.includes('value="suspendue"') && f.html.includes(`value="${bouakeId}"`),
);
await posterAction("/super", sup.cookie, fSuspend, { mairie_id: bouakeId, nouveau_statut: "suspendue" });

const nbPaiementsBkAvant = db.prepare("SELECT COUNT(*) n FROM paiements WHERE mairie_id=?").get(bouakeId).n;

const refusAdmin = await connecter("admin.bouake", "bouake123");
refusAdmin.t.includes("Accès suspendu")
  ? ok("connexion admin suspendu refusée avec le bon message")
  : ko("admin suspendu peut encore se connecter !");

const coupe = await get("/agent", agBk.cookie);
(coupe.loc ?? "").includes("/acces-bloque")
  ? ok(`session agent ouverte coupée immédiatement (${coupe.loc})`)
  : ko("session existante non coupée : " + coupe.s);

db.prepare("SELECT COUNT(*) n FROM paiements WHERE mairie_id=?").get(bouakeId).n === nbPaiementsBkAvant
  ? ok("données intactes pendant la suspension")
  : ko("des données ont disparu !");

const fReactiver = formulaires((await get("/super", sup.cookie)).t).find(
  (f) => f.html.includes("Réactiver") && f.html.includes(`value="${bouakeId}"`),
);
await posterAction("/super", sup.cookie, fReactiver, { mairie_id: bouakeId, nouveau_statut: "active" });

(await get("/agent", agBk.cookie)).s === 200
  ? ok("réactivation : accès rétabli sans perte ni reconnexion")
  : ko("accès non rétabli après réactivation");

// =============================================== 6. Impersonation
console.log("== 6. Session d'assistance (impersonation) ==");
const admBeoumi = db.prepare("SELECT id FROM agents WHERE identifiant='admin.beoumi'").get().id;
const fImp = formulaires((await get("/super", sup.cookie)).t).find(
  (f) => f.html.includes(`name="agent_id" value="${admBeoumi}"`),
);
const rImp = await posterAction("/super", sup.cookie, fImp, { agent_id: admBeoumi });
const cImp = rImp.cookie?.split(";")[0];
cImp?.startsWith("session=") ? ok("session d'assistance ouverte") : ko("impersonation échouée");
(rImp.loc ?? "").startsWith("/admin") ? ok("redirection vers /admin") : ko("mauvaise destination");

const vueAdmin = await get("/admin", cImp);
vueAdmin.t.includes("Session d&#x27;assistance technique") || vueAdmin.t.includes("Session d'assistance technique")
  ? ok("bandeau d'assistance affiché dans l'espace admin")
  : ko("bandeau d'assistance absent");
!vueAdmin.t.includes("super123") ? ok("aucun secret du propriétaire exposé") : ko("secret exposé !");

const retour = await get("/super", cImp);
(retour.loc ?? "").startsWith("/admin")
  ? ok("impersonation à sens unique : /super renvoie vers /admin")
  : ko("retour automatique possible vers /super !");

// ================================== 7. Paiements hors ligne (dédupe)
console.log("== 7. Hors ligne : déduplication uuid_client ==");
const agBm = await connecter("agent1", "agent123");
const typeMarche = db.prepare("SELECT id FROM types_taxe WHERE mairie_id=(SELECT id FROM mairies WHERE nom='Béoumi') AND nom='Taxe de marché'").get().id;
const contrib = db.prepare("SELECT id FROM contribuables WHERE code='MT-0001'").get().id;
const colPage = await get(`/agent/collecte/${typeMarche}`, agBm.cookie);
const totalAvant = db.prepare("SELECT COUNT(*) n FROM paiements").get().n;

const uuid = "test-uuid-offline-0001";
const donnees = {
  type_taxe_id: typeMarche, contribuable_id: contrib, montant: 1000,
  latitude: "", longitude: "", moyen: "cash", operateur: "", uuid_client: uuid,
};
await posterAction(`/agent/collecte/${typeMarche}`, agBm.cookie, formulaires(colPage.t)[0], donnees);
const apres1 = db.prepare("SELECT COUNT(*) n FROM paiements WHERE uuid_client=?").get(uuid).n;
apres1 === 1 ? ok("paiement hors ligne synchronisé") : ko("paiement non créé : " + apres1);

await posterAction(`/agent/collecte/${typeMarche}`, agBm.cookie, formulaires(colPage.t)[0], donnees);
const apres2 = db.prepare("SELECT COUNT(*) n FROM paiements WHERE uuid_client=?").get(uuid).n;
apres2 === 1 ? ok("renvoi identique : aucun doublon") : ko("DOUBLON créé !");
db.prepare("SELECT COUNT(*) n FROM paiements").get().n === totalAvant + 1
  ? ok("un seul paiement au total pour deux envois")
  : ko("le nombre total de paiements est incorrect");

// ===================================== 8. Échéance dépassée (suspension auto)
console.log("== 8. Échéance dépassée ==");
db.prepare("UPDATE mairies SET date_echeance_abonnement=? WHERE nom='Béoumi'")
  .run(Date.now() - 86400000);
// Toute tentative d'accès mairie déclenche la suspension automatique.
await get("/agent", agBm.cookie);
const statutEchu = db.prepare("SELECT statut FROM mairies WHERE nom='Béoumi'").get().statut;
statutEchu === "suspendue" ? ok("mairie suspendue automatiquement à l'échéance") : ko("pas de suspension automatique (" + statutEchu + ")");
(await get("/agent", agBm.cookie)).s === 307
  ? ok("accès agent coupé dès l'échéance dépassée")
  : ko("l'agent passe encore alors que l'échéance est dépassée");

console.log("");
console.log(`Résultat : ${PASS} réussis, ${FAIL} échoués`);
process.exit(FAIL === 0 ? 0 : 1);
NODEEOF
