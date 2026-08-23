export function SqueletteCartes({ nombre = 4 }: { nombre?: number }) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${nombre > 2 ? "xl:grid-cols-4" : ""}`}>
      {Array.from({ length: nombre }).map((_, i) => (
        <div key={i} className="carte p-4">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-6 w-32 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

export function SqueletteBloc({ lignes = 4 }: { lignes?: number }) {
  return (
    <div className="carte p-5">
      <div className="mb-4 h-4 w-40 animate-pulse rounded bg-slate-200" />
      <div className="space-y-3">
        {Array.from({ length: lignes }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export default function Chargement() {
  return (
    <div className="space-y-6" role="status" aria-label="Chargement en cours">
      <div>
        <div className="h-7 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>
      <SqueletteCartes />
      <SqueletteBloc />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
