"use server";

import { redirect } from "next/navigation";
import db from "@/lib/db";
import {
  accueilPourRole,
  creerSession,
  detruireSession,
  getSession,
  normaliserTelephone,
  verifierIdentifiants,
} from "@/lib/auth";
import { hashSync } from "bcryptjs";
import { genererIdentifiant, genererMotDePasse } from "@/lib/comptes";

export type EtatConnexion = { erreur?: string };

export type EtatInscriptionMairie = {
  erreur?: string;
  succes?: string;
  identifiants?: { identifiant: string; motDePasse: string; mairie: string };
};

/**
 * Inscription publique d'une mairie : la mairie est créée au statut
 * « en_attente » avec un compte administrateur dont les identifiants sont
 * affichés une seule fois. L'accès reste bloqué jusqu'à l'approbation du
 * propriétaire de l'application.
 */
export async function inscrireMairie(
  _etatPrecedent: EtatInscriptionMairie,
  formData: FormData,
): Promise<EtatInscriptionMairie> {
  const nom = String(formData.get("nom") ?? "").trim();
  const responsable = String(formData.get("responsable") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();

  if (nom.length < 2) {
    return { erreur: "Veuillez indiquer le nom de la mairie." };
  }

  const existe = db
    .prepare<[string], { id: number }>(
      "SELECT id FROM mairies WHERE nom = ? COLLATE NOCASE",
    )
    .get(nom);
  if (existe) {
    return { erreur: `La mairie « ${nom} » est déjà enregistrée.` };
  }

  const mairie = db
    .prepare(
      `INSERT INTO mairies (nom, statut, responsable, contact, cree_le)
       VALUES (?, 'en_attente', ?, ?, ?)`,
    )
    .run(nom, responsable || null, contact || null, Date.now());
  const mairieId = Number(mairie.lastInsertRowid);

  // Le formulaire public ne demande plus le nom de l'administrateur : le
  // compte est généré automatiquement au nom de la mairie.
  const adminNom = `Administrateur de ${nom}`;
  const identifiant = genererIdentifiant(adminNom, nom);
  const motDePasse = genererMotDePasse();
  db.prepare(
    `INSERT INTO agents (nom_complet, identifiant, mot_de_passe, role,
                         mairie_id, doit_changer_mdp, actif, cree_le)
     VALUES (?, ?, ?, 'admin', ?, 1, 1, ?)`,
  ).run(adminNom, identifiant, hashSync(motDePasse, 10), mairieId, Date.now());

  return {
    succes: `Demande enregistrée pour la mairie de ${nom}. L'équipe MuniTax va l'examiner : vous recevrez l'accès dès son activation.`,
    identifiants: { identifiant, motDePasse, mairie: nom },
  };
}

export async function seConnecter(
  _etatPrecedent: EtatConnexion,
  formData: FormData,
): Promise<EtatConnexion> {
  // Aucune connexion « en un clic » : chaque profil, y compris le
  // super-administrateur, doit saisir ses propres identifiants.
  const identifiant = String(formData.get("identifiant") ?? "").trim();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");

  if (!identifiant || !motDePasse) {
    return { erreur: "Veuillez saisir votre identifiant et votre mot de passe." };
  }

  const resultat = await verifierIdentifiants(identifiant, motDePasse);
  if (!resultat) {
    return { erreur: "Identifiant ou mot de passe incorrect." };
  }
  if (!resultat.ok) {
    return {
      erreur:
        resultat.raison === "suspendue"
          ? "Accès suspendu, veuillez contacter le support."
          : "Votre mairie est enregistrée mais encore en attente d'approbation par l'équipe MuniTax. Vous recevrez l'accès dès son activation.",
    };
  }

  const { role, compte } = resultat;
  const identifiantCompte =
    "identifiant" in compte ? compte.identifiant : compte.telephone;
  await creerSession({
    id: compte.id,
    nom_complet: compte.nom_complet,
    identifiant: identifiantCompte ?? "",
    role,
    mairieId: "mairie_id" in compte ? compte.mairie_id : null,
  });

  // Un compte temporaire créé par l'administration doit changer son mot de
  // passe dès la première connexion.
  if ((role === "agent" || role === "admin") && "doit_changer_mdp" in compte && compte.doit_changer_mdp) {
    redirect("/changer-mdp");
  }
  redirect(accueilPourRole(role));
}

export type EtatChangementMdp = { erreur?: string };

/** Premier changement du mot de passe temporaire (agent ou admin). */
export async function changerMotDePasseInitial(
  _etatPrecedent: EtatChangementMdp,
  formData: FormData,
): Promise<EtatChangementMdp> {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "agent" && session.role !== "admin")
  ) {
    return { erreur: "Session invalide. Reconnectez-vous." };
  }

  const nouveau = String(formData.get("nouveau") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (nouveau.length < 6) {
    return { erreur: "Le mot de passe doit contenir au moins 6 caractères." };
  }
  if (nouveau !== confirmation) {
    return { erreur: "Les deux mots de passe ne correspondent pas." };
  }

  db.prepare(
    "UPDATE agents SET mot_de_passe = ?, doit_changer_mdp = 0 WHERE id = ?",
  ).run(hashSync(nouveau, 10), session.id);

  redirect(accueilPourRole(session.role));
}

export type EtatInscription = { erreur?: string };

export async function creerCompteTesteur(
  _etatPrecedent: EtatInscription,
  formData: FormData,
): Promise<EtatInscription> {
  const nomComplet = String(formData.get("nom_complet") ?? "").trim();
  const telephoneSaisi = String(formData.get("telephone") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const mairieId = Number(formData.get("mairie_id"));

  if (nomComplet.length < 3) {
    return { erreur: "Veuillez indiquer votre nom complet." };
  }
  const mairieExiste = db
    .prepare<[number], { id: number }>("SELECT id FROM mairies WHERE id = ?")
    .get(mairieId);
  if (!mairieExiste) {
    return { erreur: "Veuillez choisir votre mairie." };
  }
  const telephone = normaliserTelephone(telephoneSaisi);
  if (telephone.length < 8 || telephone.length > 15) {
    return {
      erreur:
        "Numéro de téléphone invalide. Exemple : 690 12 34 56 ou +237 690 12 34 56.",
    };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { erreur: "Adresse e-mail invalide (ou laissez le champ vide)." };
  }
  if (motDePasse.length < 6) {
    return {
      erreur: "Le mot de passe doit contenir au moins 6 caractères.",
    };
  }
  if (motDePasse !== confirmation) {
    return { erreur: "Les deux mots de passe ne correspondent pas." };
  }

  // Le numéro sert d'identifiant de connexion : il doit rester unique parmi
  // les comptes en ligne actifs.
  const pris = db
    .prepare<[string], { id: number; mairie_id: number }>(
      "SELECT id, mairie_id FROM contribuables WHERE telephone = ? AND mot_de_passe != '' AND actif = 1",
    )
    .get(telephone);
  if (pris) {
    return {
      erreur:
        "Un compte existe déjà avec ce numéro. Connectez-vous ou utilisez un autre numéro.",
    };
  }

  const info = db
    .prepare(
      `INSERT INTO contribuables (code, nom_complet, telephone, email, mot_de_passe,
                                  mairie_id, actif, cree_le)
       VALUES (NULL, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(nomComplet, telephone, email || null, hashSync(motDePasse, 10), mairieId, Date.now());
  const id = Number(info.lastInsertRowid);
  db.prepare("UPDATE contribuables SET code = ? WHERE id = ?").run(
    `MT-${String(id).padStart(6, "0")}`,
    id,
  );

  await creerSession({
    id,
    nom_complet: nomComplet,
    identifiant: telephone,
    role: "contribuable",
    mairieId,
  });
  redirect("/contribuable");
}

export async function seDeconnecter(): Promise<void> {
  await detruireSession();
  redirect("/login");
}
