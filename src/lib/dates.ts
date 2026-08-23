export const TZ = process.env.APP_TIMEZONE || "Africa/Douala";
export const DEVISE = process.env.APP_DEVISE || "FCFA";

type Parts = {
  annee: number;
  mois: number;
  jour: number;
  heure: number;
  minute: number;
};

const dtf = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function partsDansTz(epochMs: number): Parts {
  const p = Object.fromEntries(
    dtf.formatToParts(new Date(epochMs)).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return {
    annee: +p.year,
    mois: +p.month,
    jour: +p.day,
    heure: +p.hour % 24,
    minute: +p.minute,
  };
}

/** Décalage du fuseau par rapport à UTC, en ms, à cet instant. */
function offsetMs(epochMs: number): number {
  const p = partsDansTz(epochMs);
  const commeUtc = Date.UTC(p.annee, p.mois - 1, p.jour, p.heure, p.minute);
  const secondes = Math.floor(epochMs / 1000) * 1000;
  return commeUtc - secondes;
}

export function aujourdhuiStr(): string {
  return dateStr(Date.now());
}

export function dateStr(epochMs: number): string {
  const p = partsDansTz(epochMs);
  const m = String(p.mois).padStart(2, "0");
  const j = String(p.jour).padStart(2, "0");
  return `${p.annee}-${m}-${j}`;
}

export function heureStr(epochMs: number): string {
  const p = partsDansTz(epochMs);
  const h = String(p.heure).padStart(2, "0");
  const m = String(p.minute).padStart(2, "0");
  return `${h}:${m}`;
}

export function dateHeureStr(epochMs: number): string {
  return `${dateStr(epochMs)} à ${heureStr(epochMs)}`;
}

export function estDateValide(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Bornes [début, fin) d'une journée AAAA-MM-JJ dans le fuseau de l'app. */
export function bornesJour(dateIso: string): { debut: number; fin: number } {
  const [a, m, j] = dateIso.split("-").map(Number);
  const utcMidi = Date.UTC(a, m - 1, j, 12, 0, 0);
  const debut = utcMidi - 12 * 3600_000 - offsetMs(utcMidi - 12 * 3600_000);
  return { debut, fin: debut + 86_400_000 };
}

export function ajouterJours(dateIso: string, n: number): string {
  const { debut } = bornesJour(dateIso);
  return dateStr(debut + n * 86_400_000);
}

export function montantFmt(n: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(n)} ${DEVISE}`;
}
