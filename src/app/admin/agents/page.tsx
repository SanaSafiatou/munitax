import Link from "next/link";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import FormulaireCreationAgent from "@/components/formulaire-creation-agent";

export const metadata = { title: "Agents" };

export default async function PageAgents() {
  const { mairieId } = await exigerMairie("admin");

  const agents = db
    .prepare<
      [number],
      {
        id: number;
        nom_complet: string;
        telephone: string | null;
        identifiant: string;
        role: string;
        actif: number;
      }
    >(
      `SELECT id, nom_complet, telephone, identifiant, role, actif
       FROM agents WHERE mairie_id = ? AND role != 'super'
       ORDER BY role DESC, nom_complet`,
    )
    .all(mairieId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titre-page">Agents et administrateurs</h1>
        <p className="sous-titre-page">
          Comptes rattachés à votre mairie uniquement.
        </p>
      </div>

      <FormulaireCreationAgent />

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Nom</th>
              <th className="px-4 py-2.5 font-medium">Identifiant</th>
              <th className="px-4 py-2.5 font-medium">Téléphone</th>
              <th className="px-4 py-2.5 font-medium">Rôle</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agents.map((a) => (
              <tr key={a.id} className={a.actif ? "" : "opacity-50"}>
                <td className="px-4 py-2.5 font-medium">{a.nom_complet}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{a.identifiant}</td>
                <td className="px-4 py-2.5">{a.telephone ?? "—"}</td>
                <td className="px-4 py-2.5 capitalize">{a.role}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={`/admin/agents/${a.id}`}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    Détails
                  </Link>
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  Aucun agent pour le moment — créez-en un ci-dessus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
