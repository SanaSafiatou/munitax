import Link from "next/link";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import { annulerPaiement } from "@/app/admin/actions";
import {
  FILTRES_MOYENS,
  type FiltresCollectes,
  type LigneCollecte,
  construireFiltre,
} from "@/lib/collectes";
import { libelleMoyen } from "@/lib/moyens-paiement";
import { aujourdhuiStr, dateHeureStr, montantFmt } from "@/lib/dates";

export const metadata = { title: "Collectes" };

export default async function PageCollectes(
  props: PageProps<"/admin/collectes">,
) {
  const { mairieId } = await exigerMairie("admin");
  const sp = await props.searchParams;
  const filtres: FiltresCollectes = {
    date: typeof sp.date === "string" && sp.date ? sp.date : aujourdhuiStr(),
    agent: typeof sp.agent === "string" ? sp.agent : "",
    type: typeof sp.type === "string" ? sp.type : "",
    moyen: typeof sp.moyen === "string" ? sp.moyen : "",
  };

  const { where, params } = construireFiltre(filtres, mairieId);

  const lignes = db
    .prepare<(number | string)[], LigneCollecte>(
      `SELECT p.*, a.nom_complet AS agent_nom, t.nom AS taxe_nom
       FROM paiements p
       JOIN agents a ON a.id = p.agent_id
       JOIN types_taxe t ON t.id = p.type_taxe_id
       ${where}
       ORDER BY p.date_heure DESC LIMIT 500`,
    )
    .all(...params);

  const { total } = db
    .prepare<(number | string)[], { total: number | null }>(
      `SELECT SUM(montant) AS total FROM paiements p ${where ? `${where} AND` : "WHERE"} p.statut = 'valide'`,
    )
    .get(...params)!;

  const agents = db
    .prepare<[number], { id: number; nom_complet: string }>(
      "SELECT id, nom_complet FROM agents WHERE mairie_id = ? AND role = 'agent' ORDER BY nom_complet",
    )
    .all(mairieId);
  const types = db
    .prepare<[number], { id: number; nom: string }>(
      "SELECT id, nom FROM types_taxe WHERE mairie_id = ? ORDER BY nom",
    )
    .all(mairieId);

  const queryExport = `date=${encodeURIComponent(filtres.date)}&agent=${filtres.agent}&type=${filtres.type}&moyen=${encodeURIComponent(filtres.moyen)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="titre-page">Toutes les collectes</h1>
          <p className="sous-titre-page">
            Terrain et paiements en ligne de démonstration.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          Total validé : <span className="font-semibold text-slate-900">{montantFmt(total ?? 0)}</span>
        </p>
      </div>

      <form
        method="get"
        className="carte flex flex-wrap items-end gap-3 p-4"
      >
        <label className="text-xs font-medium text-slate-600">
          Date
          <input
            type="date"
            name="date"
            defaultValue={filtres.date}
            className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Agent
          <select
            name="agent"
            defaultValue={filtres.agent}
            className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom_complet}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Type de taxe
          <select
            name="type"
            defaultValue={filtres.type}
            className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Moyen de paiement
          <select
            name="moyen"
            defaultValue={filtres.moyen}
            className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Tous</option>
            {FILTRES_MOYENS.map((m) => (
              <option key={m} value={m}>
                {libelleMoyen(m)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Filtrer
        </button>
        <Link
          href="/admin/collectes"
          className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-800"
        >
          Réinitialiser
        </Link>
        <a
          href={`/admin/export?${queryExport}`}
          className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          Exporter ce tableau ↓
        </a>
      </form>

      <div className="carte overflow-hidden">
        {lignes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Aucune collecte ne correspond à ces critères.
          </p>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-medium">Référence</th>
                <th className="px-4 py-2.5 font-medium">Date et heure</th>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Taxe</th>
                <th className="px-4 py-2.5 font-medium">Mode</th>
                <th className="px-4 py-2.5 font-medium">Paiement</th>
                <th className="px-4 py-2.5 font-medium">Commerçant</th>
                <th className="px-4 py-2.5 text-right font-medium">Montant</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
                <th className="px-4 py-2.5" colSpan={2}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lignes.map((l) => (
                <tr key={l.id} className={l.statut !== "valide" ? "opacity-60" : ""}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/recu/${l.id}`}
                      className="font-mono text-xs hover:text-emerald-700"
                    >
                      {l.reference ?? `#${l.id}`}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {dateHeureStr(l.date_heure)}
                  </td>
                  <td className="px-4 py-2.5">{l.agent_nom ?? "—"}</td>
                  <td className="px-4 py-2.5">{l.taxe_nom}</td>
                  <td className="px-4 py-2.5">
                    {l.mode === "en_ligne" ? (
                      <span className="badge-demo">En ligne</span>
                    ) : (
                      <span className="badge-neutre">Terrain</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {libelleMoyen(l.moyen_paiement)}
                    {l.reference_mobile && (
                      <span className="block font-mono text-[10px] text-slate-400">
                        {l.reference_mobile}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{l.commercant}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold ${l.statut !== "valide" ? "line-through" : ""}`}
                  >
                    {montantFmt(l.montant)}
                  </td>
                  <td className="px-4 py-2.5">
                    {l.statut === "valide" ? (
                      <span className="badge-succes">Validé</span>
                    ) : (
                      <span className="badge-erreur">Annulé</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {l.statut === "valide" && (
                      <form action={annulerPaiement}>
                        <input type="hidden" name="paiement_id" value={l.id} />
                        <button
                          type="submit"
                          className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Annuler
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {lignes.length >= 500 && (
        <p className="text-center text-xs text-slate-400">
          Résultats limités aux 500 collectes les plus récentes — utilisez l&apos;export pour tout télécharger.
        </p>
      )}
    </div>
  );
}
