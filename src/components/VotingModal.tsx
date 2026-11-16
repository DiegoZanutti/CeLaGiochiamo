import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  generateFairQuestionnaire,
  normalizeVoteToUnit,
  weightToFutStat,
} from '../engine/mathEngine';
import { CheckCircle2, Lock, Sparkles, X } from 'lucide-react';

export const VotingModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { currentPlayer, match, players, config, submitAnonymousVotes } = useApp();

  // Generate the 5 fair questions dynamically when modal opens (Modulo 04 - 2)
  const questions = useMemo(() => {
    if (!isOpen || !currentPlayer || !match) return [];
    return generateFairQuestionnaire(currentPlayer.id, match, players);
  }, [isOpen, currentPlayer, match, players]);

  const [scores, setScores] = useState<Record<string, number>>({});

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  if (!isOpen || !currentPlayer || !match) return null;

  const getScore = (playerId: string) => scores[playerId] ?? 7.0;

  const handleScoreChange = (playerId: string, val: number) => {
    setScores((prev) => ({ ...prev, [playerId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = questions.map((q) => ({
      targetPlayerId: q.target_player_id,
      attribute: q.attribute,
      score: getScore(q.target_player_id),
    }));
    await submitAnonymousVotes(payload);
    onClose();
  };

  const gradeOptions = [
    4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
  ];

  const getGradeJudgmentLabel = (v: number): string => {
    if (v <= 4.5) return 'molto scarso';
    if (v <= 5.5) return 'scarso';
    if (v <= 8.0) return 'buono';
    if (v <= 9.0) return 'molto buono';
    return 'eccellente';
  };

  const getActiveButtonStyle = (g: number) => {
    if (g <= 4.5) {
      return 'bg-rose-600 text-white ring-2 ring-rose-300 shadow-md scale-[1.03]';
    }
    if (g <= 5.5) {
      return 'bg-orange-500 text-slate-950 ring-2 ring-orange-200 shadow-md scale-[1.03]';
    }
    if (g <= 8.0) {
      return 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-200 shadow-md scale-[1.03]';
    }
    if (g <= 9.0) {
      return 'bg-teal-400 text-slate-950 ring-2 ring-teal-100 shadow-md scale-[1.03]';
    }
    return 'bg-sky-500 text-white ring-2 ring-sky-200 shadow-md scale-[1.03]';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Questionario Post-Partita Anonimo"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-5 sm:p-6 max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Algoritmo Least-Voted First · Anonimato Garantito
            </div>
            <h3 className="text-xl sm:text-2xl font-display font-bold text-white mt-1">
              Valuta 5 Compagni e Riscatta +{config.attendance_reward_tokens} Token Presenza
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              I tuoi 5 voti (da 4.0 a 10.0) vengono sommati direttamente negli accumulatori anonimi del match e aggiorneranno le Carte FUT tramite Media Mobile Esponenziale (η = {config.ema_learning_rate_eta}).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi questionario"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {questions.map((q, idx) => {
            const val = getScore(q.target_player_id);
            const uNorm = normalizeVoteToUnit(val);
            const eqFut = weightToFutStat(uNorm);
            const targetPlayer = playerMap.get(q.target_player_id);
            const initials = (targetPlayer?.name || q.target_player_name || 'G')
              .trim()
              .split(' ')
              .map((s) => s[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            const currentJudgment = getGradeJudgmentLabel(val);

            return (
              <div
                key={q.target_player_id}
                className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Domanda {idx + 1} di 5 · Attributo:{' '}
                    <strong className="text-emerald-400">{q.attribute_label}</strong>
                  </span>
                  <span className="font-mono-tabular">
                    Voto <strong className="text-white">{val.toFixed(1)}</strong> ({currentJudgment}) · FUT {eqFut}
                  </span>
                </div>

                {/* Question Header with Player Photo */}
                <div className="flex items-center gap-3.5 bg-slate-900/70 border border-slate-800/80 rounded-xl p-2.5">
                  {targetPlayer?.avatar_url ? (
                    <img
                      src={targetPlayer.avatar_url}
                      alt={q.target_player_name}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border-2 border-emerald-400/60 shrink-0 shadow"
                    />
                  ) : (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-950 border border-emerald-500/30 text-emerald-400 font-display font-extrabold text-base flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        {q.target_player_name}
                      </span>
                      {targetPlayer?.nickname && (
                        <span className="text-[11px] text-slate-400 italic truncate">
                          «{targetPlayer.nickname}»
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white mt-0.5 leading-snug">
                      {q.question_text}
                    </p>
                  </div>
                </div>

                {/* Single-Row 13 Grades + Elementary School Italic Judgment Bar */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-13 gap-1 w-full">
                    {gradeOptions.map((g) => {
                      const active = val === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => handleScoreChange(q.target_player_id, g)}
                          className={`h-9 sm:h-10 px-0.5 rounded-lg font-mono-tabular text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center whitespace-nowrap cursor-pointer ${
                            active
                              ? getActiveButtonStyle(g)
                              : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {Number.isInteger(g) ? g : g.toFixed(1)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Graphic Judgment Index Bar aligned to the 13 columns (2 + 2 + 5 + 2 + 2 = 13) */}
                  <div className="grid grid-cols-13 rounded-xl overflow-hidden border border-slate-700/70 text-[10px] sm:text-xs font-serif italic tracking-wide text-center shadow-inner">
                    {/* 4.0 - 4.5 (2 cols): molto scarso */}
                    <div
                      className={`col-span-2 py-1.5 px-1 flex items-center justify-center leading-tight transition-opacity ${
                        val <= 4.5
                          ? 'bg-gradient-to-r from-red-700 to-rose-600 text-white font-bold ring-1 ring-inset ring-white/40 opacity-100'
                          : 'bg-gradient-to-r from-red-900/75 to-rose-800/75 text-rose-100/90 opacity-80'
                      }`}
                    >
                      molto scarso
                    </div>

                    {/* 5.0 - 5.5 (2 cols): scarso */}
                    <div
                      className={`col-span-2 py-1.5 px-1 flex items-center justify-center leading-tight border-l border-black/20 transition-opacity ${
                        val >= 5.0 && val <= 5.5
                          ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-slate-950 font-bold ring-1 ring-inset ring-white/40 opacity-100'
                          : 'bg-gradient-to-r from-orange-800/75 to-amber-700/75 text-amber-100/90 opacity-80'
                      }`}
                    >
                      scarso
                    </div>

                    {/* 6.0 - 8.0 (5 cols): buono */}
                    <div
                      className={`col-span-5 py-1.5 px-1 flex items-center justify-center leading-tight border-l border-black/20 transition-opacity ${
                        val >= 6.0 && val <= 8.0
                          ? 'bg-gradient-to-r from-lime-500 via-emerald-500 to-green-500 text-slate-950 font-bold ring-1 ring-inset ring-white/40 opacity-100'
                          : 'bg-gradient-to-r from-lime-800/75 via-emerald-800/75 to-green-800/75 text-emerald-100/90 opacity-80'
                      }`}
                    >
                      buono
                    </div>

                    {/* 8.5 - 9.0 (2 cols): molto buono */}
                    <div
                      className={`col-span-2 py-1.5 px-1 flex items-center justify-center leading-tight border-l border-black/20 transition-opacity ${
                        val >= 8.5 && val <= 9.0
                          ? 'bg-gradient-to-r from-teal-400 to-cyan-500 text-slate-950 font-bold ring-1 ring-inset ring-white/40 opacity-100'
                          : 'bg-gradient-to-r from-teal-800/75 to-cyan-800/75 text-cyan-100/90 opacity-80'
                      }`}
                    >
                      molto buono
                    </div>

                    {/* 9.5 - 10.0 (2 cols): eccellente */}
                    <div
                      className={`col-span-2 py-1.5 px-1 flex items-center justify-center leading-tight border-l border-black/20 transition-opacity ${
                        val >= 9.5
                          ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold ring-1 ring-inset ring-white/40 opacity-100'
                          : 'bg-gradient-to-r from-sky-800/75 to-blue-900/75 text-sky-100/90 opacity-80'
                      }`}
                    >
                      eccellente
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Invia 5 Voti Anonimi e Riscatta +{config.attendance_reward_tokens} Token
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
