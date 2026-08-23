import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import db, {
  type AgentRow,
  type ContribuableRow,
  type Role,
  type StatutMairie,
  type SuperAdminRow,
  suspendreMairiesEchues,
} from "@/lib/db";

const COOKIE = "session";
const DUREE_S = 60 * 60 * 12;

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ||
    "secret-dev-a-changer-en-production-taxapp-2026",
);

export type Session = {
  id: number;
  nom: string;
  identifiant: string;
  role: Role;
  mairieId: number | null;
  /** Session d'assistance ouverte par le propriétaire (sens unique). */
  imp?: boolean;
};

export function accueilPourRole(role: Role): string {
  if (role === "super_admin") return "/super";
  if (role === "admin") return "/admin";
  if (role === "agent") return "/agent";
  return "/contribuable";
}

export async function creerSession(compte: {
  id: number;
  nom_complet: string;
  identifiant: string;
  role: Role;
  mairieId?: number | null;
  imp?: boolean;
}): Promise<void> {
  const jeton = await new SignJWT({
    id: compte.id,
    nom: compte.nom_complet,
    identifiant: compte.identifiant,
    role: compte.role,
    mairieId: compte.mairieId ?? null,
    imp: compte.imp === true ? "1" : "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE_S}s`)
    .sign(secret);

  (await cookies()).set(COOKIE, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: DUREE_S,
    path: "/",
  });
}

export async function detruireSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  try {
    const jeton = (await cookies()).get(COOKIE)?.value;
    if (!jeton) return null;
    const { payload } = await jwtVerify(jeton, secret);
    const role = String(payload.role ?? "");
    if (
      !payload ||
      typeof payload.id !== "number" ||
      !["admin", "agent", "contribuable", "super_admin"].includes(role)
    ) {
      return null;
    }
    return {
      id: payload.id,
      nom: String(payload.nom ?? ""),
      identifiant: String(payload.identifiant ?? ""),
      role: role as Role,
      mairieId:
        typeof payload.mairieId === "number" ? payload.mairieId : null,
      imp: payload.imp === "1",
    };
  } catch {
    return null;
  }
}

/** Exige une session dont le rôle fait partie de ceux listés. */
export async function exigerRole(...roles: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) {
    // L'espace propriétaire possède sa propre porte d'entrée, distincte de
    // la page de connexion publique.
    redirect(roles.includes("super_admin") ? "/super/login" : "/login");
  }
  if (!roles.includes(session.role)) redirect(accueilPourRole(session.role));
  return session;
}

/**
 * Statut actuel d'une mairie ("active" si introuvable : les contrôleurs de
 * pages publiques ne doivent pas bloquer par excès).
 */
export function statutMairie(mairieId: number | null | undefined): StatutMairie {
  if (!mairieId) return "active";
  return (
    db.prepare<[number], { statut: StatutMairie }>(
      "SELECT statut FROM mairies WHERE id = ?",
    ).get(mairieId)?.statut ?? "active"
  );
}

/**
 * Exige une session rattachée à une mairie (admin, agent ou contribuable) et
 * vérifie EN TEMPS RÉEL que la mairie est active : une mairie suspendue ou en
 * attente d'approbation perd l'accès immédiatement, sans perdre ses données.
 */
export async function exigerMairie(
  ...roles: Array<"admin" | "agent" | "contribuable">
): Promise<Session & { mairieId: number }> {
  const session = await exigerRole(...roles);
  if (session.mairieId == null) redirect("/login");
  // Abonnements échus : suspension automatique avant tout contrôle.
  suspendreMairiesEchues();
  const st = statutMairie(session.mairieId);
  if (st !== "active") {
    redirect(st === "suspendue" ? "/acces-bloque?suspension=1" : "/acces-bloque?attente=1");
  }
  return session as Session & { mairieId: number };
}

/** Nom d'une mairie par son identifiant ("" si introuvable). */
export function nomMairie(mairieId: number | null | undefined): string {
  if (!mairieId) return "";
  return (
    db.prepare<[number], { nom: string }>(
      "SELECT nom FROM mairies WHERE id = ?",
    ).get(mairieId)?.nom ?? ""
  );
}

/** Normalise un numéro saisi : chiffres uniquement, indicatif 237 retiré. */
export function normaliserTelephone(saisie: string): string {
  let chiffres = saisie.replaceAll(/\D/g, "");
  if (chiffres.length > 9 && chiffres.startsWith("237")) {
    chiffres = chiffres.slice(3);
  }
  return chiffres;
}

type CompteStaff = Pick<
  AgentRow,
  | "id"
  | "nom_complet"
  | "telephone"
  | "identifiant"
  | "mot_de_passe"
  | "role"
  | "mairie_id"
  | "doit_changer_mdp"
>;

async function verifierPersonnel(
  identifiant: string,
  motDePasse: string,
): Promise<CompteStaff | null> {
  const agent = db
    .prepare<[string], CompteStaff>(
      `SELECT id, nom_complet, telephone, identifiant, mot_de_passe,
              role, mairie_id, doit_changer_mdp
       FROM agents WHERE identifiant = ? AND actif = 1`,
    )
    .get(identifiant.trim().toLowerCase());
  if (!agent) return null;
  const ok = await bcrypt.compare(motDePasse, agent.mot_de_passe);
  return ok ? agent : null;
}

/**
 * Vérifie les identifiants du PROPRIÉTAIRE de l'application. La recherche
 * se fait uniquement dans la table dédiée super_administrateurs : aucun
 * compte de mairie ne peut y accéder et réciproquement.
 */
/**
 * Vérifie les identifiants du super-administrateur. Utilisée UNIQUEMENT par
 * la page de connexion dédiée /super/login — jamais par la connexion
 * publique, qui ne concerne que les mairies et les contribuables.
 */
export async function verifierProprietaire(  identifiant: string,
  motDePasse: string,
): Promise<SuperAdminRow | null> {
  const p = db
    .prepare<[string], SuperAdminRow>(
      "SELECT id, identifiant, mot_de_passe, nom_complet FROM super_administrateurs WHERE identifiant = ?",
    )
    .get(identifiant.trim().toLowerCase());
  if (!p) return null;
  const ok = await bcrypt.compare(motDePasse, p.mot_de_passe);
  return ok ? p : null;
}

async function verifierContribuable(
  telephoneNormalise: string,
  motDePasse: string,
): Promise<ContribuableRow | null> {
  const c = db
    .prepare<[string], ContribuableRow>(
      `SELECT id, code, nom_complet, telephone, email, mot_de_passe, mairie_id
       FROM contribuables
       WHERE telephone = ? AND actif = 1 AND mot_de_passe != ''
       ORDER BY id LIMIT 1`,
    )
    .get(telephoneNormalise);
  if (!c) return null;
  const ok = await bcrypt.compare(motDePasse, c.mot_de_passe);
  return ok ? c : null;
}

export type ResultatConnexion =
  | { ok: true; role: Role; compte: CompteStaff | ContribuableRow | SuperAdminRow }
  | { ok: false; raison: "suspendue" | "attente" }
  | null;

/**
 * Vérifie les identifiants d'un compte quel que soit son rôle.
 * Les agents/admins se connectent avec leur identifiant, le propriétaire
 * avec le sien (table séparée), les contribuables avec leur téléphone.
 * Une mairie suspendue ou en attente d'approbation est refusée ici même.
 */
export async function verifierIdentifiants(
  identifiantSaisi: string,
  motDePasse: string,
): Promise<ResultatConnexion> {
  const identifiant = identifiantSaisi.trim().toLowerCase();

  // Abonnements arrivés à échéance : suspension automatique avant tout
  // contrôle d'accès (aucune intervention du super-administrateur requise).
  suspendreMairiesEchues();

  // 1) Personnel des mairies — l'accès dépend du statut d'abonnement.
  const staff = await verifierPersonnel(identifiant, motDePasse);
  if (staff) {
    const st = statutMairie(staff.mairie_id);
    if (st === "suspendue") return { ok: false, raison: "suspendue" };
    if (st === "en_attente") return { ok: false, raison: "attente" };
    return { ok: true, role: staff.role, compte: staff };
  }

  // 3) Contribuables (paiement en ligne) — même coupure si la mairie est
  //    fermée ; leurs données restent intactes.
  const tel = normaliserTelephone(identifiantSaisi);
  if (tel.length >= 8) {
    const c = await verifierContribuable(tel, motDePasse);
    if (c) {
      const st = statutMairie(c.mairie_id);
      if (st === "suspendue") return { ok: false, raison: "suspendue" };
      if (st === "en_attente") return { ok: false, raison: "attente" };
      return { ok: true, role: "contribuable", compte: c };
    }
  }
  return null;
}

export { hashSync } from "bcryptjs";
