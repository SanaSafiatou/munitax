import { SqueletteCartes, SqueletteBloc } from "@/components/chargement";

export default function Loading() {
  return (
    <div className="space-y-5" role="status" aria-label="Chargement en cours">
      <SqueletteBloc lignes={2} />
      <SqueletteCartes nombre={3} />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
