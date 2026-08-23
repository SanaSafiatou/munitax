#!/usr/bin/env bash
# Recette de bout en bout exécutée À TRAVERS LE LIEN PUBLIC (tunnel) :
#   1. Agent : paiement en ESPÈCES → quittance affichée correctement.
#   2. Agent : paiement MOBILE MONEY (Wave simulé) → référence sur le reçu.
#   3. Admin : total du jour exact sur le tableau de bord.
#   4. Déconnexion puis reconnexion → aucune donnée perdue.
#   5. Deux mairies, un paiement chacune → isolation stricte des dashboards.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="https://table-rabbit-infants-need.trycloudflare.com"
echo "Cible : $BASE"
npm run seed --silent >/dev/null 2>&1 && echo "base de démonstration réinitialisée"

node --input-type=module <<'NODEEOF'
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const BASE = process.env.BASE ?? "https://table-rabbit-infants-need.trycloudflare.com";
let PASS = 0, FAIL = 0;
const ok = (m) => { PASS++; console.log("  ✓ " + m); };
const ko = (m) => { FAIL++; console.log("  ✗ " + m); };
const db = new Database("data/app.db");
const fmt = (n) => `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;

// Réseau parfois capricieux : chaque appel est retenté jusqu'à 4 fois.
async function essayer(fn) {
  let derniere;
  for (let i = 0; i < 4; i++) {
    try { return await fn(); } catch (e) {
      derniere = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw derniere;
}
async function get(url, cookie) {
  return essayer(async () => {
    const r = await fetch(BASE + url, { headers: cookie ? { cookie } : {}, redirect: "manual" });
    return { s: r.status, loc: r.headers.get("location"), h: r.headers, t: await r.text() };
  });
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
  if (f.refs?.length) {
    const d = f.refs.at(-1);
    fd.append(d.champ, d.valeur);
    fd.append(d.champ.replace(":0", ":1"), "[{}]");
    fd.append("$ACTION_KEY", f.cle);
  }
  for (const [k, v] of Object.entries(donnees)) fd.append(k, String(v));
  return essayer(async () => {
    const r = await fetch(BASE + url, { method: "POST", body: fd, headers: { cookie }, redirect: "manual" });
    return { s: r.status, loc: r.headers.get("location"), cookie: r.headers.get("set-cookie"), t: await r.text() };
  });
}
async function connecter(identifiant, motDePasse) {
  const login = await get("/login");
  const r = await posterAction("/login", "", champs(login.t), { identifiant, mot_de_passe: motDePasse });
  return { cookie: r.cookie?.split(";")[0] ?? null, loc: r.loc };
}
/** Total validé du jour pour une mairie (même requête que le dashboard). */
function totalDuJour(mairieId) {
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = jour.split("-").map(Number);
  // bornes locales Africa/Douala = UTC+0 → minuit local == minuit UTC
  const debut = Date.UTC(y, m - 1, d);
  return db.prepare(
    "SELECT COALESCE(SUM(montant),0) t FROM paiements WHERE statut='valide' AND mairie_id=? AND date_heure>=? AND date_heure<?",
  ).get(mairieId, debut, debut + 86400000).t;
}

// ============================================== 1. Paiement en espèces
console.log("== 1. Agent — paiement en espèces ==");
const agBm = await connecter("agent1", "agent123");
agBm.cookie?.startsWith("session=")
  ? ok("agent1 connecté via le lien public")
  : ko("connexion agent1 impossible");

const colBm = await get("/agent/collecte/1", agBm.cookie);
colBm.s === 200 ? ok("formulaire de collecte accessible") : ko("page collecte " + colBm.s);

const pCash = await posterAction("/agent/collecte/1", agBm.cookie, champs(colBm.t),
  { type_taxe_id: 1, contribuable_id: 3, montant: 1000, moyen: "cash", operateur: "", latitude: "", longitude: "" });
const idCash = pCash.t.match(/recuId&quot;:(\d+)|recuId":(\d+)/)?.[1] ?? pCash.t.match(/recuId&quot;:(\d+)|recuId":(\d+)/)?.[2];
idCash ? ok(`paiement cash accepté (reçu #${idCash})`) : ko("paiement cash refusé");

const recuCash = await get(`/recu/${idCash}`, agBm.cookie);
recuCash.s === 200 ? ok("quittance accessible") : ko("quittance introuvable (" + recuCash.s + ")");
recuCash.t.includes("REC-") ? ok("référence REC-… affichée") : ko("référence absente");
recuCash.t.replaceAll("\u202f", " ").includes(fmt(1000).replaceAll("\u202f", " "))
  ? ok(`montant ${fmt(1000)} affiché`)
  : ko("montant incorrect sur la quittance");
/Espèces|Especes/.test(recuCash.t) ? ok("moyen « Espèces » affiché") : ko("moyen de paiement absent");

// ========================================== 2. Paiement mobile money
console.log("== 2. Agent — paiement mobile money (Wave simulé) ==");
const pWave = await posterAction("/agent/collecte/1", agBm.cookie, champs(colBm.t),
  { type_taxe_id: 1, contribuable_id: 3, montant: 2000, moyen: "mobile", operateur: "wave", latitude: "", longitude: "" });
const idWave = pWave.t.match(/recuId&quot;:(\d+)|recuId":(\d+)/)?.[1] ?? pWave.t.match(/recuId&quot;:(\d+)|recuId":(\d+)/)?.[2];
idWave ? ok(`paiement Wave accepté (reçu #${idWave})`) : ko("paiement Wave refusé");

const refMobile = db.prepare("SELECT reference_mobile FROM paiements WHERE id=?").get(idWave).reference_mobile;
/^WV-/.test(refMobile ?? "") ? ok(`référence opérateur générée (${refMobile})`) : ko("pas de référence Wave");
const recuWave = await get(`/recu/${idWave}`, agBm.cookie);
recuWave.t.includes(refMobile) ? ok("référence mobile money visible sur la quittance") : ko("référence absente du reçu");
/Wave/.test(recuWave.t) ? ok("opérateur « Wave » affiché") : ko("opérateur non affiché");

// ====================================== 3. Admin — total du jour exact
console.log("== 3. Admin — total du jour ==");
const admBm = await connecter("admin.beoumi", "beoumi123");
admBm.cookie?.startsWith("session=") ? ok("admin Béoumi connecté") : ko("connexion admin impossible");

const beoumiId = db.prepare("SELECT id FROM mairies WHERE nom='Béoumi'").get().id;
const attenduBm = totalDuJour(beoumiId);
const dashBm = await get("/admin", admBm.cookie);
dashBm.s === 200 ? ok("tableau de bord admin accessible") : ko("dashboard " + dashBm.s);
dashBm.t.replaceAll("\u202f", " ").includes(fmt(attenduBm).replaceAll("\u202f", " "))
  ? ok(`« Collecté aujourd'hui » = ${fmt(attenduBm)} (exact, paiements terrain inclus)`)
  : ko(`total affiché ≠ ${fmt(attenduBm)}`);
const nbJour = (() => {
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = jour.split("-").map(Number);
  return db.prepare("SELECT COUNT(*) n FROM paiements WHERE statut='valide' AND mairie_id=? AND date_heure>=?").get(beoumiId, Date.UTC(y, m - 1, d)).n;
})();
const nbAffiche = dashBm.t.match(/Paiements validés aujourd&#x27;hui<[^>]*>[\s\S]*?>(\d+)</s)?.[1]
  ?? dashBm.t.match(/Paiements validés aujourd'hui[\s\S]{0,200}?>\s*(\d+)\s*</)?.[1];
Number(nbAffiche) === nbJour
  ? ok(`« Paiements validés aujourd'hui » = ${nbJour} (exact)`)
  : ko(`compteur du jour incorrect : affiché=${nbAffiche}, attendu=${nbJour}`);

// ================================ 4. Déconnexion puis reconnexion
console.log("== 4. Déconnexion / reconnexion ==");
const pageAgent = await get("/agent", agBm.cookie);
const fLogout = pageAgent.t.match(/<form\b[^>]*>(?:(?!<\/form>)[\s\S])*?Quitter[\s\S]*?<\/form>/)?.[0];
let deconnecte = false;
if (fLogout) {
  const idAct = fLogout.match(/name="(\$ACTION_ID_[0-9a-f]+)"/)?.[1];
  if (idAct) {
    const fd = new FormData();
    fd.append(idAct, "");
    const rl = await essayer(() => fetch(BASE + "/agent", { method: "POST", body: fd, headers: { cookie: agBm.cookie }, redirect: "manual" }));
    deconnecte = (rl.headers.get("location") ?? "").includes("/login");
  }
}
deconnecte ? ok("déconnexion effective (retour à /login)") : ko("déconnexion non détectée");

const agBm2 = await connecter("agent1", "agent123");
agBm2.cookie?.startsWith("session=") ? ok("reconnexion réussie") : ko("reconnexion impossible");
const hist = await get("/agent/historique", agBm2.cookie);
hist.t.includes("REC-") ? ok("l'historique retrouve les quittances après reconnexion") : ko("historique vide après reconnexion !");
const totalApres = totalDuJour(beoumiId);
db.prepare("SELECT COUNT(*) n FROM paiements WHERE mairie_id=? AND montant IN (1000,2000)").get(beoumiId).n >= 2 && totalApres === attenduBm
  ? ok(`aucune donnée perdue : total du jour inchangé (${fmt(totalApres)})`)
  : ko("des données ont disparu après déconnexion !");

// ==================== 5. Deux mairies — isolation des dashboards
console.log("== 5. Deux mairies, isolation stricte ==");
const agBk = await connecter("agent2", "agent123");
const colBk = await get("/agent/collecte/4", agBk.cookie);
await posterAction("/agent/collecte/4", agBk.cookie, champs(colBk.t),
  { type_taxe_id: 4, contribuable_id: 5, montant: 1500, moyen: "cash", operateur: "", latitude: "", longitude: "" });
ok("paiement Bouaké enregistré par agent2 (1 500 FCFA)");

const bouakeId = db.prepare("SELECT id FROM mairies WHERE nom='Bouaké'").get().id;
const attenduBk = totalDuJour(bouakeId);

const dashBm2 = await get("/admin", admBm.cookie);
dashBm2.t.replaceAll("\u202f", " ").includes(fmt(attenduBm).replaceAll("\u202f", " ")) && !(dashBm2.t.includes(fmt(attenduBm + 1500)))
  ? ok(`dashboard Béoumi reste à ${fmt(attenduBm)} (le paiement Bouaké ne compte pas)`)
  : ko("le dashboard Béoumi absorbe les données Bouaké !");
!dashBm2.t.includes("KG 77") && !dashBm2.t.includes("Alice Mefo")
  ? ok("aucun contribuable ni agent de Bouaké visible depuis Béoumi")
  : ko("FUITE : données Bouaké visibles côté Béoumi !");

const admBk = await connecter("admin.bouake", "bouake123");
const dashBk = await get("/admin", admBk.cookie);
dashBk.t.replaceAll("\u202f", " ").includes(fmt(attenduBk).replaceAll("\u202f", " "))
  ? ok(`dashboard Bouaké affiche son propre total (${fmt(attenduBk)})`)
  : ko("total Bouaké incorrect");
!dashBk.t.includes("Ngo Bassa") && !dashBk.t.includes("Jean Mbarga")
  ? ok("aucun contribuable ni agent de Béoumi visible depuis Bouaké")
  : ko("FUITE : données Béoumi visibles côté Bouaké !");

console.log("");
console.log(`Résultat : ${PASS} réussis, ${FAIL} échoués`);
process.exit(FAIL === 0 ? 0 : 1);
NODEEOF
