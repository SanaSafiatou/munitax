#!/usr/bin/env bash
# Test de vérification multi-mairies : Béoumi vs Bouaké.
# Vérifie que chaque mairie ne voit QUE ses propres données.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="http://localhost:3100"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
ko()   { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
verif(){ if [[ "$2" == "$3" ]]; then ok "$1"; else ko "$1 (attendu=$2, obtenu=$3)"; fi; }

# Extraction dynamique de l'identifiant d'action : il change à chaque
# build, on ne le code donc JAMAIS en dur.
extraire_action() { # $1 = page, $2 = champ présent dans le formulaire visé
  local FORM ID N KEY_S
  FORM=$(curl -s "$1" | awk -v ch="name=\"$2\"" '
    /<form/{dans=0} /<form/{dans=1} dans{print} dans && /<\/form>/{exit}')
  ID=$(grep -oE '\$ACTION_[0-9]+:0" value="[^"]+' <<<"$FORM" | head -1 \
    | sed 's/.*value="//;s/&quot;/"/g' | sed -E 's/.*"id":"([0-9a-f]+)".*/\1/')
  N=$(grep -oE 'name="\$ACTION_([0-9]+):0"' <<<"$FORM" | head -1 | grep -oE '[0-9]+' | head -1)
  KEY_S=$(grep -oE '\$ACTION_KEY" value="[^"]+' <<<"$FORM" | head -1 | sed 's/.*value="//')
  printf '%s\n%s\n%s\n' "$ID" "$N" "$KEY_S"
}

connexion() { # $1 identifiant, $2 mot de passe — page publique /login
  local LIGNES ID N KEY_S
  LIGNES=$(extraire_action "$BASE/login" "identifiant")
  ID=$(sed -n 1p <<<"$LIGNES"); N=$(sed -n 2p <<<"$LIGNES"); KEY_S=$(sed -n 3p <<<"$LIGNES")
  curl -s -D - -o /dev/null $BASE/login -X POST \
    -F "\$ACTION_REF_${N}=" \
    -F "\$ACTION_${N}:0={\"id\":\"$ID\",\"bound\":\"\$@1\"}" \
    -F "\$ACTION_${N}:1=[{}]" \
    -F "\$ACTION_KEY=$KEY_S" \
    -F "identifiant=$1" -F "mot_de_passe=$2" \
    | grep -ioE "set-cookie: session=[^;]+" | head -1 | sed 's/^[Ss]et-[Cc]ookie: //'
}

# Connexion du super-administrateur : porte DÉDIÉE /super/login (jamais la
# page publique, qui refuse désormais tout compte propriétaire).
connexion_super() {
  local LIGNES ID N KEY_S
  LIGNES=$(extraire_action "$BASE/super/login" "identifiant")
  ID=$(sed -n 1p <<<"$LIGNES"); N=$(sed -n 2p <<<"$LIGNES"); KEY_S=$(sed -n 3p <<<"$LIGNES")
  curl -s -D - -o /dev/null $BASE/super/login -X POST \
    -F "\$ACTION_REF_${N}=" \
    -F "\$ACTION_${N}:0={\"id\":\"$ID\",\"bound\":\"\$@1\"}" \
    -F "\$ACTION_${N}:1=[{}]" \
    -F "\$ACTION_KEY=$KEY_S" \
    -F "identifiant=$1" -F "mot_de_passe=$2" \
    | grep -ioE "set-cookie: session=[^;]+" | head -1 | sed 's/^[Ss]et-[Cc]ookie: //'
}

ID_AGENT2=$(node -e "
const db=require('better-sqlite3')('data/app.db');
console.log(db.prepare(\"SELECT id FROM agents WHERE identifiant='agent2'\").get().id);")

echo "== Connexions des comptes =="
C_SUPER=$(connexion_super super super123)
C_ADM_BM=$(connexion admin.beoumi beoumi123)
C_ADM_BK=$(connexion admin.bouake bouake123)
C_AG_BM=$(connexion agent1 agent123)
C_AG_BK=$(connexion agent2 agent123)
for nom in C_SUPER C_ADM_BM C_ADM_BK C_AG_BM C_AG_BK; do
  v=$(eval "echo \${!nom}")
  [[ "$v" == session=* ]] && ok "$nom connecté" || ko "$nom échec de connexion"
done

echo "== Super-admin : espace et mairies listées =="
HTML=$(curl -s -b "$C_SUPER" $BASE/super)
verif "/super liste Béoumi"      "1" "$(grep -c 'Béoumi' <<<"$HTML" | head -1 | ((read n; echo n> /dev/null); grep -q Béoumi <<<"$HTML" && echo 1 || echo 0))"
grep -q 'Bouaké' <<<"$HTML" && ok "/super liste Bouaké" || ko "/super ne liste pas Bouaké"

echo "== Isolation des tableaux de bord admin =="
BM=$(curl -s -b "$C_ADM_BM" $BASE/admin)
BK=$(curl -s -b "$C_ADM_BK" $BASE/admin)
grep -q 'Jean Mbarga' <<<"$BM" && ok "Dashboard Béoumi : agent Jean Mbarga visible" || ko "Jean absent du dashboard Béoumi"
grep -q 'Alice Mefo'  <<<"$BM" && ko "Dashboard Béoumi : FUITE (agent Bouaké visible)" || ok "Dashboard Béoumi : aucun agent de Bouaké"
grep -q 'Alice Mefo'  <<<"$BK" && ok "Dashboard Bouaké : agent Alice Mefo visible" || ko "Alice absente du dashboard Bouaké"
grep -q 'Jean Mbarga' <<<"$BK" && ko "Dashboard Bouaké : FUITE (agent Béoumi visible)" || ok "Dashboard Bouaké : aucun agent de Béoumi"

echo "== Export CSV strictement par mairie =="
CSV_BM=$(curl -s -b "$C_ADM_BM" "$BASE/admin/export?periode=semaine")
CSV_BK=$(curl -s -b "$C_ADM_BK" "$BASE/admin/export?periode=semaine")
LIGNES_BM=$(grep -c "^REC-" <<<"$CSV_BM" || true)
LIGNES_BK=$(grep -c "^REC-" <<<"$CSV_BK" || true)
TOTAL_DB_BM=$(node -e "
const db=require('better-sqlite3')('data/app.db');
console.log(db.prepare(\"SELECT COUNT(*) n FROM paiements WHERE mairie_id=1\").get().n);")
verif "Export Béoumi contient exactement les paiements de la mairie 1" "$TOTAL_DB_BM" "$LIGNES_BM"

echo "== Cloisonnement des fiches et cartes =="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$C_ADM_BM" "$BASE/admin/agents/$ID_AGENT2")
verif "Admin Béoumi → fiche agent Bouaké = 404" "404" "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$C_AG_BM" "$BASE/carte-contribuable/6")
verif "Agent Béoumi → carte contribuable Bouaké (MT-000006) = 404" "404" "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$C_AG_BK" "$BASE/carte-contribuable/6")
verif "Agent Bouaké → carte contribuable Bouaké = 200" "200" "$CODE"
CODE=$(curl -s -b "$C_AG_BM" "$BASE/agent/collecte/4")
if grep -q "Enregistrer un paiement" <<<"$CODE"; then ko "Agent Béoumi voit la taxe de Bouaké (FUITE)"; else ok "Agent Béoumi → taxe de Bouaké inaccessible"; fi
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$C_AG_BM" "$BASE/agent/collecte/1")
verif "Agent Béoumi → sa propre taxe = 200" "200" "$CODE"

echo ""
echo "Résultat : $PASS réussis, $FAIL échoués"
[[ $FAIL -eq 0 ]]
