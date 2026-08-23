"use client";

import { useActionState } from "react";
import { creerTypeTaxe, type EtatTypeTaxe } from "@/app/admin/actions";
import { Spinner } from "@/components/formulaire-connexion";

const ETAT_INITIAL: EtatTypeTaxe = {};

export default function FormulaireTypeTaxe() {
  const [etat, action, enCours] = useActionState<EtatTypeTaxe, FormData>(
    creerTypeTaxe,
    ETAT_INITIAL,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nom" className="etiquette">
            Nom du type de taxe
          </label>
          <input
            id="nom"
            name="nom"
            required
            minLength={2}
            className="champ mt-1"
            placeholder="ex : Taxe de marché"
          />
        </div>
        <div>
          <label htmlFor="description" className="etiquette">
            Description (facultatif)
          </label>
          <input
            id="description"
            name="description"
            className="champ mt-1"
            placeholder="ex : Étal ou place au marché"
          />
        </div>
      </div>

      <div className="grid items-end gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="montant_fixe" className="etiquette">
            Montant fixe (FCFA)
          </label>
          <input
            id="montant_fixe"
            name="montant_fixe"
            type="number"
            min={1}
            max={999999999}
            className="champ mt-1"
            placeholder="ex : 1000"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
          <input
            type="checkbox"
            name="montant_libre"
            className="h-4 w-4 accent-emerald-600"
          />
          Montant à saisir par l&apos;agent (libre)
        </label>
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

      <button type="submit" disabled={enCours} className="btn-primaire w-full py-3 sm:w-auto">
        {enCours ? (
          <>
            <Spinner /> Ajout...
          </>
        ) : (
          "Ajouter le type de taxe"
        )}
      </button>
    </form>
  );
}
