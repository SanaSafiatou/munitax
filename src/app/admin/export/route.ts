import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  type LigneCollecte,
  bornesPeriode,
  estPeriodeValide,
} from "@/lib/collectes";
import { dateStr, heureStr } from "@/lib/dates";
import { libelleMoyen } from "@/lib/moyens-paiement";

function echapper(v: string | number | null): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin" || session.mairieId == null) {
    return new NextResponse("Accès refusé", { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  const agent = sp.get("agent") || "";
  const type = sp.get("type") || "";
  const moyen = sp.get("moyen") || "";

  const valeurPeriode = sp.get("periode");
  const periode = estPeriodeValide(valeurPeriode) ? valeurPeriode : "jour";
  // « du » accepte aussi le filtre simple « date » utilisé par la liste des collectes
  const du = sp.get("du") || sp.get("date") || "";
  const au = sp.get("au") || "";
  const b = bornesPeriode(periode, du, au);

  // Cloisonnement : uniquement les paiements de la mairie de l'admin connecté.
  const conditions: string[] = ["p.mairie_id = ?", "p.date_heure >= ?", "p.date_heure < ?"];
  const params: (number | string)[] = [session.mairieId, b.debut, b.fin];

  if (agent && Number.isFinite(Number(agent))) {
    conditions.push("p.agent_id = ?");
    params.push(Number(agent));
  }
  if (type && Number.isFinite(Number(type))) {
    conditions.push("p.type_taxe_id = ?");
    params.push(Number(type));
  }
  if (["cash", "wave", "orange_money", "moov_money", "mtn_money"].includes(moyen)) {
    conditions.push("p.moyen_paiement = ?");
    params.push(moyen);
  }

  const lignes = db
    .prepare<(number | string)[], LigneCollecte>(
      `SELECT p.*, a.nom_complet AS agent_nom, t.nom AS taxe_nom
       FROM paiements p
       LEFT JOIN agents a ON a.id = p.agent_id
       JOIN types_taxe t ON t.id = p.type_taxe_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.date_heure ASC`,
    )
    .all(...params);

  const entetes = [
    "Référence",
    "Date",
    "Heure",
    "Agent",
    "Type de taxe",
    "Moyen de paiement",
    "Référence mobile money",
    "Commerçant",
    "Montant",
    "Latitude",
    "Longitude",
    "Statut",
  ];

  const lignesCsv = [
    entetes.join(";"),
    ...lignes.map((l) =>
      [
        l.reference ?? l.id,
        dateStr(l.date_heure),
        heureStr(l.date_heure),
        l.agent_nom,
        l.taxe_nom,
        libelleMoyen(l.moyen_paiement),
        l.reference_mobile ?? "",
        l.commercant,
        l.montant,
        l.latitude ?? "",
        l.longitude ?? "",
        l.statut === "valide" ? "Validé" : "Annulé",
      ]
        .map(echapper)
        .join(";"),
    ),
  ].join("\r\n");

  const csv = `\uFEFF${lignesCsv}`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="collectes_${dateStr(b.debut)}_${dateStr(Math.max(b.fin - 1, b.debut))}.csv"`,
    },
  });
}
