"use client";

import { useActionState } from "react";
import { creerCompteTesteur, type EtatInscription } from "@/app/actions";
import { Spinner } from "@/components/formulaire-connexion";
import ChampMotDePasse from "@/components/champ-mot-de-passe";

export default function FormulaireInscription({
  mairies,
}: {
  mairies: { id: number; nom: string }[];
}) {
  const [etat, action, enCours] = useActionState<EtatInscription, FormData>(
    creerCompteTesteur,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="nom_complet" className="etiquette">
          Nom complet
        </label>
        <input
          id="nom_complet"
          name="nom_complet"
          type="text"
          required
          autoComplete="name"
          className="champ"
          placeholder="ex : Marie Ngo Bassa"
        />
      </div>

      <div>
        <label htmlFor="mairie_id" className="etiquette">
          Votre mairie
        </label>
        <select id="mairie_id" name="mairie_id" required className="champ">
          {mairies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="telephone" className="etiquette">
          Numéro de téléphone
          <span className="ml-1 font-normal text-slate-400">
            (sert d&apos;identifiant)
          </span>
        </label>
        <input
          id="telephone"
          name="telephone"
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          className="champ"
          placeholder="ex : 690 12 34 56"
        />
      </div>

      <div>
        <label htmlFor="email" className="etiquette">
          Adresse e-mail{" "}
          <span className="font-normal text-slate-400">(facultatif)</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="champ"
          placeholder="ex : marie@exemple.com"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="mot_de_passe" className="etiquette">
            Mot de passe
          </label>
          <ChampMotDePasse
            id="mot_de_passe"
            autoComplete="new-password"
            placeholder="6 caractères minimum"
          />
        </div>
        <div>
          <label htmlFor="confirmation" className="etiquette">
            Confirmation
          </label>
          <ChampMotDePasse
            id="confirmation"
            autoComplete="new-password"
            placeholder="Répétez le mot de passe"
          />
        </div>
      </div>

      {etat.erreur && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {etat.erreur}
        </p>
      )}

      <button type="submit" disabled={enCours} className="btn-primaire w-full py-3">
        {enCours ? (
          <>
            <Spinner /> Création du compte...
          </>
        ) : (
          "Créer mon compte gratuit"
        )}
      </button>

      <p className="text-center text-xs leading-relaxed text-slate-400">
        Compte de démonstration : gratuit, sans engagement et sans moyen de
        paiement réel. Vos essais utilisent uniquement des transactions
        simulées.
      </p>
    </form>
  );
}
