// Source unique du schéma et des données de démonstration.
// Utilisée par :
//   - src/lib/db.ts (création/migration du schéma au démarrage de l'app)
//   - scripts/seed.mjs (CLI : npm run seed)
//   - l'action admin « Réinitialiser les données de démonstration »
//
// Modèle multi-mairies : chaque agent, type de taxe, contribuable et paiement
// appartient à une mairie ; les requêtes sont toujours filtrées par mairie.
import Database from "better-sqlite3";
import { hashSync } from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

export const SCHEMA_SQL = `
  -- Propriétaire de l'application : table ENTIÈREMENT SÉPARÉE des comptes
  -- des mairies (agents/administrateurs). Un administrateur de mairie ne
  -- peut ni le voir, ni le rechercher, ni savoir qu'il existe.
  CREATE TABLE IF NOT EXISTS super_administrateurs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    identifiant  TEXT NOT NULL UNIQUE,
    mot_de_passe TEXT NOT NULL,
    nom_complet  TEXT NOT NULL DEFAULT 'Propriétaire',
    cree_le      INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mairies (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nom          TEXT NOT NULL UNIQUE,
    statut       TEXT NOT NULL DEFAULT 'active'
                 CHECK (statut IN ('active', 'suspendue', 'en_attente')),
    date_echeance_abonnement INTEGER,
    responsable  TEXT,
    contact      TEXT,
    cree_le      INTEGER NOT NULL
  );

  -- Clés API mobile money de chaque mairie, opérateur par opérateur.
  -- Un moyen n'est proposé aux agents que si une ligne existe pour sa mairie.
  CREATE TABLE IF NOT EXISTS mairies_moyens_paiement (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    mairie_id INTEGER NOT NULL REFERENCES mairies(id) ON DELETE CASCADE,
    operateur TEXT NOT NULL
                 CHECK (operateur IN ('wave', 'orange_money', 'moov_money', 'mtn_money')),
    cle_api   TEXT NOT NULL,
    cree_le   INTEGER NOT NULL,
    UNIQUE (mairie_id, operateur)
  );

  CREATE TABLE IF NOT EXISTS agents (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_complet      TEXT NOT NULL,
    telephone        TEXT,
    identifiant      TEXT NOT NULL UNIQUE,
    mot_de_passe     TEXT NOT NULL,
    role             TEXT NOT NULL DEFAULT 'agent'
                     CHECK (role IN ('agent', 'admin')),
    mairie_id        INTEGER NOT NULL REFERENCES mairies(id),
    doit_changer_mdp INTEGER NOT NULL DEFAULT 0,
    actif            INTEGER NOT NULL DEFAULT 1,
    cree_le          INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contribuables (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    code          TEXT UNIQUE,
    nom_complet   TEXT NOT NULL,
    telephone     TEXT,
    email         TEXT,
    mot_de_passe  TEXT NOT NULL DEFAULT '',
    mairie_id     INTEGER NOT NULL REFERENCES mairies(id),
    actif         INTEGER NOT NULL DEFAULT 1,
    cree_le       INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS types_taxe (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nom            TEXT NOT NULL,
    description    TEXT,
    montant_fixe   INTEGER,
    montant_libre  INTEGER NOT NULL DEFAULT 0,
    mairie_id      INTEGER NOT NULL REFERENCES mairies(id),
    actif          INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS paiements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reference       TEXT UNIQUE,
    mairie_id       INTEGER NOT NULL REFERENCES mairies(id),
    agent_id        INTEGER REFERENCES agents(id),
    contribuable_id INTEGER REFERENCES contribuables(id),
    type_taxe_id    INTEGER NOT NULL REFERENCES types_taxe(id),
    montant         INTEGER NOT NULL,
    commercant      TEXT NOT NULL,
    date_heure      INTEGER NOT NULL,
    latitude        REAL,
    longitude       REAL,
    statut          TEXT NOT NULL DEFAULT 'valide' CHECK (statut IN ('valide', 'annule')),
    mode            TEXT NOT NULL DEFAULT 'terrain' CHECK (mode IN ('terrain', 'en_ligne')),
    moyen_paiement  TEXT NOT NULL DEFAULT 'cash'
                    CHECK (moyen_paiement IN ('cash', 'wave', 'orange_money', 'moov_money', 'mtn_money')),
    reference_mobile TEXT,
    uuid_client     TEXT,
    operateur       TEXT
  );

  CREATE TABLE IF NOT EXISTS affectations_types_taxe (
    agent_id      INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type_taxe_id  INTEGER NOT NULL REFERENCES types_taxe(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, type_taxe_id)
  );
`;

const TZ = process.env.APP_TIMEZONE || "Africa/Douala";
const dtf = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function parts(epochMs) {
  return Object.fromEntries(
    dtf.formatToParts(new Date(epochMs)).map((x) => [x.type, x.value]),
  );
}

function dateStr(epochMs) {
  const p = parts(epochMs);
  return `${p.year}-${p.month}-${p.day}`;
}

function offsetMs(epochMs) {
  const p = parts(epochMs);
  const commeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute);
  return commeUtc - Math.floor(epochMs / 1000) * 1000;
}

function debutJournee(dateIso) {
  const [a, m, j] = dateIso.split("-").map(Number);
  const utcMidi = Date.UTC(a, m - 1, j, 12);
  return utcMidi - 12 * 3600_000 - offsetMs(utcMidi - 12 * 3600_000);
}

function colonnes(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

/**
 * Crée les tables manquantes et migre les anciennes structures
 * (schéma mono-mairie → multi-mairies) en préservant les données :
 * tout l'existant est rattaché à la première mairie.
 */
export function preparerBase(db) {
  // Transaction IMMEDIATE : plusieurs processus peuvent initialiser la
  // base simultanément (workers de build, démarrages rapprochés). Une
  // transaction différée échouerait en SQLITE_BUSY en voulant passer de
  // lecture à écriture ; ici le verrou d'écriture est pris d'entrée et les
  // concurrents patientent grâce au busy_timeout.
  const fkActif = db.pragma("foreign_keys", { simple: true });
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => migrer(db)).immediate();
  } finally {
    db.pragma(fkActif ? "foreign_keys = ON" : "foreign_keys = OFF");
  }
}

function migrer(db) {
  // Restes éventuels d'une exécution interrompue.
  db.exec(`
    DROP TABLE IF EXISTS agents_migration;
    DROP TABLE IF EXISTS paiements_migration;
    DROP TABLE IF EXISTS contribuables_migration;
    DROP TABLE IF EXISTS types_migration;
  `);
  db.exec(SCHEMA_SQL);

  // Mairie par défaut UNIQUEMENT pour reprendre des données antérieures au
  // multi-mairies (des agents déjà enregistrés sans mairie dédiée). Sur une
  // base neuve — ou sur un espace de production volontairement vide — on ne
  // crée aucune mairie fictive : le super-administrateur ajoutera les vraies.
  const dejaPeuplee =
    db.prepare("SELECT COUNT(*) AS n FROM mairies").get().n > 0 ||
    db.prepare("SELECT COUNT(*) AS n FROM agents").get().n > 0;
  let mairieDefaut = 1;
  if (!dejaPeuplee) {
    // Base neuve : pas de mairie fictive. Les insertions d'agents/types plus
    // bas dans les migrations historiques ne s'exécuteront de toute façon
    // que si des lignes héritées existent.
    mairieDefaut = 0;
  } else {
    mairieDefaut = db.prepare("SELECT MIN(id) AS id FROM mairies").get().id ?? 1;
  }

  // --- mairies : statut d'abonnement, échéance, contact (colonnes additives) -
  const colsM = colonnes(db, "mairies");
  if (!colsM.includes("statut")) {
    db.exec("ALTER TABLE mairies ADD COLUMN statut TEXT NOT NULL DEFAULT 'active'");
  }
  if (!colsM.includes("date_echeance_abonnement")) {
    db.exec("ALTER TABLE mairies ADD COLUMN date_echeance_abonnement INTEGER");
  }
  if (!colsM.includes("responsable")) {
    db.exec("ALTER TABLE mairies ADD COLUMN responsable TEXT");
  }
  if (!colsM.includes("contact")) {
    db.exec("ALTER TABLE mairies ADD COLUMN contact TEXT");
  }

  // --- agents : le rôle du propriétaire quitte la table des mairies ---------
  // L'ancien schéma rangeait le super-administrateur parmi les agents ; il
  // est désormais dans sa table dédiée et le CHECK l'exclut définitivement.
  const defAgents = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'agents'",
  ).get()?.sql ?? "";
  if (defAgents.includes("'super'")) {
    // L'ancienne table n'a pas forcément toutes les colonnes récentes.
    const colsA = colonnes(db, "agents");
    const selDcm = colsA.includes("doit_changer_mdp")
      ? "doit_changer_mdp"
      : "0";
    const selMairie = colsA.includes("mairie_id")
      ? `COALESCE(mairie_id, ${mairieDefaut})`
      : String(mairieDefaut);
    // Les éventuelles lignes du propriétaire migrent d'abord vers sa table.
    db.exec(`
      INSERT OR IGNORE INTO super_administrateurs (identifiant, mot_de_passe, nom_complet, cree_le)
      SELECT identifiant, mot_de_passe, nom_complet, cree_le FROM agents WHERE role = 'super';
      DELETE FROM agents WHERE role = 'super';
      CREATE TABLE agents_migration (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        nom_complet      TEXT NOT NULL,
        telephone        TEXT,
        identifiant      TEXT NOT NULL UNIQUE,
        mot_de_passe     TEXT NOT NULL,
        role             TEXT NOT NULL DEFAULT 'agent'
                         CHECK (role IN ('agent', 'admin')),
        mairie_id        INTEGER NOT NULL REFERENCES mairies(id),
        doit_changer_mdp INTEGER NOT NULL DEFAULT 0,
        actif            INTEGER NOT NULL DEFAULT 1,
        cree_le          INTEGER NOT NULL
      );
      INSERT INTO agents_migration
        (id, nom_complet, telephone, identifiant, mot_de_passe, role,
         mairie_id, doit_changer_mdp, actif, cree_le)
      SELECT id, nom_complet, telephone, identifiant, mot_de_passe, role,
             ${selMairie}, ${selDcm}, actif, cree_le
      FROM agents;
      DROP TABLE agents;
      ALTER TABLE agents_migration RENAME TO agents;
    `);
  }
  if (!colonnes(db, "agents").includes("doit_changer_mdp")) {
    db.exec("ALTER TABLE agents ADD COLUMN doit_changer_mdp INTEGER NOT NULL DEFAULT 0");
  }

  // --- contribuables : code unique, téléphone facultatif, mairie ------------
  const colsC = colonnes(db, "contribuables");
  if (!colsC.includes("mairie_id") || !colsC.includes("code")) {
    db.exec(`
      CREATE TABLE contribuables_migration (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        code         TEXT UNIQUE,
        nom_complet  TEXT NOT NULL,
        telephone    TEXT,
        email        TEXT,
        mot_de_passe TEXT NOT NULL DEFAULT '',
        mairie_id    INTEGER NOT NULL REFERENCES mairies(id),
        actif        INTEGER NOT NULL DEFAULT 1,
        cree_le      INTEGER NOT NULL
      );
      INSERT INTO contribuables_migration
        (id, code, nom_complet, telephone, email, mot_de_passe, mairie_id, actif, cree_le)
      SELECT id, NULL, nom_complet, telephone, email, mot_de_passe, ${mairieDefaut}, actif, cree_le
      FROM contribuables;
      DROP TABLE contribuables;
      ALTER TABLE contribuables_migration RENAME TO contribuables;
      UPDATE contribuables SET code = 'MT-' || substr('00000' || id, -6)
      WHERE code IS NULL;
    `);
  }

  // --- types_taxe : rattachement à une mairie -------------------------------
  if (!colonnes(db, "types_taxe").includes("mairie_id")) {
    db.exec(`
      CREATE TABLE types_migration (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        nom            TEXT NOT NULL,
        description    TEXT,
        montant_fixe   INTEGER,
        montant_libre  INTEGER NOT NULL DEFAULT 0,
        mairie_id      INTEGER NOT NULL REFERENCES mairies(id),
        actif          INTEGER NOT NULL DEFAULT 1
      );
      INSERT INTO types_migration
        (id, nom, description, montant_fixe, montant_libre, mairie_id, actif)
      SELECT id, nom, description, montant_fixe, montant_libre, ${mairieDefaut}, actif
      FROM types_taxe;
      DROP TABLE types_taxe;
      ALTER TABLE types_migration RENAME TO types_taxe;
    `);
  }

  // --- paiements : mairie déduite de l'agent, sinon du type de taxe ---------
  const colsP = colonnes(db, "paiements");
  if (!colsP.includes("mairie_id") || !colsP.includes("moyen_paiement")) {
    // Colonnes absentes des très anciennes bases : valeurs par défaut.
    const selMoyen = colsP.includes("moyen_paiement")
      ? "COALESCE(p.moyen_paiement, 'cash')"
      : "'cash'";
    const selRefMobile = colsP.includes("reference_mobile")
      ? "p.reference_mobile"
      : "NULL";
    const selUuid = colsP.includes("uuid_client") ? "p.uuid_client" : "NULL";
    db.exec(`
      CREATE TABLE paiements_migration (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        reference       TEXT UNIQUE,
        mairie_id       INTEGER NOT NULL REFERENCES mairies(id),
        agent_id        INTEGER REFERENCES agents(id),
        contribuable_id INTEGER REFERENCES contribuables(id),
        type_taxe_id    INTEGER NOT NULL REFERENCES types_taxe(id),
        montant         INTEGER NOT NULL,
        commercant      TEXT NOT NULL,
        date_heure      INTEGER NOT NULL,
        latitude        REAL,
        longitude       REAL,
        statut          TEXT NOT NULL DEFAULT 'valide' CHECK (statut IN ('valide', 'annule')),
        mode            TEXT NOT NULL DEFAULT 'terrain' CHECK (mode IN ('terrain', 'en_ligne')),
        moyen_paiement  TEXT NOT NULL DEFAULT 'cash'
                        CHECK (moyen_paiement IN ('cash', 'wave', 'orange_money', 'moov_money', 'mtn_money')),
        reference_mobile TEXT,
        uuid_client     TEXT,
        operateur       TEXT
      );
      INSERT INTO paiements_migration
        (id, reference, mairie_id, agent_id, contribuable_id, type_taxe_id, montant,
         commercant, date_heure, latitude, longitude, statut, mode,
         moyen_paiement, reference_mobile, uuid_client, operateur)
      SELECT p.id, p.reference,
             COALESCE(a.mairie_id, t.mairie_id, ${mairieDefaut}),
             p.agent_id, p.contribuable_id, p.type_taxe_id, p.montant,
             p.commercant, p.date_heure, p.latitude, p.longitude, p.statut, p.mode,
             ${selMoyen}, ${selRefMobile}, ${selUuid}, p.operateur
      FROM paiements p
      LEFT JOIN agents a ON a.id = p.agent_id
      LEFT JOIN types_taxe t ON t.id = p.type_taxe_id;
      DROP TABLE paiements;
      ALTER TABLE paiements_migration RENAME TO paiements;
      CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(date_heure);
      CREATE INDEX IF NOT EXISTS idx_paiements_agent ON paiements(agent_id);
      CREATE INDEX IF NOT EXISTS idx_paiements_contribuable ON paiements(contribuable_id);
      CREATE INDEX IF NOT EXISTS idx_paiements_mairie ON paiements(mairie_id);
    `);
  } else {
    // Base déjà multi-mairies mais antérieure au mobile money / hors ligne.
    if (!colsP.includes("reference_mobile")) {
      db.exec("ALTER TABLE paiements ADD COLUMN reference_mobile TEXT");
    }
    if (!colsP.includes("uuid_client")) {
      db.exec("ALTER TABLE paiements ADD COLUMN uuid_client TEXT");
    }
  }

  // Codes manquants sur d'anciens contribuables créés avant la colonne code.
  db.prepare(
    "UPDATE contribuables SET code = 'MT-' || substr('00000' || id, -6) WHERE code IS NULL",
  ).run();

  // Index (créés après les migrations : les colonnes doivent exister).
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(date_heure);
    CREATE INDEX IF NOT EXISTS idx_paiements_agent ON paiements(agent_id);
    CREATE INDEX IF NOT EXISTS idx_paiements_contribuable ON paiements(contribuable_id);
    CREATE INDEX IF NOT EXISTS idx_paiements_mairie ON paiements(mairie_id);
    -- Déduplication des paiements saisis hors ligne (uuid facultatif).
    CREATE UNIQUE INDEX IF NOT EXISTS idx_paiements_uuid_client
      ON paiements(uuid_client) WHERE uuid_client IS NOT NULL;
  `);
}
export function cheminBase() {
  return path.join(process.cwd(), "data", "app.db");
}

/** Code public unique d'un contribuable : MT-000042. */
export function codeContribuable(id) {
  return `MT-${String(id).padStart(6, "0")}`;
}

/**
 * Remet la base dans un état de démonstration propre :
 * deux mairies (Béoumi et Bouaké), comptes de test et historique fictif.
 */
/**
 * Amorçage minimal d'une base hébergée vierge : crée UNIQUEMENT le compte
 * super-administrateur. Aucune mairie, aucun compte de test : l'espace
 * démarre vide et le propriétaire y crée ses vraies mairies lui-même.
 * (Pour les données de démonstration complètes, utiliser
 * `npm run seed`, qui reste disponible en local.)
 */
export function amorcerBaseNeuve(db) {
  // Les migrations insèrent une mairie fictive « Mairie principale » pour
  // reprendre d'anciennes bases ; sur une base neuve elle n'a pas de sens
  // et aucun compte ne peut encore la référencer.
  db.exec(`
    DELETE FROM mairies_moyens_paiement;
    DELETE FROM mairies;
    DELETE FROM sqlite_sequence WHERE name IN ('mairies','mairies_moyens_paiement');
  `);
  db.prepare(
    `INSERT INTO super_administrateurs (identifiant, mot_de_passe, nom_complet, cree_le)
     VALUES (?, ?, ?, ?)`,
  ).run("super", hashSync("super123", 10), "Propriétaire de l'application", Date.now());
}

export function reinitialiserDonneesDemo(options = {}) {  fs.mkdirSync(path.dirname(cheminBase()), { recursive: true });
  const db = new Database(cheminBase());
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 15000");
  db.pragma("foreign_keys = ON");
  preparerBase(db);

  if (options.journal) {
    console.log("Réinitialisation des données de démonstration...");
  }

  // Transaction : la base n'est jamais dans un état à moitié remplie,
  // même si deux processus amorcent en même temps.
  db.transaction(() => peuplerDonneesDemo(db))();

  db.close();

  if (options.journal) {
    console.log("Terminé.");
    console.log("");
    console.log("Comptes de démonstration :");
    console.log("  Super-admin    → super          / super123");
    console.log("  Admin Béoumi   → admin.beoumi   / beoumi123");
    console.log("  Admin Bouaké   → admin.bouake   / bouake123");
    console.log("  Agent Béoumi   → agent1         / agent123");
    console.log("  Agent Bouaké   → agent2         / agent123");
    console.log("  Testeur 1      → téléphone 690000001 / test1234");
    console.log("  Testeur 2      → téléphone 690000002 / test1234");
  }
}

/**
 * Remplit UNE connexion ouverte avec les données de démonstration
 * complètes. Utilisée par reinitialiserDonneesDemo et, au démarrage de
 * l'application, pour amorcer automatiquement une base hébergée vierge.
 */
export function peuplerDonneesDemo(db) {
  db.exec(`
    DELETE FROM mairies_moyens_paiement;
    DELETE FROM paiements;
    DELETE FROM sqlite_sequence WHERE name IN ('paiements','agents','contribuables','types_taxe','mairies','mairies_moyens_paiement','super_administrateurs');
    DELETE FROM agents;
    DELETE FROM contribuables;
    DELETE FROM types_taxe;
    DELETE FROM super_administrateurs;
    DELETE FROM mairies;
  `);

  const maintenant = Date.now();

  // Compte unique du PROPRIÉTAIRE de l'application — dans sa table dédiée,
  // jamais à côté des comptes des mairies.
  db.prepare(
    `INSERT INTO super_administrateurs (identifiant, mot_de_passe, nom_complet, cree_le)
     VALUES (?, ?, ?, ?)`,
  ).run("super", hashSync("super123", 10), "Propriétaire de l'application", maintenant);

  const insererMairie = db.prepare(
    `INSERT INTO mairies (nom, statut, date_echeance_abonnement, responsable, contact, cree_le)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const beoumiId = Number(insererMairie.run(
    "Béoumi", "active", maintenant + 45 * 86_400_000,
    "M. Kouassi N'Guessan", "+237 600 10 10 01", maintenant,
  ).lastInsertRowid);
  const bouakeId = Number(insererMairie.run(
    "Bouaké", "active", null, "Mme Aya Bamba", "+237 600 20 20 02", maintenant,
  ).lastInsertRowid);

  // Moyens de paiement mobile activés en mode démonstration :
  // Béoumi n'a que Wave, Bouaké a Wave et Orange Money — cela permet de
  // vérifier que chaque mairie ne propose que ses propres moyens.
  const insererCleApi = db.prepare(
    `INSERT INTO mairies_moyens_paiement (mairie_id, operateur, cle_api, cree_le)
     VALUES (?, ?, ?, ?)`,
  );
  insererCleApi.run(beoumiId, "wave", "DEMO-BEOUMI-WAVE-0001", maintenant);
  insererCleApi.run(bouakeId, "wave", "DEMO-BOUAKE-WAVE-0002", maintenant);
  insererCleApi.run(bouakeId, "orange_money", "DEMO-BOUAKE-OM-0003", maintenant);

  const insererAgent = db.prepare(
    `INSERT INTO agents (nom_complet, telephone, identifiant, mot_de_passe, role,
                         mairie_id, doit_changer_mdp, actif, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  );

  insererAgent.run(
    "Directeur Béoumi (test)", "+237 600 10 10 01", "admin.beoumi",
    hashSync("beoumi123", 10), "admin", beoumiId, 0, maintenant,
  );
  insererAgent.run(
    "Directeur Bouaké (test)", "+237 600 20 20 02", "admin.bouake",
    hashSync("bouake123", 10), "admin", bouakeId, 0, maintenant,
  );
  const agentBeoumiId = Number(insererAgent.run(
    "Jean Mbarga (test)", "+237 690 11 22 33", "agent1",
    hashSync("agent123", 10), "agent", beoumiId, 0, maintenant,
  ).lastInsertRowid);
  const agentBouakeId = Number(insererAgent.run(
    "Alice Mefo (test)", "+237 677 44 55 66", "agent2",
    hashSync("agent123", 10), "agent", bouakeId, 0, maintenant,
  ).lastInsertRowid);

  const insererContribuable = db.prepare(
    `INSERT INTO contribuables (code, nom_complet, telephone, email, mot_de_passe,
                                mairie_id, actif, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
  );

  function ajouterContribuable({ nom, telephone = null, email = null, mdp = "", mairieId }) {
    const info = insererContribuable.run(
      null, nom, telephone, email, mdp, mairieId, maintenant,
    );
    const id = Number(info.lastInsertRowid);
    db.prepare("UPDATE contribuables SET code = ? WHERE id = ?")
      .run(codeContribuable(id), id);
    return id;
  }

  const testeur1Id = ajouterContribuable({
    nom: "Clarisse Testeur (démo)", telephone: "690000001",
    email: "clarisse@demo.test", mdp: hashSync("test1234", 10), mairieId: beoumiId,
  });
  const testeur2Id = ajouterContribuable({
    nom: "Boris Testeur (démo)", telephone: "690000002",
    mdp: hashSync("test1234", 10), mairieId: beoumiId,
  });

  // Contribuables créés sur le terrain (sans compte en ligne).
  const konanId = ajouterContribuable({
    nom: "Étal 12 – Mme Ngo Bassa", telephone: "697112233", mairieId: beoumiId,
  });
  ajouterContribuable({ nom: "Étal 13 – M. Kamdem", mairieId: beoumiId });
  ajouterContribuable({ nom: "Vendeuse KG 77 – Awa Traoré", telephone: "655889900", mairieId: bouakeId });
  ajouterContribuable({ nom: "Boutique Chez Paule", mairieId: bouakeId });

  const insererType = db.prepare(
    `INSERT INTO types_taxe (nom, description, montant_fixe, montant_libre, mairie_id, actif)
     VALUES (?, ?, ?, ?, ?, 1)`,
  );
  const marcheBm = Number(insererType.run(
    "Taxe de marché", "Étal ou place au marché", 1000, 0, beoumiId,
  ).lastInsertRowid);
  const stationnementBm = Number(insererType.run(
    "Taxe de stationnement", null, 500, 0, beoumiId,
  ).lastInsertRowid);
  const occupationBm = Number(insererType.run(
    "Occupation de la voie publique", "Montant selon surface occupée", null, 1, beoumiId,
  ).lastInsertRowid);
  const marcheBk = Number(insererType.run(
    "Taxe de marché", "Étal ou place au marché (grand marché)", 1500, 0, bouakeId,
  ).lastInsertRowid);
  const stationnementBk = Number(insererType.run(
    "Taxe de stationnement", null, 500, 0, bouakeId,
  ).lastInsertRowid);
  const publiciteBk = Number(insererType.run(
    "Taxe de publicité", "Affiches et enseignes", null, 1, bouakeId,
  ).lastInsertRowid);

  const insererPaiement = db.prepare(
    `INSERT INTO paiements (reference, mairie_id, agent_id, contribuable_id, type_taxe_id,
                            montant, commercant, date_heure, latitude, longitude, statut, mode, operateur)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'valide', ?, ?)`,
  );
  const majReference = db.prepare("UPDATE paiements SET reference = ? WHERE id = ?");

  function ajouterPaiement({ mairieId, agentId, contribuableId, typeId, montant, payeur, quand, lat, lng, mode, operateur }) {
    const info = insererPaiement.run(
      mairieId, agentId ?? null, contribuableId ?? null, typeId,
      montant, payeur, quand, lat ?? null, lng ?? null,
      mode ?? "terrain", operateur ?? null,
    );
    const id = Number(info.lastInsertRowid);
    majReference.run(`REC-${dateStr(quand).replaceAll("-", "")}-${String(id).padStart(4, "0")}`, id);
  }

  const auj = dateStr(maintenant);
  const hier = dateStr(maintenant - 86_400_000);
  const avantHier = dateStr(maintenant - 2 * 86_400_000);

  // Collectes terrain Béoumi
  ajouterPaiement({ mairieId: beoumiId, agentId: agentBeoumiId, contribuableId: konanId, typeId: marcheBm, montant: 1000, payeur: "Étal 12 – Mme Ngo Bassa [TEST]", quand: debutJournee(auj) + 8 * 3600_000 + 15 * 60_000, lat: 5.4484, lng: -5.8347 });
  ajouterPaiement({ mairieId: beoumiId, agentId: agentBeoumiId, typeId: marcheBm, montant: 2000, payeur: "Étal 27 – Mme Ebanda [TEST]", quand: debutJournee(hier) + 8 * 3600_000, lat: 5.4484, lng: -5.8347 });
  ajouterPaiement({ mairieId: beoumiId, agentId: agentBeoumiId, typeId: occupationBm, montant: 5000, payeur: "Boutique rivière [TEST]", quand: debutJournee(avantHier) + 9 * 3600_000, lat: 5.45, lng: -5.83 });

  // Collectes terrain Bouaké
  ajouterPaiement({ mairieId: bouakeId, agentId: agentBouakeId, typeId: stationnementBk, montant: 500, payeur: "Véhicule TX-4523-A [TEST]", quand: debutJournee(auj) + 8 * 3600_000 + 55 * 60_000, lat: 7.6906, lng: -5.0331 });
  ajouterPaiement({ mairieId: bouakeId, agentId: agentBouakeId, typeId: publiciteBk, montant: 15000, payeur: "Enseigne Bar Le Miroir [TEST]", quand: debutJournee(auj) + 10 * 3600_000 + 5 * 60_000, lat: 7.6897, lng: -5.0312 });
  ajouterPaiement({ mairieId: bouakeId, agentId: agentBouakeId, typeId: marcheBk, montant: 3000, payeur: "Vendeuse KG 77 [TEST]", quand: debutJournee(hier) + 14 * 3600_000, lat: 7.6881, lng: -5.0299 });

  // Paiements en ligne simulés (« Paiement de démonstration », aucun argent réel)
  const OPERATEUR_DEMO = "Paiement de démonstration";
  ajouterPaiement({ mairieId: beoumiId, contribuableId: testeur1Id, typeId: marcheBm, montant: 2000, payeur: "Clarisse Testeur (démo)", quand: debutJournee(auj) + 11 * 3600_000 + 30 * 60_000, mode: "en_ligne", operateur: OPERATEUR_DEMO });
  ajouterPaiement({ mairieId: beoumiId, contribuableId: testeur2Id, typeId: stationnementBm, montant: 500, payeur: "Boris Testeur (démo)", quand: debutJournee(avantHier) + 12 * 3600_000 + 10 * 60_000, mode: "en_ligne", operateur: OPERATEUR_DEMO });

  // Démo : chaque agent voit par défaut tous les types de sa mairie
  db.prepare(
    `INSERT OR IGNORE INTO affectations_types_taxe (agent_id, type_taxe_id)
     SELECT a.id, t.id FROM agents a JOIN types_taxe t ON t.mairie_id = a.mairie_id`,
  ).run();
}
