import db from "@/lib/db";
import type { MoyenPaiement, OperateurMobile } from "@/lib/db";

/**
 * Moyens de paiement mobile money. Un opérateur n'est disponible pour les
 * agents d'une mairie que si l'administrateur y a enregistré une clé API
 * (table mairies_moyens_paiement). Tant que la mairie n'a pas de compte
 * marchand chez l'opérateur, le paiement est SIMULÉ (aucun débit réel) :
 * la vraie passerelle se branchera sur ces mêmes clés plus tard.
 */
export const OPERATEURS: {
  code: OperateurMobile;
  nom: string;
  prefixe: string;
}[] = [
  { code: "wave", nom: "Wave", prefixe: "WV" },
  { code: "orange_money", nom: "Orange Money", prefixe: "OM" },
  { code: "moov_money", nom: "Moov Money", prefixe: "MV" },
  { code: "mtn_money", nom: "MTN Money", prefixe: "MTN" },
];

export function estOperateur(v: unknown): v is OperateurMobile {
  return OPERATEURS.some((o) => o.code === v);
}

/** Libellé affichable d'un moyen de paiement stocké en base. */
export function libelleMoyen(moyen: string): string {
  if (moyen === "cash") return "Espèces";
  return OPERATEURS.find((o) => o.code === moyen)?.nom ?? moyen;
}

export function estMobile(moyen: string): boolean {
  return moyen !== "cash";
}

/** Opérateurs activés pour une mairie (clé API renseignée par son admin). */
export function operateursActifs(mairieId: number): OperateurMobile[] {
  const lignes = db
    .prepare<[number], { operateur: OperateurMobile }>(
      `SELECT operateur FROM mairies_moyens_paiement WHERE mairie_id = ?`,
    )
    .all(mairieId);
  return lignes.map((l) => l.operateur).filter(estOperateur);
}

export function estOperateurActif(
  mairieId: number,
  operateur: string,
): boolean {
  return (
    db
      .prepare<[number, string], { n: number }>(
        "SELECT COUNT(*) AS n FROM mairies_moyens_paiement WHERE mairie_id = ? AND operateur = ?",
      )
      .get(mairieId, operateur)!.n > 0
  );
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Référence d'une demande mobile money simulée (ex : WV-7KQ2M8XZ).
 * Le contribuable peut s'y référer ; en production elle sera remplacée par
 * l'identifiant renvoyé par la passerelle de l'opérateur.
 */
export function genererReferenceMobile(operateur: OperateurMobile): string {
  const prefixe =
    OPERATEURS.find((o) => o.code === operateur)?.prefixe ?? "MM";
  for (;;) {
    let suite = "";
    for (let i = 0; i < 8; i++) {
      suite += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    const ref = `${prefixe}-${suite}`;
    const existe = db
      .prepare<[string], { n: number }>(
        "SELECT COUNT(*) AS n FROM paiements WHERE reference_mobile = ?",
      )
      .get(ref)!.n;
    if (!existe) return ref;
  }
}

/** Masque une clé API pour l'affichage : ••••1234 */
export function masquerCle(cle: string): string {
  if (cle.length <= 4) return "••••";
  return `••••${cle.slice(-4)}`;
}

export type LigneMoyen = { moyen: MoyenPaiement; nb: number; total: number };

/** Répartition des paiements validés d'une mairie par moyen de paiement. */
export function repartitionParMoyen(
  mairieId: number,
  debut: number,
  fin: number,
): LigneMoyen[] {
  return db
    .prepare<[number, number, number], { moyen_paiement: MoyenPaiement; nb: number; total: number }>(
      `SELECT p.moyen_paiement, COUNT(*) AS nb, SUM(p.montant) AS total
       FROM paiements p
       WHERE p.statut = 'valide' AND p.mairie_id = ? AND p.date_heure >= ? AND p.date_heure < ?
       GROUP BY p.moyen_paiement ORDER BY total DESC`,
    )
    .all(mairieId, debut, fin)
    .map((l) => ({ moyen: l.moyen_paiement, nb: l.nb, total: l.total }));
}
