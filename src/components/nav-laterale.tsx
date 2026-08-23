"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoMarque from "@/components/logo-marque";
import { seDeconnecter } from "@/app/actions";

export type ElementNav = {
  href: string;
  libelle: string;
  icone: React.ReactNode;
};

export default function NavLaterale({
  items,
  nomUtilisateur,
  sousTitre,
}: {
  items: ElementNav[];
  nomUtilisateur: string;
  sousTitre: string;
}) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);

  const estActif = (href: string) =>
    href === "/admin" || href === "/contribuable" || href === "/agent"
      ? chemin === href
      : chemin.startsWith(href);

  const liens = (
    <nav className="flex flex-col gap-1">
      {items.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          onClick={() => setOuvert(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            estActif(e.href)
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <span className={estActif(e.href) ? "text-emerald-700" : "text-slate-400"}>
            {e.icone}
          </span>
          {e.libelle}
        </Link>
      ))}
    </nav>
  );

  const blocUtilisateur = (
    <div className="border-t border-slate-200 p-4">
      <p className="truncate text-sm font-semibold text-slate-800">{nomUtilisateur}</p>
      <p className="text-xs text-slate-500">{sousTitre}</p>
      <form action={seDeconnecter} className="mt-3">
        <button type="submit" className="btn-secondaire w-full">
          Se déconnecter
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Barre supérieure (mobile / tablette) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <LogoMarque />
          <button
            type="button"
            onClick={() => setOuvert(true)}
            aria-label="Ouvrir le menu"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Tiroir mobile */}
      {ouvert && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Fermer le menu"
            onClick={() => setOuvert(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <LogoMarque />
              <button
                type="button"
                onClick={() => setOuvert(false)}
                aria-label="Fermer"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">{liens}</div>
            {blocUtilisateur}
          </div>
        </div>
      )}

      {/* Barre latérale fixe (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="p-4">
          <LogoMarque />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">{liens}</div>
        {blocUtilisateur}
      </aside>
    </>
  );
}
