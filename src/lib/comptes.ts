import "server-only";
import db from "@/lib/db";

/** Slug court pour préfixer les identifiants : "Béoumi" → "beoumi". */
function slugifier(nom: string): string {
  return nom
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 18)
    .replace(/^\.+|\.+$/g, "") || "mairie";
}

/**
 * Génère un identifiant de connexion unique à partir du nom et de la mairie,
 * ex. « konan Kouassi » à Béoumi → beoumi.konan ou beoumi.konan2 si conflit.
 */
export function genererIdentifiant(
  nomComplet: string,
  nomMairie: string | null,
): string {
  const parties = nomComplet
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const prenom = parties[0] ?? "agent";
  const base = nomMairie ? `${slugifier(nomMairie)}.${prenom}` : prenom;

  let candidat = base;
  let n = 2;
  const existe = db.prepare<[string], { id: number }>(
    "SELECT id FROM agents WHERE identifiant = ?",
  );
  while (existe.get(candidat)) {
    candidat = `${base}${n}`;
    n += 1;
  }
  return candidat;
}

/** Code PIN à 6 chiffres pour la première connexion d'un agent. */
export function genererCodePin(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

/** Mot de passe lisible pour un administrateur créé par le super-admin. */
export function genererMotDePasse(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i += 1) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}
