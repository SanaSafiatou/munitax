"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Rafraîchit périodiquement la page côté serveur : les statistiques des
 * tableaux de bord (total collecté, agents actifs, nouvelles mairies…)
 * restent à jour sans aucune action de l'utilisateur.
 */
export default function RafraichissementAuto({ secondes = 60 }: { secondes?: number }) {
  const router = useRouter();

  useEffect(() => {
    const intervalle = setInterval(() => router.refresh(), secondes * 1000);
    return () => clearInterval(intervalle);
  }, [router, secondes]);

  return null;
}
