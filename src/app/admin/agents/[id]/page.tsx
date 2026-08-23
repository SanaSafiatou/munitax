import Link from "next/link";
import { notFound } from "next/navigation";
import db from "@/lib/db";
import { exigerMairie } from "@/lib/auth";
import { bornesPeriode, estPeriodeValide, type Periode } from "@/lib/collectes";
import { dateHeureStr, montantFmt } from "@/lib/dates";

export const metadata = { title: "Fiche agent" };

export default async function PageFicheAgent(
  props: PageProps<"/admin/agents/[id]">,
) {
  const { mairieId } = await exigerMairie("admin");
  const id = Number((await props.params).id);
  const sp = await props.searchParams;

  const agent = db
    .prepare<[number], {
      id: number;
      nom_complet: string;
      telephone: string | null;
      identifiant: string;
      role: string;
      actif: number;
      mairie_id: number;
    }>(
      "SELECT id, nom_complet, telephone, identifiant, role, actif, mairie_id FROM agents WHERE id = ?",
    )
    .get(id);
  // Cloisonnement : un agent d'une autre mairie est invisible.
  if (!agent || agent.mairie_id !== mairieId) notFound();

  const periodeParam = estPeriodeValide(sp.periode) ? sp.periode : "jour";
  const du = typeof sp.du === "string" ? sp.du : "";
  const au = typeof sp.au === "string" ? sp.au : "";

  const b = bornesPeriode(periodeParam, du, au);

  type Ligne = {
    id: number;
    reference: string | null;
    montant: number;
    commercant: string;
    date_heure: number;
    statut: "valide" | "annule";
    taxe_nom: string;
  };

  const lignes = db
    .prepare<[number, number, number], Ligne>(
      `SELECT p.id, p.reference, p.montant, p.commercant, p.date_heure, p.statut, t.nom AS taxe_nom
       FROM paiements p JOIN types_taxe t ON t.id = p.type_taxe_id
       WHERE p.agent_id = ? AND p.date_heure >= ? AND p.date_heure < ?
       ORDER BY p.date_heure DESC LIMIT 500`,
    )
    .all(agent.id, b.debut, b.fin);

  const valides = lignes.filter((l) => l.statut === "valide");
  const total = valides.reduce((s, l) => s + l.montant, 0);
  const parTaxe = new Map<string, number>();
  for (const l of valides) parTaxe.set(l.taxe_nom, (parTaxe.get(l.taxe_nom) ?? 0) + l.montant);

  const boutons: { cle: Periode; libelle: string }[] = [
    { cle: "jour", libelle: "Aujourd'hui" },
    { cle: "semaine", libelle: "7 jours" },
    { cle: "mois", libelle: "30 jours" },
    { cle: "tout", libelle: "Personnalisé" },
  ];

  return (
    <div className="space-y-4">
      <Link href="/admin/agents" className="inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Tous les agents
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{agent.nom_complet}</h1>
          <p className="text-sm text-slate-500">
            Identifiant : <span className="font-mono">{agent.identifiant}</span>
            {agent.telephone ? ` · ${agent.telephone}` : ""} ·{" "}
            <span className={agent.actif ? "text-emerald-700" : "text-red-500"}>
              {agent.actif ? "Actif" : "Désactivé"}
            </span>
          </p>
        </div>
        <a
          href={`/admin/export?agent=${agent.id}&periode=${periodeParam}&du=${du}&au=${au}`}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Exporter ↓
        </a>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
        {boutons.map((b2) => (
          <button
            key={b2.cle}
            type="submit"
            name="periode"
            value={b2.cle}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ${
              periodeParam === b2.cle
                ? "bg-emerald-700 text-white ring-emerald-700"
                : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
            }`}
          >
            {b2.libelle}
          </button>
        ))}
        {periodeParam === "tout" && (
          <>
            <label className="text-xs font-medium text-slate-600">
              Du
              <input
                type="date"
                name="du"
                defaultValue={du}
                className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Au
              <input
                type="date"
                name="au"
                defaultValue={au}
                className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          </>
        )}
      </form>

      <p className="px-1 text-sm text-slate-500">{b.libelle}</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs text-slate-500">Total collecté</p>
          <p className="mt-1 text-xl font-bold">{montantFmt(total)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs text-slate-500">Paiements validés</p>
          <p className="mt-1 text-xl font-bold">{valides.length}</p>
        </div>
        {Array.from(parTaxe.entries())
          .slice(0, 2)
          .map(([nom, t]) => (
            <div key={nom} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="truncate text-xs text-slate-500">{nom}</p>
              <p className="mt-1 text-xl font-bold">{montantFmt(t)}</p>
            </div>
          ))}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
        {lignes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Aucune transaction sur cette période.
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-medium">Référence</th>
                <th className="px-4 py-2.5 font-medium">Date et heure</th>
                <th className="px-4 py-2.5 font-medium">Taxe</th>
                <th className="px-4 py-2.5 font-medium">Commerçant</th>
                <th className="px-4 py-2.5 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lignes.map((l) => (
                <tr key={l.id} className={l.statut !== "valide" ? "opacity-60" : ""}>
                  <td className="px-4 py-2.5">
                    <Link href={`/recu/${l.id}`} className="font-mono text-xs hover:text-emerald-700">
                      {l.reference ?? `#${l.id}`}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">{dateHeureStr(l.date_heure)}</td>
                  <td className="px-4 py-2.5">{l.taxe_nom}</td>
                  <td className="px-4 py-2.5">{l.commercant}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${l.statut !== "valide" ? "line-through" : ""}`}>
                    {montantFmt(l.montant)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
