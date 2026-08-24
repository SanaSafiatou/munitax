#!/usr/bin/env bash
# Test end-to-end :
#   A. Code PIN des agents généré à 4 CHIFFRES (plus 6).
#   B. Le super-administrateur peut SUPPRIMER définitivement le compte
#      administrateur d'une mairie, avec confirmation côté navigateur,
#      sans toucher aux agents collecteurs, contribuables ni historique ;
#      sessions du compte supprimé invalidées ; comptes non-super refusés.
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

async function get(url, cookie) {
  const r = await fetch(BASE + url, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { s: r.status, loc: r.headers.get("location"), t: await r.text() };
}

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
  return { cookie: r.cookie, loc: r.loc, t: r.t };
}

const nbAgentsAvant = db.prepare("SELECT COUNT(*) AS n FROM agents").get().n;

// ================================================ A. PIN agents à 4 chiffres
console.log("== A. Génération du code PIN agent ==");
let adm = await connecter("admin.beoumi", "beoumi123");
adm.cookie ? ok("connexion admin Béoumi") : ko("connexion admin impossible");
const pageAgents = await get("/admin/agents", adm.cookie);
pageAgents.s === 200 ? ok("/admin/agents accessible") : ko("/admin/agents refusée");
const fAgent = formulaires(pageAgents.t).find((f) => f.html.includes('name="nom_complet"'));
fAgent ? ok("formulaire de création d'agent trouvé") : ko("formulaire d'agent introuvable");
const pins = [];
for (const nom of ["Test Pin Un", "Test Pin Deux"]) {
  const r = await posterAction("/admin/agents", adm.cookie, fAgent, { nom_complet: nom, telephone: "" });
  const m = r.t.match(/codePin\\?"\s*:\s*\\?"(\d+)/) ?? r.t.match(/Code PIN initial[\s\S]{0,300}?>(\d{4})</);
  m ? pins.push(m[1]) : ko(`PIN introuvable dans la réponse pour ${nom}`);
}
pins.length === 2 && pins.every((p) => p.length === 4 && /^\d{4}$/.test(p))
  ? ok(`PIN générés à 4 chiffres : ${pins.join(", ")}`)
  : ko(`PIN incorrects : ${JSON.stringify(pins)}`);
const nbAgentsApresPins = db.prepare("SELECT COUNT(*) AS n FROM agents").get().n;
nbAgentsApresPins === nbAgentsAvant + 2 ? ok("2 agents réellement créés en base") : ko("création d'agents en base défaillante");

// ============================ B1. Préparation : message envoyé par l'admin
console.log("== B1. Préparation : un message lié au futur compte supprimé ==");
const admId = db.prepare("SELECT id FROM agents WHERE identifiant='admin.beoumi'").get().id;
const pageContrib = await get("/admin/contribuables", adm.cookie);
const fMsg = formulaires(pageContrib.t).find((f) => f.html.includes('name="contenu"'));
if (fMsg) {
  await posterAction("/admin/contribuables", adm.cookie, fMsg,
    { contenu: "Message avant suppression du compte.", cible: "tous" });
  db.prepare("SELECT COUNT(*) AS n FROM messages WHERE contenu LIKE 'Message avant%' AND agent_id IS NOT NULL").get().n > 0
    ? ok("message créé avec cet admin comme auteur")
    : ko("message non rattaché à l'admin");
} else {
  ko("formulaire de message introuvable");
}

// ============================== B2. Bouton Supprimer visible côté super
console.log("== B2. Espace super-administrateur ==");
let sup = await connecter("super", "super123", "/super/login");
sup.cookie ? ok("connexion super") : ko("connexion super impossible");
const pageSuper = await get("/super", sup.cookie);
pageSuper.t.includes(">Supprimer<")
  ? ok("bouton « Supprimer » affiché à côté des administrateurs")
  : ko("bouton « Supprimer » absent");
pageSuper.t.includes('name="agent_id"') ? ok("cible du bouton = compte administrateur") : ko("champ agent_id absent");

// ================== B3. Un compte NON-super ne peut pas supprimer
console.log("== B3. Refus pour un compte non-super ==");
const idsActionsSuper = formulaires(pageSuper.t)
  .filter((f) => f.html.includes(">Supprimer<"));
const fSup = idsActionsSuper[0];
let nbAgents = db.prepare("SELECT COUNT(*) AS n FROM agents").get().n;
await posterAction("/super", adm.cookie, fSup, { agent_id: admId });
db.prepare("SELECT COUNT(*) AS n FROM agents").get().n === nbAgents
  ? ok("session admin simple : aucune suppression possible")
  : ko("FAILLE : un admin a pu supprimer un compte via l'action super !");

// ==================== B4. Suppression effective par le super
console.log("== B4. Suppression définitive par le super ==");
const rSup = await posterAction("/super", sup.cookie, fSup, { agent_id: admId });
!db.prepare("SELECT 1 FROM agents WHERE id = ?").get(admId)
  ? ok("compte administrateur supprimé de la base")
  : ko("compte toujours présent après suppression");
db.prepare("SELECT COUNT(*) AS n FROM messages WHERE contenu LIKE 'Message avant%' AND agent_id IS NULL").get().n > 0
  ? ok("historique des messages conservé (auteur anonymisé)")
  : ko("historique des messages perdu !");
db.prepare("SELECT COUNT(*) AS n FROM agents WHERE mairie_id = (SELECT id FROM mairies WHERE nom='Béoumi') AND role = 'agent' AND actif = 1").get().n >= 1
  ? ok("agents collecteurs intacts")
  : ko("agents collecteurs impactés !");

// Ancienne session du compte supprimé invalide
const ancienneSession = await get("/admin", adm.cookie);
ancienneSession.s === 307 || (ancienneSession.loc ?? "").includes("/login")
  ? ok("ancienne session du compte supprimé invalidée")
  : ko("session fantôme encore active !");
const reco = await connecter("admin.beoumi", "beoumi123");
const essaiReco = reco.cookie ? await get("/admin", reco.cookie) : { s: 307, loc: "/login" };
essaiReco.s !== 200 ? ok("connexion refusée avec les identifiants supprimés") : ko("compte supprimé peut encore se connecter !");

// Le contribuable de la mairie n'est pas impacté
const cli = await connecter("690000001", "test1234");
cli.cookie ? ok("contribuable de la mairie intact") : ko("contribuable impacté !");

// ==================== B5. Seuls les comptes « admin » sont supprimables
console.log("== B5. Périmètre du bouton Supprimer ==");
const agent1Id = db.prepare("SELECT id FROM agents WHERE identifiant='agent1'").get().id;
nbAgents = db.prepare("SELECT COUNT(*) AS n FROM agents").get().n;
await posterAction("/super", sup.cookie, fSup, { agent_id: agent1Id });
db.prepare("SELECT COUNT(*) AS n FROM agents").get().n === nbAgents
  ? ok("un compte AGENT collecteur ne peut pas être supprimé via ce bouton")
  : ko("un agent collecteur a été supprimé !");

console.log("");
process.exit(FAIL > 0 ? 1 : 0);
NODEEOF

status=$?
echo ""
[ $status -eq 0 ] && echo "TOUS LES TESTS PASSENT" || echo "ÉCHECS DÉTECTÉS"
exit $status
