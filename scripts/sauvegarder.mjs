// Exporte un instantané consolidé de la base réelle pour la migration vers
// Render : fichier unique (VACUUM INTO), compressé (gzip) puis encodé en
// base64. Le résultat est écrit dans data/production.base64 (jamais committé).
// Valeur à coller dans la variable d'environnement RESTAURER_DB_B64 de Render.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const src = process.env.APP_DB_PATH ?? path.join(process.cwd(), "data", "app.db");
if (!fs.existsSync(src)) {
  console.error(`Base introuvable : ${src}`);
  process.exit(1);
}

const dossierBackups = path.join(process.cwd(), "data", "backups");
fs.mkdirSync(dossierBackups, { recursive: true });
const copie = path.join(
  dossierBackups,
  `app-${new Date().toISOString().slice(0, 19).replaceAll(/[T:-]/g, "")}.db`,
);
fs.rmSync(copie, { force: true }); // VACUUM INTO exige un fichier inexistant

const db = new Database(src, { readonly: true });
db.pragma("busy_timeout = 15000");
db.exec(`VACUUM INTO '${copie.replaceAll("'", "''")}'`);
db.close();

const b64 = zlib.gzipSync(fs.readFileSync(copie)).toString("base64");
fs.writeFileSync(path.join(process.cwd(), "data", "production.base64"), b64);

console.log(`Copie de sauvegarde    : ${copie}`);
console.log(`Instantané base64 gzip : data/production.base64 (${Math.round(b64.length / 1024)} Ko)`);
console.log("Collez son contenu dans la variable RESTAURER_DB_B64 de Render (démarrage en machine).");