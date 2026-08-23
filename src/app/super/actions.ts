"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import {
  creerSession,
  exigerRole,
  nomMairie,
} from "@/lib/auth";
import { genererIdentifiant, genererMotDePasse } from "@/lib/comptes";
import { hashSync } from "bcryptjs";

export type EtatCreationMairie = {
  erreur?: string;
  succes?: string;
};

/** Ajoute une nouvelle mairie active, avec échéance d'abonnement facultative. */
export async function ajouterMairie(
  _etatPrecedent: EtatCreationMairie,
  formData: FormData,
): Promise<EtatCreationMairie> {
  await exigerRole("super_admin");
  const nom = String(formData.get("nom") ?? "").trim();

  if (nom.length < 2) {
    return { erreur: "Veuillez saisir le nom de la mairie." };
  }

  const echeanceBrute = String(formData.get("date_echeance") ?? "").trim();
  let echeance: number | null = null;
  if (echeanceBrute) {
    const t = new Date(`${echeanceBrute}T12:00:00`).getTime();
    if (!Number.isFinite(t)) {
      return { erreur: "Date d'échéance invalide." };
    }
    if (t <= Date.now()) {
      return { erreur: "La date d'échéance doit être dans le futur." };
    }
    echeance = t;
  }

  const existe = db
    .prepare<[string], { id: number }>(
      "SELECT id FROM mairies WHERE nom = ? COLLATE NOCASE",
    )
    .get(nom);
  if (existe) {
    return { erreur: `La mairie « ${nom} » existe déjà.` };
  }

  db.prepare(
    `INSERT INTO mairies (nom, statut, date_echeance_abonnement, cree_le)
     VALUES (?, 'active', ?, ?)`,
  ).run(nom, echeance, Date.now());
  revalidatePath("/super");

  return {
    succes: `Mairie « ${nom} » créée. Vous pouvez maintenant y créer un compte administrateur.`,
  };
}

export type EtatCreationAdmin = {
  erreur?: string;
  compteCree?: {
    nomComplet: string;
    mairie: string;
    identifiant: string;
    motDePasse: string;
  };
};

/** Crée le compte administrateur d'une mairie ; identifiants générés. */
export async function creerAdminMairie(
  _etatPrecedent: EtatCreationAdmin,
  formData: FormData,
): Promise<EtatCreationAdmin> {
  await exigerRole("super_admin");
  const nomComplet = String(formData.get("nom_complet") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();
  const mairieId = Number(formData.get("mairie_id"));

  if (nomComplet.length < 3) {
    return { erreur: "Veuillez indiquer le nom complet de l'administrateur." };
  }
  const mairie = db
    .prepare<[number], { id: number; nom: string }>(
      "SELECT id, nom FROM mairies WHERE id = ?",
    )
    .get(mairieId);
  if (!mairie) {
    return { erreur: "Veuillez choisir la mairie à administrer." };
  }

  const identifiant = genererIdentifiant(nomComplet, mairie.nom);
  const motDePasse = genererMotDePasse();

  db.prepare(
    `INSERT INTO agents (nom_complet, telephone, identifiant, mot_de_passe, role,
                         mairie_id, doit_changer_mdp, actif, cree_le)
     VALUES (?, ?, ?, ?, 'admin', ?, 1, 1, ?)`,
  ).run(
    nomComplet,
    telephone || null,
    identifiant,
    hashSync(motDePasse, 10),
    mairie.id,
    Date.now(),
  );
  revalidatePath("/super");

  return {
    compteCree: {
      nomComplet,
      mairie: nomMairie(mairie.id),
      identifiant,
      motDePasse,
    },
  };
}

export type EtatActionMairie = {
  erreur?: string;
  succes?: string;
};

/**
 * Approuve, suspend ou réactive une mairie. Une mairie suspendue (ou en
 * attente) voit tous ses comptes bloqués immédiatement, sans suppression
 * de données ; la réactivation rétablit l'accès tel quel.
 */
export async function changerStatutMairie(
  _etatPrecedent: EtatActionMairie,
  formData: FormData,
): Promise<EtatActionMairie> {
  await exigerRole("super_admin");
  const mairieId = Number(formData.get("mairie_id"));
  const nouveauStatut = String(formData.get("nouveau_statut") ?? "");

  if (!["active", "suspendue"].includes(nouveauStatut)) {
    return { erreur: "Statut demandé invalide." };
  }
  const mairie = db
    .prepare<[number], { id: number }>("SELECT id FROM mairies WHERE id = ?")
    .get(mairieId);
  if (!mairie) {
    return { erreur: "Mairie introuvable." };
  }

  db.prepare("UPDATE mairies SET statut = ? WHERE id = ?").run(
    nouveauStatut,
    mairieId,
  );
  revalidatePath("/super");

  return {
    succes:
      nouveauStatut === "suspendue"
        ? `Mairie « ${nomMairie(mairieId)} » suspendue : ses comptes ne peuvent plus se connecter, ses données sont conservées.`
        : `Mairie « ${nomMairie(mairieId)} » active : l'accès est rétabli pour tous ses comptes.`,
  };
}

/**
 * Ouvre une session d'assistance « dans la peau » d'un administrateur de
 * mairie. Sens unique par conception : aucun retour automatique vers
 * l'espace propriétaire — il faut se déconnecter puis se reconnecter.
 */
export async function seConnecterComme(
  _etatPrecedent: EtatActionMairie,
  formData: FormData,
): Promise<EtatActionMairie> {
  await exigerRole("super_admin");
  const agentId = Number(formData.get("agent_id"));

  const agent = db
    .prepare<
      [number],
      {
        id: number;
        nom_complet: string;
        identifiant: string;
        role: "admin" | "agent";
        mairie_id: number;
        actif: number;
      }
    >(
      "SELECT id, nom_complet, identifiant, role, mairie_id, actif FROM agents WHERE id = ?",
    )
    .get(agentId);

  if (!agent || !agent.actif || agent.role !== "admin") {
    return { erreur: "Aucun administrateur actif trouvé pour cette mairie." };
  }

  await creerSession({
    id: agent.id,
    nom_complet: agent.nom_complet,
    identifiant: agent.identifiant,
    role: "admin",
    mairieId: agent.mairie_id,
    imp: true,
  });
  redirect("/admin");
}
