import Link from "next/link";
import { notFound } from "next/navigation";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import FormulairePaiement from "@/components/formulaire-paiement";
import { OPERATEURS, operateursActifs } from "@/lib/moyens-paiement";

export const metadata = { title: "Nouvelle collecte" };

export default async function PageCollecte(
  props: PageProps<"/agent/collecte/[typeId]">,
) {
  const session = await exigerMairie("agent");
  const { mairieId } = session;
  const { typeId } = await props.params;

  // Le type doit appartenir à la mairie de l'agent ET lui être confié.
  const type = db
    .prepare<[number, number, number], { id: number; nom: string; description: string | null; montant_fixe: number | null; montant_libre: number }>(
      `SELECT t.id, t.nom, t.description, t.montant_fixe, t.montant_libre
       FROM types_taxe t
       JOIN affectations_types_taxe a ON a.type_taxe_id = t.id AND a.agent_id = ?
       WHERE t.id = ? AND t.mairie_id = ? AND t.actif = 1`,
    )
    .get(session.id, Number(typeId), mairieId);
  if (!type) notFound();

  // Seuls les opérateurs dont la clé API a été renseignée par l'admin de
  // cette mairie sont proposés au paiement.
  const actifs = operateursActifs(mairieId);
  const operateurs = OPERATEURS.filter((o) => actifs.includes(o.code));

  return (
    <div className="space-y-4">
      <Link
        href="/agent"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15 6-6 6 6 6" />
        </svg>
        Retour
      </Link>

      <div>
        <h1 className="titre-page">Enregistrer un paiement</h1>
        <p className="sous-titre-page">Collecte terrain — quittance immédiate.</p>
      </div>

      <FormulairePaiement
        typeId={type.id}
        nomTaxe={type.nom}
        description={type.description}
        montantFixe={type.montant_libre ? null : type.montant_fixe}
        operateurs={operateurs.map((o) => ({ code: o.code, nom: o.nom }))}
      />
    </div>
  );
}
