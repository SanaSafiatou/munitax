"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  creerContribuable,
  enregistrerPaiement,
  rechercherContribuables,
  type ContribuableChoisi,
  type EtatPaiement,
} from "@/app/agent/actions";
import { Spinner } from "@/components/formulaire-connexion";
import { montantFmt } from "@/lib/dates";
import { ajouterALaFile } from "@/lib/hors-ligne";

type Props = {
  typeId: number;
  nomTaxe: string;
  description: string | null;
  montantFixe: number | null;
  operateurs: { code: string; nom: string }[];
};

type Gps =
  | { etat: "en-cours" }
  | { etat: "ok"; lat: number; lng: number }
  | { etat: "erreur"; message: string };

type RecuHorsLigne = {
  uuid: string;
  dateHeure: number;
  montant: number;
};

function messageErreurGps(err: GeolocationPositionError | Error): string {
  if ("code" in err && err.code === err.PERMISSION_DENIED) {
    return "Autorisation de localisation refusée. Activez-la pour l'application dans les réglages du téléphone.";
  }
  return "Position introuvable. Vérifiez que le GPS du téléphone est activé puis réessayez.";
}

function nouvelUuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `h-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function FormulairePaiement({
  typeId,
  nomTaxe,
  description,
  montantFixe,
  operateurs,
}: Props) {
  const [etat, action, enCours] = useActionState<EtatPaiement, FormData>(
    enregistrerPaiement,
    {},
  );
  const [contribuable, setContribuable] = useState<ContribuableChoisi | null>(
    null,
  );
  const [gps, setGps] = useState<Gps>({ etat: "en-cours" });
  const [essai, setEssai] = useState(0);
  const mobilePossible = operateurs.length > 0;
  const [moyen, setMoyen] = useState<"cash" | "mobile">("cash");
  const [operateur, setOperateur] = useState(
    operateurs[0]?.code ?? "",
  );
  const [enLigne, setEnLigne] = useState(true);
  const [recuHorsLigne, setRecuHorsLigne] = useState<RecuHorsLigne | null>(
    null,
  );

  useEffect(() => {
    const maj = () => {
      const connecte = navigator.onLine;
      setEnLigne(connecte);
      // Impossible de joindre un opérateur mobile sans réseau : on repasse
      // automatiquement en espèces.
      if (!connecte) setMoyen("cash");
    };
    maj();
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => {
      window.removeEventListener("online", maj);
      window.removeEventListener("offline", maj);
    };
  }, []);

  useEffect(() => {
    let annule = false;
    new Promise<GeolocationPosition>((resoudre, rejeter) => {
      if (!("geolocation" in navigator)) {
        rejeter(new Error("non disponible"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        resoudre,
        rejeter,
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
      );
    })
      .then((pos) => {
        if (!annule)
          setGps({
            etat: "ok",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
      })
      .catch((err: GeolocationPositionError | Error) => {
        if (!annule)
          setGps({ etat: "erreur", message: messageErreurGps(err) });
      });
    return () => {
      annule = true;
    };
  }, [essai]);

  const relancer = () => {
    setGps({ etat: "en-cours" });
    setEssai((n) => n + 1);
  };

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Hors ligne : on n'envoie rien au serveur. Le paiement est empilé
        // sur l'appareil avec un identifiant unique ; il sera synchronisé
        // automatiquement (sans doublon) au retour du réseau.
        if (navigator.onLine) return;
        e.preventDefault();
        if (!contribuable) return;
        const fd = new FormData(e.currentTarget);
        const montant = Math.round(Number(fd.get("montant")));
        if (!Number.isFinite(montant) || montant <= 0) return;
        const uuid = nouvelUuid();
        ajouterALaFile({
          uuid,
          dateHeure: Date.now(),
          nomTaxe,
          contribuableNom: contribuable.nom_complet,
          contribuableCode: contribuable.code,
          montant,
          moyenLabel: "Espèces",
          champs: {
            type_taxe_id: String(typeId),
            contribuable_id: String(contribuable.id),
            montant: String(montant),
            latitude: String(fd.get("latitude") ?? ""),
            longitude: String(fd.get("longitude") ?? ""),
            moyen: "cash",
            operateur: "",
            uuid_client: uuid,
          },
        });
        setRecuHorsLigne({
          uuid,
          dateHeure: Date.now(),
          montant,
        });
      }}
      className="space-y-4"
    >
      <input type="hidden" name="type_taxe_id" value={typeId} />
      <input
        type="hidden"
        name="contribuable_id"
        value={contribuable?.id ?? ""}
      />
      <input type="hidden" name="moyen" value={moyen} />
      <input
        type="hidden"
        name="operateur"
        value={moyen === "mobile" ? operateur : ""}
      />
      <input
        type="hidden"
        name="latitude"
        value={gps.etat === "ok" ? gps.lat : ""}
      />
      <input
        type="hidden"
        name="longitude"
        value={gps.etat === "ok" ? gps.lng : ""}
      />

      {/* Récapitulatif taxe */}
      <div className="carte p-4 text-sm">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Type de taxe
        </p>
        <p className="font-semibold">{nomTaxe}</p>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>

      {/* Contribuable */}
      <ChoixContribuable
        choisi={contribuable}
        onChoisi={(c) => setContribuable(c)}
      />

      {/* Montant modifiable */}
      <div>
        <label htmlFor="montant" className="etiquette">
          Montant encaissé (FCFA)
        </label>
        <input
          id="montant"
          name="montant"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          defaultValue={montantFixe ?? ""}
          className="champ text-lg font-semibold"
        />
        {montantFixe !== null ? (
          <p className="mt-1 text-xs text-slate-400">
            Tarif habituel : <strong>{montantFmt(montantFixe)}</strong> — le
            montant est modifiable (plusieurs étals, régularisation…).
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            Taxe à montant libre : saisissez le montant convenu selon la
            surface occupée.
          </p>
        )}
      </div>

      {/* Moyen de paiement : cash ou mobile money */}
      <fieldset className="carte space-y-3 p-4 text-sm">
        <legend className="etiquette !mb-0">Moyen de paiement</legend>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMoyen("cash")}
            aria-pressed={moyen === "cash"}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 font-semibold ring-1 transition-colors ${
              moyen === "cash"
                ? "bg-emerald-700 text-white ring-emerald-700"
                : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10.5h8m-9 6h10M4 6.5h16v11H4z" />
            </svg>
            Espèces
          </button>
          {mobilePossible && (
            <button
              type="button"
              onClick={() => setMoyen("mobile")}
              disabled={!enLigne}
              aria-pressed={moyen === "mobile"}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 font-semibold ring-1 transition-colors ${
                moyen === "mobile"
                  ? "bg-emerald-700 text-white ring-emerald-700"
                  : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
                <path strokeLinecap="round" d="M11 18.5h2" />
              </svg>
              Mobile Money
            </button>
          )}
        </div>

        {moyen === "cash" && (
          <p className="text-xs text-slate-500">
            {enLigne
              ? "Le contribuable remet le montant en espèces à l'agent."
              : "Hors ligne : le paiement en espèces est enregistré sur l'appareil, puis synchronisé automatiquement."}
          </p>
        )}

        {mobilePossible && moyen === "mobile" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {operateurs.map((o) => (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => setOperateur(o.code)}
                  aria-pressed={operateur === o.code}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors ${
                    operateur === o.code
                      ? "bg-emerald-100 text-emerald-800 ring-emerald-400"
                      : "bg-white text-slate-500 ring-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {o.nom}
                </button>
              ))}
            </div>
            <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800 ring-1 ring-sky-200">
              Une demande de paiement est envoyée au téléphone du contribuable,
              qui confirme sur son téléphone (ou compose le code fourni).
              Mode démonstration : la demande est validée immédiatement et une
              référence est enregistrée sur la quittance — aucun débit réel.
            </p>
          </div>
        )}
      </fieldset>

      {/* GPS automatique */}
      <div className="carte p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-start gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className={`mt-0.5 h-5 w-5 shrink-0 ${
                gps.etat === "ok"
                  ? "text-emerald-600"
                  : gps.etat === "erreur"
                    ? "text-red-500"
                    : "text-slate-400 animate-pulse"
              }`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z"
              />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span>
              {gps.etat === "en-cours" && "Recherche du signal GPS…"}
              {gps.etat === "ok" && (
                <>
                  <span className="font-medium text-emerald-700">
                    Position capturée automatiquement
                  </span>
                  <span className="block font-mono text-xs text-slate-500">
                    {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                  </span>
                </>
              )}
              {gps.etat === "erreur" && (
                <span className="text-red-600">{gps.message}</span>
              )}
            </span>
          </p>
          {gps.etat !== "en-cours" && (
            <button
              type="button"
              onClick={relancer}
              className="btn-secondaire shrink-0 px-3 py-1.5 text-xs"
            >
              Actualiser
            </button>
          )}
        </div>
        <p className="mt-1 pl-7 text-xs text-slate-500">
          Le lieu du prélèvement est enregistré automatiquement avec la
          quittance.
        </p>
      </div>

      {recuHorsLigne && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-300"
        >
          <p className="text-sm font-bold text-emerald-800">
            Quittance émise — enregistrée sur l&apos;appareil
          </p>
          <dl className="mt-2 space-y-1 text-sm text-emerald-900">
            <div className="flex justify-between gap-4">
              <dt className="text-emerald-700">Contribuable</dt>
              <dd className="font-semibold">{contribuable?.nom_complet}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-emerald-700">Taxe</dt>
              <dd>{nomTaxe}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-emerald-700">Montant</dt>
              <dd className="font-bold">{montantFmt(recuHorsLigne.montant)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-emerald-700">Référence provisoire</dt>
              <dd className="font-mono text-xs">
                HORS-LIGNE-{recuHorsLigne.uuid.slice(0, 8).toUpperCase()}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-emerald-700">
            Le reçu définitif (référence REC-…) sera généré dès la
            synchronisation, sans aucune action de votre part.
          </p>
        </div>
      )}

      {etat.recuId && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200"
        >
          <p className="text-sm font-bold text-emerald-800">
            Paiement enregistré — quittance disponible.
          </p>
          <Link
            href={`/recu/${etat.recuId}`}
            className="mt-2 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Voir / imprimer la quittance
          </Link>
        </div>
      )}

      {etat.erreur && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {etat.erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours || !contribuable}
        className="btn-primaire w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enCours ? (
          <>
            <Spinner />{" "}
            {moyen === "mobile" ? "Envoi de la demande…" : "Enregistrement…"}
          </>
        ) : contribuable ? (
          moyen === "mobile" ? (
            `Demander le paiement ${operateurs.find((o) => o.code === operateur)?.nom ?? ""}`.trim()
          ) : enLigne ? (
            "Valider le paiement"
          ) : (
            "Enregistrer hors ligne"
          )
        ) : (
          "Sélectionnez d'abord le contribuable"
        )}
      </button>
    </form>
  );
}

/** Recherche ou création de la fiche contribuable, puis sélection. */
function ChoixContribuable({
  choisi,
  onChoisi,
}: {
  choisi: ContribuableChoisi | null;
  onChoisi: (c: ContribuableChoisi | null) => void;
}) {
  const [requete, setRequete] = useState("");
  const [resultats, setResultats] = useState<ContribuableChoisi[]>([]);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [modeCreation, setModeCreation] = useState(false);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [creationErreur, setCreationErreur] = useState<string | undefined>();

  async function lancerRecherche() {
    setRechercheEnCours(true);
    try {
      setResultats(await rechercherContribuables(requete));
    } finally {
      setRechercheEnCours(false);
    }
  }

  async function soumettreCreation(fd: FormData) {
    setCreationEnCours(true);
    setCreationErreur(undefined);
    try {
      const res = await creerContribuable({}, fd);
      if (res.contribuable) {
        onChoisi(res.contribuable);
        setModeCreation(false);
      } else {
        setCreationErreur(res.erreur ?? "Création impossible.");
      }
    } finally {
      setCreationEnCours(false);
    }
  }

  if (choisi) {
    return (
      <div className="carte p-4 text-sm ring-1 ring-emerald-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-600">
              Contribuable sélectionné
            </p>
            <p className="font-semibold text-slate-900">{choisi.nom_complet}</p>
            <p className="font-mono text-xs text-emerald-700">{choisi.code}</p>
            {choisi.telephone && (
              <p className="text-xs text-slate-500">+225 {choisi.telephone}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChoisi(null)}
            className="btn-secondaire shrink-0 px-3 py-1.5 text-xs"
          >
            Changer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="carte space-y-3 p-4 text-sm">
      <p className="etiquette !mb-0">Contribuable concerné</p>

      {!modeCreation ? (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  lancerRecherche();
                }
              }}
              placeholder="Code (MT-0001) ou nom…"
              className="champ flex-1"
              aria-label="Rechercher un contribuable"
            />
            <button
              type="button"
              onClick={lancerRecherche}
              disabled={rechercheEnCours || requete.trim().length < 2}
              className="btn-secondaire shrink-0"
            >
              {rechercheEnCours ? <Spinner /> : "Rechercher"}
            </button>
          </div>

          {resultats.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
              {resultats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onChoisi(c)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-emerald-50/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {c.nom_complet}
                      </span>
                      <span className="block font-mono text-xs text-emerald-700">
                        {c.code}
                        {c.telephone ? ` · ${c.telephone}` : ""}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-emerald-700">
                      Choisir
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {requete.trim().length >= 2 &&
            !rechercheEnCours &&
            resultats.length === 0 && (
              <p className="text-xs text-slate-500">
                Aucun contribuable trouvé pour « {requete.trim()} ».
              </p>
            )}

          <button
            type="button"
            onClick={() => setModeCreation(true)}
            className="lien-action text-sm"
          >
            + Créer une nouvelle fiche contribuable
          </button>
        </>
      ) : (
        <form action={soumettreCreation} className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div>
            <label htmlFor="c-nom" className="etiquette">
              Nom du contribuable
            </label>
            <input
              id="c-nom"
              name="nom"
              type="text"
              required
              minLength={3}
              className="champ"
              placeholder="ex : Étal 42 – Mme Ngo Bassa"
            />
          </div>
          <div>
            <label htmlFor="c-tel" className="etiquette">
              Téléphone (facultatif)
            </label>
            <input
              id="c-tel"
              name="telephone"
              type="tel"
              inputMode="tel"
              className="champ"
              placeholder="01 02 03 04 05 — laissez vide si le contribuable n'en a pas"
            />
          </div>
          {creationErreur && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
              {creationErreur}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creationEnCours}
              className="btn-primaire flex-1 py-2.5"
            >
              {creationEnCours ? (
                <>
                  <Spinner /> Création…
                </>
              ) : (
                "Créer la fiche"
              )}
            </button>
            <button
              type="button"
              onClick={() => setModeCreation(false)}
              className="btn-secondaire"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
