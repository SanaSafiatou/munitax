"use client";

import { useActionState } from "react";
import { seConnecter, type EtatConnexion } from "@/app/actions";
import { Spinner } from "@/components/formulaire-connexion";

const COMPTES = [
  {
    valeur: "super",
    role: "Super-administrateur",
    detail: "Ajout de mairies, comptes admin",
  },
  {
    valeur: "adminBeoumi",
    role: "Admin — Béoumi",
    detail: "Tableau de bord et agents de Béoumi",
  },
  {
    valeur: "adminBouake",
    role: "Admin — Bouaké",
    detail: "Tableau de bord et agents de Bouaké",
  },
  {
    valeur: "agent1",
    role: "Agent collecteur — Béoumi",
    detail: "Encaissement terrain avec GPS",
  },
  {
    valeur: "agent2",
    role: "Agent collecteur — Bouaké",
    detail: "Encaissement terrain avec GPS",
  },
  {
    valeur: "testeur",
    role: "Contribuable",
    detail: "Paiement en ligne de démonstration",
  },
];

export default function ComptesDemo() {
  const [etat, action, enCours] = useActionState<EtatConnexion, FormData>(
    seConnecter,
    {},
  );

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Comptes de démonstration
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">
        Un clic pour essayer chaque profil — données fictives.
      </p>

      <form action={action} className="mt-3 space-y-2">
        {COMPTES.map((c) => (
          <button
            key={c.valeur}
            type="submit"
            name="compte"
            value={c.valeur}
            disabled={enCours}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 disabled:opacity-60"
          >
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                {c.role}
              </span>
              <span className="block text-xs text-slate-500">{c.detail}</span>
            </span>
            {enCours ? <Spinner /> : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
              </svg>
            )}
          </button>
        ))}
      </form>

      {etat.erreur && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {etat.erreur}
        </p>
      )}
    </div>
  );
}
