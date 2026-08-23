import Link from "next/link";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import { aujourdhuiStr, bornesJour, montantFmt } from "@/lib/dates";

export const metadata = { title: "Collecter" };

export default async function PageAgent() {
  const session = await exigerMairie("agent");
  const { debut, fin } = bornesJour(aujourdhuiStr());

  const types = db
    .prepare<[number], { id: number; nom: string; description: string | null; montant_fixe: number | null; montant_libre: number }>(
      "SELECT id, nom, description, montant_fixe, montant_libre FROM types_taxe WHERE actif = 1 AND mairie_id = ? ORDER BY nom",
    )
    .all(session.mairieId);

  const resume = db
    .prepare<[number, number, number], { nb: number; total: number | null }>(
      "SELECT COUNT(*) AS nb, SUM(montant) AS total FROM paiements WHERE agent_id = ? AND statut = 'valide' AND date_heure >= ? AND date_heure < ?",
    )
    .get(session.id, debut, fin)!;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-r from-emerald-800 to-emerald-700 p-5 text-white shadow-sm">
        <p className="text-sm text-emerald-100">Mes collectes du jour</p>
        <p className="mt-1 text-3xl font-bold">{montantFmt(resume.total ?? 0)}</p>
        <p className="mt-0.5 text-sm text-emerald-100">
          {resume.nb} paiement{resume.nb > 1 ? "s" : ""} enregistré{resume.nb > 1 ? "s" : ""}
        </p>
      </section>

      <section>
        <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Choisir le type de taxe
        </h2>
        <div className="grid gap-3">
          {types.map((t) => (
            <Link
              key={t.id}
              href={`/agent/collecte/${t.id}`}
              className="carte flex items-center justify-between p-4 transition hover:ring-emerald-300 active:bg-slate-50"
            >
              <span>
                <span className="block font-semibold">{t.nom}</span>
                <span className="block text-sm text-slate-500">
                  {t.montant_libre
                    ? "Montant à saisir"
                    : `${montantFmt(t.montant_fixe ?? 0)}`}
                  {t.description ? ` · ${t.description}` : ""}
                </span>
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          ))}
          {types.length === 0 && (
            <p className="carte p-4 text-center text-sm text-slate-500">
              Aucun type de taxe configuré. Contactez l&apos;administrateur.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
