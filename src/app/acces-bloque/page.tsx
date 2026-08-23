import { seDeconnecter } from "@/app/actions";
import { IconeMarque } from "@/components/logo-marque";

export const metadata = { title: "Accès suspendu" };

type Props = PageProps<"/acces-bloque">;

export default async function PageAccesBloque(props: Props) {
  const sp = await props.searchParams;
  const attente = sp.attente === "1";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 p-6">
      <div className="carte w-full max-w-md p-8 text-center">
        <span
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
            attente ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-9 w-9">
            {attente ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            ) : (
              <>
                <rect x="5" y="10.5" width="14" height="10" rx="2" />
                <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
              </>
            )}
          </svg>
        </span>

        <h1 className="text-xl font-bold text-slate-900">
          {attente ? "Mairie en cours de validation" : "Accès suspendu"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {attente
            ? "Votre mairie est enregistrée mais encore en attente d'approbation par l'équipe MuniTax. Vous serez notifié dès son activation. Aucune donnée n'a été perdue."
            : "Accès suspendu, veuillez contacter le support."}
        </p>

        <form action={seDeconnecter} className="mt-6">
          <button type="submit" className="btn-primaire w-full py-3">
            Se déconnecter
          </button>
        </form>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <IconeMarque className="h-4 w-4" /> MuniTax
      </p>
    </main>
  );
}
