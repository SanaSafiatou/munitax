import db from "@/lib/db";
import {
  FormulaireAjoutMairie,
  FormulaireCreationAdmin,
  ActionsMairie,
} from "@/components/formulaires-super";
import RafraichissementAuto from "@/components/rafraichissement-auto";
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
  const pastilles: Record<StatutMairie, string> = {
    active: "bg-emerald-500",
    suspendue: "bg-red-500",
    en_attente: "bg-amber-500",
  };
  const libelles: Record<StatutMairie, string> = {
    active: "Active",
    suspendue: "Suspendue",
    en_attente: "En attente",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[statut]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${pastilles[statut]}`} />
      {libelles[statut]}
    </span>
  );
}

export const dynamic = "force-dynamic";

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
               WHERE a.mairie_id = m.id AND a.role = 'agent' AND a.actif = 1) AS nb_agents,
              (SELECT a.id FROM agents a
               WHERE a.mairie_id = m.id AND a.role = 'admin' AND a.actif = 1
               ORDER BY a.id LIMIT 1) AS admin_id
       FROM mairies m ORDER BY m.nom`,
    )
    .all();

  const nbActive = mairies.filter((m) => m.statut === "active").length;
  const nbAttente = mairies.filter((m) => m.statut === "en_attente").length;
  const nbSuspendue = mairies.filter((m) => m.statut === "suspendue").length;

  const stats = [
    {
      libelle: "Mairies inscrites",
      valeur: String(mairies.length),
      detail: "Total des collectivités",
      icone: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01",
      degrade: "from-emerald-600 to-teal-500",
    },
    {
      libelle: "Actives",
      valeur: String(nbActive),
      detail: "En fonctionnement",
      icone: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
      degrade: "from-sky-600 to-cyan-500",
    },
    {
      libelle: "En attente",
      valeur: String(nbAttente),
      detail: "À approuver",
      icone: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
      degrade: "from-amber-500 to-orange-500",
    },
    {
      libelle: "Suspendues",
      valeur: String(nbSuspendue),
      detail: "Abonnement bloqué",
      icone: "M18.364 18.364A9 9 0 0 1 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636",
      degrade: "from-red-500 to-rose-500",
    },
  ];

  return (
    <div className="space-y-6">
      <RafraichissementAuto secondes={60} />

      {/* Héros premium */}
      <section className="hero-premium bg-gradient-to-br from-violet-950 via-emerald-950 to-emerald-900 p-6 sm:p-8">
        <div className="hero-halo-gauche" />
        <div className="hero-halo-droite" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Espace propriétaire
          </p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Gestion des mairies
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-emerald-100/90">
            Ajoutez autant de mairies que nécessaire, suivez leurs abonnements
            et contrôlez leurs accès. Les données de collecte restent dans
            l&apos;espace de chaque mairie.
          </p>
        </div>
      </section>

      {/* Indicateurs premium */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.libelle}
            className="group carte-premium relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(6,78,59,0.35)]"
          >
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-violet-100 to-transparent opacity-70 transition group-hover:scale-125" />
            <div className="relative flex items-center gap-3">
              <span className={`pastille-icone bg-gradient-to-br ${s.degrade}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icone} />
                </svg>
              </span>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {s.libelle}
              </p>
            </div>
            <p className="relative mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
              {s.valeur}
            </p>
            <p className="relative mt-1 text-xs text-slate-400">{s.detail}</p>
          </div>
        ))}
      </div>

      {/* Mairies en attente */}
      {nbAttente > 0 && (
        <div role="alert" className="carte-premium flex flex-wrap items-center gap-3 border-0 border-l-4 border-l-amber-400 p-4">
          <span className="pastille-icone bg-gradient-to-br from-amber-500 to-orange-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {nbAttente} mairie(s) inscrite(s) en libre-service attend(ent)
              votre approbation
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              {mairies
                .filter((m) => m.statut === "en_attente")
                .map((m) => m.nom)
                .join(" · ")}{" "}
              — utilisez le bouton « Approuver » dans le tableau ci-dessous.
            </p>
          </div>
        </div>
      )}

      {/* Ajouter une mairie */}
      <section className="carte-premium">
        <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 sm:text-base">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-emerald-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          Ajouter une mairie
        </h2>
        <div className="p-5">
          <FormulaireAjoutMairie />
        </div>
      </section>

      {/* Tableau des mairies */}
      <section className="carte-premium overflow-hidden">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 sm:text-base">
          Mairies existantes ({mairies.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-semibold">Mairie</th>
                <th className="px-5 py-2.5 font-semibold">Statut</th>
                <th className="px-5 py-2.5 font-semibold">Échéance abonnement</th>
                <th className="px-5 py-2.5 text-right font-semibold">Agents</th>
                <th className="px-5 py-2.5 font-semibold">Contact</th>
                <th className="px-5 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mairies.map((m) => {
                const ech = m.date_echeance_abonnement;
                const depassee = ech != null && ech < AUJOURDHUI();
                const ini = m.nom.trim().split(/\s+/);
                const init = ((ini[0]?.[0] ?? "") + (ini[1]?.[0] ?? "")).toUpperCase();
                return (
                  <tr key={m.id} className="align-top transition hover:bg-emerald-50/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-xs font-bold text-white shadow-sm">
                          {init}
                        </span>
                        <div className="min-w-0">
                          <span className="block truncate font-semibold text-slate-800">{m.nom}</span>
                          {m.responsable && (
                            <span className="block truncate text-xs text-slate-400">
                              {m.responsable}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <BadgeStatut statut={m.statut} />
                    </td>
                    <td className="px-5 py-3">
                      {ech == null ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <>
                          <span className={depassee ? "font-semibold text-red-600" : "tabular-nums"}>
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
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 tabular-nums">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a8.25 8.25 0 0 1 15 0" />
                        </svg>
                        {m.nb_agents}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">{m.contact ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <ActionsMairie
                        mairie={{
                          id: m.id,
                          nom: m.nom,
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

      {/* Créer un compte administrateur */}
      <section className="carte-premium">
        <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 sm:text-base">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-violet-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />
          </svg>
          Créer un compte administrateur
        </h2>
        <div className="p-5">
          <FormulaireCreationAdmin mairies={mairies.map((m) => ({ id: m.id, nom: m.nom }))} />
        </div>
      </section>
    </div>
  );
}