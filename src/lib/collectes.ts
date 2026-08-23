import {
  ajouterJours,
  aujourdhuiStr,
  bornesJour,
  estDateValide,
} from "@/lib/dates";
import type { PaiementRow } from "@/lib/db";

export type FiltresCollectes = {
  date: string;
  agent: string;
  type: string;
  moyen: string;
};

/** Valeurs acceptées pour le filtre « moyen de paiement ». */
export const FILTRES_MOYENS = [
  "cash",
  "wave",
  "orange_money",
  "moov_money",
  "mtn_money",
] as const;

export type Periode = "jour" | "semaine" | "mois" | "tout";

export type LigneCollecte = PaiementRow & {
  agent_nom: string | null;
  taxe_nom: string;
};

export function construireFiltre(f: FiltresCollectes, mairieId?: number) {
  const conditions: string[] = [];
  const params: (number | string)[] = [];

  // Cloisonnement multi-mairies : toujours en premier paramètre.
  if (typeof mairieId === "number") {
    conditions.push("p.mairie_id = ?");
    params.push(mairieId);
  }
  if (estDateValide(f.date)) {
    const { debut, fin } = bornesJour(f.date);
    conditions.push("p.date_heure >= ?", "p.date_heure < ?");
    params.push(debut, fin);
  }
  if (f.agent && Number.isFinite(Number(f.agent))) {
    conditions.push("p.agent_id = ?");
    params.push(Number(f.agent));
  }
  if (f.type && Number.isFinite(Number(f.type))) {
    conditions.push("p.type_taxe_id = ?");
    params.push(Number(f.type));
  }
  if ((FILTRES_MOYENS as readonly string[]).includes(f.moyen)) {
    conditions.push("p.moyen_paiement = ?");
    params.push(f.moyen);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export function estPeriodeValide(v: unknown): v is Periode {
  return v === "jour" || v === "semaine" || v === "mois" || v === "tout";
}

/** Bornes [début, fin) d'une période nommée ou personnalisée (du → au). */
export function bornesPeriode(
  periode: Periode,
  du: string,
  au: string,
): { debut: number; fin: number; libelle: string } {
  const auj = aujourdhuiStr();

  if (periode === "semaine") {
    const d = ajouterJours(auj, -6);
    return { ...bornesPerso(d, auj), libelle: `7 derniers jours (${d} → ${auj})` };
  }
  if (periode === "mois") {
    const d = ajouterJours(auj, -29);
    return { ...bornesPerso(d, auj), libelle: `30 derniers jours (${d} → ${auj})` };
  }
  if (periode === "tout" && estDateValide(du) && estDateValide(au)) {
    return bornesPerso(du, au, `Période du ${du} au ${au}`);
  }
  const j = estDateValide(du) ? du : auj;
  return { ...bornesJour(j), libelle: `Journée du ${j}` };
}

function bornesPerso(du: string, au: string, libelle?: string) {
  return {
    debut: bornesJour(estDateValide(du) ? du : aujourdhuiStr()).debut,
    fin: bornesJour(estDateValide(au) ? au : aujourdhuiStr()).fin,
    libelle: libelle ?? `Période du ${du} au ${au}`,
  };
}
