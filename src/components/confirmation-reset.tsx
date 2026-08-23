"use client";

import { useActionState, useState } from "react";
import {
  reinitialiserDonnees,
  type EtatReinitialisation,
} from "@/app/super/actions";
import { Spinner } from "@/components/formulaire-connexion";

export default function ConfirmationReset() {
  const [etat, action, enCours] = useActionState<EtatReinitialisation, FormData>(
    reinitialiserDonnees,
    {},
  );
  const [confirmationDemandee, setConfirmationDemandee] = useState(false);

  if (etat.succes) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
        </svg>
        <p>{etat.succes}</p>
      </div>
    );
  }

  if (!confirmationDemandee) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setConfirmationDemandee(true)}
          className="btn-danger"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.7 4.3 19.7 7.3M5 21h14a1 1 0 0 0 1-1V8l-5-5H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1zm2-12h6M7 13h6M7 17h4" />
          </svg>
          Réinitialiser les données de démonstration
        </button>
        {etat.erreur && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {etat.erreur}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-800">
        Confirmer la réinitialisation ?
      </p>
      <p className="mt-1 text-sm text-red-700">
        Tous les comptes créés par les testeurs et tous les paiements enregistrés
        seront définitivement effacés et remplacés par les données fictives.
      </p>
      <form action={action} className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={enCours} className="btn-danger">
          {enCours ? (
            <>
              <Spinner /> Réinitialisation...
            </>
          ) : (
            "Oui, tout réinitialiser"
          )}
        </button>
        <button
          type="button"
          onClick={() => setConfirmationDemandee(false)}
          disabled={enCours}
          className="btn-secondaire"
        >
          Annuler
        </button>
      </form>
    </div>
  );
}
