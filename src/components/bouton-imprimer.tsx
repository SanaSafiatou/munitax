"use client";

export default function BoutonImprimer({ libelle = "Imprimer / PDF" }: { libelle?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondaire py-3">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.7 8V4h10.6v4M6.7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1.7m-12.6-3h12.6v7H6.7v-7z" />
      </svg>
      {libelle}
    </button>
  );
}
