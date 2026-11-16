import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Match, Player } from '../types/models';
import { getPlayerFutOverall, weightToFutStat } from '../engine/mathEngine';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  History,
  Shield,
  Trophy,
  Users,
  Vote,
  XCircle,
} from 'lucide-react';

const STATUS_BADGE: Record<
  Match['status'],
  { label: string; className: string }
> = {
  DRAFT: {
    label: 'Bozza',
    className: 'bg-slate-800 text-slate-300 border-slate-700',
  },
  OPEN_FOR_BETS: {
    label: 'Scommesse Aperte',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  IN_PLAY: {
    label: 'In Corso (3.0)',
    className: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  VOTING_OPEN: {
    label: 'Votazioni Aperte',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  ARCHIVED: {
    label: 'Conclusa',
    className: 'bg-slate-800/90 text-slate-300 border-slate-700',
  },
};

export const MatchHistoryView: React.FC = () => {
  const { matchesHistory, match, players, currentPlayer, isLoggedIn } = useApp();

  const [expandedMatchIds, setExpandedMatchIds] = useState<Record<string, boolean>>({});

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  // Combine matchesHistory and current active match (if played or in play/voting/archived), deduplicated by id
  const allPlayedMatches = useMemo<Match[]>(() => {
    const map = new Map<string, Match>();
    for (const m of matchesHistory) {
      map.set(m.id, m);
    }
    if (match) {
      map.set(match.id, match);
    }
    const list = Array.from(map.values()).filter(
      (m) =>
        m.status === 'ARCHIVED' ||
        m.status === 'VOTING_OPEN' ||
        m.status === 'IN_PLAY' ||
        m.score.winner !== null
    );
    return list;
  }, [matchesHistory, match]);

  const toggleExpand = (id: string) => {
    setExpandedMatchIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Personal Recap Stats from currentPlayer reconciled with allPlayedMatches
  const personalStats = useMemo(() => {
    if (!currentPlayer) return null;
    let histPlayed = 0;
    let histWon = 0;
    let histDrawn = 0;

    for (const m of allPlayedMatches) {
      const t1Ids = [
        ...(m.team_1.gk_id ? [m.team_1.gk_id] : []),
        ...m.team_1.outfield_ids,
      ];
      const t2Ids = [
        ...(m.team_2.gk_id ? [m.team_2.gk_id] : []),
        ...m.team_2.outfield_ids,
      ];
      const inT1 = t1Ids.includes(currentPlayer.id);
      const inT2 = t2Ids.includes(currentPlayer.id);
      if (inT1 || inT2) {
        histPlayed += 1;
        if (m.score.winner === 'X') {
          histDrawn += 1;
        } else if (
          (m.score.winner === '1' && inT1) ||
          (m.score.winner === '2' && inT2)
        ) {
          histWon += 1;
        }
      }
    }

    const played = Math.max(currentPlayer.stats.matches_played, histPlayed);
    const won = Math.max(currentPlayer.stats.matches_won, histWon);
    const drawn = Math.max(currentPlayer.stats.matches_drawn ?? 0, histDrawn);
    const lost = Math.max(0, played - won - drawn);
    const betsTotal = currentPlayer.stats.bets_total;
    const betsWon = currentPlayer.stats.bets_won;
    const betsLost = Math.max(0, betsTotal - betsWon);
    const netTokens = currentPlayer.stats.bets_net_profit ?? 0;
    return {
      played,
      won,
      drawn,
      lost,
      betsTotal,
      betsWon,
      betsLost,
      netTokens,
    };
  }, [currentPlayer, allPlayedMatches]);

  const renderTeamFormationCard = (
    title: string,
    accentClass: string,
    team: Match['team_1']
  ) => {
    const gk = team.gk_id ? playerMap.get(team.gk_id) : null;
    return (
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${accentClass}`} />
            <span className="font-bold text-white text-xs sm:text-sm">{title}</span>
          </div>
          <span className="text-[11px] font-mono-tabular text-slate-400">
            Forza: <strong className="text-emerald-400">{team.total_power.toFixed(2)}</strong>
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          {gk && (
            <div className="flex items-center justify-between bg-slate-900/90 px-3 py-1.5 rounded-xl border border-amber-500/30">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                  POR
                </span>
                <span className="font-semibold text-white truncate">{gk.name}</span>
              </div>
              <span className="font-mono-tabular text-[11px] text-amber-300 font-semibold shrink-0">
                POR {weightToFutStat(gk.weights.portiere)}
              </span>
            </div>
          )}

          {team.outfield_ids.map((id) => {
            const p = playerMap.get(id);
            if (!p) {
              return (
                <div
                  key={id}
                  className="flex items-center justify-between bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800/70 text-slate-400"
                >
                  <span>{id}</span>
                </div>
              );
            }
            return (
              <div
                key={id}
                className="flex items-center justify-between bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800/70"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                    {p.computed.role_label}
                  </span>
                  <span className="font-medium text-white truncate">{p.name}</span>
                </div>
                <span className="font-mono-tabular text-[11px] text-slate-300 font-bold shrink-0">
                  FUT {getPlayerFutOverall(p)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <History className="w-7 h-7 text-emerald-400" />
            <span>Storico Partite</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Archivio completo delle partite giocate. Clicca su una partita per ispezionare le formazioni scese in campo.
          </p>
        </div>
        <div className="text-xs font-mono-tabular text-slate-400 bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl self-start sm:self-auto">
          Partite in archivio: <strong className="text-white">{allPlayedMatches.length}</strong>
        </div>
      </div>

      {/* Personal Recap Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-xl">
        {!isLoggedIn || !currentPlayer || !personalStats ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Recap Personale Giocatore & Scommesse
              </div>
              <h2 className="text-lg font-display font-bold text-white mt-0.5">
                Accedi e collega il tuo profilo giocatore per vedere il tuo bilancio
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Qui sotto puoi comunque consultare tutte le partite giocate, i risultati e le formazioni.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                {currentPlayer.avatar_url ? (
                  <img
                    src={currentPlayer.avatar_url}
                    alt={currentPlayer.name}
                    className="w-11 h-11 rounded-2xl object-cover border border-emerald-400/60"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-emerald-500/30 text-emerald-400 font-display font-extrabold text-sm flex items-center justify-center">
                    {currentPlayer.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                    Il Tuo Bilancio Stagionale
                  </div>
                  <h2 className="text-lg sm:text-xl font-display font-extrabold text-white">
                    {currentPlayer.name}
                    {currentPlayer.nickname ? ` «${currentPlayer.nickname}»` : ''}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-950/90 border border-amber-500/30 px-3.5 py-2 rounded-2xl font-mono-tabular">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-400">Saldo Attuale:</span>
                <strong className="text-sm text-amber-300">{currentPlayer.stats.tokens} Token</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Blocco 1: Partite Giocate */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-emerald-400" />
                    Riepilogo Partite Giocate
                  </span>
                  <span className="font-mono-tabular text-slate-400">
                    Totale: <strong className="text-white">{personalStats.played}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center font-mono-tabular pt-1">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">Giocate</div>
                    <div className="text-base sm:text-lg font-bold text-white mt-0.5">
                      {personalStats.played}
                    </div>
                  </div>
                  <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2.5">
                    <div className="text-[10px] text-emerald-300 font-sans">Vinte</div>
                    <div className="text-base sm:text-lg font-bold text-emerald-400 mt-0.5">
                      {personalStats.won}
                    </div>
                  </div>
                  <div className="bg-amber-950/25 border border-amber-500/30 rounded-xl p-2.5">
                    <div className="text-[10px] text-amber-300 font-sans">Pareggi</div>
                    <div className="text-base sm:text-lg font-bold text-amber-300 mt-0.5">
                      {personalStats.drawn}
                    </div>
                  </div>
                  <div className="bg-rose-950/25 border border-rose-500/30 rounded-xl p-2.5">
                    <div className="text-[10px] text-rose-300 font-sans">Perse</div>
                    <div className="text-base sm:text-lg font-bold text-rose-400 mt-0.5">
                      {personalStats.lost}
                    </div>
                  </div>
                </div>
              </div>

              {/* Blocco 2: Scommesse e Token Vinti/Persi */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-400" />
                    Riepilogo Scommesse & Token
                  </span>
                  <span className="font-mono-tabular text-slate-400">
                    Vinte: <strong className="text-amber-300">{personalStats.betsWon}/{personalStats.betsTotal}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center font-mono-tabular pt-1">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">Piazzate</div>
                    <div className="text-base sm:text-lg font-bold text-white mt-0.5">
                      {personalStats.betsTotal}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">Vinte / Perse</div>
                    <div className="text-base sm:text-lg font-bold text-amber-300 mt-0.5">
                      {personalStats.betsWon}W · {personalStats.betsLost}L
                    </div>
                  </div>
                  <div
                    className={`rounded-xl p-2.5 border ${
                      personalStats.netTokens >= 0
                        ? 'bg-emerald-950/30 border-emerald-500/30'
                        : 'bg-rose-950/30 border-rose-500/30'
                    }`}
                  >
                    <div className="text-[10px] text-slate-300 font-sans">Profitto Netto</div>
                    <div
                      className={`text-base sm:text-lg font-bold mt-0.5 ${
                        personalStats.netTokens >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {personalStats.netTokens > 0
                        ? `+${personalStats.netTokens}`
                        : personalStats.netTokens}{' '}
                      <span className="text-[10px] font-normal">Tok</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Simplified List of Played Matches */}
      {allPlayedMatches.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-display font-bold text-white">
            Nessuna partita in storico
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Non appena una partita entrerà in corso o verrà conclusa dal Direttore, apparirà qui con il risultato e le formazioni complete.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allPlayedMatches.map((m) => {
            const isExpanded = Boolean(expandedMatchIds[m.id]);
            const stBadge = STATUS_BADGE[m.status] ?? STATUS_BADGE.ARCHIVED;

            const t1Ids = [
              ...(m.team_1.gk_id ? [m.team_1.gk_id] : []),
              ...m.team_1.outfield_ids,
            ];
            const t2Ids = [
              ...(m.team_2.gk_id ? [m.team_2.gk_id] : []),
              ...m.team_2.outfield_ids,
            ];

            // Compute personal status for currentPlayer in this match
            const myId = currentPlayer?.id;
            const inT1 = myId ? t1Ids.includes(myId) : false;
            const inT2 = myId ? t2Ids.includes(myId) : false;
            const wasPresent = inT1 || inT2;

            let matchOutcomeBadge: { text: string; cls: string } = {
              text: 'Non presente',
              cls: 'bg-slate-800/80 text-slate-400 border-slate-700',
            };

            if (wasPresent) {
              if (m.score.winner === null || m.status === 'IN_PLAY') {
                matchOutcomeBadge = {
                  text: inT1 ? 'In campo (i Gabry)' : 'In campo (i Piero)',
                  cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                };
              } else if (m.score.winner === 'X') {
                matchOutcomeBadge = {
                  text: 'Giocata · Pareggio',
                  cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                };
              } else if (
                (m.score.winner === '1' && inT1) ||
                (m.score.winner === '2' && inT2)
              ) {
                matchOutcomeBadge = {
                  text: 'Giocata · Vittoria',
                  cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                };
              } else {
                matchOutcomeBadge = {
                  text: 'Giocata · Sconfitta',
                  cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
                };
              }
            }

            // Bet status for currentPlayer in this match
            const myBet = myId ? m.bets[myId] : undefined;
            let betOutcomeBadge: { text: string; cls: string } = {
              text: 'Nessuna scommessa',
              cls: 'bg-slate-800/80 text-slate-400 border-slate-700',
            };

            if (myBet) {
              if (myBet.status === 'CANCELLED') {
                betOutcomeBadge = {
                  text: `Scommessa Annullata (Rimborsati ${myBet.amount} Tok)`,
                  cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                };
              } else if (!myBet.settled && m.score.winner === null) {
                betOutcomeBadge = {
                  text: `Puntati ${myBet.amount} Tok su '${myBet.pick}'`,
                  cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                };
              } else {
                const wonBet =
                  myBet.status === 'WON' ||
                  (myBet.status !== 'LOST' && m.score.winner === myBet.pick);
                if (wonBet) {
                  const netWin = myBet.potential_payout - myBet.amount;
                  betOutcomeBadge = {
                    text: `Scommessa Vinta (+${netWin} Tok netti · Incasso ${myBet.potential_payout})`,
                    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                  };
                } else {
                  betOutcomeBadge = {
                    text: `Scommessa Persa (-${myBet.amount} Tok)`,
                    cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
                  };
                }
              }
            }

            // Voting status for currentPlayer in this match
            const hasVotedInMatch = myId
              ? m.voting_tracker.voters_completed_ids.includes(myId)
              : false;

            return (
              <div
                key={m.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden transition-colors shadow-md"
              >
                {/* Clickable Simplified Row */}
                <button
                  type="button"
                  onClick={() => toggleExpand(m.id)}
                  className="w-full p-4 sm:p-5 text-left flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer"
                >
                  {/* Left: Date & Scoreboard */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-center font-mono-tabular min-w-[92px]">
                        {m.score.team_1 !== null && m.score.team_2 !== null ? (
                          <div className="text-lg sm:text-xl font-display font-extrabold text-white">
                            {m.score.team_1} <span className="text-slate-500">-</span> {m.score.team_2}
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-amber-300 py-1">
                            In Corso
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400">
                          i Gabry vs i Piero
                        </div>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${stBadge.className}`}
                          >
                            {stBadge.label}
                          </span>
                          <span className="text-xs text-slate-400 font-mono-tabular">
                            Quote: 1({m.odds['1'].toFixed(2)}) · X({m.odds['X'].toFixed(2)}) · 2({m.odds['2'].toFixed(2)})
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-display font-bold text-white mt-1">
                          {m.date_label}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Right: User Personal Badges (Played, Bet, Voted) + Expand Chevron */}
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/80">
                    {currentPlayer && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {/* 1. Esito Partita */}
                        <span
                          className={`px-2.5 py-1 rounded-xl border font-semibold flex items-center gap-1 ${matchOutcomeBadge.cls}`}
                        >
                          <Shield className="w-3 h-3" />
                          {matchOutcomeBadge.text}
                        </span>

                        {/* 2. Esito Scommessa */}
                        <span
                          className={`px-2.5 py-1 rounded-xl border font-semibold flex items-center gap-1 font-mono-tabular ${betOutcomeBadge.cls}`}
                        >
                          <Coins className="w-3 h-3" />
                          {betOutcomeBadge.text}
                        </span>

                        {/* 3. Stato Voto */}
                        {wasPresent && (
                          <span
                            className={`px-2.5 py-1 rounded-xl border font-semibold flex items-center gap-1 ${
                              hasVotedInMatch
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {hasVotedInMatch ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Votato
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" /> Non votato
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 ml-auto lg:ml-2">
                      <span>{isExpanded ? 'Nascondi formazioni' : 'Vedi formazioni'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Lineups Section */}
                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-slate-800/90 bg-slate-950/40 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        Formazioni Ufficiali ({m.convocati_ids.length} giocatori)
                      </span>
                      <span className="flex items-center gap-1.5 font-mono-tabular">
                        <Vote className="w-3.5 h-3.5 text-sky-400" />
                        Votazioni completate: {m.voting_tracker.voters_completed_ids.length}/10
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderTeamFormationCard(
                        `i Gabry ${
                          m.score.team_1 !== null ? `(${m.score.team_1} Gol)` : ''
                        }`,
                        'bg-emerald-400',
                        m.team_1
                      )}
                      {renderTeamFormationCard(
                        `i Piero ${
                          m.score.team_2 !== null ? `(${m.score.team_2} Gol)` : ''
                        }`,
                        'bg-sky-400',
                        m.team_2
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
