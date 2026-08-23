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
