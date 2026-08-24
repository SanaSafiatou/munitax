"use client";

import { useActionState } from "react";
import {
  ajouterMairie,
  creerAdminMairie,
  changerStatutMairie,
  seConnecterComme,
  supprimerAdminMairie,
  type EtatCreationMairie,
  type EtatCreationAdmin,
  type EtatActionMairie,
  type EtatSuppressionAdmin,
} from "@/app/super/actions";
import { Spinner } from "@/components/formulaire-connexion";

/** Formulaire d'ajout d'une mairie (propriétaire) : nom + échéance facultative. */
export function FormulaireAjoutMairie() {
  const [etat, action, enCours] = useActionState<EtatCreationMairie, FormData>(
    ajouterMairie,
    {},
  );

  return (
    <form action={action} className="space-y-3 p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="nom-mairie" className="etiquette">
            Nom de la nouvelle mairie
          </label>
          <input
            id="nom-mairie"
            name="nom"
            type="text"
            required
            minLength={2}
            className="champ w-full"
            placeholder="ex : Yamoussoukro, Daloa, San-Pédro…"
          />
        </div>
        <div>
          <label htmlFor="echeance-mairie" className="etiquette">
            Échéance abonnement (facultative)
          </label>
          <input
            id="echeance-mairie"
            name="date_echeance"
            type="date"
            className="champ sm:w-44"
          />
        </div>
        <button
          type="submit"
          disabled={enCours}
          className="btn-primaire shrink-0 self-end"
        >
          {enCours ? <Spinner /> : "Ajouter"}
        </button>
      </div>
      {etat.erreur && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {etat.erreur}
        </p>
      )}
      {etat.succes && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
          {etat.succes}
        </p>
      )}
    </form>
  );
}

/** Création d'un compte administrateur pour une mairie existante. */
export function FormulaireCreationAdmin({
  mairies,
}: {
  mairies: { id: number; nom: string }[];
}) {
  const [etat, action, enCours] = useActionState<EtatCreationAdmin, FormData>(
    creerAdminMairie,
    {},
  );

  return (
    <form action={action} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="admin-nom" className="etiquette">
            Nom complet de l&apos;administrateur
          </label>
          <input
            id="admin-nom"
            name="nom_complet"
            type="text"
            required
            minLength={3}
            className="champ"
            placeholder="ex : Sylvain Kouamé"
          />
        </div>
        <div>
          <label htmlFor="admin-tel" className="etiquette">
            Téléphone (facultatif)
          </label>
          <input
            id="admin-tel"
            name="telephone"
            type="tel"
            className="champ"
            placeholder="+225 …"
          />
        </div>
      </div>
      <div>
        <label htmlFor="admin-mairie" className="etiquette">
          Mairie à administrer
        </label>
        <select id="admin-mairie" name="mairie_id" required className="champ">
          {mairies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          L&apos;identifiant et le mot de passe sont générés automatiquement et
          affichés une seule fois après création.
        </p>
      </div>

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
          "Créer le compte administrateur"
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
            Compte créé pour {etat.compteCree.nomComplet} — mairie de{" "}
            {etat.compteCree.mairie}
          </p>
          <dl className="mt-2 space-y-1 font-mono text-sm text-emerald-900">
            <div className="flex justify-between gap-4">
              <dt className="font-sans text-emerald-700">Identifiant</dt>
              <dd className="font-bold">{etat.compteCree.identifiant}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-sans text-emerald-700">Mot de passe</dt>
              <dd className="font-bold">{etat.compteCree.motDePasse}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-emerald-700">
            À communiquer maintenant : ces informations ne seront plus
            affichées.
          </p>
        </div>
      )}
    </form>
  );
}

const clsBouton =
  "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** Boutons d'une ligne de mairie : approbation, suspension, impersonation. */
export function ActionsMairie({
  mairie,
}: {
  mairie: { id: number; statut: string; adminId: number | null };
}) {
  const [etatStatut, actionStatut, enCoursStatut] = useActionState<
    EtatActionMairie,
    FormData
  >(changerStatutMairie, {});
  const [etatImp, actionImp, enCoursImp] = useActionState<
    EtatActionMairie,
    FormData
  >(seConnecterComme, {});
  const [etatSup, actionSup, enCoursSup] = useActionState<
    EtatSuppressionAdmin,
    FormData
  >(supprimerAdminMairie, {});

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {mairie.statut !== "active" && (
          <form action={actionStatut}>
            <input type="hidden" name="mairie_id" value={mairie.id} />
            <input type="hidden" name="nouveau_statut" value="active" />
            <button
              type="submit"
              disabled={enCoursStatut}
              className={`${clsBouton} bg-emerald-600 text-white hover:bg-emerald-500`}
            >
              {mairie.statut === "en_attente" ? "Approuver" : "Réactiver"}
            </button>
          </form>
        )}
        {mairie.statut === "active" && (
          <form action={actionStatut}>
            <input type="hidden" name="mairie_id" value={mairie.id} />
            <input type="hidden" name="nouveau_statut" value="suspendue" />
            <button
              type="submit"
              disabled={enCoursStatut}
              className={`${clsBouton} bg-white text-red-600 ring-1 ring-red-300 hover:bg-red-50`}
            >
              Suspendre
            </button>
          </form>
        )}
        <form action={actionImp}>
          <input type="hidden" name="agent_id" value={mairie.adminId ?? ""} />
          <button
            type="submit"
            disabled={!mairie.adminId || enCoursImp}
            title={
              mairie.adminId
                ? "Ouvrir une session d'assistance en tant qu'administrateur (sans retour automatique)"
                : "Aucun administrateur actif pour cette mairie"
            }
            className={`${clsBouton} bg-slate-900 text-white hover:bg-slate-700`}
          >
            Se connecter
          </button>
        </form>
        {mairie.adminId && (
          <form
            action={actionSup}
            onSubmit={(e) => {
              if (
                !confirm(
                  "Êtes-vous sûr ? Ce compte administrateur sera supprimé définitivement, sans possibilité de récupération.",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="agent_id" value={mairie.adminId} />
            <button
              type="submit"
              disabled={enCoursSup}
              title="Supprimer définitivement ce compte administrateur"
              className={`${clsBouton} bg-red-600 text-white hover:bg-red-500`}
            >
              Supprimer
            </button>
          </form>
        )}
      </div>
      {(etatStatut.erreur || etatImp.erreur || etatSup.erreur) && (
        <p role="alert" className="max-w-56 text-right text-xs text-red-600">
          {etatStatut.erreur ?? etatImp.erreur ?? etatSup.erreur}
        </p>
      )}
      {(etatStatut.succes || etatSup.succes) && (
        <p role="status" className="max-w-56 text-right text-xs text-emerald-700">
          {etatStatut.succes ?? etatSup.succes}
        </p>
      )}
    </div>
  );
}
