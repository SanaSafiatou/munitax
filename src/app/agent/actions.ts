"use server";

import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import {
  estOperateur,
  estOperateurActif,
  genererReferenceMobile,
  libelleMoyen,
} from "@/lib/moyens-paiement";

export type EtatPaiement = { erreur?: string; recuId?: number };

export type ContribuableChoisi = {
  id: number;
  code: string;
  nom_complet: string;
  telephone: string | null;
};

/** Recherche des contribuables de la mairie par code (MT-…) ou nom. */
export async function rechercherContribuables(
  requete: string,
): Promise<ContribuableChoisi[]> {
  const session = await exigerMairie("agent");
  const q = requete.trim();
  if (q.length < 2) return [];

  const motif = `%${q}%`;
  return db
    .prepare<[number, string, string], ContribuableChoisi>(
      `SELECT id, code, nom_complet, telephone
       FROM contribuables
       WHERE mairie_id = ? AND actif = 1 AND (code LIKE ? OR nom_complet LIKE ?)
       ORDER BY nom_complet LIMIT 8`,
    )
    .all(session.mairieId, motif, motif);
}

export type EtatCreationContribuable = {
  erreur?: string;
  contribuable?: ContribuableChoisi;
};

/**
 * Création d'une fiche contribuable sur le terrain : le nom suffit,
 * le téléphone est facultatif. Un code unique (MT-000042) est généré.
 */
export async function creerContribuable(
  _etatPrecedent: EtatCreationContribuable,
  formData: FormData,
): Promise<EtatCreationContribuable> {
  const session = await exigerMairie("agent");

  const nomComplet = String(formData.get("nom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();

  if (nomComplet.length < 3) {
    return { erreur: "Veuillez indiquer le nom du contribuable." };
  }

  const info = db
    .prepare(
      `INSERT INTO contribuables (code, nom_complet, telephone, mot_de_passe,
                                  mairie_id, actif, cree_le)
       VALUES (NULL, ?, ?, '', ?, 1, ?)`,
    )
    .run(nomComplet, telephone || null, session.mairieId, Date.now());
  const id = Number(info.lastInsertRowid);
  const code = `MT-${String(id).padStart(6, "0")}`;
  db.prepare("UPDATE contribuables SET code = ? WHERE id = ?").run(code, id);

  return {
    contribuable: { id, code, nom_complet: nomComplet, telephone: telephone || null },
  };
}

export async function enregistrerPaiement(
  _etatPrecedent: EtatPaiement,
  formData: FormData,
): Promise<EtatPaiement> {
  const session = await exigerMairie("agent");

  const typeId = Number(formData.get("type_taxe_id"));
  const contribuableId = Number(formData.get("contribuable_id"));
  const commercant = String(formData.get("commercant") ?? "").trim();
  const montant = Number(formData.get("montant"));
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));

  // Le type de taxe doit appartenir à la mairie de l'agent.
  const type = db
    .prepare<[number, number], { id: number; montant_fixe: number | null; montant_libre: number }>(
      "SELECT id, montant_fixe, montant_libre FROM types_taxe WHERE id = ? AND mairie_id = ? AND actif = 1",
    )
    .get(typeId, session.mairieId);
  if (!type) return { erreur: "Type de taxe invalide." };

  // Le contribuable doit appartenir à la même mairie que l'agent.
  const contribuable = db
    .prepare<[number, number], { id: number; nom_complet: string }>(
      "SELECT id, nom_complet FROM contribuables WHERE id = ? AND mairie_id = ? AND actif = 1",
    )
    .get(contribuableId, session.mairieId);
  if (!contribuable) {
    return { erreur: "Veuillez sélectionner le contribuable concerné." };
  }
  if (!Number.isFinite(montant) || montant <= 0)
    return { erreur: "Veuillez saisir un montant valide." };

  // Moyen de paiement : « cash » ou un opérateur mobile activé pour CETTE
  // mairie (jamais confiance au client : on revérifie en base).
  const moyenBrut = String(formData.get("moyen") ?? "cash").trim();
  const operateurBrut = String(formData.get("operateur") ?? "").trim();

  let moyenPaiement: "cash" | string = "cash";
  let referenceMobile: string | null = null;

  if (moyenBrut === "mobile") {
    if (!estOperateur(operateurBrut)) {
      return { erreur: "Opérateur de paiement mobile invalide." };
    }
    if (!estOperateurActif(session.mairieId, operateurBrut)) {
      return {
        erreur: `${libelleMoyen(operateurBrut)} n'est pas activé pour votre mairie. Demandez à l'administrateur d'enregistrer la clé API.`,
      };
    }
    moyenPaiement = operateurBrut;
    // Mode démonstration : la demande est considérée acceptée immédiatement.
    // En production, c'est ici qu'on appellera la passerelle de l'opérateur
    // avec la clé API de la mairie et qu'on attendra sa confirmation.
    referenceMobile = genererReferenceMobile(operateurBrut);
  } else if (moyenBrut !== "cash") {
    return { erreur: "Moyen de paiement inconnu." };
  }

  // Identifiant généré hors ligne (facultatif) : la clé unique partielle rend
  // la synchronisation idempotente — un doublon renvoie le reçu initial.
  const uuidClient = String(formData.get("uuid_client") ?? "").trim() || null;

  const info = db
    .prepare(
      `INSERT INTO paiements (mairie_id, agent_id, contribuable_id, type_taxe_id,
                             montant, commercant, date_heure, latitude, longitude,
                             statut, mode, moyen_paiement, reference_mobile, uuid_client)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'valide', 'terrain', ?, ?, ?)
       ON CONFLICT (uuid_client) WHERE uuid_client IS NOT NULL DO NOTHING`,
    )
    .run(
      session.mairieId,
      session.id,
      contribuable.id,
      type.id,
      Math.round(montant),
      commercant || contribuable.nom_complet,
      Date.now(),
      Number.isFinite(latitude) && latitude !== 0 ? latitude : null,
      Number.isFinite(longitude) && longitude !== 0 ? longitude : null,
      moyenPaiement,
      referenceMobile,
      uuidClient,
    );

  // Si l'insertion a été ignorée (doublon hors ligne déjà synchronisé),
  // lastInsertRowid n'est pas fiable : on relit le reçu par son uuid.
  let id = info.changes > 0 ? Number(info.lastInsertRowid) : 0;
  if (!id && uuidClient) {
    id = Number(
      db
        .prepare<[string], { id: number }>(
          "SELECT id FROM paiements WHERE uuid_client = ?",
        )
        .get(uuidClient)?.id ?? 0,
    );
  }
  if (!id) {
    return { erreur: "Ce paiement a déjà été enregistré." };
  }

  const dateStrLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "Africa/Douala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  db.prepare("UPDATE paiements SET reference = ? WHERE id = ?").run(
    `REC-${dateStrLocal.replaceAll("-", "")}-${String(id).padStart(4, "0")}`,
    id,
  );

  // Pas de redirection : le formulaire doit fonctionner hors ligne (file
  // d'attente locale) et afficher le reçu sans quitter la page.
  return { recuId: id };
}
