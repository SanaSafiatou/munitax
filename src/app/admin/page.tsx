import Link from "next/link";
import db from "@/lib/db";
import { exigerMairie, nomMairie } from "@/lib/auth";
import RafraichissementAuto from "@/components/rafraichissement-auto";
import {
  ajouterJours,
  aujourdhuiStr,
  bornesJour,
  dateStr,
  montantFmt,
} from "@/lib/dates";
import { libelleMoyen, repartitionParMoyen } from "@/lib/moyens-paiement";

export const metadata = { title: "Tableau de bord" };

type Ligne = { id: number; nom: string; nb: number; total: number };

function Initiales({ nom, className = "" }: { nom: string; className?: string }) {
  const p = nom.trim().split(/\s+/);
  const ini = ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-xs font-bold text-white shadow-sm ${className}`}
    >
      {ini}
    </span>
  );
}

const ICONES: Record<string, string> = {
  "Collecté aujourd'hui":
    "M3 12l1.5-1.5M3 12l1.5 1.5M3 12h1m-1 0h6m0 0a2 2 0 0 1 4 0m-4 0a2 2 0 0 0 4 0m6-4l1.5 1.5M21 8l-1.5 1.5M21 8v6m0-6H9m12 6h-6m6 0v-1",
  "Paiements validés aujourd'hui":
    "M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z",
  "Agents actifs aujourd'hui":
    "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a8.25 8.25 0 0 1 15 0",
  "Contribuables inscrits":
    "M3 12l9-8 9 8M5.5 10.5V20h13v-9.5M10 20v-5h4v5",
};

const DEGRES: string[] = [
  "from-emerald-600 to-teal-500",
  "from-sky-600 to-cyan-500",
  "from-violet-600 to-fuchsia-500",
  "from-amber-500 to-orange-500",
];

export default async function PageAdmin() {
  const { mairieId } = await exigerMairie("admin");
  const m = nomMairie(mairieId);
  const jour = aujourdhuiStr();
  const hier = ajouterJours(jour, -1);
  const { debut, fin } = bornesJour(jour);
  const h = bornesJour(hier);

  const totalJour = db
    .prepare<[number, number, number], { total: number | null; nb: number }>(
      "SELECT SUM(montant) AS total, COUNT(*) AS nb FROM paiements WHERE statut = 'valide' AND mairie_id = ? AND date_heure >= ? AND date_heure < ?",
    )
    .get(mairieId, debut, fin)!;
  const totalHier = db
    .prepare<[number, number, number], { total: number | null }>(
      "SELECT SUM(montant) AS total FROM paiements WHERE statut = 'valide' AND mairie_id = ? AND date_heure >= ? AND date_heure < ?",
    )
    .get(mairieId, h.debut, h.fin)!;

  const parAgent = db
    .prepare<[number, number, number], Ligne>(
      `SELECT a.id, a.nom_complet AS nom, COUNT(*) AS nb, SUM(p.montant) AS total
       FROM paiements p JOIN agents a ON a.id = p.agent_id
       WHERE p.statut = 'valide' AND p.mairie_id = ? AND p.date_heure >= ? AND p.date_heure < ?
       GROUP BY a.id ORDER BY total DESC`,
    )
    .all(mairieId, debut, fin);

  const parTaxe = db
    .prepare<[number, number, number], Ligne>(
      `SELECT t.id, t.nom, COUNT(*) AS nb, SUM(p.montant) AS total
       FROM paiements p JOIN types_taxe t ON t.id = p.type_taxe_id
       WHERE p.statut = 'valide' AND p.mairie_id = ? AND p.date_heure >= ? AND p.date_heure < ?
       GROUP BY t.id ORDER BY total DESC`,
    )
    .all(mairieId, debut, fin);

  const enLigneJour = db
    .prepare<[number, number, number], { total: number | null; nb: number }>(
      "SELECT SUM(montant) AS total, COUNT(*) AS nb FROM paiements WHERE statut = 'valide' AND mode = 'en_ligne' AND mairie_id = ? AND date_heure >= ? AND date_heure < ?",
    )
    .get(mairieId, debut, fin)!;

  const parMoyen = repartitionParMoyen(mairieId, debut, fin);
  const totalMoyens = parMoyen.reduce((s, m) => s + m.total, 0);

  const nbContribuables = (
    db
      .prepare<[number], { n: number }>(
        "SELECT COUNT(*) AS n FROM contribuables WHERE mairie_id = ?",
      )
      .get(mairieId)!
  ).n;

  const decalageSemaine = (() => {
    const d = new Date(bornesJour(jour).debut);
    return (d.getDay() + 6) % 7; // lundi = 0
  })();
  const debutSemaine = bornesJour(ajouterJours(jour, -decalageSemaine)).debut;
  const finSemaine = debutSemaine + 7 * 86_400_000;

  const [anneeEnCours, moisEnCours] = jour.split("-").map(Number);
  const debutMois = bornesJour(
    `${anneeEnCours}-${String(moisEnCours).padStart(2, "0")}-01`,
  ).debut;
  const finMois = bornesJour(
    moisEnCours === 12
      ? `${anneeEnCours + 1}-01-01`
      : `${anneeEnCours}-${String(moisEnCours + 1).padStart(2, "0")}-01`,
  ).debut;

  const sommePeriode = (debutPeriode: number, finPeriode: number) =>
    db
      .prepare<
        [number, number, number],
        { total: number | null; nb: number }
      >(
        "SELECT SUM(montant) AS total, COUNT(*) AS nb FROM paiements WHERE statut = 'valide' AND mairie_id = ? AND date_heure >= ? AND date_heure < ?",
      )
      .get(mairieId, debutPeriode, finPeriode)!;

  const totalSemaine = sommePeriode(debutSemaine, finSemaine);
  const totalMois = sommePeriode(debutMois, finMois);

  const contribuablesRecents = db
    .prepare<
      [number],
      {
        id: number;
        code: string | null;
        nom_complet: string;
        telephone: string | null;
        cree_le: number;
      }
    >(
      `SELECT id, code, nom_complet, telephone, cree_le
       FROM contribuables
       WHERE mairie_id = ? AND actif = 1
       ORDER BY cree_le DESC LIMIT 6`,
    )
    .all(mairieId);

  const jours7 = Array.from({ length: 7 }, (_, i) => ajouterJours(jour, -(6 - i)));
  const debut7 = bornesJour(jours7[0]).debut;
  const brut = db
    .prepare<[number, number, number], { date_heure: number; montant: number }>(
      "SELECT date_heure, montant FROM paiements WHERE statut = 'valide' AND mairie_id = ? AND date_heure >= ? AND date_heure < ?",
    )
    .all(mairieId, debut7, fin);
  const totauxParJour = new Map<string, number>(jours7.map((j) => [j, 0]));
  for (const l of brut) {
    const j = dateStr(l.date_heure);
    if (totauxParJour.has(j)) totauxParJour.set(j, totauxParJour.get(j)! + l.montant);
  }
  const maxJour = Math.max(1, ...totauxParJour.values());
  const formatteurJour = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: process.env.APP_TIMEZONE || "Africa/Douala" });

  const evolution =
    (totalHier.total ?? 0) > 0
      ? Math.round((((totalJour.total ?? 0) - (totalHier.total ?? 0)) / (totalHier.total ?? 1)) * 100)
      : null;

  const cartes = [
    {
      libelle: "Collecté aujourd'hui",
      valeur: montantFmt(totalJour.total ?? 0),
      detail:
        evolution === null
          ? `Hier : ${montantFmt(totalHier.total ?? 0)}`
          : `${evolution >= 0 ? "▲" : "▼"} ${Math.abs(evolution)} % vs hier`,
      detailPositif: evolution !== null && evolution >= 0,
    },
    {
      libelle: "Paiements validés aujourd'hui",
      valeur: String(totalJour.nb),
      detail: `${enLigneJour.nb} en ligne · ${totalJour.nb - enLigneJour.nb} terrain`,
    },
    {
      libelle: "Agents actifs aujourd'hui",
      valeur: String(parAgent.length),
      detail: "Ayant encaissé au moins un paiement",
    },
    {
      libelle: "Contribuables inscrits",
      valeur: String(nbContribuables),
      detail: `${enLigneJour.nb} paiement(s) en ligne aujourd'hui`,
    },
  ];

  return (
    <div className="space-y-6">
      <RafraichissementAuto secondes={60} />

      {/* Héros premium */}
      <section className="hero-premium bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 sm:p-8">
        <div className="hero-halo-gauche" />
        <div className="hero-halo-droite" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Mairie de {m}
            </p>
            <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Tableau de bord
            </h1>
            <p className="mt-1 text-sm text-emerald-100/90">
              Activité du jour, strictement limitée à votre mairie.
            </p>
          </div>
          <Link
            href={`/admin/collectes?date=${jour}`}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
          >
            Voir toutes les collectes du jour
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Indicateurs premium */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartes.map((c, i) => (
          <div
            key={c.libelle}
            className="group carte-premium relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(6,78,59,0.35)]"
          >
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-100 to-transparent opacity-70 transition group-hover:scale-125" />
            <div className="relative flex items-center gap-3">
              <span className={`pastille-icone bg-gradient-to-br ${DEGRES[i % DEGRES.length]}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d={ICONES[c.libelle]} />
                </svg>
              </span>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {c.libelle}
              </p>
            </div>
            <p className="relative mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
              {c.valeur}
            </p>
            {c.detail.startsWith("▲") || c.detail.startsWith("▼") ? (
              <span
                className={`puce-tendance mt-1 ${
                  c.detailPositif
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-red-50 text-red-700 ring-red-200"
                }`}
              >
                {c.detail}
              </span>
            ) : (
              <p className="mt-1 truncate text-xs text-slate-400">{c.detail}</p>
            )}
          </div>
        ))}
      </div>

      {/* Périodes : jour, semaine, mois */}
      <section className="carte-premium">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
            Paiements par période
          </h2>
          <span className="badge-neutre">FCFA</span>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          {[
            {
              libelle: "Aujourd'hui",
              total: totalJour.total ?? 0,
              nb: totalJour.nb,
              part:
                (totalSemaine.total ?? 0) > 0
                  ? Math.round(((totalJour.total ?? 0) / (totalSemaine.total ?? 1)) * 100)
                  : null,
              textePart: "part de la semaine",
              degrade: DEGRES[0],
              icone: ICONES["Collecté aujourd'hui"],
            },
            {
              libelle: "Cette semaine",
              total: totalSemaine.total ?? 0,
              nb: totalSemaine.nb,
              part:
                (totalMois.total ?? 0) > 0
                  ? Math.round(((totalSemaine.total ?? 0) / (totalMois.total ?? 1)) * 100)
                  : null,
              textePart: "part du mois",
              degrade: DEGRES[2],
              icone: ICONES["Paiements validés aujourd'hui"],
            },
            {
              libelle: "Ce mois-ci",
              total: totalMois.total ?? 0,
              nb: totalMois.nb,
              part: null,
              textePart: "",
              degrade: DEGRES[3],
              icone: ICONES["Contribuables inscrits"],
            },
          ].map((k) => (
            <div
              key={k.libelle}
              className="group rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(15,23,42,0.25)]"
            >
              <div className="flex items-center gap-2">
                <span className={`pastille-icone bg-gradient-to-br ${k.degrade}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d={k.icone} />
                  </svg>
                </span>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {k.libelle}
                </p>
              </div>
              <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
                {montantFmt(k.total)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {k.nb} paiement{k.nb > 1 ? "s" : ""} validé{k.nb > 1 ? "s" : ""}
              </p>
              {k.part !== null && (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${k.degrade}`}
                      style={{ width: `${Math.max(2, k.part)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {k.part} % {k.textePart}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Graphique 7 jours */}
      <section className="carte-premium">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
            Collecte des 7 derniers jours
          </h2>
          <span className="badge-neutre">FCFA</span>
        </div>
        <div className="flex items-end justify-between gap-2 px-5 pb-5 pt-6 sm:gap-4">
          {jours7.map((j) => {
            const t = totauxParJour.get(j) ?? 0;
            const hauteurPct = Math.max(3, Math.round((t / maxJour) * 100));
            const aujSelected = j === jour;
            return (
              <div key={j} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-500 sm:text-xs">
                  {t > 0 ? new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(t) : ""}
                </span>
                <div
                  className="flex h-32 w-full max-w-[56px] items-end overflow-hidden rounded-xl bg-gradient-to-t from-emerald-50 to-slate-50 ring-1 ring-emerald-100/50"
                >
                  <div
                    className={`w-full rounded-t-xl transition-all duration-500 ${
                      aujSelected
                        ? "bg-gradient-to-t from-emerald-700 via-emerald-500 to-teal-400 shadow-[0_0_20px_-4px_rgba(16,185,129,0.6)]"
                        : "bg-gradient-to-t from-emerald-500/80 to-teal-400/70"
                    }`}
                    style={{ height: `${hauteurPct}%` }}
                    title={`${j} : ${montantFmt(t)}`}
                  />
                </div>
                <span className={`text-xs capitalize ${aujSelected ? "font-bold text-emerald-700" : "text-slate-400"}`}>
                  {formatteurJour.format(new Date(bornesJour(j).debut))}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Répartition par moyen de paiement */}
      <section className="carte-premium">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
            Répartition par moyen de paiement
          </h2>
          <Link href="/admin/moyens-paiement" className="lien-action text-sm">
            Configurer les moyens de paiement →
          </Link>
        </div>
        {parMoyen.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            Aucune collecte aujourd&apos;hui.
          </p>
        ) : (
          <ul className="space-y-4 px-5 pb-5 pt-4">
            {parMoyen.map((m) => {
              const part = totalMoyens > 0 ? Math.round((m.total / totalMoyens) * 100) : 0;
              return (
                <li key={m.moyen}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-800">{libelleMoyen(m.moyen)}</span>
                    <span className="text-slate-500">
                      {m.nb} paiement{m.nb > 1 ? "s" : ""} ·{" "}
                      <span className="font-semibold text-slate-900">
                        {montantFmt(m.total)}
                      </span>{" "}
                      <span
                        className={`ml-1 inline-flex w-14 justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                          m.moyen === "cash"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-sky-50 text-sky-700"
                        }`}
                      >
                        {part} %
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/40">
                    <div
                      className={`h-full rounded-full transition-all ${
                        m.moyen === "cash"
                          ? "bg-gradient-to-r from-emerald-600 to-teal-400"
                          : "bg-gradient-to-r from-sky-600 to-cyan-400"
                      }`}
                      style={{ width: `${Math.max(2, part)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Répartitions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="carte-premium overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
              Agents actifs aujourd&apos;hui
            </h2>
            <span className="badge-neutre">{parAgent.length}</span>
          </div>
          {parAgent.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">Aucune collecte aujourd&apos;hui.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 font-semibold">Agent</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Paiements</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parAgent.map((a) => (
                  <tr key={a.id} className="transition hover:bg-emerald-50/40">
                    <td className="px-5 py-3">
                      <Link href={`/admin/agents/${a.id}`} className="flex items-center gap-3">
                        <Initiales nom={a.nom} />
                        <span className="font-medium text-slate-800 hover:text-emerald-700">
                          {a.nom}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">{a.nb}</td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-slate-900">
                      {montantFmt(a.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="carte-premium overflow-hidden">
          <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 sm:text-base">
            Répartition par type de taxe
          </h2>
          {parTaxe.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">Aucune collecte aujourd&apos;hui.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 font-semibold">Type de taxe</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Paiements</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parTaxe.map((t) => (
                  <tr key={t.id} className="transition hover:bg-emerald-50/40">
                    <td className="px-5 py-3 font-medium text-slate-800">{t.nom}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">{t.nb}</td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-slate-900">
                      {montantFmt(t.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Contribuables inscrits */}
      <section className="carte-premium overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
            Contribuables inscrits
          </h2>
          <Link href="/admin/contribuables" className="lien-action text-sm">
            Gérer les contribuables →
          </Link>
        </div>
        {contribuablesRecents.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            Aucun contribuable inscrit pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {contribuablesRecents.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Initiales nom={c.nom_complet} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{c.nom_complet}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {c.telephone ?? "—"}
                    {c.code ? ` · Code ${c.code}` : ""}
                  </p>
                </div>
                <span className="text-xs text-slate-400">inscrit le {dateStr(c.cree_le)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-400">
        <span>Appareil mobile :</span>
        <a href="/apk/MuniTax-Admin.apk" className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-emerald-700 hover:underline" download>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Administrateur (.apk)
        </a>
      </div>
    </div>
  );
}