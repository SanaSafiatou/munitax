"use client";

import { useActionState } from "react";
import {
  changerMotDePasseInitial,
  type EtatChangementMdp,
} from "@/app/actions";
import { Spinner } from "@/components/formulaire-connexion";

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
        <input
          id="nouveau"
          name="nouveau"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="champ"
        />
      </div>
      <div>
        <label htmlFor="confirmation" className="etiquette">
          Confirmer le nouveau mot de passe
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="champ"
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
