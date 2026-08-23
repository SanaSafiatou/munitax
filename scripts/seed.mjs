// Réinitialise la base avec les données de démonstration (comptes de test inclus).
// La logique partagée avec l'application se trouve dans demo-data.mjs.
import { reinitialiserDonneesDemo } from "./demo-data.mjs";

reinitialiserDonneesDemo({ journal: true });
