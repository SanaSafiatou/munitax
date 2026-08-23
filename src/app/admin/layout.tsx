import { exigerMairie, nomMairie } from "@/lib/auth";
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
    href: "/admin",
    libelle: "Tableau de bord",
    icone: icone("M3 13h4v8H3v-8zm7-9h4v17h-4V4zm7 5h4v12h-4V9z"),
  },
  {
    href: "/admin/collectes",
    libelle: "Collectes",
    icone: icone("M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m-6 9 2 2 4-4"),
  },
  {
    href: "/admin/agents",
    libelle: "Agents",
    icone: icone("M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a8.25 8.25 0 0 1 15 0"),
  },
  {
    href: "/admin/contribuables",
    libelle: "Contribuables",
    icone: icone("M3 12l9-8 9 8M5.5 10.5V20h13v-9.5M10 20v-5h4v5"),
  },
  {
    href: "/admin/moyens-paiement",
    libelle: "Moyens de paiement",
    icone: icone("M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"),
  },
  {
    href: "/admin/parametres",
    libelle: "Paramètres",
    icone: icone("M10.3 4.3a1.7 1.7 0 0 1 3.4 0 1.7 1.7 0 0 0 2.5 1.1 1.7 1.7 0 0 1 2.4 2.4 1.7 1.7 0 0 0 1.1 2.5 1.7 1.7 0 0 1 0 3.4 1.7 1.7 0 0 0-1.1 2.5 1.7 1.7 0 0 1-2.4 2.4 1.7 1.7 0 0 0-2.5 1.1 1.7 1.7 0 0 1-3.4 0 1.7 1.7 0 0 0-2.5-1.1 1.7 1.7 0 0 1-2.4-2.4 1.7 1.7 0 0 0-1.1-2.5 1.7 1.7 0 0 1 0-3.4 1.7 1.7 0 0 0 1.1-2.5 1.7 1.7 0 0 1 2.4-2.4 1.7 1.7 0 0 0 2.5-1.1zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"),
  },
];

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  const session = await exigerMairie("admin");
  const mairie = nomMairie(session.mairieId);

  return (
    <div className="min-h-dvh lg:pl-64">
      <NavLaterale
        items={items}
        nomUtilisateur={session.nom}
        sousTitre={`Administration — ${mairie}`}
      />
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-800">
        Mode démonstration — données fictives, aucune transaction réelle.
      </div>
      {session.imp && (
        <div className="border-b border-violet-300 bg-violet-100 px-4 py-1.5 text-center text-xs font-semibold text-violet-900">
          Session d&apos;assistance technique — vous naviguez avec les droits de{" "}
          {session.nom} ({mairie}). Aucun retour automatique : déconnectez-vous
          pour retrouver votre session.
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
