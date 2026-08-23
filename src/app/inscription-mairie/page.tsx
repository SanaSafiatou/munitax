import Link from "next/link";
import FormulaireInscriptionMairie from "@/components/formulaire-inscription-mairie";
import LogoMarque, { IconeMarque } from "@/components/logo-marque";

export const metadata = { title: "Inscrire votre mairie" };

const etapes = [
  "Envoyez ce formulaire : votre mairie est enregistrée immédiatement.",
  "L'équipe MuniTax examine et active votre mairie.",
  "Connectez-vous : agents, contribuables et collectes sont prêts.",
];

export default function PageInscriptionMairie() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-gradient-to-b from-emerald-900 to-emerald-800 p-10 text-white lg:flex">
        <LogoMarque surFondFonce />
        <div>
          <h1 className="max-w-md text-3xl font-bold leading-tight tracking-tight">
            Rejoignez les mairies qui digitalisent leurs taxes municipales.
          </h1>
          <ol className="mt-8 space-y-4">
            {etapes.map((e, i) => (
              <li key={e} className="flex items-start gap-3 text-sm text-emerald-50">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold">
                  {i + 1}
                </span>
                {e}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-emerald-200/80">
          Environnement de démonstration — aucune transaction réelle n&apos;est
          traitée.
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center lg:hidden">
            <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white">
              <IconeMarque className="h-7 w-7" />
            </span>
            <span className="font-bold text-slate-900">MuniTax</span>
          </div>

          <div className="carte p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900">
              Inscrire votre mairie
            </h2>
            <p className="sous-titre-page mb-5">
              Gratuit et sans engagement — activation après validation par
              l&apos;équipe MuniTax.
            </p>
            <FormulaireInscriptionMairie />
          </div>

          <p className="mt-5 text-center text-sm text-slate-500">
            Déjà un compte ?{" "}
            <Link href="/login" className="font-semibold text-emerald-700 hover:underline">
              Se connecter
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-slate-400">
            <Link href="/" className="hover:underline">← Retour à l&apos;accueil</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
