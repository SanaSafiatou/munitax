"use client";

import { useActionState, useState } from "react";
import {
  enregistrerAgentsType,
  type EtatAffectationType,
} from "@/app/admin/actions";
import { Spinner } from "@/components/formulaire-connexion";

export type AgentListe = { id: number; nom_complet: string; identifiant: string };

const ETAT_INITIAL: EtatAffectationType = {};

/**
 * Panneau « à qui confier ce type ? » : une case par agent, plus l'option
 * « Tous les agents ». Utilisé juste après la création d'un type et dans la
 * liste des types configurés.
 */
export default function AffectationAgentsType({
  typeId,
  nom,
  agents,
  assignes,
}: {
  typeId: number;
  nom?: string;
  agents: AgentListe[];
  assignes: number[];
}) {
  const [etat, action, enCours] = useActionState<EtatAffectationType, FormData>(
    enregistrerAgentsType,
    ETAT_INITIAL,
  );
  const [choisis, setChoisis] = useState<Set<number>>(new Set(assignes));

  if (agents.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun agent à qui confier ce type pour le moment : créez d&apos;abord des
        agents dans le menu « Agents ».
      </p>
    );
  }

  const tous = agents.map((a) => a.id);
  const tousCoche = tous.length > 0 && tous.every((id) => choisis.has(id));
  const basculeTous = () => setChoisis(tousCoche ? new Set() : new Set(tous));
  const bascule = (id: number) =>
    setChoisis((prec) => {
      const suivant = new Set(prec);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="type_taxe_id" value={typeId} />
      {nom && (
        <p className="text-sm font-semibold text-slate-800">
          À qui confier «&nbsp;{nom}&nbsp;» ?
        </p>
      )}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200">
        <input
          type="checkbox"
          checked={tousCoche}
          onChange={basculeTous}
          className="h-4 w-4 accent-emerald-600"
        />
        Tous les agents ({agents.length})
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {agents.map((a) => (
          <label
            key={a.id}
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <input
              type="checkbox"
              name="agents"
              value={a.id}
              checked={choisis.has(a.id)}
              onChange={() => bascule(a.id)}
              className="h-4 w-4 accent-emerald-600"
            />
            <span className="font-medium text-slate-800">{a.nom_complet}</span>
          </label>
        ))}
      </div>
      {etat.erreur && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {etat.erreur}
        </p>
      )}
      {etat.succes && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          {etat.succes}
        </p>
      )}
      <button type="submit" disabled={enCours} className="btn-primaire py-2.5">
        {enCours ? (
          <>
            <Spinner /> Enregistrement…
          </>
        ) : (
          "Enregistrer la sélection"
        )}
      </button>
    </form>
  );
}
