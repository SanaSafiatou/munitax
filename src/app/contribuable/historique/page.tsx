import Link from "next/link";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import { dateHeureStr, montantFmt } from "@/lib/dates";

export const metadata = { title: "Mes paiements" };

type Ligne = {
  id: number;
  reference: string | null;
  montant: number;
  date_heure: number;
  statut: "valide" | "annule";
  mode: "terrain" | "en_ligne";
  taxe_nom: string;
};

export default async function PageHistoriqueContribuable() {
  const session = await exigerMairie("contribuable");

  const lignes = db
    .prepare<[number], Ligne>(
      `SELECT p.id, p.reference, p.montant, p.date_heure, p.statut, p.mode, t.nom AS taxe_nom
       FROM paiements p JOIN types_taxe t ON t.id = p.type_taxe_id
       WHERE p.contribuable_id = ?
       ORDER BY p.date_heure DESC LIMIT 200`,
    )
    .all(session.id);

  const totalValide = lignes
    .filter((l) => l.statut === "valide")
    .reduce((s, l) => s + l.montant, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="titre-page">Mes paiements</h1>
          <p className="sous-titre-page">
            Historique complet de vos quittances de démonstration.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          Total validé :{" "}
          <span className="font-semibold text-slate-900">{montantFmt(totalValide)}</span>
        </p>
      </div>

      {lignes.length === 0 ? (
        <div className="carte flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
            </svg>
          </span>
          <p className="text-sm text-slate-500">
            Aucun paiement pour le moment.
          </p>
          <Link href="/contribuable" className="btn-primaire">
            Payer une taxe (démonstration)
          </Link>
        </div>
      ) : (
        <>
          {/* Vue mobile : cartes */}
          <ul className="carte divide-y divide-slate-100 sm:hidden">
            {lignes.map((l) => (
              <li key={l.id}>
                <Link href={`/recu/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{l.taxe_nom}</span>
                    <span className="block text-xs text-slate-500">
                      {dateHeureStr(l.date_heure)} · {l.reference ?? `#${l.id}`}
                    </span>
                  </span>
                  <span className={`shrink-0 font-semibold ${l.statut === "valide" ? "" : "text-red-500 line-through"}`}>
                    {montantFmt(l.montant)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Vue tableau (ordinateur) */}
          <div className="carte hidden overflow-hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Référence</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Taxe</th>
                  <th className="px-5 py-3 font-medium">Mode</th>
                  <th className="px-5 py-3 text-right font-medium">Montant</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lignes.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/recu/${l.id}`} className="font-mono text-xs text-emerald-700 hover:underline">
                        {l.reference ?? `#${l.id}`}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                      {dateHeureStr(l.date_heure)}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800">{l.taxe_nom}</td>
                    <td className="px-5 py-3">
                      {l.mode === "en_ligne" ? (
                        <span className="badge-neutre">En ligne (démo)</span>
                      ) : (
                        <span className="badge-neutre">Terrain</span>
                      )}
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold ${l.statut !== "valide" ? "text-red-500 line-through" : ""}`}>
                      {montantFmt(l.montant)}
                    </td>
                    <td className="px-5 py-3">
                      {l.statut === "valide" ? (
                        <span className="badge-succes">Validé</span>
                      ) : (
                        <span className="badge-erreur">Annulé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
