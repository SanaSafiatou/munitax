"use client";

import { useActionState } from "react";
import {
  enregistrerCleMoyen,
  type EtatCleMoyen,
} from "@/app/admin/actions";
import { Spinner } from "@/components/formulaire-connexion";

type Props = {
  code: string;
  nom: string;
  cleMasquee: string | null;
};

/** Formulaire d'une clé API opérateur : coller, enregistrer, ou désactiver. */
export default function FormulaireCleOperateur({
  code,
  nom,
  cleMasquee,
}: Props) {
  const [etat, action, enCours] = useActionState<EtatCleMoyen, FormData>(
    enregistrerCleMoyen,
    {},
  );
  const active = cleMasquee !== null;

  return (
    <form action={action} className="space-y-3 p-4 text-sm">
      <input type="hidden" name="operateur" value={code} />
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-900">{nom}</p>
        {active ? (
          <span className="badge-succes">Activé · clé {cleMasquee}</span>
        ) : (
          <span className="badge-neutre">Non configuré</span>
        )}
      </div>

      <label htmlFor={`cle-${code}`} className="etiquette !mb-0">
        Clé API fournie par l&apos;opérateur
      </label>
      <input
        id={`cle-${code}`}
        name="cle_api"
        type="text"
        autoComplete="off"
        spellCheck={false}
        defaultValue=""
        placeholder={active ? "Coller une nouvelle clé pour la remplacer" : "ex : sk_live_wv_5f3a…"}
        className="champ font-mono text-xs"
      />

      {etat.succes && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
          {etat.succes}
        </p>
      )}
      {etat.erreur && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          {etat.erreur}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enCours}
          className="btn-primaire flex-1 py-2.5 disabled:opacity-50"
        >
          {enCours ? (
            <>
              <Spinner /> Enregistrement…
            </>
          ) : active ? (
            "Remplacer la clé"
          ) : (
            `Activer ${nom}`
          )}
        </button>
        {active && (
          <button
            type="submit"
            name="desactiver"
            value="1"
            disabled={enCours}
            className="rounded-xl px-4 py-2.5 font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
          >
            Désactiver
          </button>
        )}
      </div>
    </form>
  );
}
