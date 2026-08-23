import Link from "next/link";
import { redirect } from "next/navigation";
import { accueilPourRole, getSession } from "@/lib/auth";
import LogoMarque from "@/components/logo-marque";

export default async function Accueil() {
  const session = await getSession();
  if (session) redirect(accueilPourRole(session.role));

  const roles = [
    {
      titre: "Contribuable",
      description:
        "Payez vos taxes en ligne en quelques clics et conservez vos quittances.",
      points: [
        "Paiement en ligne de démonstration",
        "Quittance numérique immédiate",
        "Historique de vos paiements",
      ],
      href: "/inscription",
      cta: "Créer un compte gratuit",
      icone: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5zm6-10.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0zM6 14.25c0-.99 1.79-1.5 3-1.5s3 .51 3 1.5" />
      ),
    },
    {
      titre: "Agent collecteur",
      description:
        "Encaissez sur le terrain et générez une quittance instantanée.",
      points: [
        "Collecte rapide avec position GPS",
        "Reçu envoyable par SMS",
        "Journal quotidien des collectes",
      ],
      href: "/login",
      cta: "Espace agent",
      icone: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a8.25 8.25 0 0 1 15 0M17.25 6.6a3.4 3.4 0 0 1 0 6.6M21 13.5a6.8 6.8 0 0 1 1.5 4.2M3 13.5A6.8 6.8 0 0 0 1.5 17.7" />
      ),
    },
    {
      titre: "Administration",
      description:
        "Suivez la collecte en temps réel et pilotez votre équipe municipale.",
      points: [
        "Tableau de bord et indicateurs",
        "Suivi par agent et par taxe",
        "Export des données (CSV)",
      ],
      href: "/login",
      cta: "Espace mairie",
      icone: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.1 10.3 6a2.4 2.4 0 0 1 3.4 0l7.3 7.1M5 11v8.5h14V11M9.5 19.5v-5h5v5" />
      ),
    },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      {/* En-tête */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <LogoMarque />
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn-fantome">
              Se connecter
            </Link>
            <Link href="/inscription" className="btn-primaire">
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Héros */}
        <section className="bg-gradient-to-b from-emerald-900 to-emerald-800 text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
            <p className="badge-demo mb-4">Version de démonstration gratuite</p>
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              La collecte des taxes municipales, simple et transparente.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-emerald-100 sm:text-lg">
              Une plateforme unique pour les contribuables, les agents
              collecteurs et l&apos;administration : paiements en ligne,
              encaissement terrain et pilotage en temps réel.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/inscription"
                className="btn bg-white px-5 py-3 text-emerald-800 shadow hover:bg-emerald-50"
              >
                Tester gratuitement
              </Link>
              <Link
                href="/login"
                className="btn border border-white/30 bg-white/10 px-5 py-3 text-white hover:bg-white/20"
              >
                J&apos;ai déjà un compte
              </Link>
            </div>

            <dl className="mt-12 grid grid-cols-1 gap-6 border-t border-white/15 pt-8 sm:grid-cols-3">
              {[
                ["3", "profils adaptés : mairie, agent, contribuable"],
                ["100 %", "gratuit pendant la phase de démonstration"],
                ["0", "paiement réel : transactions simulées uniquement"],
              ].map(([valeur, libelle]) => (
                <div key={libelle}>
                  <dt className="text-3xl font-bold">{valeur}</dt>
                  <dd className="mt-1 text-sm text-emerald-100">{libelle}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Profils */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
            Une application pensée pour chaque acteur de la commune
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
            Choisissez un profil pour découvrir les fonctionnalités associées.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {roles.map((r) => (
              <article key={r.titre} className="carte flex flex-col p-6">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
                    {r.icone}
                  </svg>
                </span>
                <h3 className="text-lg font-semibold text-slate-900">{r.titre}</h3>
                <p className="mt-1 text-sm text-slate-500">{r.description}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-slate-600">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                      </svg>
                      {p}
                    </li>
                  ))}
                </ul>
                <Link href={r.href} className="lien-action mt-5">
                  {r.cta} →
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* Bandeau démonstration */}
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                </svg>
              </span>
              <div>
                <h2 className="font-semibold text-amber-900">
                  En savoir plus sur cette version de test
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-amber-800">
                  Cette plateforme est une <strong>démonstration</strong> :
                  aucun argent réel n&apos;est échangé et aucun opérateur de
                  paiement n&apos;est connecté. Les données visibles sont
                  fictives et peuvent être réinitialisées à tout moment par
                  l&apos;administrateur. Les comptes de test sont affichés sur
                  la page de connexion — invitez vos collègues à essayer chacun
                  des trois profils.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pied de page */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row">
          <p>MuniTax — démonstration destinée aux collectivités territoriales.</p>
          <p className="badge-demo">Données de test · aucune transaction réelle</p>
        </div>
      </footer>
    </div>
  );
}
