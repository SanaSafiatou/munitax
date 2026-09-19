"use client";

import { useActionState } from "react";
import {
  changerMotDePasseInitial,
  type EtatChangementMdp,
} from "@/app/actions";
import { Spinner } from "@/components/formulaire-connexion";
import ChampMotDePasse from "@/components/champ-mot-de-passe";

export default function FormulaireChangementMdp() {
  const [etat, action, enCours] = useActionState<EtatChangementMdp, FormData>(
    changerMotDePasseInitial,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-500">
        Choisissez un code à 4 chiffres, connu de vous seul.
      </p>
      <div>
        <label htmlFor="nouveau" className="etiquette">
          Nouveau code (4 chiffres)
        </label>
        <ChampMotDePasse
          id="nouveau"
          autoComplete="new-password"
          placeholder="4 chiffres"
          inputMode="numeric"
          maxLength={4}
          pattern="[0-9]{4}"
          conseil="Uniquement des chiffres, entre 0000 et 9999."
        />
      </div>
      <div>
        <label htmlFor="confirmation" className="etiquette">
          Confirmer le nouveau code
        </label>
        <ChampMotDePasse
          id="confirmation"
          autoComplete="new-password"
          placeholder="Répétez le code"
          inputMode="numeric"
          maxLength={4}
          pattern="[0-9]{4}"
        />
      </div>
      {etat.erreur && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {etat.erreur}
        </p>
      )}
      <button type="submit" disabled={enCours} className="btn-primaire w-full py-3">
        {enCours ? (
          <>
            <Spinner /> Enregistrement…
          </>
        ) : (
          "Enregistrer mon nouveau code"
        )}
      </button>
    </form>
  );
}
