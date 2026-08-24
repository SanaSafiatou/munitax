import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import db from "@/lib/db";
import { exigerRole, nomMairie } from "@/lib/auth";
import BoutonImprimer from "@/components/bouton-imprimer";

export const metadata = { title: "Carte de contribuable" };

/**
 * Carte physique du contribuable, imprimable une seule fois puis remise à
 * l'intéressé. Elle porte son code unique en clair et en QR code : l'agent
 * peut le scanner ou le taper lors des paiements suivants, même sans
 * téléphone.
 */
export default async function PageCarteContribuable(
  props: PageProps<"/carte-contribuable/[id]">,
) {
  const session = await exigerRole("admin", "agent", "super_admin");
  const id = Number((await props.params).id);

  const c = db
    .prepare<[number], { id: number; code: string | null; nom_complet: string; telephone: string | null; mairie_id: number }>(
      "SELECT id, code, nom_complet, telephone, mairie_id FROM contribuables WHERE id = ? AND actif = 1",
    )
    .get(id);
  if (!c) notFound();

  // Cloisonnement : la carte n'est accessible qu'au personnel de la mairie.
  if (session.role !== "super_admin" && session.mairieId !== c.mairie_id) {
    notFound();
  }

  const texteQr = c.code ?? `MT-${String(c.id).padStart(4, "0")}`;
  const dataUrl = await QRCode.toDataURL(texteQr, {
    margin: 1,
    width: 320,
    color: { dark: "#064e3b", light: "#ffffff" },
  });

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 p-4 print:max-w-none print:p-0">
      <p className="print:hidden text-sm text-slate-500">
        Imprimez cette carte et remettez-la au contribuable — elle lui sert
        d&apos;identifiant pour tous ses paiements futurs.
      </p>

      <div className="mx-auto w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow ring-2 ring-emerald-800 print:shadow-none print:ring-1">
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 px-5 py-3 text-white">
          <p className="text-[10px] uppercase tracking-widest text-emerald-200">
            Mairie de {nomMairie(c.mairie_id)}
          </p>
          <p className="text-sm font-bold">Carte de contribuable</p>
        </div>
        <div className="flex items-center gap-4 p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt={`QR code ${texteQr}`} className="h-28 w-28 shrink-0" />
          <div className="min-w-0">
            <p className="font-mono text-lg font-bold text-emerald-900">{texteQr}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-800">
              {c.nom_complet}
            </p>
            {c.telephone && (
              <p className="text-xs text-slate-500">+225 {c.telephone}</p>
            )}
          </div>
        </div>
        <p className="border-t border-slate-100 px-5 py-2 text-center text-[10px] text-slate-400">
          Présentez cette carte à tout agent collecteur lors de vos paiements.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 print:hidden sm:grid-cols-2">
        <Link
          href="/agent"
          className="rounded-xl bg-white px-4 py-3 text-center font-semibold text-emerald-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Terminer
        </Link>
        <BoutonImprimer />
      </div>
    </main>
  );
}
