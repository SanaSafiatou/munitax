"use client";

import { useActionState } from "react";
import {
  creerAgent,
  type EtatCreationAgent,
} from "@/app/admin/actions";
import { Spinner } from "@/components/formulaire-connexion";

/**
 * Création d'un agent par l'administrateur : identifiant + code PIN
 * générés automatiquement, affichés une seule fois.
 */
export default function FormulaireCreationAgent() {
  const [etat, action, enCours] = useActionState<EtatCreationAgent, FormData>(
    creerAgent,
    {},
  );

  return (
    <section className="carte">
      <h2 className="carte-titre">Ajouter un agent collecteur</h2>
      <form action={action} className="space-y-4 p-5 pt-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="agent-nom" className="etiquette">
              Nom complet de l&apos;agent
            </label>
            <input
              id="agent-nom"
              name="nom_complet"
              type="text"
              required
              minLength={3}
              className="champ"
              placeholder="ex : Ibrahim Coulibaly"
            />
          </div>
          <div>
            <label htmlFor="agent-tel" className="etiquette">
              Téléphone (facultatif)
            </label>
            <input
              id="agent-tel"
              name="telephone"
              type="tel"
              className="champ"
              placeholder="+237 …"
            />
          </div>
        </div>
        <p className="-mt-1 text-xs text-slate-400">
          L&apos;agent est rattaché automatiquement à votre mairie. Son
          identifiant et son code PIN à 6 chiffres sont générés puis affichés
          une seule fois ; il devra choisir son propre mot de passe à la
          première connexion.
        </p>

        <button
          type="submit"
          disabled={enCours}
          className="btn-primaire w-full sm:w-auto"
        >
          {enCours ? (
            <>
              <Spinner /> Création…
            </>
          ) : (
            "Créer le compte agent"
          )}
        </button>

        {etat.erreur && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {etat.erreur}
          </p>
        )}
        {etat.compteCree && (
          <div role="status" className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
            <p className="text-sm font-semibold text-emerald-800">
              Agent {etat.compteCree.nomComplet} créé pour la mairie de{" "}
              {etat.compteCree.mairie}.
            </p>
            <dl className="mt-2 space-y-1 font-mono text-sm text-emerald-900">
              <div className="flex justify-between gap-4">
                <dt className="font-sans text-emerald-700">Identifiant</dt>
                <dd className="font-bold">{etat.compteCree.identifiant}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-sans text-emerald-700">Code PIN initial</dt>
                <dd className="font-bold">{etat.compteCree.codePin}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Communiquez ces informations à l&apos;agent maintenant : elles ne
              seront plus jamais affichées.
            </p>
          </div>
        )}
      </form>
    </section>
  );
}
