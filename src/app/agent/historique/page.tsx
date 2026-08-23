import Link from "next/link";
import db from "@/lib/db";
import { exigerRole } from "@/lib/auth";
import { aujourdhuiStr, bornesJour, heureStr, montantFmt } from "@/lib/dates";

export const metadata = { title: "Mon historique" };

export default async function PageHistorique() {
  const session = await exigerRole("agent");
  const jour = aujourdhuiStr();
  const { debut, fin } = bornesJour(jour);

  type Ligne = {
    id: number;
    reference: string | null;
    montant: number;
    commercant: string;
    date_heure: number;
    statut: "valide" | "annule";
    taxe_nom: string;
  };

  const lignes = db
    .prepare<[number, number, number], Ligne>(
      `SELECT p.id, p.reference, p.montant, p.commercant, p.date_heure, p.statut, t.nom AS taxe_nom
       FROM paiements p JOIN types_taxe t ON t.id = p.type_taxe_id
       WHERE p.agent_id = ? AND p.date_heure >= ? AND p.date_heure < ?
       ORDER BY p.date_heure DESC`,
    )
    .all(session.id, debut, fin);

  const total = lignes
    .filter((l) => l.statut === "valide")
    .reduce((s, l) => s + l.montant, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Collectes du jour</h1>
        <p className="text-sm text-slate-500">
          Total : <span className="font-semibold text-slate-900">{montantFmt(total)}</span>
        </p>
      </div>

      {lignes.length === 0 ? (
        <p className="carte p-6 text-center text-sm text-slate-500">
          Aucune collecte enregistrée aujourd&apos;hui.
        </p>
      ) : (
        <ul className="carte divide-y divide-slate-100">
          {lignes.map((l) => (
            <li key={l.id}>
              <Link
                href={`/recu/${l.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 active:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{l.commercant}</span>
                  <span className="block truncate text-sm text-slate-500">
                    {l.taxe_nom} · {heureStr(l.date_heure)}
                  </span>
                </span>
                <span className="text-right">
                  <span
                    className={`block font-semibold ${l.statut === "valide" ? "" : "text-red-500 line-through"}`}
                  >
                    {montantFmt(l.montant)}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {l.reference ?? `#${l.id}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="px-1 text-center text-xs text-slate-400">
        Journal du {jour} — touchez une ligne pour revoir le reçu.
      </p>
    </div>
  );
}
