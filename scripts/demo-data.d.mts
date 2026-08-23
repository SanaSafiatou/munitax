export declare const SCHEMA_SQL: string;
export declare function preparerBase(db: unknown): void;
export declare function cheminBase(): string;
export interface OptionsDemo {
  journal?: boolean;
}
export declare function reinitialiserDonneesDemo(options?: OptionsDemo): void;

/**
 * Remplit UNE connexion better-sqlite3 déjà migrée avec les données de
 * démonstration complètes (comptes, taxes, historique).
 */
export declare function peuplerDonneesDemo(db: unknown): void;

/**
 * Amorçage minimal d'une base hébergée vierge : crée uniquement le compte
 * super-administrateur (identifiant « super », mot de passe « super123 »).
 */
export declare function amorcerBaseNeuve(db: unknown): void;
