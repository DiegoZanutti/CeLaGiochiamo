import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AllAttrKey, Player, RoleLabel } from '../types/models';
import {
  getPlayerFutOverall,
  weightToFutStat,
} from '../engine/mathEngine';
import { FutCard, FutCardDetailModal } from './FutCard';
import { Lock, Search, ShieldCheck, SlidersHorizontal, Vote } from 'lucide-react';

type RoleFilter = 'ALL' | RoleLabel;
type SortKey = 'overall' | AllAttrKey;

export const MIN_VOTES_FOR_UNLOCK = 4;

export const FutGalleryView: React.FC = () => {
  const { players, currentUser, currentPlayer, isDirettore } = useApp();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('overall');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const userCompletedVotes = currentPlayer?.stats?.votes_completed_matches ?? 0;

  const canViewAllPlayers = useMemo(() => {
    if (isDirettore) return true;
    return (
      currentUser?.auth_status === 'VALIDATED' &&
      Boolean(currentPlayer) &&
      userCompletedVotes >= MIN_VOTES_FOR_UNLOCK
    );
  }, [isDirettore, currentUser?.auth_status, currentPlayer, userCompletedVotes]);

  const activePlayers = useMemo(
    () => players.filter((p) => p.is_active),
    [players]
  );

  const filteredAndSortedPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activePlayers
      .filter((p) => {
        if (roleFilter === 'ALL') return true;
        const effectiveRole: RoleLabel = p.wants_to_be_gk
          ? 'POR'
          : p.computed.role_label;
        return effectiveRole === roleFilter;
      })
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.nickname || '').toLowerCase().includes(q)
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
  }, [activePlayers, roleFilter, sortBy, searchQuery]);

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
        <h2 className="text-xl font-display font-bold text-white">Players</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Nessun giocatore registrato nella rosa ufficiale.
        </p>
      </div>
    );
  }

  if (!canViewAllPlayers) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 text-center max-w-xl mx-auto my-6 space-y-4 shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
              Players
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Le Card complete e le statistiche dettagliate di tutti i giocatori sono visibili ai giocatori{' '}
              <strong className="text-emerald-400">validati</strong> che hanno completato{' '}
              <strong className="text-white">almeno {MIN_VOTES_FOR_UNLOCK} votazioni post-partita</strong>.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 max-w-md mx-auto space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Vote className="w-4 h-4 text-emerald-400" />
                Le tue votazioni completate:
              </span>
              <span className="font-mono-tabular font-bold text-amber-300">
                {userCompletedVotes} / {MIN_VOTES_FOR_UNLOCK}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((userCompletedVotes / MIN_VOTES_FOR_UNLOCK) * 100)
                  )}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-400 pt-0.5">
              {!currentUser || currentUser.auth_status !== 'VALIDATED'
                ? 'Accedi e collega un profilo giocatore, partecipa ad almeno 4 partite e vota la prestazione dei tuoi compagni'
                : `Ti mancano ancora ${Math.max(
                    1,
                    MIN_VOTES_FOR_UNLOCK - userCompletedVotes
                  )} votazioni post-partita per sbloccare tutte le Card della rosa.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
                Players
              </h1>
              {isDirettore && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Accesso Direttore
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Rosa ufficiale completa ({activePlayers.length} giocatori attivi) · Clicca su una Card per esplorare tutti i dettagli
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
