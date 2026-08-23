"use client";

import { useActionState } from "react";
import { seConnecter, type EtatConnexion } from "@/app/actions";
import ChampMotDePasse from "@/components/champ-mot-de-passe";

export default function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState<EtatConnexion, FormData>(
    seConnecter,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="identifiant" className="etiquette">
          Identifiant ou téléphone
        </label>
        <input
          id="identifiant"
          name="identifiant"
          type="text"
          autoComplete="username"
          required
          autoCapitalize="none"
          className="champ"
          placeholder="ex : agent1 ou 690 12 34 56"
        />
      </div>
      <div>
        <label htmlFor="mot_de_passe" className="etiquette">
          Mot de passe
        </label>
        <ChampMotDePasse id="mot_de_passe" />
      </div>

      {etat.erreur && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {etat.erreur}
        </p>
      )}

      <button type="submit" disabled={enCours} className="btn-primaire w-full py-3">
        {enCours ? (
          <>
            <Spinner /> Connexion...
          </>
        ) : (
          "Se connecter"
        )}
      </button>
    </form>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
