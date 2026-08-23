import db from "@/lib/db";
import { exigerMairie, nomMairie } from "@/lib/auth";
import { montantFmt } from "@/lib/dates";
import FormulaireTypeTaxe from "@/components/formulaire-type-taxe";
import AffectationAgentsType from "@/components/affectation-agents-type";
import { modifierTypeTaxe, supprimerTypeTaxe } from "@/app/admin/actions";

export const metadata = { title: "Types de taxes" };

export default async function PageTypesTaxe() {
  const session = await exigerMairie("admin");

  const types = db
    .prepare<
      [number],
      {
        id: number;
        nom: string;
        description: string | null;
        montant_fixe: number | null;
        montant_libre: number;
        utilisations: number;
      }
    >(
      `SELECT t.id, t.nom, t.description, t.montant_fixe, t.montant_libre,
              (SELECT COUNT(*) FROM paiements p WHERE p.type_taxe_id = t.id) AS utilisations
       FROM types_taxe t
       WHERE t.mairie_id = ? AND t.actif = 1
       ORDER BY t.nom`,
    )
    .all(session.mairieId);

  const agents = db
    .prepare<[number], { id: number; nom_complet: string; identifiant: string }>(
      "SELECT id, nom_complet, identifiant FROM agents WHERE mairie_id = ? AND role = 'agent' AND actif = 1 ORDER BY nom_complet",
    )
    .all(session.mairieId);

  const affectesParType = new Map<number, number[]>();
  for (const r of db
    .prepare<[number], { type_taxe_id: number; agent_id: number }>(
      `SELECT a.type_taxe_id, a.agent_id
       FROM affectations_types_taxe a
       JOIN agents g ON g.id = a.agent_id
       WHERE g.mairie_id = ? AND g.role = 'agent'`,
    )
    .all(session.mairieId)) {
    const liste = affectesParType.get(r.type_taxe_id) ?? [];
    liste.push(r.agent_id);
    affectesParType.set(r.type_taxe_id, liste);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Types de taxes</h1>
        <p className="sous-titre-page">
          Ce que les agents voient dans leur liste « Choisir le type de taxe » pour{" "}
          {nomMairie(session.mairieId)}.
        </p>
      </header>

      <section className="carte mb-8 p-6 sm:p-8">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Ajouter un type de taxe</h2>
        <FormulaireTypeTaxe agents={agents} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          Types configurés ({types.length})
        </h2>

        {types.length === 0 ? (
          <p className="carte p-6 text-center text-sm text-slate-500">
            Aucun type de taxe pour le moment : ajoutez-en un ci-dessus pour que vos
            agents puissent encaisser.
          </p>
        ) : (
          <ul className="space-y-3">
            {types.map((t) => (
              <li key={t.id} className="carte p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{t.nom}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {t.montant_libre
                        ? "Montant à saisir par l'agent"
                        : montantFmt(t.montant_fixe ?? 0)}
                      {" · "}
                      {t.utilisations === 0
                        ? "aucun encaissement"
                        : `${t.utilisations} encaissement${t.utilisations > 1 ? "s" : ""}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <details className="relative">
                      <summary className="btn-fantome cursor-pointer list-none px-3 py-1.5 text-sm">
                        Modifier
                      </summary>
                      <form
                        action={modifierTypeTaxe}
                        className="mt-2 grid w-full min-w-64 gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:min-w-96"
                      >
                        <input type="hidden" name="id" value={t.id} />
                        <input name="nom" defaultValue={t.nom} required minLength={2} className="champ" aria-label="Nom" />
                        <input
                          name="montant_fixe"
                          type="number"
                          min={1}
                          defaultValue={t.montant_fixe ?? ""}
                          disabled={!!t.montant_libre}
                          className="champ"
                          placeholder="Montant fixe (FCFA)"
                          aria-label="Montant fixe"
                        />
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            name="montant_libre"
                            defaultChecked={!!t.montant_libre}
                            className="h-4 w-4 accent-emerald-600"
                          />
                          Montant à saisir par l&apos;agent
                        </label>
                        <button type="submit" className="btn-primaire py-2 text-sm">
                          Enregistrer
                        </button>
                      </form>
                    </details>

                    <form action={supprimerTypeTaxe}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        title={
                          t.utilisations > 0
                            ? "Sera désactivé (déjà utilisé par des encaissements)"
                            : "Supprimer"
                        }
                        className="rounded-xl px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </form>
                  </div>
                </div>
              <details className="mt-3 border-t border-slate-100 pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-emerald-700">
                  Agents assignés ({(affectesParType.get(t.id) ?? []).length}/{agents.length})
                </summary>
                <div className="mt-3">
                  <AffectationAgentsType
                    typeId={t.id}
                    agents={agents}
                    assignes={affectesParType.get(t.id) ?? []}
                  />
                </div>
              </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
