"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { enregistrerPaiement } from "@/app/agent/actions";
import {
  EVENEMENT_FILE,
  lireFile,
  retirerDeLaFile,
} from "@/lib/hors-ligne";

/**
 * Bandeau de l'espace agent : compte les paiements saisis hors ligne et
 * les renvoie au serveur dès que la connexion revient. La déduplication
 * côté serveur (uuid_client) garantit zéro doublon même après plusieurs
 * tentatives.
 */
export default function SynchroniseurOffline() {
  const [enLigne, setEnLigne] = useState(true);
  const [nb, setNb] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const boucle = useRef(false);

  const rafraichir = useCallback(() => {
    setEnLigne(navigator.onLine);
    setNb(lireFile().length);
  }, []);

  useEffect(() => {
    // Différé d'un tick : évite un setState synchrone dans l'effet.
    const initial = setTimeout(rafraichir, 0);
    window.addEventListener("online", rafraichir);
    window.addEventListener("offline", rafraichir);
    window.addEventListener(EVENEMENT_FILE, rafraichir);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("online", rafraichir);
      window.removeEventListener("offline", rafraichir);
      window.removeEventListener(EVENEMENT_FILE, rafraichir);
    };
  }, [rafraichir]);

  const synchroniser = useCallback(async () => {
    if (boucle.current) return;
    boucle.current = true;
    setEnCours(true);
    try {
      for (const p of lireFile()) {
        try {
          const fd = new FormData();
          for (const [k, v] of Object.entries(p.champs)) fd.append(k, v);
          const res = await enregistrerPaiement({}, fd);
          // Succès, ou paiement déjà synchronisé lors d'une tentative
          // précédente : dans les deux cas il quitte la file.
          if (res.recuId || res.erreur?.includes("déjà été enregistré")) {
            retirerDeLaFile(p.uuid);
          }
        } catch {
          break; // réseau perdu en cours de route : on reprendra plus tard
        }
      }
    } finally {
      boucle.current = false;
      setEnCours(false);
      setNb(lireFile().length);
    }
  }, []);

  useEffect(() => {
    if (navigator.onLine && lireFile().length > 0) void synchroniser();
  }, [enLigne, synchroniser]);

  if (enLigne && nb === 0) return null;

  return (
    <div
      className={`border-b px-4 py-1.5 text-center text-xs font-medium ${
        enLigne
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-300 bg-slate-100 text-slate-600"
      }`}
      role="status"
    >
      {enLigne ? (
        nb > 0 ? (
          <>
            {nb} paiement{nb > 1 ? "s" : ""} en attente de synchronisation —{" "}
            <button
              type="button"
              onClick={() => void synchroniser()}
              disabled={enCours}
              className="font-semibold underline underline-offset-2 disabled:opacity-50"
            >
              {enCours ? "Synchronisation…" : "Envoyer maintenant"}
            </button>
          </>
        ) : null
      ) : (
        <>Hors ligne — les paiements restent enregistrés sur l&apos;appareil et partiront automatiquement au retour du réseau.</>
      )}
    </div>
  );
}
