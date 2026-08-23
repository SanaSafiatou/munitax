"use client";

import { useState } from "react";

/**
 * Champ mot de passe avec bouton d'affichage/masquage (icône œil).
 * Remplace <input type="password"> partout où l'utilisateur saisit un secret.
 */
export default function ChampMotDePasse({
  id,
  autoComplete = "current-password",
  placeholder = "••••••••",
  className = "champ",
  requis = true,
}: {
  id: string;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
  requis?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={requis}
        className={`${className} pr-11`}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        title={visible ? "Masquer" : "Afficher"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition hover:text-slate-600"
      >
        {visible ? (
          // œil barré
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c7 0 10 7 10 7a17.4 17.4 0 0 1-2.2 3.2M6.6 6.6C3.8 8.3 2 12 2 12s3 7 10 7c1.5 0 2.9-.35 4.1-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </svg>
        ) : (
          // œil
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
