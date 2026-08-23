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
