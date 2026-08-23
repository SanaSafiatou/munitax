import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import FormulaireConnexionSuper from "@/components/formulaire-connexion-super";

export const metadata = { title: "Espace propriétaire" };

/**
 * Page de connexion DÉDIÉE au super-administrateur. Adresse non publiée :
 * aucun lien depuis l'accueil, la page de connexion publique ou tout autre
 * espace. Seule cette page permet d'ouvrir une session propriétaire.
 */
export default async function PageConnexionSuper() {
  const session = await getSession();
  if (session?.role === "super_admin") redirect("/super");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v4h8Z" />
            </svg>
          </span>
          <h1 className="text-lg font-bold text-slate-100">Espace propriétaire</h1>
          <p className="mt-1 text-xs text-slate-400">Accès réservé — authentification requise.</p>
        </div>
        <FormulaireConnexionSuper />
      </div>
    </main>
  );
}
