export const metadata = { title: "Paramètres" };

const COMPTES = [
  ["Administrateur Béoumi", "admin.beoumi", "beoumi123"],
  ["Administrateur Bouaké", "admin.bouake", "bouake123"],
  ["Agent Béoumi", "agent1", "agent123"],
  ["Agent Bouaké", "agent2", "agent123"],
  ["Contribuable en ligne", "690000001", "test1234"],
] as const;

export default function PageParametres() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="titre-page">Paramètres</h1>
        <p className="sous-titre-page">
          Environnement de démonstration multi-mairies.
        </p>
      </div>

      {/* Mode démonstration */}
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
          </span>
          <div className="text-sm leading-relaxed text-amber-800">
            <h2 className="font-semibold text-amber-900">Mode démonstration actif</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Aucun opérateur de paiement réel n&apos;est intégré.</li>
              <li>Tous les paiements en ligne sont simulés et gratuits.</li>
              <li>
                Les données sont cloisonnées par mairie : vous ne voyez que
                celles de la vôtre.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Comptes de démonstration */}
      <section className="carte">
        <h2 className="carte-titre">Comptes de démonstration</h2>
        <p className="px-5 pt-3 text-sm text-slate-500">
          Ces comptes sont recréés par le super-administrateur lors d&apos;une
          réinitialisation complète.
        </p>
        <div className="overflow-x-auto p-4 pt-3">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-medium">Profil</th>
                <th className="py-2 pr-4 font-medium">Identifiant</th>
                <th className="py-2 font-medium">Mot de passe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {COMPTES.map(([profil, id, mdp]) => (
                <tr key={`${profil}-${id}`}>
                  <td className="py-2.5 pr-4 font-medium text-slate-700">{profil}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs">{id}</td>
                  <td className="py-2.5 font-mono text-xs">{mdp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          Les agents que vous créez reçoivent un code PIN temporaire à
          remplacer dès leur première connexion.
        </p>
      </section>
    </div>
  );
}
