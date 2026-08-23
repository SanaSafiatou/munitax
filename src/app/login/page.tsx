import Link from "next/link";
import { redirect } from "next/navigation";
import FormulaireConnexion from "@/components/formulaire-connexion";
import LogoMarque, { IconeMarque } from "@/components/logo-marque";
import { accueilPourRole, getSession } from "@/lib/auth";

export const metadata = { title: "Connexion" };

const avantages = [
  "Suivi des collectes en temps réel pour la mairie",
  "Quittance numérique immédiate pour chaque paiement",
  "Paiement en ligne simulé, gratuit et sans engagement",
];

export default async function PageConnexion() {
  const session = await getSession();
  if (session) redirect(accueilPourRole(session.role));

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Panneau de marque */}
      <aside className="relative hidden flex-col justify-between bg-gradient-to-b from-emerald-900 to-emerald-800 p-10 text-white lg:flex">
        <LogoMarque surFondFonce />
        <div>
          <h1 className="max-w-md text-3xl font-bold leading-tight tracking-tight">
            La gestion des taxes municipales, enfin centralisée.
          </h1>
          <ul className="mt-8 space-y-4">
            {avantages.map((a) => (
              <li key={a} className="flex items-start gap-3 text-sm text-emerald-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
                {a}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-emerald-200/80">
          Environnement de démonstration — aucune transaction réelle n&apos;est
          traitée.
        </p>
      </aside>

      {/* Formulaire */}
      <main className="flex flex-1 items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center lg:hidden">
            <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white">
              <IconeMarque className="h-7 w-7" />
            </span>
            <span className="font-bold text-slate-900">MuniTax</span>
          </div>

          <div className="carte p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900">Connexion</h2>
            <p className="sous-titre-page mb-5">
              Accédez à votre espace selon votre profil.
            </p>

            <FormulaireConnexion />
          </div>

          <p className="mt-5 text-center text-sm text-slate-500">
            Contribuable sans compte ?{" "}
            <Link href="/inscription" className="font-semibold text-emerald-700 hover:underline">
              Créer un compte gratuit
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-slate-500">
            Vous représentez une mairie ?{" "}
            <Link href="/inscription-mairie" className="font-semibold text-emerald-700 hover:underline">
              Inscrire votre mairie
            </Link>
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
            <span>Applications Android :</span>
            <a href="/apk/MuniTax-Agent.apk" className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-emerald-700 hover:underline" download>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              Agent (.apk)
            </a>
            <a href="/apk/MuniTax-Contribuable.apk" className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-emerald-700 hover:underline" download>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              Client (.apk)
            </a>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">
            <Link href="/" className="hover:underline">← Retour à l&apos;accueil</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
