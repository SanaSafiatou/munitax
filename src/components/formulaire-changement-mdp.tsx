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
      <div>
        <label htmlFor="nouveau" className="etiquette">
          Nouveau mot de passe (6 caractères minimum)
        </label>
        <ChampMotDePasse
          id="nouveau"
          autoComplete="new-password"
          placeholder="6 caractères minimum"
        />
      </div>
      <div>
        <label htmlFor="confirmation" className="etiquette">
          Confirmer le nouveau mot de passe
        </label>
        <ChampMotDePasse
          id="confirmation"
          autoComplete="new-password"
          placeholder="Répétez le mot de passe"
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
          "Enregistrer mon nouveau mot de passe"
        )}
      </button>
    </form>
  );
}
