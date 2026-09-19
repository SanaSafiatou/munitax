import Link from "next/link";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import { aujourdhuiStr, bornesJour, montantFmt } from "@/lib/dates";

export const metadata = { title: "Collecter" };

const COULEURS = [
  "from-emerald-600 to-teal-500",
  "from-sky-600 to-cyan-500",
  "from-violet-600 to-fuchsia-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-indigo-600 to-blue-500",
];

export default async function PageAgent() {
  const session = await exigerMairie("agent");
  const { debut, fin } = bornesJour(aujourdhuiStr());

  const types = db
    .prepare<[number, number], { id: number; nom: string; description: string | null; montant_fixe: number | null; montant_libre: number }>(
      `SELECT t.id, t.nom, t.description, t.montant_fixe, t.montant_libre
       FROM types_taxe t
       JOIN affectations_types_taxe a ON a.type_taxe_id = t.id AND a.agent_id = ?
       WHERE t.actif = 1 AND t.mairie_id = ?
       ORDER BY t.nom`,
    )
    .all(session.id, session.mairieId);

  const resume = db
    .prepare<[number, number, number], { nb: number; total: number | null }>(
      "SELECT COUNT(*) AS nb, SUM(montant) AS total FROM paiements WHERE agent_id = ? AND statut = 'valide' AND date_heure >= ? AND date_heure < ?",
    )
    .get(session.id, debut, fin)!;

  return (
    <div className="space-y-5">
      {/* Héros premium */}
      <section className="hero-premium bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 p-6 sm:p-7">
        <div className="hero-halo-gauche" />
        <div className="hero-halo-droite" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
              {session.nom}
            </p>
            <p className="mt-1.5 text-sm text-emerald-100">Mes collectes du jour</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight">
              {montantFmt(resume.total ?? 0)}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-emerald-50 ring-1 ring-white/20">
              {resume.nb} paiement{resume.nb > 1 ? "s" : ""} enregistré
              {resume.nb > 1 ? "s" : ""}
            </p>
          </div>
          <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur sm:flex">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-8 w-8 text-emerald-100">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Choisir le type de taxe
        </h2>
        <div className="grid gap-3">
          {types.map((t, i) => (
            <Link
              key={t.id}
              href={`/agent/collecte/${t.id}`}
              className="group carte-premium flex items-center gap-4 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(6,78,59,0.35)]"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${COULEURS[i % COULEURS.length]}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{t.nom}</span>
                <span className="block truncate text-sm text-slate-500">
                  {t.montant_libre
                    ? "Montant à saisir"
                    : `${montantFmt(t.montant_fixe ?? 0)}`}
                  {t.description ? ` · ${t.description}` : ""}
                </span>
              </span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition group-hover:bg-emerald-600 group-hover:text-white group-hover:ring-emerald-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                </svg>
              </span>
            </Link>
          ))}
          {types.length === 0 && (
            <p className="carte p-4 text-center text-sm text-slate-500">
              Aucun type de taxe ne vous a été confié pour le moment. Contactez votre administrateur.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}