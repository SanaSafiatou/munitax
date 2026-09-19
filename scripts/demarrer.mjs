// Point d'entrée de démarrage Render : restaure la base réelle sur le disque
// persistant si elle n'existe pas encore (RESTAURER_DB_B64 = base64 gzip de
// data/app.db, générée par `npm run sauvegarder`), puis lance Next.js.
// Sans RESTAURER_DB_B64, l'application amorce automatiquement les données de
// démonstration (comportement habituel de src/lib/db.ts).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";

const dbPath =
  process.env.APP_DB_PATH ?? path.join(process.cwd(), "data", "app.db");
const PORT = process.env.PORT ?? "10000";

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

if (!fs.existsSync(dbPath)) {
  const b64 = process.env.RESTAURER_DB_B64;
  if (b64) {
    try {
      fs.writeFileSync(dbPath, zlib.gunzipSync(Buffer.from(b64, "base64")));
      console.log(
        `[demarrage] base restaurée depuis RESTAURER_DB_B64 → ${dbPath} (${fs.statSync(dbPath).size} octets)`,
      );
    } catch (e) {
      console.error("[demarrage] restauration echouee, base vierge (`" + e.message + "`)");
    }
  } else {
    console.log(
      "[demarrage] pas de RESTAURER_DB_B64 : base vierge, amorcage automatique des donnees demo au demarrage",
    );
  }
} else {
  console.log(`[demarrage] base existante conservée → ${dbPath}`);
}

const child = spawn(
  process.execPath,
  [
    path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
    "start",
    "-p",
    String(PORT),
  ],
  { stdio: "inherit", env: process.env },
);
child.on("exit", (code) => process.exit(code ?? 1));