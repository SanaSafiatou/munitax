import Link from "next/link";
import db from "@/lib/db";
import FormulaireInscription from "@/components/formulaire-inscription";

export const metadata = { title: "Créer un compte" };

export default async function PageInscription() {
  const mairies = db
    .prepare<[], { id: number; nom: string }>(
      "SELECT id, nom FROM mairies ORDER BY nom",
    )
    .all();

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Créer un compte contribuable
          </h1>
          <p className="sous-titre-page">
            Gratuit et réservé à la phase de démonstration.
          </p>
        </div>

        <div className="carte p-6 sm:p-8">
          {mairies.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aucune mairie n'est encore active sur la plateforme. Revenez
              bientôt : les contribuables pourront créer leur compte dès
              l'ouverture de la première mairie.
            </p>
          ) : (
            <FormulaireInscription mairies={mairies} />
          )}
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Vous avez déjà un compte ?{" "}
          <Link href="/login" className="font-semibold text-emerald-700 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
