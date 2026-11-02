import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { BetPick, Player, TeamLineup } from '../types/models';
import { getPlayerFutOverall } from '../engine/mathEngine';
import { VotingModal } from './VotingModal';
import { FutCardDetailModal } from './FutCard';
import { BalancingInfoModal } from './BalancingInfoModal';
import {
  Calendar,
  CheckCircle2,
  Coins,
  HelpCircle,
  Lock,
  LogIn,
  Sparkles,
  Vote,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'In Preparazione',
  OPEN_FOR_BETS: 'Scommesse Aperte',
  IN_PLAY: 'In Corso',
  VOTING_OPEN: 'Votazioni Aperte',
  ARCHIVED: 'Conclusa',
};

function resolveTeamPlayers(
  team: TeamLineup | undefined,
  playerMap: Map<string, Player>
): Player[] {
  if (!team) return [];
  const orderedIds = [
    ...(team.gk_id ? [team.gk_id] : []),
    ...team.outfield_ids,
  ];
  const uniqueIds = Array.from(new Set(orderedIds));
  return uniqueIds
    .map((id) => playerMap.get(id))
    .filter((p): p is Player => Boolean(p))
    .slice(0, 5);
}

export const MatchHomeView: React.FC<{
  onOpenLogin?: () => void;
}> = ({ onOpenLogin }) => {
  const {
    match,
    players,
    currentUser,
    currentPlayer,
    isLoggedIn,
    config,
    placeBet,
    loginWithGoogle,
  } = useApp();

  const [selectedPick, setSelectedPick] = useState<BetPick>('1');
  const [betAmount, setBetAmount] = useState<number>(25);
  const [isVotingModalOpen, setIsVotingModalOpen] = useState(false);
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);
  const [isBalancingInfoOpen, setIsBalancingInfoOpen] = useState(false);

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const team1Players = useMemo(
    () => resolveTeamPlayers(match?.team_1, playerMap),
    [match?.team_1, playerMap]
  );

  const team2Players = useMemo(
    () => resolveTeamPlayers(match?.team_2, playerMap),
    [match?.team_2, playerMap]
  );

  const userExistingBet = currentPlayer && match
    ? match.bets[currentPlayer.id]
    : undefined;

  const isConvocatoInMatch = Boolean(
    currentPlayer && match?.convocati_ids.includes(currentPlayer.id)
  );
  const hasAlreadyVoted = Boolean(
    currentPlayer &&
      match?.voting_tracker.voters_completed_ids.includes(currentPlayer.id)
  );

  // 1X2 distribution
  const betDistribution = useMemo(() => {
    if (!match) {
      return { count1: 0, countX: 0, count2: 0, pct1: 33, pctX: 34, pct2: 33, totalBets: 0 };
    }
    const entries = Object.values(match.bets);
    const totalBets = entries.length;
    if (totalBets === 0) {
      return { count1: 0, countX: 0, count2: 0, pct1: 33, pctX: 34, pct2: 33, totalBets: 0 };
    }
    const c1 = entries.filter((b) => b.pick === '1').length;
    const cX = entries.filter((b) => b.pick === 'X').length;
    const c2 = entries.filter((b) => b.pick === '2').length;
    return {
      count1: c1,
      countX: cX,
      count2: c2,
      pct1: Math.round((c1 / totalBets) * 100),
      pctX: Math.round((cX / totalBets) * 100),
      pct2: Math.round((c2 / totalBets) * 100),
      totalBets,
    };
  }, [match?.bets]);

  const maxAllowedBet = useMemo(() => {
    const balance = currentPlayer?.stats.tokens ?? 0;
    if (config.max_bet_amount) {
      return Math.min(balance, config.max_bet_amount);
    }
    return balance;
  }, [currentPlayer, config.max_bet_amount]);

  const effectiveBetAmount = Math.min(
    Math.max(1, betAmount),
    Math.max(1, maxAllowedBet)
  );
  const potentialPayout = match
    ? Math.round(effectiveBetAmount * match.odds[selectedPick])
    : 0;

  const statusLabel = match
    ? STATUS_LABELS[match.status] ?? 'Scommesse Aperte'
    : 'In Organizzazione';

  const triggerLogin = () => {
    if (onOpenLogin) {
      onOpenLogin();
    } else {
      loginWithGoogle();
    }
  };

  return (
    <div className="space-y-6">
      {/* Compact Voting Banner if voting window is open */}
      {match && match.status === 'VOTING_OPEN' && isConvocatoInMatch && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Vote className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {hasAlreadyVoted
                  ? 'Votazione completata!'
                  : 'Vota i compagni di squadra e riscatta i tuoi Token'}
              </div>
              <div className="text-xs text-slate-400">
                {hasAlreadyVoted
                  ? `+${config.attendance_reward_tokens} Token Presenza accreditati sul tuo wallet.`
                  : `5 valutazioni veloci per ricevere +${config.attendance_reward_tokens} Token Presenza.`}
              </div>
            </div>
          </div>
          {!hasAlreadyVoted ? (
            <button
              type="button"
              onClick={() => setIsVotingModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              Vota Ora (+{config.attendance_reward_tokens} Token)
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" /> Riscatto eseguito
            </div>
          )}
        </div>
      )}

      {/* Main Pitch & Bets Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Pitch Column: First visual element */}
        <div className="lg:col-span-7 space-y-3">
          {/* Pitch Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                {match ? match.date_label : 'Prossima Partita'}
              </span>
              <span className="text-slate-600">·</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBalancingInfoOpen(true)}
                className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-[11px] font-medium text-slate-300 hover:text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Come funziona il meccanismo di bilanciamento delle squadre"
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Come Funziona l&apos;Equilibrio</span>
              </button>
              {match && match.score.team_1 !== null && match.score.team_2 !== null && (
                <div className="text-sm font-display font-bold text-white font-mono-tabular">
                  Risultato: {match.score.team_1} - {match.score.team_2}
                </div>
              )}
            </div>
          </div>

          {/* 5vs5 Futsal Field with Goals & Symmetrical Pentagon Formations */}
          <div className="relative rounded-3xl bg-gradient-to-b from-emerald-950/90 via-emerald-900/55 to-emerald-950/90 border border-emerald-500/25 overflow-hidden shadow-xl min-h-[640px] sm:min-h-[680px] flex flex-col">
            {/* Outer Pitch Boundary */}
            <div className="pointer-events-none absolute inset-3 border-2 border-emerald-300/25 rounded-2xl" />

            {/* Top Goal & Penalty Box (Squadra Gabry) */}
            <div className="pointer-events-none absolute top-0.5 left-1/2 -translate-x-1/2 w-28 sm:w-32 h-3 bg-emerald-950/95 border-x-2 border-t-2 border-white/80 rounded-t-md shadow-inner overflow-hidden z-10">
              <div
                className="w-full h-full opacity-40"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, rgba(255,255,255,0.65) 1px, transparent 1px)',
                  backgroundSize: '4px 4px',
                }}
              />
            </div>
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 w-48 sm:w-56 h-16 border-x border-b border-emerald-300/25 rounded-b-2xl" />

            {/* Midfield Line & Circle */}
            <div className="pointer-events-none absolute left-3 right-3 top-1/2 h-px bg-emerald-300/30" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-emerald-300/25" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-300/50" />

            {/* Bottom Goal & Penalty Box (Squadra Piero) */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 w-48 sm:w-56 h-16 border-x border-t border-emerald-300/25 rounded-t-2xl" />
            <div className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 w-28 sm:w-32 h-3 bg-emerald-950/95 border-x-2 border-b-2 border-white/80 rounded-b-md shadow-inner overflow-hidden z-10">
              <div
                className="w-full h-full opacity-40"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, rgba(255,255,255,0.65) 1px, transparent 1px)',
                  backgroundSize: '4px 4px',
                }}
              />
            </div>

            {!match ? (
              /* Pitch Empty State when no match is active */
              <div className="relative z-10 my-auto py-16 flex flex-col items-center justify-center text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                  <Calendar className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-display font-bold text-white">
                  Nessuna partita in programma
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 max-w-sm leading-relaxed">
                  La prossima formazione è in fase di organizzazione. Non appena Il Direttore pubblicherà la partita, potrai vedere le squadre e puntare i tuoi token.
                </p>
              </div>
            ) : (
              <div className="relative z-10 flex-1 grid grid-rows-2">
                {/* =========================================================
                    TOP HALF — SQUADRA GABRY (Pentagon 1-2-2 facing down)
                   ========================================================= */}
                <div className="relative flex flex-col justify-between pt-9 pb-5 sm:pt-10 sm:pb-6 px-4 sm:px-8">
                  {/* Corner Team Label & Score (Fixed so it does not shift rows) */}
                  <div className="pointer-events-none absolute top-4 left-5 right-5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 bg-slate-950/55 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/15">
                      <span className="w-2 h-2 rounded-full bg-white shadow" />
                      <span className="text-[11px] font-bold text-white tracking-wider uppercase">
                        Squadra Gabry
                      </span>
                    </div>
                    {match.score.team_1 !== null && (
                      <span className="text-lg font-display font-extrabold text-white bg-slate-950/60 px-2.5 py-0.5 rounded-lg border border-white/15">
                        {match.score.team_1}
                      </span>
                    )}
                  </div>

                  {/* Row 1 (Pentagon Top Vertex): Player 1 */}
                  <div className="relative z-10 flex items-center justify-center">
                    {team1Players[0] && (
                      <PitchPlayerToken
                        player={team1Players[0]}
                        teamVariant="light"
                        onSelect={setInspectedPlayer}
                      />
                    )}
                  </div>

                  {/* Row 2 (Pentagon Wide Pair): Players 2 & 3 */}
                  <div className="relative z-10 flex items-center justify-between w-full max-w-[500px] mx-auto">
                    {team1Players.slice(1, 3).map((p) => (
                      <PitchPlayerToken
                        key={p.id}
                        player={p}
                        teamVariant="light"
                        onSelect={setInspectedPlayer}
                      />
                    ))}
                  </div>

                  {/* Row 3 (Pentagon Inner Pair): Players 4 & 5 */}
                  <div className="relative z-10 flex items-center justify-center gap-3 sm:gap-10 w-full max-w-[380px] mx-auto">
                    {team1Players.slice(3, 5).map((p) => (
                      <PitchPlayerToken
                        key={p.id}
                        player={p}
                        teamVariant="light"
                        onSelect={setInspectedPlayer}
                      />
                    ))}
                  </div>
                </div>

                {/* =========================================================
                    BOTTOM HALF — SQUADRA PIERO (Pentagon 2-2-1 facing up)
                   ========================================================= */}
                <div className="relative flex flex-col justify-between pt-5 pb-9 sm:pt-6 sm:pb-10 px-4 sm:px-8">
                  {/* Row 1 (Pentagon Inner Pair): Players 4 & 5 */}
                  <div className="relative z-10 flex items-center justify-center gap-3 sm:gap-10 w-full max-w-[380px] mx-auto">
                    {team2Players.slice(3, 5).map((p) => (
                      <PitchPlayerToken
                        key={p.id}
                        player={p}
                        teamVariant="dark"
                        onSelect={setInspectedPlayer}
                      />
                    ))}
                  </div>

                  {/* Row 2 (Pentagon Wide Pair): Players 2 & 3 */}
                  <div className="relative z-10 flex items-center justify-between w-full max-w-[500px] mx-auto">
                    {team2Players.slice(1, 3).map((p) => (
                      <PitchPlayerToken
                        key={p.id}
                        player={p}
                        teamVariant="dark"
                        onSelect={setInspectedPlayer}
                      />
                    ))}
                  </div>

                  {/* Row 3 (Pentagon Bottom Vertex): Player 1 */}
                  <div className="relative z-10 flex items-center justify-center">
                    {team2Players[0] && (
                      <PitchPlayerToken
                        player={team2Players[0]}
                        teamVariant="dark"
                        onSelect={setInspectedPlayer}
                      />
                    )}
                  </div>

                  {/* Corner Team Label & Score (Fixed so it does not shift rows) */}
                  <div className="pointer-events-none absolute bottom-4 left-5 right-5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 bg-slate-950/65 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-sky-400/25">
                      <span className="w-2 h-2 rounded-full bg-sky-400 shadow" />
                      <span className="text-[11px] font-bold text-white tracking-wider uppercase">
                        Squadra Piero
                      </span>
                    </div>
                    {match.score.team_2 !== null && (
                      <span className="text-lg font-display font-extrabold text-sky-400 bg-slate-950/65 px-2.5 py-0.5 rounded-lg border border-sky-400/25">
                        {match.score.team_2}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Info Banner for Balancing Engine */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  Squadre Generate con Motore Matematico Gerarchico
                </div>
                <div className="text-[11px] text-slate-400">
                  Ottimizzazione combinatoria su ruoli, parità di forza e moltiplicatore portieri.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsBalancingInfoOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Info Motore
            </button>
          </div>
        </div>

        {/* Bets Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Scommesse 1X2</h3>
              </div>
              {isLoggedIn && currentPlayer && (
                <span className="text-xs font-mono-tabular text-slate-300">
                  Saldo: <strong className="text-amber-400">{currentPlayer.stats.tokens}</strong> Token
                </span>
              )}
            </div>

            {!match ? (
              <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="text-sm font-semibold text-white">
                  Scommesse al momento chiuse
                </div>
                <div className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                  Le quote 1X2 apriranno non appena Il Direttore pubblicherà la formazione della prossima partita.
                </div>
              </div>
            ) : (
              <>
                {/* 1X2 Odds Selector */}
                <div className="mt-4">
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { pick: '1' as BetPick, label: '1 · Gabry', odds: match.odds['1'] },
                        { pick: 'X' as BetPick, label: 'X · Pari', odds: match.odds['X'] },
                        { pick: '2' as BetPick, label: '2 · Piero', odds: match.odds['2'] },
                      ] as const
                    ).map((opt) => {
                      const isSelected =
                        (userExistingBet?.pick ?? selectedPick) === opt.pick;
                      return (
                        <button
                          key={opt.pick}
                          type="button"
                          disabled={
                            Boolean(userExistingBet) ||
                            match.status !== 'OPEN_FOR_BETS' ||
                            !isLoggedIn
                          }
                          onClick={() => setSelectedPick(opt.pick)}
                          className={`min-h-[58px] rounded-2xl border p-2.5 flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-sm'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          } ${
                            userExistingBet || match.status !== 'OPEN_FOR_BETS' || !isLoggedIn
                              ? 'opacity-85'
                              : 'cursor-pointer'
                          }`}
                        >
                          <span className="text-[11px] font-medium text-slate-300">
                            {opt.label}
                          </span>
                          <span className="text-lg font-display font-extrabold text-amber-300 font-mono-tabular mt-0.5">
                            {opt.odds.toFixed(2)}x
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Auth Gate & Betting Action */}
                <div className="mt-5">
                  {!isLoggedIn ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center space-y-3">
                      <div className="text-xs text-slate-400">
                        Accedi con il tuo account per puntare i tuoi Token sulla partita.
                      </div>
                      <button
                        type="button"
                        onClick={triggerLogin}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        Accedi per Scommettere
                      </button>
                    </div>
                  ) : currentUser?.auth_status !== 'VALIDATED' || !currentPlayer ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
                      <div className="font-semibold text-amber-400">
                        Profilo in attesa di validazione
                      </div>
                      <p>
                        Per scommettere, associa il tuo profilo giocatore nella scheda <strong>Profilo</strong>.
                      </p>
                    </div>
                  ) : userExistingBet ? (
                    <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Scommessa Piazzata
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          {userExistingBet.status ?? 'Registrata'}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <div className="text-[11px] text-slate-400">Pronostico</div>
                          <div className="text-base font-display font-bold text-white">
                            Segno {userExistingBet.pick} ({match.odds[userExistingBet.pick].toFixed(2)}x)
                          </div>
                        </div>
                        <div className="text-right font-mono-tabular">
                          <div className="text-[11px] text-slate-400">Puntata: {userExistingBet.amount} Token</div>
                          <div className="text-base font-bold text-amber-300">
                            Vincita: +{userExistingBet.potential_payout} Token
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : match.status !== 'OPEN_FOR_BETS' ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Scommesse chiuse per questo incontro.</span>
                    </div>
                  ) : currentPlayer.stats.tokens <= 0 ? (
                    <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-300 space-y-1">
                      <div className="font-semibold text-rose-400">Saldo Token Esaurito</div>
                      <p className="text-slate-400">
                        Nessun bailout: gioca in campo nella prossima partita e completa le votazioni per ricevere nuovi Token.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-300">Puntata:</span>
                          <span className="font-mono-tabular font-bold text-amber-300 text-sm">
                            {effectiveBetAmount} Token
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={maxAllowedBet}
                          value={effectiveBetAmount}
                          onChange={(e) => setBetAmount(Number(e.target.value))}
                          className="w-full accent-emerald-400 cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono-tabular mt-1">
                          <span>1</span>
                          <div className="flex gap-2">
                            {[10, 25, 50, maxAllowedBet].map((preset, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setBetAmount(Math.min(preset, maxAllowedBet))}
                                className="text-slate-400 hover:text-white underline cursor-pointer"
                              >
                                {preset === maxAllowedBet ? 'MAX' : preset}
                              </button>
                            ))}
                          </div>
                          <span>{maxAllowedBet}</span>
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Vincita potenziale:</span>
                        <span className="font-mono-tabular text-sm font-bold text-emerald-400">
                          +{potentialPayout} Token
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => placeBet(selectedPick, effectiveBetAmount)}
                        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        Piazza Scommessa ({effectiveBetAmount} Token)
                      </button>
                    </div>
                  )}
                </div>

                {/* Clean Minimal Bet Distribution */}
                <div className="mt-5 pt-4 border-t border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-2">
                    Pronostici community ({betDistribution.totalBets} scommesse):
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono-tabular">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2">
                      <div className="text-[10px] text-slate-400">1 · Gabry</div>
                      <div className="font-bold text-white mt-0.5">{betDistribution.pct1}%</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2">
                      <div className="text-[10px] text-slate-400">X · Pari</div>
                      <div className="font-bold text-amber-300 mt-0.5">{betDistribution.pctX}%</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-2">
                      <div className="text-[10px] text-slate-400">2 · Piero</div>
                      <div className="font-bold text-sky-400 mt-0.5">{betDistribution.pct2}%</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <VotingModal
        isOpen={isVotingModalOpen}
        onClose={() => setIsVotingModalOpen(false)}
      />
      <FutCardDetailModal
        player={inspectedPlayer}
        onClose={() => setInspectedPlayer(null)}
      />
      <BalancingInfoModal
        isOpen={isBalancingInfoOpen}
        onClose={() => setIsBalancingInfoOpen(false)}
      />
    </div>
  );
};

const PitchPlayerToken: React.FC<{
  player: Player;
  teamVariant: 'light' | 'dark';
  onSelect: (p: Player) => void;
}> = ({ player, teamVariant, onSelect }) => {
  const ovr = getPlayerFutOverall(player);
  const isLight = teamVariant === 'light';
  const roleBadge = player.wants_to_be_gk ? 'POR' : player.computed.role_label;

  return (
    <button
      type="button"
      onClick={() => onSelect(player)}
      className={`w-[134px] sm:w-[162px] h-[52px] shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl border text-left transition-transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-between gap-2 shadow-md ${
        isLight
          ? 'bg-white/95 border-slate-200 text-slate-950'
          : 'bg-slate-950/90 border-sky-400/40 text-white'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {player.avatar_url && (
          <img
            src={player.avatar_url}
            alt={player.name}
            className="w-7 h-7 rounded-full object-cover border border-emerald-500/40 shrink-0"
          />
        )}
        <div className="min-w-0">
          <div className="font-display font-bold text-xs sm:text-sm truncate leading-tight">
            {player.name}
          </div>
          <div
            className={`text-[10px] font-mono-tabular ${
              isLight ? 'text-slate-600' : 'text-sky-300'
            }`}
          >
            {roleBadge}
          </div>
        </div>
      </div>
      <div
        className={`font-display font-extrabold text-base sm:text-lg tabular-nums shrink-0 ${
          isLight ? 'text-emerald-700' : 'text-amber-300'
        }`}
      >
        {ovr}
      </div>
    </button>
  );
};
