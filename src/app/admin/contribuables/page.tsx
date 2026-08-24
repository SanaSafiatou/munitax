import Link from "next/link";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import { dateHeureStr, dateStr } from "@/lib/dates";
import FormulaireMessageContribuables from "@/components/formulaire-message-contribuables";

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

  const messages = db
    .prepare<
      [number],
      {
        id: number;
        contenu: string;
        cree_le: number;
        nb_destinataires: number;
        nb_lus: number;
        nb_sms: number;
      }
    >(
      `SELECT m.id, m.contenu, m.cree_le,
              COUNT(d.id) AS nb_destinataires,
              SUM(CASE WHEN d.lu_le IS NOT NULL THEN 1 ELSE 0 END) AS nb_lus,
              SUM(CASE WHEN TRIM(COALESCE(c.telephone, '')) != '' THEN 1 ELSE 0 END) AS nb_sms
       FROM messages m
       LEFT JOIN messages_destinataires d ON d.message_id = m.id
       LEFT JOIN contribuables c ON c.id = d.contribuable_id
       WHERE m.mairie_id = ?
       GROUP BY m.id
       ORDER BY m.cree_le DESC
       LIMIT 20`,
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

      {/* Envoi d'un message à tous ou partie des contribuables de la mairie */}
      <details className="carte p-5 sm:p-6">
        <summary className="flex cursor-pointer items-center gap-2 text-base font-bold text-emerald-800">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
          </svg>
          Envoyer un message aux contribuables
        </summary>
        <p className="mb-4 mt-2 text-sm text-slate-500">
          Notification dans l&apos;espace en ligne des contribuables concernés,
          et SMS pour ceux qui ont un numéro renseigné.
        </p>
        <FormulaireMessageContribuables
          contribuables={contribuables.map((c) => ({
            id: c.id,
            nom_complet: c.nom_complet,
            code: c.code,
            telephone: c.telephone,
          }))}
        />
      </details>

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
                    {c.telephone ? `+225 ${c.telephone}` : "Sans téléphone"}
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
                      {c.telephone ? `+225 ${c.telephone}` : "—"}
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

      {/* Historique des messages déjà envoyés par cette mairie */}
      <section>
        <h2 className="mb-3 mt-4 font-semibold text-slate-900">
          Messages déjà envoyés ({messages.length})
        </h2>
        {messages.length === 0 ? (
          <p className="carte p-6 text-center text-sm text-slate-500">
            Aucun message pour le moment. Utilisez « Envoyer un message aux
            contribuables » ci-dessus.
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="carte p-4 sm:p-5">
                <p className="whitespace-pre-wrap break-words text-sm text-slate-800">
                  {m.contenu}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {dateHeureStr(m.cree_le)} · {m.nb_destinataires}{" "}
                  destinataire{m.nb_destinataires > 1 ? "s" : ""}
                  {m.nb_sms > 0
                    ? ` · dont ${m.nb_sms} par SMS`
                    : " · aucun SMS possible"}
                  {" · "}
                  {m.nb_lus >= (m.nb_destinataires ?? 0) && m.nb_lus > 0
                    ? "vu(s) par tous"
                    : `${m.nb_lus} lu${m.nb_lus > 1 ? "s" : ""}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
