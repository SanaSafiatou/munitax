"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const onglets = [
  {
    href: "/agent",
    libelle: "Collecter",
    icone: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.8 2 1.5c1.5 1.1 3.7.4 4-.9.3-1.4-.9-2-2.6-2.4l-1-.3c-1.9-.4-3-1.1-2.7-2.5.3-1.3 2.3-2 3.9-1L14.5 11M12 3v2m0 14v2" />
    ),
  },
  {
    href: "/agent/historique",
    libelle: "Historique",
    icone: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 21h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1zm4-6h2m4 0h-2" />
    ),
  },
];

export default function NavAgent() {
  const chemin = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-lg">
        {onglets.map((o) => {
          const actif =
            o.href === "/agent"
              ? chemin === "/agent"
              : chemin.startsWith(o.href);
          return (
            <Link
              key={o.href}
              href={o.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                actif ? "text-emerald-700" : "text-slate-400"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                {o.icone}
              </svg>
              {o.libelle}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
