import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Shield,
  Flame,
  Scale,
  BrainCircuit,
  Award,
  ChevronRight,
  TrendingUp,
  Sliders,
  CheckCircle2,
  HelpCircle,
  Users,
} from 'lucide-react';

export interface BalancingInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'INTUITIVE' | 'STAGES' | 'POLAR' | 'FORMULAS';
}

type InfoTab = 'INTUITIVE' | 'STAGES' | 'POLAR' | 'FORMULAS';

export const BalancingInfoModal: React.FC<BalancingInfoModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'INTUITIVE',
}) => {
  const [activeTab, setActiveTab] = useState<InfoTab>(initialTab);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="balancing-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="balancing-modal-title"
                className="text-lg sm:text-xl font-display font-bold text-white tracking-tight"
              >
                Come Funziona l'Equilibrio delle Squadre
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Il motore matematico gerarchico a 4 stadi di <span className="text-emerald-400 font-medium">Ce La Giochiamo!</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi guida"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 sm:px-6 gap-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'INTUITIVE', label: '1. In Parole Semplici', icon: Users },
            { id: 'STAGES', label: '2. I 4 Stadi del Motore', icon: Scale },
            { id: 'POLAR', label: '3. Poli Attacco vs Difesa', icon: Flame },
            { id: 'FORMULAS', label: '4. Formule Matematiche', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as InfoTab)}
                className={`py-3 px-3 sm:px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-emerald-400 text-emerald-400 font-bold bg-emerald-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-sm leading-relaxed">
          {/* TAB 1: INTUITIVE OVERVIEW */}
          {activeTab === 'INTUITIVE' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-base mb-1">
                  <Sparkles className="w-5 h-5" />
                  Basta litigi sul "squadre sbilanciate!"
                </div>
                <p className="text-slate-300 text-xs sm:text-sm">
                  Nel calcetto amatoriale tra amici, fare le formazioni a caso o a simpatia porta quasi sempre a partite senza storia (12 a 2) e malumori.
                  Il nostro algoritmo risolve questo problema alla radice con un approccio matematico oggettivo, tenendo conto sia della forza complessiva che del ruolo tattico di ogni giocatore.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                    01
                  </div>
                  <h4 className="font-bold text-white text-sm">I Portieri prima di tutto</h4>
                  <p className="text-xs text-slate-400">
                    Se ci sono due portieri di ruolo, il sistema ne assegna obbligatoriamente uno alla Squadra Chiara e uno alla Squadra Scura. Se ce n'è uno solo, l'algoritmo compensa la squadra rimasta senza portiere assegnandole giocatori di movimento più forti!
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    02
                  </div>
                  <h4 className="font-bold text-white text-sm">Non solo forza, ma Ruoli Reali</h4>
                  <p className="text-xs text-slate-400">
                    Avere 5 attaccanti contro 5 difensori non è una vera partita. Il motore calcola la propensione offensiva e difensiva di ognuno e assegna a ciascuno uno stato chiaro: <strong>Attaccante</strong>, <strong>Difensore</strong> o <strong>Tuttocampista</strong>, garantendo reparti bilanciati.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                    03
                  </div>
                  <h4 className="font-bold text-white text-sm">Niente "1 fenomeno + 4 scarsi contro 5 medi"</h4>
                  <p className="text-xs text-slate-400">
                    Due squadre possono avere la stessa media matematica pur essendo totalmente sbilanciate nella sostanza. L'algoritmo calcola la <em>varianza interna</em>, evitando che tutti i fuoriclasse finiscano da una parte o che una squadra sia costretta a giocare con un solo trascinatore.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
                    04
                  </div>
                  <h4 className="font-bold text-white text-sm">Voti Anonimi ed Evoluzione Continua</h4>
                  <p className="text-xs text-slate-400">
                    A fine match ogni partecipante vota anonimamente i compagni. Nessun voto può stravolgere la card in un solo colpo: una media mobile esponenziale (EMA) aggiorna gradualmente le statistiche di partita in partita, rispecchiando la reale crescita dei giocatori.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THE 4 STAGES */}
          {activeTab === 'STAGES' && (
            <div className="space-y-5">
              {/* Stadio I */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs tracking-wider uppercase font-mono">
                      Stadio I
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      Gestione Portieri & Classificazione nei 3 Ruoli
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-slate-300">
                  Tra i 10 convocati, l'algoritmo individua chi desidera giocare in porta (<span className="font-mono text-emerald-400">b_GK = 1</span>) e li ordina per abilità specifica.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <strong className="text-white block mb-1">Riconversione Portieri:</strong>
                    I primi 2 portieri difendono i pali (1 per squadra). Gli eventuali portieri candidati in esubero (3 o più) vengono riconvertiti in giocatori di movimento e classificati con il loro valore di campo.
                  </div>
                  <div>
                    <strong className="text-white block mb-1">Poli e Soglia di Ruolo:</strong>
                    Si calcolano l'Affinità Offensiva (<span className="font-mono text-emerald-400">S_A</span>) e Difensiva (<span className="font-mono text-cyan-400">S_D</span>). Se lo scarto relativo normalizzato supera la soglia <span className="font-mono text-white">|τ| = 0.20</span>, il giocatore diventa <strong>Attaccante</strong> o <strong>Difensore</strong>; altrimenti è un prezioso <strong>Tuttocampista</strong>.
                  </div>
                </div>
              </div>

              {/* Stadio II */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs tracking-wider uppercase font-mono">
                      Stadio II
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      Ottimizzazione Macro-Strutturale dei Ruoli
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-slate-300">
                  Prima di decidere i singoli nomi, il motore stabilisce la distribuzione tattica ottimale tra le due formazioni valutando tutte le combinazioni di ruoli ammissibili (<span className="font-mono text-amber-400">D_K</span>). Produce due soluzioni distinte:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-3">
                    <span className="text-emerald-400 font-bold block mb-1">Proposta A — Simmetria di Ruolo</span>
                    Privilegia moduli identici e speculari tra le due squadre (stesso numero di punte e difensori), minimizzando la distanza euclidea tra i reparti.
                  </div>
                  <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3">
                    <span className="text-amber-400 font-bold block mb-1">Proposta B — Compensazione Tattica</span>
                    Se il numero di attaccanti o difensori è dispari, assegna più tuttocampisti alla squadra con meno punte, pareggiando la spinta offensiva complessiva.
                  </div>
                </div>
              </div>

              {/* Stadio III */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold text-xs tracking-wider uppercase font-mono">
                      Stadio III
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      Ottimizzazione Micro-Allocativa di Forza (Combinatoria Esatta)
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-slate-300">
                  Fissati i ruoli, l'algoritmo esplora in millisecondi <strong>tutte</strong> le possibili assegnazioni di giocatori (fino a 70 o 252 combinazioni) e trova il minimo assoluto della funzione di costo:
                </p>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs font-mono text-center text-cyan-300">
                  L_forza = α1·Φ_tot + α2·Φ_attr + α3·Φ_δ + α4·Φ_var
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
                  <div>• <strong className="text-slate-200">Φ_tot (Priorità 1):</strong> Pareggio della potenza totale, comprensiva del moltiplicatore portiere <span className="font-mono text-emerald-400">λ_GK</span>.</div>
                  <div>• <strong className="text-slate-200">Φ_attr (Priorità 2):</strong> Pareggio vettoriale su ciascuno dei 5 attributi (Tiro, Velocità, Passaggio, Resistenza, Difesa).</div>
                  <div>• <strong className="text-slate-200">Φ_δ (Priorità 3):</strong> Allineamento del baricentro continuo tra le due squadre.</div>
                  <div>• <strong className="text-slate-200">Φ_var (Priorità 4):</strong> Distribuzione bilanciata dei giocatori di punta contro la disparità interna.</div>
                </div>
              </div>

              {/* Stadio IV */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-400 font-bold text-xs tracking-wider uppercase font-mono">
                      Stadio IV
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      Quote 1X2 Dinamiche & Votazioni Post-Match (EMA)
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-slate-300">
                  La partita prende vita sul campo e nell'applicazione:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <strong className="text-purple-400 block mb-1">Quote Scommesse Imparziali:</strong>
                    Calcolate sulla reale probabilità matematica di vittoria derivante dal differenziale di forza e dai moduli schierati.
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <strong className="text-purple-400 block mb-1">Algoritmo di Votazione Equa:</strong>
                    Sistema <em>Least-Voted First</em> che distribuisce i questionari anonimi garantendo a tutti i partecipanti lo stesso numero esatto di valutazioni ricevute.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: POLAR COEFFICIENTS DETAILS */}
          {activeTab === 'POLAR' && (
            <div className="space-y-5">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Perché i Coefficienti Polari sono DIVERSI tra Attacco e Difesa?
                </div>
                <p className="text-xs text-slate-300">
                  Nel calcio a 5, le qualità che rendono letale un attaccante non sono la semplice "fotocopia" delle qualità di un difensore.
                  Per questo motivo il motore calcola due punteggi indipendenti e asimmetrici: l'<strong>Affinità Offensiva (S_A)</strong> e l'<strong>Affinità Difensiva (S_D)</strong>.
                </p>
              </div>

              {/* Comparison Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Attacco Card */}
                <div className="bg-gradient-to-b from-amber-950/30 to-slate-950 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <h4 className="font-bold text-white text-sm">Polo Offensivo (S_A)</h4>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-amber-400">Somma Pesi = 100%</span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <strong className="text-white block">Tiro (T)</strong>
                        <span className="text-[11px] text-slate-400">Finalizzazione, conclusione, fiuto del gol</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">50%</span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <strong className="text-white block">Velocità (V)</strong>
                        <span className="text-[11px] text-slate-400">Scatto in profondità, allungo in contropiede</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">25%</span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <strong className="text-white block">Passaggio (P)</strong>
                        <span className="text-[11px] text-slate-400">Visione di gioco, triangolazioni e assist</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">15%</span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <strong className="text-white block">Resistenza (R)</strong>
                        <span className="text-[11px] text-slate-400">Pressing offensivo alto, recupero palla avanzato</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">10%</span>
                    </div>
                  </div>
                </div>

                {/* Difesa Card */}
                <div className="bg-gradient-to-b from-cyan-950/30 to-slate-950 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <h4 className="font-bold text-white text-sm">Polo Difensivo (S_D)</h4>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-cyan-400">Somma Pesi = 100%</span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <strong className="text-white block">Difesa (D)</strong>
                        <span className="text-[11px] text-slate-400">Marcatura a uomo, diagonale, intercetto e contrasto</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">50%</span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <strong className="text-white block">Resistenza (R)</strong>
                        <span className="text-[11px] text-slate-400">Corsa continua per 50 min, ripiegamento costante</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">25%</span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <strong className="text-white block">Passaggio (P)</strong>
                        <span className="text-[11px] text-slate-400">Costruzione dal basso, uscita palla al piede</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">15%</span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <strong className="text-white block">Velocità (V)</strong>
                        <span className="text-[11px] text-slate-400">Recupero in campo aperto su fughe avversarie</span>
                      </div>
                      <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">10%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Takeaway Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  La Logica dell'Inversione Atletico-Tattica:
                </div>
                <p>
                  Notate come i due attributi atletici scambiano il proprio peso: in <strong>Attacco</strong> la <span className="text-amber-400 font-semibold">Velocità pesa il 25%</span> (fondamentale per saltare l'uomo e scattare in porta) mentre la Resistenza pesa il 10%.
                  In <strong>Difesa</strong> la <span className="text-cyan-400 font-semibold">Resistenza pesa il 25%</span> (fondamentale per tenere la marcatura e rientrare dopo ogni azione avversaria) mentre la Velocità pesa il 10%. Il <strong>Passaggio (15%)</strong> è la regia comune a entrambi i reparti.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: MATHEMATICAL FORMULAS */}
          {activeTab === 'FORMULAS' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 font-mono text-xs">
                <div className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] font-sans">
                  Formula 1: Indice Relativo di Ruolo Normalizzato (δ_i)
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center text-slate-200">
                  δ_i = (S_A,i - S_D,i) / (S_A,i + S_D,i) ∈ [-1, +1]
                </div>
                <div className="text-slate-400 text-[11px] font-sans leading-relaxed">
                  Dividere per la somma dei due poli elimina la bravura assoluta (M_i), consentendo di misurare puramente la <em>vocazione tattica</em>: un fuoriclasse e un esordiente con gli stessi rapporti tra tiro e marcatura avranno lo stesso indice δ_i!
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 font-mono text-xs">
                <div className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] font-sans">
                  Formula 2: Funzione di Costo Macro-Strutturale dei Ruoli
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center text-slate-200">
                  J(x) = w1·[(p1 - n1)² + (p2 - n2)²] + w2·||x1 - x2||² - w3·H_tot
                </div>
                <div className="text-slate-400 text-[11px] font-sans leading-relaxed">
                  Dove <span className="text-white font-mono">H_tot</span> è l'entropia di Shannon dei ruoli, garantendo che le squadre non siano monotone e abbiano una corretta miscela di punte, centrocampisti e difensori.
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 font-mono text-xs">
                <div className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] font-sans">
                  Formula 3: Funzione Obiettivo di Assegnazione Giocatori
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center text-slate-200">
                  L_forza(u) = 2.0·Φ_tot(u) + 1.0·Φ_attr(u) + 0.5·Φ_δ(u) + 0.25·Φ_var(u)
                </div>
                <div className="text-slate-400 text-[11px] font-sans leading-relaxed">
                  L'algoritmo valuta in tempo reale la combinazione con il costo minimo, garantendo la convergenza matematica al miglior equilibrio possibile per la serata.
                </div>
              </div>

              {/* Parameter Table */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 overflow-x-auto">
                <div className="text-slate-300 font-bold text-xs mb-3 font-sans">
                  Costanti di Taratura del Sistema (Personalizzabili dal Direttore)
                </div>
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="py-2 pr-4 font-semibold">Parametro</th>
                      <th className="py-2 px-3 font-semibold font-mono">Default</th>
                      <th className="py-2 pl-3 font-semibold">Significato e Impatto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300 text-xs">
                    <tr>
                      <td className="py-2 pr-4 font-medium text-white">Soglia Ruolo (τ)</td>
                      <td className="py-2 px-3 font-mono text-emerald-400">0.20</td>
                      <td className="py-2 pl-3 text-slate-400">Rapporto di predominanza minimo (almeno 60% vs 40%) per definire un giocatore specializzato</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium text-white">Moltiplicatore Portiere (λ_GK)</td>
                      <td className="py-2 px-3 font-mono text-emerald-400">1.00</td>
                      <td className="py-2 pl-3 text-slate-400">Peso specifico del portiere nel bilanciamento della potenza complessiva</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium text-white">Pesi Soluzione A (Simmetria)</td>
                      <td className="py-2 px-3 font-mono text-emerald-400">(1.0, 2.0, 0.1)</td>
                      <td className="py-2 pl-3 text-slate-400">Privilegia formazioni speculari con stesso numero di attaccanti e difensori</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium text-white">Pesi Soluzione B (Compensazione)</td>
                      <td className="py-2 px-3 font-mono text-emerald-400">(3.0, 1.0, 0.1)</td>
                      <td className="py-2 pl-3 text-slate-400">Compensa le carenze di punte aumentando i tuttocampisti nella squadra</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium text-white">Tasso Apprendimento EMA (η)</td>
                      <td className="py-2 px-3 font-mono text-emerald-400">0.10</td>
                      <td className="py-2 pl-3 text-slate-400">Incidenza del 10% del nuovo voto e 90% della storia pregressa</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Algoritmo attivo: <span className="text-emerald-400 font-semibold">MIQP Hierarchical 4-Stage Balancing</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
          >
            Ho Capito
          </button>
        </div>
      </div>
    </div>
  );
};
