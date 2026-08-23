import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import FormulaireCleOperateur from "@/components/formulaire-cle-operateur";
import { OPERATEURS, masquerCle } from "@/lib/moyens-paiement";

export const metadata = { title: "Moyens de paiement" };

export default async function PageMoyensPaiement() {
  const { mairieId } = await exigerMairie("admin");

  // Uniquement les clés de CETTE mairie — jamais celles des autres.
  const cles = new Map(
    db
      .prepare<[number], { operateur: string; cle_api: string }>(
        "SELECT operateur, cle_api FROM mairies_moyens_paiement WHERE mairie_id = ?",
      )
      .all(mairieId)
      .map((l) => [l.operateur, l.cle_api]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titre-page">Moyens de paiement mobile</h1>
        <p className="sous-titre-page">
          Activez Wave, Orange Money, Moov Money ou MTN Money en collant la clé
          API fournie par chaque opérateur. Le moyen devient disponible pour vos
          agents dès l&apos;enregistrement, sans modification du code.
        </p>
      </div>

      <div className="rounded-xl bg-sky-50 p-4 text-sm leading-relaxed text-sky-900 ring-1 ring-sky-200">
        <p className="font-semibold">Avant d&apos;aller plus loin</p>
        <p className="mt-1">
          Pour recevoir réellement les paiements, la mairie doit ouvrir un{" "}
          <strong>compte marchand professionnel</strong> chez chaque opérateur ;
          celui-ci fournit alors une clé API à coller ici. Tant que le compte
          n&apos;existe pas, les paiements restent en{" "}
          <strong>mode simulation</strong> (aucun débit réel) — idéal pour
          présenter le concept.
        </p>
        <p className="mt-2">
          Vos clés sont propres à la mairie : elles ne sont ni visibles ni
          utilisables par une autre mairie. Les espèces restent toujours
          disponibles.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {OPERATEURS.map((o) => (
          <div key={o.code} className="carte overflow-hidden">
            <FormulaireCleOperateur
              code={o.code}
              nom={o.nom}
              cleMasquee={cles.has(o.code) ? masquerCle(cles.get(o.code)!) : null}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
