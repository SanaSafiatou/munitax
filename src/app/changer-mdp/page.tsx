import { redirect } from "next/navigation";
import db from "@/lib/db";
import { accueilPourRole, exigerRole } from "@/lib/auth";
import FormulaireChangementMdp from "@/components/formulaire-changement-mdp";
import LogoMarque from "@/components/logo-marque";

export const metadata = { title: "Nouveau mot de passe" };

export default async function PageChangerMdp() {
  const session = await exigerRole("agent", "admin");

  // Rien à faire si le mot de passe temporaire a déjà été remplacé.
  const compte = db
    .prepare<[number], { doit_changer_mdp: number }>(
      "SELECT doit_changer_mdp FROM agents WHERE id = ?",
    )
    .get(session.id);
  if (!compte || !compte.doit_changer_mdp) {
    redirect(accueilPourRole(session.role));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center">
        <LogoMarque />
      </div>
      <div className="carte p-6 sm:p-8">
        <h1 className="text-lg font-bold text-slate-900">
          Personnalisez votre mot de passe
        </h1>
        <p className="sous-titre-page mb-5">
          Vous vous êtes connecté avec un mot de passe temporaire fourni par
          l&apos;administration. Choisissez-en un nouveau, connu de vous seul :
          après cet enregistrement, plus personne ne pourra le consulter.
        </p>
        <FormulaireChangementMdp />
      </div>
    </main>
  );
}
