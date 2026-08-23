import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  preparerBase,
  peuplerDonneesDemo,
} from "../../scripts/demo-data.mjs";

const DATA_DIR = path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "app.db"));
db.pragma("journal_mode = WAL");
// Plusieurs processus peuvent initialiser la base en même temps (workers
// de build, redémarrages) : on attend notre tour plutôt que d'échouer.
db.pragma("busy_timeout = 15000");
db.pragma("foreign_keys = ON");

preparerBase(db);

// Hébergement neuf (ou disque éphémère remis à zéro) : la base créée par
// les migrations ne contient aucun compte. On l'amorce alors avec les
// données de démonstration pour que l'application soit immédiatement
// utilisable après chaque démarrage. Transaction IMMEDIATE : si deux
// processus amorcent simultanément, le second voit une base déjà remplie
// et passe son chemin.
db.transaction(() => {
  const nb = (table: string): number =>
    (
      db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
        n: number;
      }
    ).n;

  if (
    nb("agents") > 0 ||
    nb("super_administrateurs") > 0 ||
    nb("contribuables") > 0 ||
    nb("types_taxe") > 0
  ) {
    return;
  }
  console.log("[munitax] base vierge : amorçage des données de démonstration");
  peuplerDonneesDemo(db);
}).immediate();

export type Role = "admin" | "agent" | "contribuable" | "super_admin";

export type SuperAdminRow = {
  id: number;
  identifiant: string;
  mot_de_passe: string;
  nom_complet: string;
};

export type StatutMairie = "active" | "suspendue" | "en_attente";

export type MairieRow = {
  id: number;
  nom: string;
  statut: StatutMairie;
  date_echeance_abonnement: number | null;
  responsable: string | null;
  contact: string | null;
  cree_le: number;
};

export type AgentRow = {
  id: number;
  nom_complet: string;
  telephone: string | null;
  identifiant: string;
  mot_de_passe: string;
  role: "agent" | "admin";
  mairie_id: number | null;
  doit_changer_mdp: number;
};

export type ContribuableRow = {
  id: number;
  code: string | null;
  nom_complet: string;
  telephone: string | null;
  email: string | null;
  mot_de_passe: string;
  mairie_id: number;
};

export type TypeTaxeRow = {
  id: number;
  nom: string;
  description: string | null;
  montant_fixe: number | null;
  montant_libre: number;
  mairie_id: number;
  actif: number;
};

export type OperateurMobile =
  | "wave"
  | "orange_money"
  | "moov_money"
  | "mtn_money";

export type MoyenPaiement = "cash" | OperateurMobile;

export type PaiementRow = {
  id: number;
  reference: string | null;
  mairie_id: number;
  agent_id: number | null;
  contribuable_id: number | null;
  type_taxe_id: number;
  montant: number;
  commercant: string;
  date_heure: number;
  latitude: number | null;
  longitude: number | null;
  statut: "valide" | "annule";
  mode: "terrain" | "en_ligne";
  moyen_paiement: MoyenPaiement;
  reference_mobile: string | null;
  uuid_client: string | null;
  operateur: string | null;
};

export default db;
