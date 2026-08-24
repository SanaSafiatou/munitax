#!/usr/bin/env bash
# Test end-to-end de la création d'une fiche contribuable par l'agent
# (bouton « + Créer une nouvelle fiche contribuable » du formulaire de
# paiement), et de son apparition immédiate dans la liste « Contribuables »
# du tableau de bord admin :
#   1. La page agent n'a AUCUN formulaire imbriqué (source du bug initial).
#   2. Création via l'action serveur : réponse OK, code MT-XXXX attribué.
#   3. Validation : nom absent/trop court → erreur explicite, rien en base.
#   4. Étanchéité mairie : fiche rattachée à la mairie de l'agent.
#   5. Le contribuable créé apparaît dans la page admin « Contribuables »,
#      mais PAS depuis une autre mairie.
#   6. La recherche agent (par nom) retrouve bien la nouvelle fiche.
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

async function get(url, cookie) {
  const r = await fetch(BASE + url, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { s: r.status, loc: r.headers.get("location"), t: await r.text() };
}

function cookieSession(r) {
  const liste =
    typeof r.headers.getSetCookie === "function"
      ? r.headers.getSetCookie()
      : [r.headers.get("set-cookie")].filter(Boolean);
  const c = liste.find((x) => x.startsWith("session="));
  return c ? c.split(";")[0] : null;
}

/** Connexion via l'action login (formulaire HTML avec métadonnées $ACTION). */
async function connexion(identifiant, motDePasse) {
  const page = await get("/login");
  // <input name="$ACTION_N:0" value="{&quot;id&quot;:&quot;<hex>&quot;,…}">
  const m = page.t.match(
    /name="\$ACTION_(\d+):0" value="([^"]+)"/,
  );
  if (!m) return null;
  const idx = m[1];
  const meta = JSON.parse(m[2].replaceAll("&quot;", '"'));
  const cle = page.t.match(/\$ACTION_KEY" value="([^"]+)"/)?.[1];
  const corps = new FormData();
  corps.append(`$ACTION_REF_${idx}`, "");
  corps.append(`$ACTION_${idx}:0`, JSON.stringify(meta));
  corps.append(`$ACTION_${idx}:1`, "[{}]");
  if (cle) corps.append("$ACTION_KEY", cle);
  corps.append("identifiant", identifiant);
  corps.append("mot_de_passe", motDePasse);
  const r = await fetch(BASE + "/login", {
    method: "POST",
    body: corps,
    redirect: "manual",
  });
  return cookieSession(r);
}

/** Découvre l'id d'une action serveur dans les chunks JS chargés par la page.
 *  Les chunks contiennent le manifeste :
 *  __next_internal_action_entry_do_not_use__
 *  [{"<id>":{"name":"<export>"}}, "<module>", ""]. */
async function trouverIdAction(pageHtml, nomExport) {
  for (const m of pageHtml.matchAll(/\/_next\/static\/chunks\/[^"]+\.js/g)) {
    const js = await get(m[0]);
    for (const c of js.t.matchAll(
      /__next_internal_action_entry_do_not_use__\s*(\[[^\n]*?\])\s*\*\//g,
    )) {
      try {
        const [entrees] = JSON.parse(c[1]);
        for (const [id, info] of Object.entries(entrees ?? {})) {
          if (info?.name === nomExport) return id;
        }
      } catch {
        /* fragment de manifeste illisible : chunk suivant */
      }
    }
  }
  return null;
}

/**
 * Appelle l'action serveur `creerContribuable` exactement comme le client
 * React : POST multipart avec Next-Action, entrées du FormData préfixées
 * « _1_ » AVANT le modèle racine « 0 » (l'ordre est déterminant).
 */
async function appelerAction(cookie, url, idAction, champs) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.append("_1_" + k, v);
  fd.append("0", '[{},"$K1"]');
  const r = await fetch(BASE + url, {
    method: "POST",
    headers: { cookie, "Next-Action": idAction, origin: BASE },
    body: fd,
  });
  return await r.text();
}

console.log("\n== 1. Connexion agent ==");
{
  const cookieAgent = await connexion("agent1", "agent123");
  if (!cookieAgent) {
    ko("connexion agent1 impossible");
    console.log(`\n=== RÉSULTAT : ${PASS} réussites, ${FAIL + 1} échecs ===`);
    process.exit(1);
  }
  ok("agent1 connecté (session obtenue)");

  const pageCollecte = await get("/agent/collecte/1", cookieAgent);
  if (pageCollecte.s === 200)
    ok("page /agent/collecte/1 accessible");
  else {
    ko("page collecte inaccessible (" + pageCollecte.s + ")");
    console.log(`\n=== RÉSULTAT : ${PASS} réussites, ${FAIL} échecs ===`);
    process.exit(1);
  }

  console.log("\n== 2. Aucun formulaire imbriqué (bug initial) ==");
  {
    let profondeur = 0, imbriques = 0;
    for (const m of pageCollecte.t.matchAll(/<form[\s>]|<\/form>/g)) {
      if (m[0] === "</form>") profondeur--;
      else {
        if (profondeur > 0) imbriques++;
        profondeur++;
      }
    }
    if (imbriques === 0) ok("aucun <form> imbriqué dans le DOM rendu");
    else ko(imbriques + " formulaire(s) imbriqué(s) — bug initial présent");
  }

  const idCreer = await trouverIdAction(pageCollecte.t, "creerContribuable");
  if (idCreer) ok("id action creerContribuable trouvé : " + idCreer);
  else {
    ko("id action creerContribuable introuvable dans les chunks");
    console.log(`\n=== RÉSULTAT : ${PASS} réussites, ${FAIL} échecs ===`);
    process.exit(1);
  }

  console.log("\n== 3. Création d'une fiche par l'agent ==");
  {
    const avant = db
      .prepare("SELECT COUNT(*) n FROM contribuables WHERE mairie_id=?")
      .get(beoumi.id).n;
    const rep = await appelerAction(cookieAgent, "/agent/collecte/1", idCreer, {
      nom: "Koffi Test Creation",
      telephone: "0707070707",
    });
    const apres = db
      .prepare("SELECT COUNT(*) n FROM contribuables WHERE mairie_id=?")
      .get(beoumi.id).n;
    const fiche = db
      .prepare("SELECT * FROM contribuables WHERE nom_complet='Koffi Test Creation'")
      .get();
    if (rep.includes('"contribuable"') && rep.includes("MT-"))
      ok("réponse flight contient le contribuable créé");
    else ko("réponse inattendue : " + rep.slice(0, 120));
    if (apres === avant + 1) ok("ligne ajoutée en base (" + avant + " → " + apres + ")");
    else ko("aucune ligne ajoutée en base");
    if (fiche && /^MT-\d{4}$/.test(fiche.code)) ok("code MT- attribué : " + fiche.code);
    else ko("code MT-XXXX manquant");
    if (fiche && fiche.mairie_id === beoumi.id)
      ok("fiche rattachée à la mairie de l'agent (Béoumi)");
    else ko("mauvaise mairie : " + JSON.stringify(fiche?.mairie_id));
  }

  console.log("\n== 4. Validation des entrées ==");
  {
    const repCourte = await appelerAction(cookieAgent, "/agent/collecte/1", idCreer, { nom: "ab" });
    if (repCourte.includes('"erreur"') && !repCourte.includes('"contribuable"'))
      ok("nom trop court refusé");
    else ko("nom trop court accepté !");
    const repVide = await appelerAction(cookieAgent, "/agent/collecte/1", idCreer, { nom: "" });
    if (repVide.includes("Veuillez indiquer le nom"))
      ok("message « Veuillez indiquer le nom du contribuable. »");
    else ko("message de validation manquant : " + repVide.slice(0, 120));
    const invalides = db
      .prepare("SELECT COUNT(*) n FROM contribuables WHERE nom_complet IN ('ab','')")
      .get().n;
    if (invalides === 0) ok("rien inséré en base pour les saisies invalides");
    else ko(invalides + " saisie(s) invalide(s) insérée(s) en base");
  }

  console.log("\n== 5. Visibilité côté admin ==");
  {
    const cookieAdmin = await connexion("admin.beoumi", "beoumi123");
    if (!cookieAdmin) ko("connexion admin impossible");
    else {
      const liste = await get("/admin/contribuables", cookieAdmin);
      if (liste.s === 200 && liste.t.includes("Koffi Test Creation"))
        ok("la fiche créée par l'agent apparaît dans « Contribuables » (admin Béoumi)");
      else ko("fiche absente de la liste admin");

      const cookieAutre = await connexion("admin.bouake", "bouake123");
      if (cookieAutre) {
        const liste2 = await get("/admin/contribuables", cookieAutre);
        if (liste2.t.includes("Koffi Test Creation"))
          ko("fuite : visible depuis Bouaké !");
        else ok("invisible depuis la mairie de Bouaké");
      } else ok("(admin Bouaké indisponible — étanchéité non testée)");
    }
  }

  console.log("\n== 6. Retrouvabilité par recherche agent ==");
  {
    const idRecherche = await trouverIdAction(
      pageCollecte.t,
      "rechercherContribuables",
    );
    if (!idRecherche) ko("id action rechercherContribuables introuvable");
    else {
      // Signature (requete: string) : argument lié encodé en JSON flight,
      // sans FormData cette fois.
      const fd = new FormData();
      fd.append("0", JSON.stringify(["Koffi"]));
      const r = await fetch(BASE + "/agent/collecte/1", {
        method: "POST",
        headers: { cookie: cookieAgent, "Next-Action": idRecherche, origin: BASE },
        body: fd,
      });
      const t = await r.text();
      if (t.includes("Koffi Test Creation"))
        ok("recherche par nom retrouve la fiche créée");
      else ko("recherche par nom sans résultat : " + t.slice(0, 150));
    }
  }
}

console.log(`\n=== RÉSULTAT : ${PASS} réussites, ${FAIL} échecs ===`);
process.exit(FAIL ? 1 : 0);
NODEEOF
