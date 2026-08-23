import { exigerMairie } from "@/lib/auth";
import NavLaterale, { type ElementNav } from "@/components/nav-laterale";

function icone(chemin: string) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d={chemin} />
    </svg>
  );
}

const items: ElementNav[] = [
  {
    href: "/contribuable",
    libelle: "Tableau de bord",
    icone: icone("M3 10.8 12 4l9 6.8M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"),
  },
  {
    href: "/contribuable/historique",
    libelle: "Mes paiements",
    icone: icone("M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 6h7M9 13h7M9 17h4"),
  },
];

export default async function LayoutContribuable({
  children,
}: LayoutProps<"/contribuable">) {
  const session = await exigerMairie("contribuable");

  return (
    <div className="min-h-dvh lg:pl-64">
      <NavLaterale
        items={items}
        nomUtilisateur={session.nom}
        sousTitre="Compte contribuable"
      />
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-800">
        Mode démonstration — les paiements sont simulés, aucun argent réel
        n&apos;est débité.
      </div>
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
