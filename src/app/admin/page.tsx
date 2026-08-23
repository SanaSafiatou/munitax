import Link from "next/link";
import db from "@/lib/db";
import { exigerMairie, nomMairie } from "@/lib/auth";
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

  // Répartition des encaissements du jour par moyen de paiement
  // (espèces, Wave, Orange Money… selon les clés activées par la mairie).
  const parMoyen = repartitionParMoyen(mairieId, debut, fin);
  const totalMoyens = parMoyen.reduce((s, m) => s + m.total, 0);

  const nbContribuables = (
    db
      .prepare<[number], { n: number }>(
        "SELECT COUNT(*) AS n FROM contribuables WHERE mairie_id = ?",
      )
      .get(mairieId)!
  ).n;

  // Série des 7 derniers jours pour le graphique
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="titre-page">Tableau de bord — mairie de {m}</h1>
          <p className="sous-titre-page">
            Activité du jour, strictement limitée à votre mairie.
          </p>
        </div>
        <Link href={`/admin/collectes?date=${jour}`} className="lien-action">
          Voir toutes les collectes du jour →
        </Link>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartes.map((c) => (
          <div key={c.libelle} className="carte p-4">
            <p className="text-xs text-slate-500">{c.libelle}</p>
            <p className="mt-1 truncate text-2xl font-bold text-slate-900">{c.valeur}</p>
            <p className={`mt-1 truncate text-xs ${c.detailPositif ? "text-emerald-600" : "text-slate-400"}`}>
              {c.detail}
            </p>
          </div>
        ))}
      </div>

      {/* Graphique 7 jours */}
      <section className="carte">
        <h2 className="carte-titre">Collecte des 7 derniers jours</h2>
        <div className="flex items-end justify-between gap-2 px-5 pb-5 pt-6 sm:gap-4">
          {jours7.map((j) => {
            const t = totauxParJour.get(j) ?? 0;
            const hauteurPct = Math.max(3, Math.round((t / maxJour) * 100));
            const aujSelected = j === jour;
            return (
              <div key={j} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-medium text-slate-500 sm:text-xs">
                  {t > 0 ? new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(t) : ""}
                </span>
                <div className="flex h-28 w-full max-w-[52px] items-end overflow-hidden rounded-lg bg-slate-100">
                  <div
                    className={`w-full rounded-lg transition-all ${aujSelected ? "bg-emerald-600" : "bg-emerald-400/70"}`}
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
      <section className="carte">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="carte-titre">Répartition par moyen de paiement (aujourd&apos;hui)</h2>
          <Link href="/admin/moyens-paiement" className="lien-action text-sm">
            Configurer les moyens de paiement →
          </Link>
        </div>
        {parMoyen.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            Aucune collecte aujourd&apos;hui.
          </p>
        ) : (
          <ul className="space-y-3 px-5 pb-5 pt-4">
            {parMoyen.map((m) => {
              const part = totalMoyens > 0 ? Math.round((m.total / totalMoyens) * 100) : 0;
              return (
                <li key={m.moyen}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{libelleMoyen(m.moyen)}</span>
                    <span className="text-slate-500">
                      {m.nb} paiement{m.nb > 1 ? "s" : ""} ·{" "}
                      <span className="font-semibold text-slate-900">
                        {montantFmt(m.total)}
                      </span>{" "}
                      ({part} %)
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${m.moyen === "cash" ? "bg-emerald-600" : "bg-sky-500"}`}
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
        <section className="carte">
          <h2 className="carte-titre">Collecte terrain par agent</h2>
          {parAgent.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">Aucune collecte aujourd&apos;hui.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2 font-medium">Agent</th>
                  <th className="px-5 py-2 text-right font-medium">Paiements</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parAgent.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-2.5">
                      <Link href={`/admin/agents/${a.id}`} className="font-medium hover:text-emerald-700">
                        {a.nom}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-right">{a.nb}</td>
                    <td className="px-5 py-2.5 text-right font-semibold">{montantFmt(a.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="carte">
          <h2 className="carte-titre">Répartition par type de taxe</h2>
          {parTaxe.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">Aucune collecte aujourd&apos;hui.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2 font-medium">Type de taxe</th>
                  <th className="px-5 py-2 text-right font-medium">Paiements</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parTaxe.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-2.5 font-medium">{t.nom}</td>
                    <td className="px-5 py-2.5 text-right">{t.nb}</td>
                    <td className="px-5 py-2.5 text-right font-semibold">{montantFmt(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
