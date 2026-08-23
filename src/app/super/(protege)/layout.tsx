import { exigerRole } from "@/lib/auth";
import NavLaterale from "@/components/nav-laterale";
import { seDeconnecterSuper } from "../actions";

function icone(chemin: string) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d={chemin} />
    </svg>
  );
}

const items = [
  {
    href: "/super",
    libelle: "Mairies",
    icone: icone("M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01"),
  },
];

export default async function LayoutEspaceProtege({
  children,
}: LayoutProps<"/super">) {
  const session = await exigerRole("super_admin");

  return (
    <div className="min-h-dvh lg:pl-64">
      <NavLaterale
        items={items}
        nomUtilisateur={session.nom}
        sousTitre="Propriétaire de l'application"
        deconnexion={seDeconnecterSuper}
      />
      <div className="border-b border-violet-200 bg-violet-50 px-4 py-1.5 text-center text-xs font-medium text-violet-800">
        Espace propriétaire — gestion des mairies, des abonnements et des accès
        administrateurs. Aucune donnée de collecte n&apos;est visible ici.
      </div>
      <main className="mx-auto w-full max-w-4xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
