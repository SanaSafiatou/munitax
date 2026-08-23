"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  inscrireMairie,
  type EtatInscriptionMairie,
} from "@/app/actions";
import { Spinner } from "@/components/formulaire-connexion";

/** Demande d'inscription d'une mairie (page publique). */
export default function FormulaireInscriptionMairie() {
  const [etat, action, enCours] = useActionState<
    EtatInscriptionMairie,
    FormData
  >(inscrireMairie, {});

  if (etat.identifiants) {
    return (
      <div className="space-y-5">
        <div
          role="status"
          className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200"
        >
          <p className="text-sm font-semibold text-emerald-800">
            Demande enregistrée pour la mairie de {etat.identifiants.mairie}.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-emerald-700">
            Votre mairie est en attente d&apos;approbation. Conservez dès
            maintenant les identifiants du compte administrateur — ils ne
            seront plus affichés :
          </p>
          <dl className="mt-3 space-y-1 font-mono text-sm text-emerald-900">
            <div className="flex justify-between gap-4">
              <dt className="font-sans text-emerald-700">Identifiant</dt>
              <dd className="font-bold">{etat.identifiants.identifiant}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-sans text-emerald-700">Mot de passe</dt>
              <dd className="font-bold">{etat.identifiants.motDePasse}</dd>
            </div>
          </dl>
        </div>
        <Link href="/login" className="btn-primaire block w-full py-3 text-center">
          Aller à la page de connexion
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="insc-nom" className="etiquette">
          Nom de la mairie
        </label>
        <input
          id="insc-nom"
          name="nom"
          type="text"
          required
          minLength={2}
          className="champ w-full"
          placeholder="ex : Daloa"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="insc-responsable" className="etiquette">
            Responsable (facultatif)
          </label>
          <input
            id="insc-responsable"
            name="responsable"
            type="text"
            className="champ w-full"
            placeholder="ex : M. le maire Koné"
          />
        </div>
        <div>
          <label htmlFor="insc-contact" className="etiquette">
            Téléphone / e-mail (facultatif)
          </label>
          <input
            id="insc-contact"
            name="contact"
            type="text"
            className="champ w-full"
            placeholder="+237 …"
          />
        </div>
      </div>
      <div>
        <label htmlFor="insc-admin" className="etiquette">
          Nom complet du futur administrateur
        </label>
        <input
          id="insc-admin"
          name="admin_nom"
          type="text"
          required
          minLength={3}
          className="champ w-full"
          placeholder="ex : Sylvain Kouamé"
        />
        <p className="mt-1 text-xs text-slate-400">
          Un compte administrateur sera créé ; ses identifiants s&apos;afficheront
          une seule fois après l&apos;envoi.
        </p>
      </div>

      <button
        type="submit"
        disabled={enCours}
        className="btn-primaire w-full py-3"
      >
        {enCours ? (
          <>
            <Spinner /> Envoi…
          </>
        ) : (
          "Envoyer la demande d'inscription"
        )}
      </button>

      {etat.erreur && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
        >
          {etat.erreur}
        </p>
      )}
    </form>
  );
}
