import { exigerMairie } from "@/lib/auth";
import { seDeconnecter } from "@/app/actions";
import NavAgent from "@/components/nav-agent";
import SynchroniseurOffline from "@/components/synchroniseur-offline";

export default async function LayoutAgent({
  children,
}: LayoutProps<"/agent">) {
  const session = await exigerMairie("agent");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a8.25 8.25 0 0 1 15 0" />
              </svg>
            </span>
            <div>
              <p className="text-xs text-slate-500">Agent collecteur</p>
              <p className="text-sm font-semibold leading-tight">{session.nom}</p>
            </div>
          </div>
          <form action={seDeconnecter}>
            <button type="submit" className="btn-fantome">
              Quitter
            </button>
          </form>
        </div>
        <p className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-800">
          Mode démonstration — données de test.
        </p>
        <SynchroniseurOffline />
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 p-4 pb-24">{children}</main>

      <NavAgent />
    </div>
  );
}
