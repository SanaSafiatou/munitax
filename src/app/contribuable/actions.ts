"use server";

import { redirect } from "next/navigation";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";

export type EtatPaiementDemo = { erreur?: string };

const OPERATEUR_DEMO = "Paiement de démonstration";

/** Petite pause pour rendre la simulation de paiement réaliste. */
function attendre(ms: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms));
}

export async function simulerPaiementEnLigne(
  _etatPrecedent: EtatPaiementDemo,
  formData: FormData,
): Promise<EtatPaiementDemo> {
  const session = await exigerMairie("contribuable");
  if (session.mairieId == null) {
    return { erreur: "Aucune mairie rattachée à ce compte." };
  }

  const typeId = Number(formData.get("type_taxe_id"));
  const montant = Number(formData.get("montant"));

  // Le type de taxe doit appartenir à la mairie du contribuable.
  const type = db
    .prepare<[number, number], { id: number; montant_fixe: number | null; montant_libre: number }>(
      "SELECT id, montant_fixe, montant_libre FROM types_taxe WHERE id = ? AND mairie_id = ? AND actif = 1",
    )
    .get(typeId, session.mairieId);
  if (!type) return { erreur: "Type de taxe invalide." };
  if (!Number.isFinite(montant) || montant <= 0) {
    return { erreur: "Veuillez saisir un montant valide." };
  }

  // Simulation du traitement du paiement (aucun opérateur réel n'est contacté).
  await attendre(900);

  const info = db
    .prepare(
      `INSERT INTO paiements (mairie_id, contribuable_id, type_taxe_id, montant, commercant,
                              date_heure, statut, mode, operateur)
       VALUES (?, ?, ?, ?, ?, ?, 'valide', 'en_ligne', ?)`,
    )
    .run(session.mairieId, session.id, type.id, Math.round(montant), session.nom, Date.now(), OPERATEUR_DEMO);

  const id = Number(info.lastInsertRowid);
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

  redirect(`/recu/${id}`);
}
