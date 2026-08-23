import db from "@/lib/db";
import {
  FormulaireAjoutMairie,
  FormulaireCreationAdmin,
  ActionsMairie,
} from "@/components/formulaires-super";
import type { StatutMairie } from "@/lib/db";

export const metadata = { title: "Gestion des mairies" };

const AUJOURDHUI = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

function BadgeStatut({ statut }: { statut: StatutMairie }) {
  const styles: Record<StatutMairie, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    suspendue: "bg-red-50 text-red-700 ring-red-200",
    en_attente: "bg-amber-50 text-amber-700 ring-amber-200",
  };
  const libelles: Record<StatutMairie, string> = {
    active: "Active",
    suspendue: "Suspendue",
    en_attente: "En attente",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${styles[statut]}`}
    >
      {libelles[statut]}
    </span>
  );
}

export default function PageSuper() {
  const mairies = db
    .prepare<
      [],
      {
        id: number;
        nom: string;
        statut: StatutMairie;
        date_echeance_abonnement: number | null;
        responsable: string | null;
        contact: string | null;
        nb_agents: number;
        admin_id: number | null;
      }
    >(
      `SELECT m.id, m.nom, m.statut, m.date_echeance_abonnement, m.responsable, m.contact,
              (SELECT COUNT(*) FROM agents a
               WHERE a.mairie_id = m.id AND a.actif = 1) AS nb_agents,
              (SELECT a.id FROM agents a
               WHERE a.mairie_id = m.id AND a.role = 'admin' AND a.actif = 1
               ORDER BY a.id LIMIT 1) AS admin_id
       FROM mairies m ORDER BY m.nom`,
    )
    .all();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titre-page">Mairies</h1>
        <p className="sous-titre-page">
          Ajoutez autant de mairies que nécessaire, suivez leurs abonnements et
          contrôlez leurs accès. Les données de collecte restent dans l&apos;espace
          de chaque mairie.
        </p>
      </div>

      <section className="carte">
        <h2 className="carte-titre">Ajouter une mairie</h2>
        <FormulaireAjoutMairie />
      </section>

      <section className="carte">
        <h2 className="carte-titre">Mairies existantes ({mairies.length})</h2>
        <div className="overflow-x-auto p-4 pt-3">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-medium">Mairie</th>
                <th className="py-2 pr-4 font-medium">Statut</th>
                <th className="py-2 pr-4 font-medium">Échéance abonnement</th>
                <th className="py-2 pr-4 text-right font-medium">Agents</th>
                <th className="py-2 pr-4 font-medium">Contact</th>
                <th className="py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mairies.map((m) => {
                const ech = m.date_echeance_abonnement;
                const depassee = ech != null && ech < AUJOURDHUI();
                return (
                  <tr key={m.id} className="align-top hover:bg-slate-50/60">
                    <td className="py-2.5 pr-4">
                      <span className="font-semibold text-slate-800">{m.nom}</span>
                      {m.responsable && (
                        <span className="block text-xs text-slate-400">
                          {m.responsable}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <BadgeStatut statut={m.statut} />
                    </td>
                    <td className="py-2.5 pr-4">
                      {ech == null ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <>
                          <span className={depassee ? "font-semibold text-red-600" : ""}>
                            {new Date(ech).toLocaleDateString("fr-FR")}
                          </span>
                          {depassee && (
                            <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                              Dépassée
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right">{m.nb_agents}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-500">
                      {m.contact ?? "—"}
                    </td>
                    <td className="py-2.5">
                      <ActionsMairie
                        mairie={{
                          id: m.id,
                          statut: m.statut,
                          adminId: m.admin_id,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
              {mairies.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                    Aucune mairie pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="carte">
        <h2 className="carte-titre">Créer un compte administrateur</h2>
        <FormulaireCreationAdmin mairies={mairies.map((m) => ({ id: m.id, nom: m.nom }))} />
      </section>
    </div>
  );
}
