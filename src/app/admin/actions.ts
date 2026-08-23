"use server";

import { revalidatePath } from "next/cache";
import db from "@/lib/db";
import { exigerMairie, nomMairie } from "@/lib/auth";
import { genererCodePin, genererIdentifiant } from "@/lib/comptes";
import { estOperateur, libelleMoyen } from "@/lib/moyens-paiement";
import { hashSync } from "bcryptjs";

export async function annulerPaiement(formData: FormData): Promise<void> {
  const { mairieId } = await exigerMairie("admin");
  const id = Number(formData.get("paiement_id"));
  if (!Number.isFinite(id)) return;
  db.prepare(
    "UPDATE paiements SET statut = 'annule' WHERE id = ? AND mairie_id = ? AND statut = 'valide'",
  ).run(id, mairieId);
  revalidatePath("/admin");
  revalidatePath("/admin/collectes");
}

export type EtatCreationAgent = {
  erreur?: string;
  compteCree?: {
    nomComplet: string;
    mairie: string;
    identifiant: string;
    codePin: string;
    telephone: string | null;
  };
};

/**
 * Création d'un compte agent par l'administrateur de la mairie :
 * identifiant et code PIN à 6 chiffres générés automatiquement.
 * Le PIN est temporaire : l'agent devra le remplacer à sa première connexion.
 */
export async function creerAgent(
  _etatPrecedent: EtatCreationAgent,
  formData: FormData,
): Promise<EtatCreationAgent> {
  const { mairieId } = await exigerMairie("admin");

  const nomComplet = String(formData.get("nom_complet") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();

  if (nomComplet.length < 3) {
    return { erreur: "Veuillez indiquer le nom complet de l'agent." };
  }
  if (telephone && !/^[\d\s+.-]{8,20}$/.test(telephone)) {
    return { erreur: "Numéro de téléphone invalide." };
  }

  const identifiant = genererIdentifiant(nomComplet, nomMairie(mairieId));
  const codePin = genererCodePin();

  db.prepare(
    `INSERT INTO agents (nom_complet, telephone, identifiant, mot_de_passe, role,
                         mairie_id, doit_changer_mdp, actif, cree_le)
     VALUES (?, ?, ?, ?, 'agent', ?, 1, 1, ?)`,
  ).run(nomComplet, telephone || null, identifiant, hashSync(codePin, 10), mairieId, Date.now());

  revalidatePath("/admin/agents");
  revalidatePath("/super");

  return {
    compteCree: {
      nomComplet,
      mairie: nomMairie(mairieId),
      identifiant,
      codePin,
      telephone: telephone || null,
    },
  };
}

export type EtatCleMoyen = { succes?: string; erreur?: string };

/**
 * Enregistrement (ou désactivation) de la clé API mobile money d'un
 * opérateur pour la mairie de l'admin connecté. La clé est stockée dans
 * mairies_moyens_paiement : dès l'enregistrement, le moyen devient
 * disponible pour les agents de cette mairie, sans redéploiement.
 */
export async function enregistrerCleMoyen(
  _etatPrecedent: EtatCleMoyen,
  formData: FormData,
): Promise<EtatCleMoyen> {
  const { mairieId } = await exigerMairie("admin");

  const operateur = String(formData.get("operateur") ?? "");
  const cle = String(formData.get("cle_api") ?? "").trim();
  const desactiver = formData.get("desactiver") === "1";

  if (!estOperateur(operateur)) {
    return { erreur: "Opérateur inconnu." };
  }

  if (desactiver) {
    db.prepare(
      "DELETE FROM mairies_moyens_paiement WHERE mairie_id = ? AND operateur = ?",
    ).run(mairieId, operateur);
    revalidatePath("/admin/moyens-paiement");
    revalidatePath("/agent");
    return {
      succes: `${libelleMoyen(operateur)} désactivé — le moyen n'est plus proposé à vos agents.`,
    };
  }

  if (cle.length < 8) {
    return {
      erreur:
        "Clé API trop courte. Collez la clé complète fournie par l'opérateur.",
    };
  }

  db.prepare(
    `INSERT INTO mairies_moyens_paiement (mairie_id, operateur, cle_api, cree_le)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (mairie_id, operateur)
     DO UPDATE SET cle_api = excluded.cle_api`,
  ).run(mairieId, operateur, cle, Date.now());

  revalidatePath("/admin/moyens-paiement");
  revalidatePath("/agent");

  return {
    succes: `${libelleMoyen(operateur)} activé — disponible immédiatement pour vos agents.`,
  };
}

/* ======================= Types de taxes ======================= */

export type EtatTypeTaxe = {
  erreur?: string;
  succes?: string;
  typeCree?: { id: number; nom: string };
};

export type EtatAffectationType = { erreur?: string; succes?: string };

function lireMontant(formData: FormData): { erreur?: string; montant: number | null } {
  const libre = formData.get("montant_libre") !== null;
  const brut = String(formData.get("montant_fixe") ?? "").replace(/[\s.]/g, "");
  if (libre) return { montant: null };
  if (!/^\d{1,9}$/.test(brut) || Number(brut) < 1) {
    return {
      erreur:
        "Indiquez un montant fixe en FCFA (1 minimum), ou cochez « Montant à saisir par l'agent ».",
      montant: null,
    };
  }
  return { montant: Number(brut) };
}

export async function creerTypeTaxe(
  _etatPrecedent: EtatTypeTaxe,
  formData: FormData,
): Promise<EtatTypeTaxe> {
  const { mairieId } = await exigerMairie("admin");

  const nom = String(formData.get("nom") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (nom.length < 2) {
    return { erreur: "Veuillez indiquer le nom du type de taxe (2 caractères minimum)." };
  }
  const { erreur, montant } = lireMontant(formData);
  if (erreur) return { erreur };

  const existe = db
    .prepare<[string, number], { id: number }>(
      "SELECT id FROM types_taxe WHERE nom = ? COLLATE NOCASE AND mairie_id = ? AND actif = 1",
    )
    .get(nom, mairieId);
  if (existe) {
    return { erreur: `« ${nom} » existe déjà pour votre mairie.` };
  }

  db.prepare(
    `INSERT INTO types_taxe (nom, description, montant_fixe, montant_libre, mairie_id, actif)
     VALUES (?, ?, ?, ?, ?, 1)`,
  ).run(nom, description || null, montant, montant === null ? 1 : 0, mairieId);

  const cree = db
    .prepare<[string, number], { id: number }>(
      "SELECT id FROM types_taxe WHERE nom = ? COLLATE NOCASE AND mairie_id = ? AND actif = 1",
    )
    .get(nom, mairieId);
  if (!cree) return { erreur: "L'enregistrement a échoué, veuillez réessayer." };

  revalidatePath("/admin/types-taxe");
  revalidatePath("/agent");
  return {
    succes: `« ${nom} » ajouté : choisissez maintenant les agents qui pourront l'encaisser.`,
    typeCree: { id: cree.id, nom },
  };
}

export async function modifierTypeTaxe(formData: FormData): Promise<void> {
  const { mairieId } = await exigerMairie("admin");

  const id = Number(formData.get("id"));
  const nom = String(formData.get("nom") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!Number.isInteger(id) || nom.length < 2) return;
  const { montant } = lireMontant(formData);
  if (!montant && formData.get("montant_libre") === null) return;

  db.prepare(
    `UPDATE types_taxe SET nom = ?, description = ?, montant_fixe = ?, montant_libre = ?
     WHERE id = ? AND mairie_id = ? AND actif = 1`,
  ).run(nom, description || null, montant, montant === null ? 1 : 0, id, mairieId);

  revalidatePath("/admin/types-taxe");
  revalidatePath("/agent");
}

/**
 * Enregistre la liste des agents confiés d'un type de taxe donné : seuls ces
 * agents verront ce type dans leur application. Remplace la sélection précédente.
 */
export async function enregistrerAgentsType(
  _etatPrecedent: EtatAffectationType,
  formData: FormData,
): Promise<EtatAffectationType> {
  const { mairieId } = await exigerMairie("admin");

  const typeId = Number(formData.get("type_taxe_id"));
  const type = db
    .prepare<[number, number], { id: number; nom: string }>(
      "SELECT id, nom FROM types_taxe WHERE id = ? AND mairie_id = ? AND actif = 1",
    )
    .get(typeId, mairieId);
  if (!type) return { erreur: "Type de taxe introuvable." };

  const ids = formData
    .getAll("agents")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));

  db.transaction(() => {
    // On ne retire que les affectations des agents de CETTE mairie.
    db.prepare(
      `DELETE FROM affectations_types_taxe
       WHERE type_taxe_id = ?
         AND agent_id IN (SELECT id FROM agents WHERE mairie_id = ? AND role = 'agent')`,
    ).run(typeId, mairieId);

    const insere = db.prepare(
      "INSERT OR IGNORE INTO affectations_types_taxe (agent_id, type_taxe_id) VALUES (?, ?)",
    );
    for (const idAgent of ids) {
      const a = db
        .prepare<[number, number], { id: number }>(
          "SELECT id FROM agents WHERE id = ? AND mairie_id = ? AND role = 'agent' AND actif = 1",
        )
        .get(idAgent, mairieId);
      if (a) insere.run(idAgent, typeId);
    }
  })();

  revalidatePath("/admin/types-taxe");
  revalidatePath("/admin/agents");
  revalidatePath("/agent");
  return {
    succes:
      ids.length === 0
        ? `« ${type.nom} » retiré à tous vos agents.`
        : `« ${type.nom} » confié à ${ids.length} agent${ids.length > 1 ? "s" : ""}.`,
  };
}

export async function supprimerTypeTaxe(formData: FormData): Promise<void> {
  const { mairieId } = await exigerMairie("admin");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  // Un type déjà utilisé par des encaissements est conservé (historique,
  // reçus) mais désactivé : il disparaît simplement des listes.
  const utilise = db
    .prepare<[number], { id: number }>(
      "SELECT id FROM paiements WHERE type_taxe_id = ? LIMIT 1",
    )
    .get(id);

  if (utilise) {
    db.prepare("UPDATE types_taxe SET actif = 0 WHERE id = ? AND mairie_id = ?").run(
      id,
      mairieId,
    );
  } else {
    db.prepare("DELETE FROM types_taxe WHERE id = ? AND mairie_id = ?").run(id, mairieId);
  }

  revalidatePath("/admin/types-taxe");
  revalidatePath("/agent");
}

/**
 * Enregistre la liste des types de taxes confiés à un agent : l'application
 * agent n'affiche plus QUE ces types. Remplace l'affectation précédente.
 */
export async function enregistrerTypesAgent(formData: FormData): Promise<void> {
  const { mairieId } = await exigerMairie("admin");

  const agentId = Number(formData.get("agent_id"));
  const agent = db
    .prepare<[number, number], { id: number; role: string }>(
      "SELECT id, role FROM agents WHERE id = ? AND mairie_id = ? AND actif = 1",
    )
    .get(agentId, mairieId);
  if (!agent || agent.role !== "agent") return;

  const ids = formData
    .getAll("types")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));

  db.transaction(() => {
    db.prepare("DELETE FROM affectations_types_taxe WHERE agent_id = ?").run(agentId);
    const insere = db.prepare(
      "INSERT OR IGNORE INTO affectations_types_taxe (agent_id, type_taxe_id) VALUES (?, ?)",
    );
    for (const id of ids) {
      // Seuls les types réellement actifs de LA mairie de l'agent sont acceptés.
      const t = db
        .prepare<[number, number], { id: number }>(
          "SELECT id FROM types_taxe WHERE id = ? AND mairie_id = ? AND actif = 1",
        )
        .get(id, mairieId);
      if (t) insere.run(agentId, id);
    }
  })();

  revalidatePath(`/admin/agents/${agentId}`);
  revalidatePath("/admin/agents");
  revalidatePath("/agent");
}
