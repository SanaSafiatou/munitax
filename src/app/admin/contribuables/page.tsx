import Link from "next/link";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import { dateStr } from "@/lib/dates";

export const metadata = { title: "Contribuables" };

export default async function PageContribuables() {
  const { mairieId } = await exigerMairie("admin");

  const contribuables = db
    .prepare<
      [number],
      {
        id: number;
        code: string | null;
        nom_complet: string;
        telephone: string | null;
        email: string | null;
        cree_le: number;
        nb_paiements: number;
        total: number | null;
      }
    >(
      `SELECT c.id, c.code, c.nom_complet, c.telephone, c.email, c.cree_le,
              COUNT(p.id) AS nb_paiements,
              SUM(CASE WHEN p.statut = 'valide' THEN p.montant END) AS total
       FROM contribuables c
       LEFT JOIN paiements p ON p.contribuable_id = c.id
       WHERE c.mairie_id = ?
       GROUP BY c.id
       ORDER BY c.cree_le DESC`,
    )
    .all(mairieId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="titre-page">Contribuables</h1>
        <p className="sous-titre-page">
          Fiches créées sur le terrain par vos agents et comptes en ligne de
          votre mairie.
        </p>
      </div>

      <div className="carte overflow-hidden">
        {contribuables.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Aucun contribuable pour le moment. Les fiches sont créées par les
            agents lors des collectes.
          </p>
        ) : (
          <>
            {/* Mobile : cartes */}
            <ul className="divide-y divide-slate-100 sm:hidden">
              {contribuables.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <p className="font-medium">{c.nom_complet}</p>
                  <p className="font-mono text-xs text-emerald-700">{c.code ?? "—"}</p>
                  <p className="text-xs text-slate-500">
                    {c.telephone ? `+237 ${c.telephone}` : "Sans téléphone"}
                    {c.email ? ` · ${c.email}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {c.nb_paiements} paiement(s) · {dateStr(c.cree_le)}
                  </p>
                </li>
              ))}
            </ul>

            {/* Desktop : tableau */}
            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Nom</th>
                  <th className="px-5 py-3 font-medium">Téléphone</th>
                  <th className="px-5 py-3 font-medium">Créé le</th>
                  <th className="px-5 py-3 text-right font-medium">Paiements</th>
                  <th className="px-5 py-3 text-right font-medium">Total payé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contribuables.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-semibold text-emerald-700">
                      {c.code ?? "—"}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800">{c.nom_complet}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                      {c.telephone ? `+237 ${c.telephone}` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{dateStr(c.cree_le)}</td>
                    <td className="px-5 py-3 text-right">{c.nb_paiements}</td>
                    <td className="px-5 py-3 text-right font-semibold">
                      {c.total != null ? `${new Intl.NumberFormat("fr-FR").format(c.total)} FCFA` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <Link href="/admin/collectes" className="lien-action">
        Voir toutes les collectes →
      </Link>
    </div>
  );
}
