#!/usr/bin/env bash
# Scénario de vérification multi-mairies complet :
#   1. L'admin de chaque mairie crée son agent (identifiant + PIN générés).
#   2. Chaque agent change son PIN à la première connexion.
#   3. Chaque agent enregistre un paiement terrain avec un contribuable.
#   4. On vérifie que chaque tableau de bord ne montre QUE les paiements de sa mairie.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="http://localhost:3100"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); echo "  ✓ $1"; }
ko() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
verif(){ if [[ "$2" == "$3" ]]; then ok "$1"; else ko "$1 (attendu=$2, obtenu=$3)"; fi; }

ACTION_LOGIN="60ea92d67db1d3c472fc75a52a843c172e34bcf431"

extraire_cle()  { grep -oE '\$ACTION_KEY" value="[^"]+' <<<"${1:-$(cat)}" | head -1 | sed 's/.*value="//'; }

connexion() { # → cookie ; renvoie aussi l'en-tête Location dans LOC
  curl -s -D /tmp/opencode/h.txt -o /dev/null $BASE/login -X POST \
    -F '$ACTION_REF_2=' \
    -F "\$ACTION_2:0={\"id\":\"$ACTION_LOGIN\",\"bound\":\"\$@1\"}" \
    -F '$ACTION_2:1=[{}]' \
    -F "\$ACTION_KEY=$(curl -s $BASE/login | extraire_cle)" \
    -F "identifiant=$1" -F "mot_de_passe=$2"
  grep -ioE "^location: .*" /tmp/opencode/h.txt | head -1 | tr -d '\r' || true
  grep -ioE "set-cookie: session=[^;]+" /tmp/opencode/h.txt | head -1 | sed 's/^[Ss]et-[Cc]ookie: //'
}

echo "== 0. Réinitialisation des données de démonstration =="
npm run seed --silent >/dev/null && ok "base réinitialisée"

echo "== 1. Création d'un agent par chaque admin =="
K_LOGIN=$(curl -s $BASE/login | extraire_cle)
C_ADM_BM=$(curl -s -D - -o /dev/null $BASE/login -X POST \
  -F '$ACTION_REF_2=' -F "\$ACTION_2:0={\"id\":\"$ACTION_LOGIN\",\"bound\":\"\$@1\"}" \
  -F '$ACTION_2:1=[{}]' -F "\$ACTION_KEY=$K_LOGIN" \
  -F 'identifiant=admin.beoumi' -F 'mot_de_passe=beoumi123' \
  | grep -ioE "set-cookie: session=[^;]+" | head -1 | sed 's/^[Ss]et-[Cc]ookie: //')
C_ADM_BK=$(curl -s -D - -o /dev/null $BASE/login -X POST \
  -F '$ACTION_REF_2=' -F "\$ACTION_2:0={\"id\":\"$ACTION_LOGIN\",\"bound\":\"\$@1\"}" \
  -F '$ACTION_2:1=[{}]' -F "\$ACTION_KEY=$K_LOGIN" \
  -F 'identifiant=admin.bouake' -F 'mot_de_passe=bouake123' \
  | grep -ioE "set-cookie: session=[^;]+" | head -1 | sed 's/^[Ss]et-[Cc]ookie: //')
[[ "$C_ADM_BM" == session=* && "$C_ADM_BK" == session=* ]] && ok "deux admins connectés" || ko "connexions admin"

creer_agent() { : ; } # (la création est faite par le bloc Node ci-dessous)

# Les appels curl avec noms de champs dynamiques sont fragiles en bash :
# on passe par un petit script Node pour la création d'agents et les paiements.
node --input-type=module <<'NODEEOF' || true
import fs from "node:fs";

const BASE = "http://localhost:3100";
const ACTION_LOGIN = "60ea92d67db1d3c472fc75a52a843c172e34bcf431";
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
  const num = d.champ.split(":")[0].slice(1); // $ACTION_2 → ACTION_2... format name
  fd.append(d.champ, d.valeur);
  fd.append(d.champ.replace(":0", ":1"), "[{}]");
  fd.append("$ACTION_KEY", f.cle);
  for (const [k, v] of Object.entries(donnees)) fd.append(k, String(v));
  const r = await fetch(BASE + url, { method: "POST", body: fd, headers: { cookie }, redirect: "manual" });
  return { s: r.status, loc: r.headers.get("location"), h: r.headers, t: await r.text() };
}

async function connecter(identifiant, motDePasse) {
  const page = await get("/login");
  const f = champs(page.t);
  const r = await posterAction("/login", "", f, { identifiant, mot_de_passe: motDePasse });
  const sc = r.h.get("set-cookie");
  const cookie = sc?.split(";")[0];
  return { cookie, location: r.loc, statut: r.s };
}

// --- connexions admin ---
const admBm = await connecter("admin.beoumi", "beoumi123");
const admBk = await connecter("admin.bouake", "bouake123");
if (admBm.cookie?.startsWith("session=")) ok("admin Béoumi connecté"); else ko("admin Béoumi");
if (admBk.cookie?.startsWith("session=")) ok("admin Bouaké connecté"); else ko("admin Bouaké");

// --- création des agents ---
async function creerAgent(cookieAdmin, nom) {
  const page = await get("/admin/agents", cookieAdmin);
  const f = champs(page.t);
  const r = await posterAction("/admin/agents", cookieAdmin, f, { nom_complet: nom });
  const m = r.t.match(/"compteCree":\{"nomComplet":"[^"]*","mairie":"[^"]*","identifiant":"([^"]*)","codePin":"(\d+)"/);
  return m ? { identifiant: m[1], pin: m[2] } : null;
}
const agBm = await creerAgent(admBm.cookie, "Test Kouassi");
const agBk = await creerAgent(admBk.cookie, "Test Awa");
if (agBm) ok(`Agent Béoumi créé : ${agBm.identifiant} / PIN ${agBm.pin}`); else ko("création agent Béoumi");
if (agBk) ok(`Agent Bouaké créé : ${agBk.identifiant} / PIN ${agBk.pin}`); else ko("création agent Bouaké");

// --- première connexion : changement de mot de passe obligatoire ---
async function premierLoginEtChangement(c) {
  const l1 = await connecter(c.identifiant, c.pin);
  if (!/changer-mdp/.test(l1.location ?? "")) return ko("redirection /changer-mdp absente pour " + c.identifiant), null;
  const page = await get("/changer-mdp", l1.cookie);
  const f = champs(page.t);
  const r = await posterAction("/changer-mdp", l1.cookie, f, { nouveau: "nouveau123", confirmation: "nouveau123" });
  return r.loc;
}
const retBm = await premierLoginEtChangement(agBm);
retBm === "/agent" ? ok(`${agBm.identifiant} a personnalisé son mot de passe → /agent`) : ko("changement mdp Béoumi (" + retBm + ")");
const retBk = await premierLoginEtChangement(agBk);
retBk === "/agent" ? ok(`${agBk.identifiant} a personnalisé son mot de passe → /agent`) : ko("changement mdp Bouaké (" + retBk + ")");

// --- paiements terrain par chaque agent ---
// Depuis le mode hors ligne, l'action renvoie { recuId } au lieu d'une
// redirection : on lit l'identifiant de reçu directement dans la réponse.
async function payer(cookieAgent, typeId, contribuableId, montant) {
  const page = await get(`/agent/collecte/${typeId}`, cookieAgent);
  if (page.s !== 200) return { erreur: "page collecte " + page.s };
  const f = champs(page.t);
  const r = await posterAction(`/agent/collecte/${typeId}`, cookieAgent, f,
    { type_taxe_id: typeId, contribuable_id: contribuableId, montant, latitude: "", longitude: "" });
  const m = r.t.match(/recuId&quot;:(\d+)|recuId":(\d+)/);
  return { recu: m ? `/recu/${m[1] ?? m[2]}` : null, corps: r.t.slice(0, 200) };
}
const sessBm = await connecter(agBm.identifiant, "nouveau123");
const sessBk = await connecter(agBk.identifiant, "nouveau123");

// Types après seed : Béoumi marché = id 1, contribuable MT-000003 = id 3
//                   Bouaké marché = id 4, contribuable MT-000005 = id 5
const pBm = await payer(sessBm.cookie, 1, 3, 1000);
/recu\/(\d+)/.test(pBm.recu ?? "") ? ok(`Paiement Béoumi enregistré (${pBm.recu})`) : ko("paiement Béoumi : " + JSON.stringify(pBm));
const pBk = await payer(sessBk.cookie, 4, 5, 1500);
/recu\/(\d+)/.test(pBk.recu ?? "") ? ok(`Paiement Bouaké enregistré (${pBk.recu})`) : ko("paiement Bouaké : " + JSON.stringify(pBk));

fs.writeFileSync("/tmp/opencode/scenario.json", JSON.stringify({
  agBm, agBk, pBm, pBk, cookiesBm: sessBm.cookie, cookiesBk: sessBk.cookie,
}));
console.log(`\n[étape actions] ${PASS} réussis, ${FAIL} échoués`);
process.exitCode = FAIL ? 1 : 0;
NODEEOF

echo ""
echo "== 2. Vérification finale des tableaux de bord =="
if [[ ! -f /tmp/opencode/scenario.json ]]; then
  echo "  ✗ étape actions échouée, vérifications finales ignorées"
  exit 1
fi
C_AG_BM=$(connexion "$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/opencode/scenario.json')).agBm.identifiant)")" nouveau123)
C_AG_BK=$(connexion "$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/opencode/scenario.json')).agBk.identifiant)")" nouveau123)

DASH_BM=$(curl -s -b "$C_ADM_BM" $BASE/admin)
DASH_BK=$(curl -s -b "$C_ADM_BK" $BASE/admin)

grep -q "Test Kouassi" <<<"$DASH_BM" && ok "Dashboard Béoumi affiche l'agent Test Kouassi" || ko "agent Béoumi absent du dashboard"
grep -q "Test Awa" <<<"$DASH_BM" && ko "FUITE : agent de Bouaké visible à Béoumi" || ok "Dashboard Béoumi sans aucun agent de Bouaké"
grep -q "Test Awa" <<<"$DASH_BK" && ok "Dashboard Bouaké affiche l'agent Test Awa" || ko "agent Bouaké absent du dashboard"
grep -q "Test Kouassi" <<<"$DASH_BK" && ko "FUITE : agent de Béoumi visible à Bouaké" || ok "Dashboard Bouaké sans aucun agent de Béoumi"

echo "== 3. Vérification en base : chaque paiement dans SA mairie =="
node -e "
const db = require('better-sqlite3')('data/app.db');
const rows = db.prepare(\`
  SELECT p.id, p.mairie_id, p.montant, a.identifiant AS agent, c.code
  FROM paiements p JOIN agents a ON a.id=p.agent_id JOIN contribuables c ON c.id=p.contribuable_id
  WHERE a.identifiant LIKE 'beoumi.%' OR a.identifiant LIKE 'bouake.%'\`).all();
let pass = 0;
for (const r of rows) {
  const attendu = r.agent.startsWith('beoumi.') ? 1 : 2;
  if (r.mairie_id === attendu) { console.log('  ✓ paiement #' + r.id + ' (' + r.agent + ', ' + r.code + ') → mairie ' + r.mairie_id); pass++; }
  else { console.log('  ✗ paiement #' + r.id + ' (' + r.agent + ') mairie ' + r.mairie_id + ' ≠ ' + attendu); process.exitCode = 1; }
}
rows.length === 2 ? pass++ : (console.log('  ✗ il faut exactement 2 paiements, trouvé ' + rows.length), process.exitCode = 1);
"

echo ""
TOTAL=$((PASS + FAIL))
echo "Résultat : $PASS réussis, $FAIL échoués"
[[ $FAIL -eq 0 ]]
