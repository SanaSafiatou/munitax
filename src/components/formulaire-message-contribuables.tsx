"use client";

import { useActionState, useState } from "react";
import { envoyerMessage, type EtatMessage } from "@/app/admin/actions";
import { Spinner } from "@/components/formulaire-connexion";

export type ContribuableListe = {
  id: number;
  nom_complet: string;
  code: string | null;
  telephone: string | null;
};

const MAX_LONGUEUR = 500;

const ETAT_INITIAL: EtatMessage = {};

/**
 * Formulaire « Envoyer un message aux contribuables » : texte libre, cible
 * « tous » ou sélection case par case (même mécanique que l'affectation des
 * types de taxes aux agents). La liste ne contient que les contribuables de
 * la mairie de l'administrateur connecté.
 */
export default function FormulaireMessageContribuables({
  contribuables,
}: {
  contribuables: ContribuableListe[];
}) {
  const [etat, action, enCours] = useActionState<EtatMessage, FormData>(
    envoyerMessage,
    ETAT_INITIAL,
  );
  const [tous, setTous] = useState(true);
  const [contenu, setContenu] = useState("");
  const [choisis, setChoisis] = useState<Set<number>>(new Set());

  if (contribuables.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun contribuable à contacter pour le moment.
      </p>
    );
  }

  const idsTous = contribuables.map((c) => c.id);
  const tousCoche =
    idsTous.length > 0 && idsTous.every((id) => choisis.has(id));
  const basculeTous = () =>
    setChoisis(tousCoche ? new Set() : new Set(idsTous));
  const bascule = (id: number) =>
    setChoisis((prec) => {
      const suivant = new Set(prec);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="message-contenu" className="etiquette">
          Message
        </label>
        <textarea
          id="message-contenu"
          name="contenu"
          rows={3}
          required
          maxLength={MAX_LONGUEUR}
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          className="champ"
          placeholder="ex : Les collectes reprendront samedi dès 8 h à la grande marché."
        />
        <p className="mt-1 text-right text-xs text-slate-400">
          {contenu.length}/{MAX_LONGUEUR}
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="etiquette mb-1">Destinataires</legend>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200">
          <input
            type="radio"
            name="cible"
            value="tous"
            checked={tous}
            onChange={() => setTous(true)}
            className="h-4 w-4 accent-emerald-600"
          />
          Tous les contribuables ({contribuables.length})
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50">
          <input
            type="radio"
            name="cible"
            value="selection"
            checked={!tous}
            onChange={() => setTous(false)}
            className="h-4 w-4 accent-emerald-600"
          />
          Sélection précise
        </label>

        {!tous && (
          <div className="grid gap-2 sm:grid-cols-2">
            {contribuables.length > 3 && (
              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={tousCoche}
                  onChange={basculeTous}
                  className="h-4 w-4 accent-emerald-600"
                />
                Tout cocher / décocher
              </label>
            )}
            {contribuables.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  name="contribuables"
                  value={c.id}
                  checked={choisis.has(c.id)}
                  onChange={() => bascule(c.id)}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">
                    {c.nom_complet}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {c.code ?? "—"}
                    {c.telephone?.trim() ? " · SMS possible" : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {etat.erreur && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
        >
          {etat.erreur}
        </p>
      )}
      {etat.succes && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200"
        >
          {etat.succes}
        </p>
      )}

      <button type="submit" disabled={enCours} className="btn-primaire py-2.5">
        {enCours ? (
          <>
            <Spinner /> Envoi…
          </>
        ) : (
          "Envoyer le message"
        )}
      </button>
    </form>
  );
}
