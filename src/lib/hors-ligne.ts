/**
 * File d'attente locale (localStorage) des paiements saisis hors ligne.
 * Côté client uniquement : le serveur ne lit jamais ces données.
 */

export type PaiementEnAttente = {
  /** Identifiant unique généré sur l'appareil (déduplication côté serveur). */
  uuid: string;
  dateHeure: number;
  nomTaxe: string;
  contribuableNom: string;
  contribuableCode: string | null;
  montant: number;
  moyenLabel: string;
  /** Champs bruts à renvoyer au serveur lors de la synchronisation. */
  champs: Record<string, string>;
};

const CLE = "munitax_file_paiements";

/** Événement diffusé après chaque changement de la file (même onglet). */
export const EVENEMENT_FILE = "munitax-file-maj";

export function lireFile(): PaiementEnAttente[] {
  try {
    const brut = localStorage.getItem(CLE);
    const liste = brut ? (JSON.parse(brut) as PaiementEnAttente[]) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

export function ecrireFile(items: PaiementEnAttente[]): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(items));
  } catch {
    /* stockage plein ou indisponible : la saisie en ligne reste possible */
  }
  window.dispatchEvent(new Event(EVENEMENT_FILE));
}

export function ajouterALaFile(item: PaiementEnAttente): void {
  ecrireFile([...lireFile(), item]);
}

export function retirerDeLaFile(uuid: string): void {
  ecrireFile(lireFile().filter((p) => p.uuid !== uuid));
}
