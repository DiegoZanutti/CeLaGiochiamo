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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Questionario Post-Partita Anonimo"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Algoritmo Least-Voted First · Anonimato Garantito
            </div>
            <h3 className="text-2xl font-display font-bold text-white mt-1">
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
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {questions.map((q, idx) => {
            const val = getScore(q.target_player_id);
            const uNorm = normalizeVoteToUnit(val);
            const eqFut = weightToFutStat(uNorm);

            return (
              <div
                key={q.target_player_id}
                className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>
                    Domanda {idx + 1} di 5 · Attributo:{' '}
                    <strong className="text-emerald-400">{q.attribute_label}</strong>
                  </span>
                  <span className="font-mono-tabular">
                    u = {uNorm.toFixed(2)} · Prestazione FUT {eqFut}
                  </span>
                </div>

                <p className="text-sm font-semibold text-white mb-3">
                  {q.question_text}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {gradeOptions.map((g) => {
                    const active = val === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleScoreChange(q.target_player_id, g)}
                        className={`min-h-[38px] px-2.5 rounded-lg font-mono-tabular text-xs font-semibold transition-colors ${
                          active
                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                            : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {g.toFixed(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm flex items-center gap-2 transition-colors"
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
