import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AllAttrKey, Player, RoleLabel } from '../types/models';
import { getPlayerFutOverall, weightToFutStat } from '../engine/mathEngine';
import { FutCard, FutCardDetailModal } from './FutCard';
import { Search, SlidersHorizontal } from 'lucide-react';

type RoleFilter = 'ALL' | RoleLabel;
type SortKey = 'overall' | AllAttrKey;

export const FutGalleryView: React.FC = () => {
  const { players } = useApp();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('overall');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const filteredAndSortedPlayers = useMemo(() => {
    return players
      .filter((p) => p.is_active)
      .filter((p) => {
        if (roleFilter === 'ALL') return true;
        const effectiveRole: RoleLabel = p.wants_to_be_gk
          ? 'POR'
          : p.computed.role_label;
        return effectiveRole === roleFilter;
      })
      .filter((p) =>
        p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'overall') {
          return getPlayerFutOverall(b) - getPlayerFutOverall(a);
        }
        return (
          weightToFutStat(b.weights[sortBy]) -
          weightToFutStat(a.weights[sortBy])
        );
      });
  }, [players, roleFilter, sortBy, searchQuery]);

  const roleTabs: Array<{ id: RoleFilter; label: string }> = [
    { id: 'ALL', label: 'Tutti i Ruoli' },
    { id: 'POR', label: 'Portieri (POR)' },
    { id: 'DIF', label: 'Difensori (DIF)' },
    { id: 'TUT', label: 'Tuttocampisti (TUT)' },
    { id: 'ATT', label: 'Attaccanti (ATT)' },
  ];

  const sortOptions: Array<{ id: SortKey; label: string }> = [
    { id: 'overall', label: 'Overall (OVR)' },
    { id: 'tiro', label: 'Tiro (TIR)' },
    { id: 'velocita', label: 'Velocità (VEL)' },
    { id: 'passaggio', label: 'Passaggio (PAS)' },
    { id: 'resistenza', label: 'Resistenza (RES)' },
    { id: 'difesa', label: 'Difesa (DIF)' },
    { id: 'portiere', label: 'Portiere (POR)' },
  ];

  if (players.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto my-8 space-y-3 shadow-lg">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
          <Search className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-display font-bold text-white">Carte FUT</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Nessun giocatore registrato nella rosa ufficiale. I profili appariranno qui automaticamente non appena Il Direttore aggiungerà i giocatori nel Backoffice.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
              Carte FUT
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Rosa ufficiale · {filteredAndSortedPlayers.length} giocatori
            </p>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca giocatore..."
                aria-label="Cerca giocatore per nome"
                className="pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
              <label htmlFor="fut-sort-select" className="text-xs text-slate-400 shrink-0">
                Ordina:
              </label>
              <select
                id="fut-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-slate-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Role Filter Segmented Bar */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4 p-1.5 bg-slate-950 rounded-2xl border border-slate-800/80">
          {roleTabs.map((tab) => {
            const active = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Cards Grid */}
        {filteredAndSortedPlayers.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            Nessun giocatore trovato con i filtri selezionati.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 mt-6">
            {filteredAndSortedPlayers.map((player) => (
              <FutCard
                key={player.id}
                player={player}
                onClick={(p) => setSelectedPlayer(p)}
              />
            ))}
          </div>
        )}
      </div>

      <FutCardDetailModal
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
};
