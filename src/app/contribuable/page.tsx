import Link from "next/link";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import { marquerMessagesLus } from "@/app/contribuable/actions";
import { ajouterJours, aujourdhuiStr, bornesJour, dateStr, heureStr, montantFmt } from "@/lib/dates";

export const metadata = { title: "Mon espace" };

const DEGRES = [
  "from-emerald-600 to-teal-500",
  "from-sky-600 to-cyan-500",
  "from-amber-500 to-orange-500",
];

export default async function PageContribuable() {
  const session = await exigerMairie("contribuable");

  const types = db
    .prepare<[number], { id: number; nom: string; description: string | null; montant_fixe: number | null; montant_libre: number }>(
      "SELECT id, nom, description, montant_fixe, montant_libre FROM types_taxe WHERE actif = 1 AND mairie_id = ? ORDER BY nom",
    )
    .all(session.mairieId ?? -1);

  const jour = aujourdhuiStr();
  const debutMois = `${jour.slice(0, 7)}-01`;
  const debutMoisSuivant = dateStr(bornesJour(ajouterJours(debutMois, 32)).debut);
  const bMois = { debut: bornesJour(debutMois).debut, fin: bornesJour(debutMoisSuivant).debut };

  const mois = db
    .prepare<[number, number, number], { total: number | null; nb: number }>(
      `SELECT SUM(montant) AS total, COUNT(*) AS nb
       FROM paiements
       WHERE contribuable_id = ? AND statut = 'valide' AND mode = 'en_ligne'
         AND date_heure >= ? AND date_heure < ?`,
    )
    .get(session.id, bMois.debut, bMois.fin)!;

  const derniers = db
    .prepare<[number], { id: number; reference: string | null; montant: number; date_heure: number; statut: "valide" | "annule"; taxe_nom: string }>(
      `SELECT p.id, p.reference, p.montant, p.date_heure, p.statut, t.nom AS taxe_nom
       FROM paiements p JOIN types_taxe t ON t.id = p.type_taxe_id
       WHERE p.contribuable_id = ?
       ORDER BY p.date_heure DESC LIMIT 5`,
    )
    .all(session.id);

  const messages = db
    .prepare<
      [number, number],
      { id: number; contenu: string; cree_le: number; lu_le: number | null }
    >(
      `SELECT m.id, m.contenu, m.cree_le, d.lu_le
       FROM messages m
       JOIN messages_destinataires d ON d.message_id = m.id
       WHERE d.contribuable_id = ? AND m.mairie_id = ?
       ORDER BY m.cree_le DESC LIMIT 5`,
    )
    .all(session.id, session.mairieId ?? -1);
  const nonLus = messages.filter((m) => m.lu_le === null).length;

  const cartes = [
    {
      libelle: "Payé ce mois-ci",
      valeur: montantFmt(mois.total ?? 0),
      icone: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
    },
    {
      libelle: "Quittances ce mois",
      valeur: String(mois.nb),
      icone: "M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z",
    },
    {
      libelle: "Dernier paiement",
      valeur: derniers[0] ? dateStr(derniers[0].date_heure) : "—",
      icone: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Héros premium */}
      <section className="hero-premium bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 p-6 sm:p-8">
        <div className="hero-halo-gauche" />
        <div className="hero-halo-droite" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Bonjour,
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {session.nom}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-emerald-100/90">
            Consultez vos taxes et payez en ligne en toute autonomie — paiement
            de démonstration instantané.
          </p>
        </div>
      </section>

      {/* Messages de la mairie */}
      {messages.length > 0 && (
        <section
          className={`carte-premium overflow-hidden ${
            nonLus > 0
              ? "ring-emerald-200 shadow-[0_12px_32px_-16px_rgba(6,78,59,0.25)]"
              : ""
          }`}
        >
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 font-semibold text-slate-900">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5 text-emerald-700">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
            </svg>
            Messages de votre mairie
            {nonLus > 0 && (
              <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-white">
                {nonLus} nouveau{nonLus > 1 ? "x" : ""}
              </span>
            )}
          </h2>
          <ul className="space-y-3 p-5">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-xl px-4 py-3 text-sm ring-1 ${
                  m.lu_le === null
                    ? "bg-gradient-to-r from-emerald-50 to-emerald-50/40 font-medium text-slate-900 ring-emerald-200"
                    : "bg-slate-50 text-slate-600 ring-slate-100"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.contenu}</p>
                <p className="mt-1 text-xs font-normal text-slate-400">
                  {dateStr(m.cree_le)} à {heureStr(m.cree_le)}
                  {m.lu_le === null ? "" : " · déjà lu"}
                </p>
              </li>
            ))}
          </ul>
          {nonLus > 0 && (
            <form action={marquerMessagesLus} className="border-t border-slate-100 px-5 py-3">
              <button type="submit" className="btn-secondaire px-3 py-1.5 text-xs">
                Marquer comme lu
              </button>
            </form>
          )}
        </section>
      )}

      {/* Indicateurs premium */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cartes.map((c, i) => (
          <div
            key={c.libelle}
            className="group carte-premium relative overflow-hidden flex items-center gap-4 p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(6,78,59,0.35)]"
          >
            <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br to-transparent opacity-70 transition group-hover:scale-125 ${i % 2 === 0 ? "from-emerald-100" : "from-sky-100"}`} />
            <span className={`pastille-icone relative bg-gradient-to-br ${DEGRES[i % DEGRES.length]}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d={c.icone} />
              </svg>
            </span>
            <span className="relative min-w-0">
              <span className="block truncate text-xs font-semibold uppercase tracking-wide text-slate-400">
                {c.libelle}
              </span>
              <span className="block truncate text-2xl font-extrabold tracking-tight text-slate-900">
                {c.valeur}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Taxes à payer */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Payer une taxe en ligne</h2>
          <span className="badge-demo">Paiement simulé</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {types.map((t, i) => (
            <Link
              key={t.id}
              href={`/contribuable/payer/${t.id}`}
              className="group carte-premium flex items-center justify-between gap-3 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(6,78,59,0.35)]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${DEGRES[i % DEGRES.length]}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900 group-hover:text-emerald-800">
                    {t.nom}
                  </span>
                  <span className="block truncate text-sm text-slate-500">
                    {t.montant_libre ? "Montant libre" : montantFmt(t.montant_fixe ?? 0)}
                    {t.description ? ` · ${t.description}` : ""}
                  </span>
                </span>
              </span>
              <span className="btn-primaire shrink-0 px-3 py-2">Payer</span>
            </Link>
          ))}
          {types.length === 0 && (
            <p className="carte p-6 text-center text-sm text-slate-500 sm:col-span-2">
              Aucune taxe disponible pour le moment.
            </p>
          )}
        </div>
      </section>

      {/* Derniers paiements */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Derniers paiements</h2>
          <Link href="/contribuable/historique" className="lien-action">
            Tout voir →
          </Link>
        </div>
        {derniers.length === 0 ? (
          <p className="carte p-6 text-center text-sm text-slate-500">
            Vous n&apos;avez encore aucun paiement. Choisissez une taxe
            ci-dessus pour essayer le parcours de démonstration.
          </p>
        ) : (
          <ul className="carte-premium divide-y divide-slate-100 overflow-hidden">
            {derniers.map((p) => (
              <li key={p.id}>
                <Link href={`/recu/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-emerald-50/40">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{p.taxe_nom}</span>
                    <span className="block text-sm text-slate-500">
                      {dateStr(p.date_heure)} à {heureStr(p.date_heure)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className={`font-bold tabular-nums ${p.statut === "valide" ? "text-emerald-700" : "text-red-500 line-through"}`}>
                      {montantFmt(p.montant)}
                    </span>
                    {p.statut === "valide" ? (
                      <span className="badge-succes hidden sm:inline-flex">Validé</span>
                    ) : (
                      <span className="badge-erreur hidden sm:inline-flex">Annulé</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}