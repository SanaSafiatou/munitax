import Link from "next/link";
import { notFound } from "next/navigation";
import db from "@/lib/db";
import { getSession, nomMairie } from "@/lib/auth";
import BoutonImprimer from "@/components/bouton-imprimer";
import { dateHeureStr, montantFmt } from "@/lib/dates";
import { estMobile, libelleMoyen } from "@/lib/moyens-paiement";

export const metadata = { title: "Quittance de paiement" };

type Jointure = {
  id: number;
  reference: string | null;
  montant: number;
  commercant: string;
  date_heure: number;
  latitude: number | null;
  longitude: number | null;
  statut: "valide" | "annule";
  mode: "terrain" | "en_ligne";
  moyen_paiement: string;
  reference_mobile: string | null;
  operateur: string | null;
  agent_id: number | null;
  contribuable_id: number | null;
  mairie_id: number;
  agent_nom: string | null;
  taxe_nom: string;
  contribuable_nom: string | null;
  contribuable_code: string | null;
  contribuable_telephone: string | null;
};

export default async function PageRecu(props: PageProps<"/recu/[id]">) {
  const session = await getSession();
  if (!session) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <Link href="/login" className="lien-action">
          Veuillez vous connecter pour voir cette quittance.
        </Link>
      </main>
    );
  }

  const p = db
    .prepare<[number], Jointure>(
      `SELECT p.id, p.reference, p.montant, p.commercant, p.date_heure,
              p.latitude, p.longitude, p.statut, p.mode,
              p.moyen_paiement, p.reference_mobile, p.operateur,
              p.agent_id, p.contribuable_id, p.mairie_id,
              a.nom_complet AS agent_nom,
              t.nom AS taxe_nom,
              c.nom_complet AS contribuable_nom,
              c.code AS contribuable_code,
              c.telephone AS contribuable_telephone
       FROM paiements p
       LEFT JOIN agents a ON a.id = p.agent_id
       JOIN types_taxe t ON t.id = p.type_taxe_id
       LEFT JOIN contribuables c ON c.id = p.contribuable_id
       WHERE p.id = ?`,
    )
    .get(Number((await props.params).id));
  if (!p) notFound();

  // Cloisonnement : un admin ne voit que les quittances de sa mairie ;
  // un agent uniquement les siennes ; un contribuable les siennes.
  const autorise =
    (session.role === "super_admin") ||
    (session.role === "admin" && session.mairieId === p.mairie_id) ||
    (session.role === "agent" && session.mairieId === p.mairie_id && p.agent_id === session.id) ||
    (session.role === "contribuable" && p.contribuable_id === session.id);
  if (!autorise) notFound();

  const enLigne = p.mode === "en_ligne";
  const mobile = !enLigne && estMobile(p.moyen_paiement);
  const retour = session.role === "contribuable"
    ? { href: "/contribuable/historique", libelle: "Retour à mes paiements" }
    : { href: "/agent", libelle: "Nouvelle collecte" };

  const texteSms = `Quittance ${p.reference ?? p.id} : ${montantFmt(p.montant)} - ${p.taxe_nom} payé par ${p.commercant}${mobile ? ` via ${libelleMoyen(p.moyen_paiement)} (réf. ${p.reference_mobile})` : ""} (Mairie de ${nomMairie(p.mairie_id)}) le ${dateHeureStr(p.date_heure)}. Merci.`;

  const lignesRecu: [string, string][] = [
    ["Type de taxe", p.taxe_nom],
    ["Montant", montantFmt(p.montant)],
    [enLigne ? "Payé par" : "Commerçant / payeur", p.commercant],
    ...(enLigne
      ? []
      : [["Moyen de paiement", libelleMoyen(p.moyen_paiement)] as [string, string]]),
  ];
  if (p.reference_mobile) {
    lignesRecu.push(["Référence mobile money", p.reference_mobile]);
  }
  if (p.contribuable_nom && p.contribuable_code) {
    lignesRecu.push(["Contribuable", `${p.contribuable_nom} (${p.contribuable_code})`]);
  }
  if (enLigne) {
    lignesRecu.push(["Mode de paiement", p.operateur ?? "Paiement de démonstration"]);
  } else {
    lignesRecu.push(["Encaissé par", p.agent_nom ?? "—"]);
    lignesRecu.push([
      "Position GPS",
      p.latitude != null && p.longitude != null
        ? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`
        : "Non disponible",
    ]);
  }
  lignesRecu.push(["Mairie", nomMairie(p.mairie_id)]);
  lignesRecu.push(["Date et heure", dateHeureStr(p.date_heure)]);

  const filigrane = enLigne || mobile;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 p-4">
      <div className="carte relative overflow-hidden p-6">
        {/* Filigrane pour la démonstration */}
        {filigrane && (
          <span className="pointer-events-none absolute -right-10 top-6 rotate-45 rounded bg-amber-100 px-10 py-1 text-xs font-bold uppercase tracking-widest text-amber-700 ring-1 ring-amber-300">
            Démo
          </span>
        )}

        <div className="text-center">
          <div
            className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${
              p.statut === "valide"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-600"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8">
              {p.statut === "valide"
                ? <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />}
            </svg>
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Quittance de paiement
          </p>
          <p className="font-mono text-sm font-semibold">{p.reference ?? `#${p.id}`}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {p.statut !== "valide" && (
              <span className="badge-erreur">Paiement annulé</span>
            )}
            {mobile && (
              <span className="badge-demo">
                {libelleMoyen(p.moyen_paiement)} — simulation, aucun débit réel
              </span>
            )}
            {enLigne && (
              <span className="badge-demo">Simulation — aucun débit réel</span>
            )}
          </div>
        </div>

        <dl className="mt-5 divide-y divide-slate-100 text-sm">
          {lignesRecu.map(([label, valeur]) => (
            <div key={label} className="flex items-start justify-between gap-4 py-2.5">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-right font-medium">{valeur}</dd>
            </div>
          ))}
        </dl>

        {!enLigne && (
          <>
            <a
              href={`sms:${p.contribuable_telephone ? `+237${p.contribuable_telephone}` : ""}?&body=${encodeURIComponent(texteSms)}`}
              className="btn-primaire mt-6 w-full py-3"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12c0 3.9-4 7-9 7-1 0-2-.1-2.9-.4L4 20l1.3-3.1C4 15.7 3 13.9 3 12c0-3.9 4-7 9-7s9 3.1 9 7z" />
              </svg>
              {p.contribuable_telephone
                ? "Envoyer la quittance par SMS"
                : "Envoyer par SMS (aucun téléphone enregistré)"}
            </a>
            <p className="mt-2 text-center text-xs text-slate-500">
              Vous pouvez aussi montrer cet écran au contribuable comme preuve
              ou l&apos;imprimer sur une imprimante portable.
            </p>
          </>
        )}
        {enLigne && (
          <p className="mt-5 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs leading-relaxed text-slate-500 ring-1 ring-slate-200">
            Cette quittance atteste une transaction simulée dans le cadre de la
            démonstration. Les opérateurs de paiement mobile seront intégrés
            lors d&apos;une phase ultérieure.
          </p>
        )}

        {/* Accès à la carte du contribuable (personnel de la mairie). */}
        {p.contribuable_id &&
          p.contribuable_code &&
          (session.role === "agent" || session.role === "admin") && (
            <Link
              href={`/carte-contribuable/${p.contribuable_id}`}
              className="mt-2 block rounded-xl px-4 py-2.5 text-center text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 print:hidden"
            >
              Voir la carte de contribuable ({p.contribuable_code})
            </Link>
          )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link
          href={retour.href}
          className="rounded-xl bg-white px-4 py-3 text-center font-semibold text-emerald-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          {retour.libelle}
        </Link>
        <BoutonImprimer />
      </div>
    </main>
  );
}
