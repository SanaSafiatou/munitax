"use client";

import { useActionState } from "react";
import { connexionSuper, type EtatConnexionSuper } from "@/app/super/actions";

export default function FormulaireConnexionSuper() {
  const [etat, action, enCours] = useActionState<EtatConnexionSuper, FormData>(
    connexionSuper,
    {},
  );

  return (
    <form action={action} className="carte space-y-4 border-violet-900/40 bg-slate-900 p-6 ring-1 ring-violet-800/30">
      <div>
        <label htmlFor="super-identifiant" className="etiquette text-slate-300">
          Identifiant
        </label>
        <input
          id="super-identifiant"
          name="identifiant"
          type="text"
          required
          autoComplete="username"
          className="champ mt-1 bg-slate-800 text-slate-100 placeholder:text-slate-500"
          placeholder="Identifiant propriétaire"
        />
      </div>
      <div>
        <label htmlFor="super-motdepasse" className="etiquette text-slate-300">
          Mot de passe
        </label>
        <input
          id="super-motdepasse"
          name="mot_de_passe"
          type="password"
          required
          autoComplete="current-password"
          className="champ mt-1 bg-slate-800 text-slate-100 placeholder:text-slate-500"
          placeholder="••••••••"
        />
      </div>

      {etat.erreur && (
        <p role="alert" className="rounded-xl bg-red-950 px-3 py-2 text-sm text-red-300 ring-1 ring-red-800">
          {etat.erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
      >
        {enCours ? "Connexion…" : "Accéder à l'espace propriétaire"}
      </button>
    </form>
  );
}
