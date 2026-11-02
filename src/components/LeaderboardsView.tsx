import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Award, Coins, Flame, Trophy } from 'lucide-react';

type LeaderboardTab = 'ORACOLO' | 'PAPERONI' | 'RE_DEL_CAMPO' | 'STAKANOVISTI';

export const LeaderboardsView: React.FC = () => {
  const { players } = useApp();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('RE_DEL_CAMPO');

  const totalMatchesOrganized = useMemo(() => {
    if (players.length === 0) return 1;
    const maxPlayed = Math.max(
      1,
      ...players.map((p) => p.stats.matches_played)
    );
    return maxPlayed;
  }, [players]);

  if (players.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto my-8 space-y-3 shadow-lg">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
          <Trophy className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-display font-bold text-white">Classifiche</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Nessuna statistica disponibile. Le classifiche (Re del Campo, Oracolo, Paperoni, Stakanovisti) verranno aggiornate automaticamente al termine delle prime partite giocate.
        </p>
      </div>
    );
  }

  const sortedRows = useMemo(() => {
    const list = [...players].filter((p) => p.is_active);

    if (activeTab === 'ORACOLO') {
      // Modulo 05 (3.1): Primary = bets_won desc, Secondary = Win Rate % desc
      return list.sort((a, b) => {
        if (b.stats.bets_won !== a.stats.bets_won) {
          return b.stats.bets_won - a.stats.bets_won;
        }
        const wrA =
          a.stats.bets_total > 0
            ? (a.stats.bets_won / a.stats.bets_total) * 100
            : 0;
        const wrB =
          b.stats.bets_total > 0
            ? (b.stats.bets_won / b.stats.bets_total) * 100
            : 0;
        return wrB - wrA;
      });
    }

    if (activeTab === 'PAPERONI') {
      // Modulo 05 (3.2): Primary = tokens desc
      return list.sort((a, b) => b.stats.tokens - a.stats.tokens);
    }

    if (activeTab === 'RE_DEL_CAMPO') {
      // Modulo 05 (3.3): Primary = matches_won desc, Secondary = Win %
      return list.sort((a, b) => {
        if (b.stats.matches_won !== a.stats.matches_won) {
          return b.stats.matches_won - a.stats.matches_won;
        }
        const wrA =
          a.stats.matches_played > 0
            ? a.stats.matches_won / a.stats.matches_played
            : 0;
        const wrB =
          b.stats.matches_played > 0
            ? b.stats.matches_won / b.stats.matches_played
            : 0;
        return wrB - wrA;
      });
    }

    // STAKANOVISTI (Modulo 05 - 3.4): Primary = matches_played desc, Secondary = votes_completed_matches desc
    return list.sort((a, b) => {
      if (b.stats.matches_played !== a.stats.matches_played) {
        return b.stats.matches_played - a.stats.matches_played;
      }
      return b.stats.votes_completed_matches - a.stats.votes_completed_matches;
    });
  }, [players, activeTab]);

  const tabs: Array<{
    id: LeaderboardTab;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'RE_DEL_CAMPO',
      title: 'Re del Campo',
      subtitle: 'Maggior Numero di Vittorie Reali Conquistate sul Campo',
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: 'ORACOLO',
      title: 'Oracolo 1X2',
      subtitle: 'Migliori Scommettitori 1X2 (Pronostici Vinti & Percentuale di Successo)',
      icon: <Award className="w-4 h-4" />,
    },
    {
      id: 'PAPERONI',
      title: 'Paperoni Token',
      subtitle: 'Montepremi e Portafoglio Token dei Giocatori',
      icon: <Coins className="w-4 h-4" />,
    },
    {
      id: 'STAKANOVISTI',
      title: 'Stakanovisti',
      subtitle: 'Presenze alle Partite & Questionari di Voto Completati',
      icon: <Flame className="w-4 h-4" />,
    },
  ];

  const activeMeta = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="pb-4 border-b border-slate-800">
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
            Classifiche
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{activeMeta.subtitle}</p>
        </div>

        {/* Navbar Secondaria per la Navigazione tra le Classifiche */}
        <nav aria-label="Navigazione classifiche" className="mt-5">
          <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.title}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Leaderboard Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400">
                <th className="py-3 px-4 w-16">Pos.</th>
                <th className="py-3 px-4">Giocatore</th>
                <th className="py-3 px-4">Ruolo</th>
                {activeTab === 'ORACOLO' && (
                  <>
                    <th className="py-3 px-4 text-right">Pronostici Indovinati / Tot.</th>
                    <th className="py-3 px-4 text-right">Win Rate %</th>
                  </>
                )}
                {activeTab === 'PAPERONI' && (
                  <>
                    <th className="py-3 px-4 text-right">Saldo Token Attuale</th>
                    <th className="py-3 px-4 text-right">Profitto Netto Scommesse</th>
                  </>
                )}
                {activeTab === 'RE_DEL_CAMPO' && (
                  <>
                    <th className="py-3 px-4 text-right">Vittorie Campo</th>
                    <th className="py-3 px-4 text-right">Partite Giocate</th>
                    <th className="py-3 px-4 text-right">% Vittorie</th>
                  </>
                )}
                {activeTab === 'STAKANOVISTI' && (
                  <>
                    <th className="py-3 px-4 text-right">Presenze Totali</th>
                    <th className="py-3 px-4 text-right">Votazioni Completate</th>
                    <th className="py-3 px-4 text-right">% Presenza Stagionale</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {sortedRows.map((p, index) => {
                const rank = index + 1;
                const role = p.wants_to_be_gk ? 'POR' : p.computed.role_label;

                const betWinRate =
                  p.stats.bets_total > 0
                    ? ((p.stats.bets_won / p.stats.bets_total) * 100).toFixed(1)
                    : '0.0';
                const fieldWinRate =
                  p.stats.matches_played > 0
                    ? ((p.stats.matches_won / p.stats.matches_played) * 100).toFixed(1)
                    : '0.0';
                const attendancePct = (
                  (p.stats.matches_played / totalMatchesOrganized) *
                  100
                ).toFixed(0);
                const netProfit = p.stats.bets_net_profit ?? 0;

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-950/60 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono-tabular font-bold text-slate-300">
                      #{rank}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {p.name}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400 font-mono-tabular">
                      {role}
                    </td>

                    {activeTab === 'ORACOLO' && (
                      <>
                        <td className="py-3.5 px-4 text-right font-mono-tabular text-white font-semibold">
                          {p.stats.bets_won} / {p.stats.bets_total}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-tabular text-emerald-400 font-bold">
                          {betWinRate}%
                        </td>
                      </>
                    )}

                    {activeTab === 'PAPERONI' && (
                      <>
                        <td className="py-3.5 px-4 text-right font-mono-tabular text-amber-300 font-bold text-base">
                          {p.stats.tokens} Token
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-mono-tabular font-semibold ${
                            netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {netProfit >= 0 ? `+${netProfit}` : netProfit} Token
                        </td>
                      </>
                    )}

                    {activeTab === 'RE_DEL_CAMPO' && (
                      <>
                        <td className="py-3.5 px-4 text-right font-mono-tabular text-emerald-400 font-bold text-base">
                          {p.stats.matches_won}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-tabular text-slate-300">
                          {p.stats.matches_played}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-tabular text-white font-semibold">
                          {fieldWinRate}%
                        </td>
                      </>
                    )}

                    {activeTab === 'STAKANOVISTI' && (
                      <>
                        <td className="py-3.5 px-4 text-right font-mono-tabular text-white font-bold text-base">
                          {p.stats.matches_played}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-tabular text-slate-300">
                          {p.stats.votes_completed_matches}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-tabular text-sky-400 font-semibold">
                          {attendancePct}%
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
