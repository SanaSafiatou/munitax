import Link from "next/link";
import { notFound } from "next/navigation";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import FormulairePaiementDemo from "@/components/formulaire-paiement-demo";

export const metadata = { title: "Paiement en ligne" };

export default async function PagePayer(
  props: PageProps<"/contribuable/payer/[typeId]">,
) {
  const session = await exigerMairie("contribuable");
  const { typeId } = await props.params;

  // Le type de taxe doit appartenir à la mairie du contribuable.
  const type = db
    .prepare<[number, number], { id: number; nom: string; description: string | null; montant_fixe: number | null; montant_libre: number }>(
      "SELECT id, nom, description, montant_fixe, montant_libre FROM types_taxe WHERE id = ? AND mairie_id = ? AND actif = 1",
    )
    .get(Number(typeId), session.mairieId ?? -1);
  if (!type) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/contribuable"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15 6-6 6 6 6" />
        </svg>
        Retour au tableau de bord
      </Link>

      <div>
        <h1 className="titre-page">Nouveau paiement</h1>
        <p className="sous-titre-page">
          Étape unique : vérifiez le montant puis confirmez la simulation.
        </p>
      </div>

      <FormulairePaiementDemo
        typeId={type.id}
        nomTaxe={type.nom}
        description={type.description}
        montantFixe={type.montant_libre ? null : type.montant_fixe}
      />
    </div>
  );
}
