"use client";

import { useActionState } from "react";
import {
  simulerPaiementEnLigne,
  type EtatPaiementDemo,
} from "@/app/contribuable/actions";
import { Spinner } from "@/components/formulaire-connexion";
import { montantFmt } from "@/lib/dates";

type Props = {
  typeId: number;
  nomTaxe: string;
  description: string | null;
  montantFixe: number | null;
};

export default function FormulairePaiementDemo({
  typeId,
  nomTaxe,
  description,
  montantFixe,
}: Props) {
  const [etat, action, enCours] = useActionState<EtatPaiementDemo, FormData>(
    simulerPaiementEnLigne,
    {},
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="type_taxe_id" value={typeId} />

      {/* Récapitulatif */}
      <div className="carte p-5">
        <p className="text-xs uppercase tracking-wide text-slate-400">Taxe à régler</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-900">{nomTaxe}</p>
        {description && <p className="text-sm text-slate-500">{description}</p>}

        <div className="mt-4">
          <label htmlFor="montant" className="etiquette">
            Montant à payer
          </label>
          <div className="relative mt-1">
            <input
              id="montant"
              name="montant"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              readOnly={montantFixe !== null}
              defaultValue={montantFixe ?? ""}
              placeholder={montantFixe === null ? "Saisissez le montant" : undefined}
              aria-describedby={montantFixe === null ? "aide-montant" : undefined}
              className="champ pr-16 text-lg font-semibold"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-400">
              FCFA
            </span>
          </div>
          {montantFixe === null && (
            <p id="aide-montant" className="mt-1 text-xs text-slate-400">
              Cette taxe est à montant libre : saisissez le montant dû selon
              votre situation.
            </p>
          )}
        </div>
      </div>

      {/* Encart mode de paiement */}
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path strokeLinecap="round" d="M3 10h18M7 15h4" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Paiement de démonstration
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              Aucun opérateur de paiement (Orange Money, Wave, MTN, Moov…)
              n&apos;est connecté : le règlement est{" "}
              <strong>simulé</strong> et reste entièrement gratuit.
              {montantFixe === null ? "" : ` Montant : ${montantFmt(montantFixe)}.`}
            </p>
          </div>
        </div>
      </div>

      {etat.erreur && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {etat.erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="btn-primaire w-full py-3.5 text-base"
      >
        {enCours ? (
          <>
            <Spinner /> Traitement du paiement...
          </>
        ) : (
          <>
            Simuler le paiement
            {montantFixe !== null ? ` — ${montantFmt(montantFixe)}` : ""}
          </>
        )}
      </button>
      <p className="text-center text-xs text-slate-400">
        Une quittance numérique sera générée immédiatement après la simulation.
      </p>
    </form>
  );
}
