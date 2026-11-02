import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  BalancingEngineResult,
  BalancingProposal,
  GlobalConfig,
  Match,
  Player,
  PlayerWeights,
} from '../types/models';
import {
  computeMatchOdds,
  futStatToWeight,
  getPlayerFutOverall,
  getPlayerNaturalFutOverall,
  weightToFutStat,
} from '../engine/mathEngine';
import { DEFAULT_GLOBAL_CONFIG, setClientDatabaseEnvironment } from '../db/testDatabase';
import { BalancingInfoModal } from './BalancingInfoModal';
import { preprocessPlayerPhoto } from '../lib/imageProcessor';
import {
  ArrowLeftRight,
  Calculator,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Edit3,
  HelpCircle,
  Info,
  MapPin,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  Trash2,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

function parseMatchDateLabel(dateLabel: string): {
  dateText: string;
  timeText: string;
  locationText: string;
} {
  const raw = (dateLabel || '').trim();
  if (!raw) {
    return {
      dateText: 'Giovedì 12 Novembre',
      timeText: '21:00',
      locationText: 'Sporting Club',
    };
  }

  let datePart = raw;
  let rest = '';

  const dashSplit = raw.split(/\s*[—–-]\s*/);
  if (dashSplit.length >= 2) {
    datePart = dashSplit[0].trim();
    rest = dashSplit.slice(1).join(' - ').trim();
  }

  let timePart = '21:00';
  let locationPart = 'Sporting Club';

  if (rest) {
    const dotSplit = rest.split(/\s*[·•|]\s*/);
    const timeCandidate = dotSplit[0]
      .replace(/^ore\s*/i, '')
      .trim();
    if (timeCandidate) {
      timePart = timeCandidate;
    }
    if (dotSplit.length >= 2) {
      locationPart = dotSplit.slice(1).join(' · ').trim() || 'Sporting Club';
    } else {
      locationPart = '';
    }
  } else {
    const dotSplit = raw.split(/\s*[·•|]\s*/);
    if (dotSplit.length >= 2) {
      datePart = dotSplit[0].trim();
      locationPart = dotSplit.slice(1).join(' · ').trim();
    }
  }

  return {
    dateText: datePart || 'Giovedì 12 Novembre',
    timeText: timePart || '21:00',
    locationText: locationPart || 'Sporting Club',
  };
}

function buildMatchDateLabel(
  dateText: string,
  timeText: string,
  locationText: string
): string {
  const d = dateText.trim() || 'Giovedì';
  const t = timeText.trim().replace(/^ore\s*/i, '');
  const l = locationText.trim();
  const timeChunk = t ? ` — Ore ${t}` : '';
  const locChunk = l ? ` · ${l}` : '';
  return `${d}${timeChunk}${locChunk}`.slice(0, 120);
}

function formatIsoDateToItalian(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return '';
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const formatted = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dateObj);
  return formatted
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

interface VariableDoc {
  label: string;
  category: string;
  explanation: string;
  recommended: string;
}

const GLOBAL_VARS_DOC: Record<string, VariableDoc> = {
  role_threshold_tau: {
    label: 'Soglia di Specializzazione Ruolo',
    category: 'Classificazione dei Ruoli',
    explanation:
      'Determina quanto un giocatore deve eccellere nel polo offensivo o difensivo rispetto al suo valore medio per essere classificato come Attaccante o Difensore anziché Tuttocampista (rapporto di predominanza tra i poli).',
    recommended: 'Valore consigliato: 0.20 (compreso tra 0.10 e 0.35)',
  },
  // Polo Offensivo (S_A)
  polar_att_tiro: {
    label: 'Polo Attacco: Peso Tiro',
    category: 'Classificazione Ruoli (Polo Offensivo)',
    explanation:
      'Importanza percentuale primaria attribuita al Tiro e alla finalizzazione (50%) nel calcolare l’Affinità Offensiva (S_A). È il fattore più determinante per una punta.',
    recommended: 'Valore consigliato: 0.50 (50%)',
  },
  polar_att_vel: {
    label: 'Polo Attacco: Peso Velocità',
    category: 'Classificazione Ruoli (Polo Offensivo)',
    explanation:
      'Importanza percentuale della Velocità e dello scatto in profondità (25%) per attaccare gli spazi e condurre contropiedi vincenti.',
    recommended: 'Valore consigliato: 0.25 (25%)',
  },
  polar_att_pas: {
    label: 'Polo Attacco: Peso Passaggio',
    category: 'Classificazione Ruoli (Polo Offensivo)',
    explanation:
      'Incidenza della precisione nelle triangolazioni, visione di gioco e assist filtranti (15%) nella fase offensiva.',
    recommended: 'Valore consigliato: 0.15 (15%)',
  },
  polar_att_res: {
    label: 'Polo Attacco: Peso Resistenza',
    category: 'Classificazione Ruoli (Polo Offensivo)',
    explanation:
      'Incidenza della corsa e del pressing offensivo alto (10%) per disturbare la prima costruzione avversaria.',
    recommended: 'Valore consigliato: 0.10 (10%)',
  },
  // Polo Difensivo (S_D)
  polar_dif_dif: {
    label: 'Polo Difesa: Peso Difesa',
    category: 'Classificazione Ruoli (Polo Difensivo)',
    explanation:
      'Importanza percentuale primaria della Difesa (50%) — marcatura, intercetto, contrasto e diagonali — nel calcolare l’Affinità Difensiva (S_D). È il fattore cardine per proteggere la porta.',
    recommended: 'Valore consigliato: 0.50 (50%)',
  },
  polar_dif_res: {
    label: 'Polo Difesa: Peso Resistenza',
    category: 'Classificazione Ruoli (Polo Difensivo)',
    explanation:
      'Importanza cruciale della tenuta atletica sui 50 minuti (25%) per ripiegare costantemente, raddoppiare e non perdere la marcatura nei momenti caldi della gara.',
    recommended: 'Valore consigliato: 0.25 (25%)',
  },
  polar_dif_pas: {
    label: 'Polo Difesa: Peso Passaggio',
    category: 'Classificazione Ruoli (Polo Difensivo)',
    explanation:
      'Incidenza della precisione nell’uscita palla al piede e prima impostazione dal basso (15%) senza regalare palla agli attaccanti avversari.',
    recommended: 'Valore consigliato: 0.15 (15%)',
  },
  polar_dif_vel: {
    label: 'Polo Difesa: Peso Velocità',
    category: 'Classificazione Ruoli (Polo Difensivo)',
    explanation:
      'Incidenza dello scatto nel recupero difensivo in campo aperto (10%) sulle fughe degli attaccanti lanciati a rete.',
    recommended: 'Valore consigliato: 0.10 (10%)',
  },
  // Fallbacks per compatibilità
  polar_a: {
    label: 'Peso Primario di Reparto (Tiro / Difesa)',
    category: 'Classificazione dei Ruoli',
    explanation:
      'Assegna il 50% al Tiro per il Polo Attacco (S_A) e il 50% alla Difesa per il Polo Difesa (S_D).',
    recommended: 'Valore consigliato: 0.50 (50%)',
  },
  polar_b: {
    label: 'Peso Atletico Dominante (Velocità / Resistenza)',
    category: 'Classificazione dei Ruoli',
    explanation:
      'Assegna il 25% alla Velocità per il Polo Attacco (scatto in profondità) e il 25% alla Resistenza per il Polo Difesa (marcatura e tenuta atletica).',
    recommended: 'Valore consigliato: 0.25 (25%)',
  },
  polar_c: {
    label: 'Peso Atletico Secondario (Resistenza / Velocità)',
    category: 'Classificazione dei Ruoli',
    explanation:
      'Assegna il 10% alla Resistenza in Attacco (pressing alto) e il 10% alla Velocità in Difesa (recupero su fughe avversarie).',
    recommended: 'Valore consigliato: 0.10 (10%)',
  },
  polar_d: {
    label: 'Peso Regia e Passaggio',
    category: 'Classificazione dei Ruoli',
    explanation:
      'Assegna il 15% al Passaggio sia nel Polo Attacco (visione di gioco) sia nel Polo Difesa (costruzione dal basso).',
    recommended: 'Valore consigliato: 0.15 (15%)',
  },
  macro_A_w1: {
    label: 'Parità Ruoli (Proposta A)',
    category: 'Bilanciamento Squadre Macro',
    explanation:
      'Priorità data alla parità numerica tra attaccanti e difensori tra le due squadre nella prima proposta.',
    recommended: 'Valore consigliato: 1.0',
  },
  macro_A_w2: {
    label: 'Uguaglianza Forza (Proposta A)',
    category: 'Bilanciamento Squadre Macro',
    explanation:
      'Priorità data all’azzeramento del divario di forza complessiva tra le due formazioni.',
    recommended: 'Valore consigliato: 2.0 (massimo equilibrio)',
  },
  macro_A_w3: {
    label: 'Omogeneità Attributi (Proposta A)',
    category: 'Bilanciamento Squadre Macro',
    explanation:
      'Priorità per mantenere simili i reparti (tiro, velocità e difesa) tra squadra chiara e scura.',
    recommended: 'Valore consigliato: 0.1',
  },
  macro_B_w1: {
    label: 'Parità Ruoli (Proposta B Alternativa)',
    category: 'Bilanciamento Squadre Macro',
    explanation:
      'Peso per la parità di ruoli nella seconda variante (impostata per privilegiare ruoli speculari perfetti).',
    recommended: 'Valore consigliato: 3.0',
  },
  macro_B_w2: {
    label: 'Uguaglianza Forza (Proposta B Alternativa)',
    category: 'Bilanciamento Squadre Macro',
    explanation:
      'Peso del pareggio di forza nella variante con parità ruoli rinforzata.',
    recommended: 'Valore consigliato: 1.0',
  },
  macro_B_w3: {
    label: 'Omogeneità Attributi (Proposta B Alternativa)',
    category: 'Bilanciamento Squadre Macro',
    explanation:
      'Priorità secondaria per la coerenza dei singoli reparti nella proposta B.',
    recommended: 'Valore consigliato: 0.1',
  },
  gk_lambda: {
    label: 'Impatto Decisivo del Portiere',
    category: 'Calcolo della Forza Complessiva',
    explanation:
      'Moltiplicatore che amplifica l’importanza del portiere rispetto a un singolo giocatore di movimento nel computo della forza della squadra (un portiere eccezionale sposta gli equilibri).',
    recommended: 'Valore consigliato: 1.5 (o compreso tra 1.2 e 2.0)',
  },
  alpha_a1: {
    label: 'Importanza Tiro',
    category: 'Calcolo della Forza Complessiva',
    explanation:
      'Incidenza della finalizzazione e conclusioni nella pericolosità complessiva di una squadra.',
    recommended: 'Valore consigliato: 2.0',
  },
  alpha_a2: {
    label: 'Importanza Passaggio e Regia',
    category: 'Calcolo della Forza Complessiva',
    explanation:
      'Incidenza della precisione di manovra e costruzione dal basso.',
    recommended: 'Valore consigliato: 1.0',
  },
  alpha_a3: {
    label: 'Importanza Difesa e Copertura',
    category: 'Calcolo della Forza Complessiva',
    explanation:
      'Incidenza della capacità di arginare le conclusioni e proteggere la porta.',
    recommended: 'Valore consigliato: 0.5',
  },
  alpha_a4: {
    label: 'Importanza Corsa e Resistenza',
    category: 'Calcolo della Forza Complessiva',
    explanation:
      'Incidenza della tenuta atletica sui 50 minuti di partita.',
    recommended: 'Valore consigliato: 0.25',
  },
  ema_eta: {
    label: 'Velocità Aggiornamento Voti',
    category: 'Evoluzione Voti ed Economia Token',
    explanation:
      'Tasso di apprendimento della media mobile esponenziale. Definisce quanto il voto ricevuto nella partita attuale incide rispetto alla storia passata del giocatore (es. 0.10 significa 10% nuovo voto e 90% storico pregresso, evitando sbalzi eccessivi).',
    recommended: 'Valore consigliato: 0.10 (compreso tra 0.05 e 0.25)',
  },
  initial_tokens: {
    label: 'Token di Benvenuto',
    category: 'Evoluzione Voti ed Economia Token',
    explanation:
      'Saldo di Token omaggio accreditato a un giocatore appena l’account Google/Apple viene convalidato dal Direttore.',
    recommended: 'Valore consigliato: 100 Token',
  },
  attendance_reward: {
    label: 'Premio Presenza e Votazione',
    category: 'Evoluzione Voti ed Economia Token',
    explanation:
      'Token extra assegnati a ogni giocatore al termine della partita dopo aver completato le votazioni anonime sui compagni.',
    recommended: 'Valore consigliato: 20 Token',
  },
  odd_1: {
    label: 'Quota Base Vittoria Squadra 1',
    category: 'Evoluzione Voti ed Economia Token',
    explanation:
      'Moltiplicatore base di vincita applicato alle puntate sulla vittoria della Squadra 1 quando le due squadre sono perfettamente alla pari.',
    recommended: 'Valore tipico: 1.85',
  },
  odd_X: {
    label: 'Quota Base Pareggio',
    category: 'Evoluzione Voti ed Economia Token',
    explanation:
      'Moltiplicatore base applicato alle puntate sul pareggio (evento storicamente meno frequente nel calcetto).',
    recommended: 'Valore tipico: 3.20',
  },
  odd_2: {
    label: 'Quota Base Vittoria Squadra 2',
    category: 'Evoluzione Voti ed Economia Token',
    explanation:
      'Moltiplicatore base di vincita applicato alle puntate sulla vittoria della Squadra 2 in condizione di parità teorica.',
    recommended: 'Valore tipico: 1.85',
  },
  dynamic_odds_sensitivity: {
    label: 'Sensibilità Quote Dinamiche',
    category: 'Evoluzione Voti ed Economia Token',
    explanation:
      'Controlla quanto il divario di forza tra le due squadre influenza le quote delle scommesse 1X2. Un valore più alto rende la squadra favorita con quota più bassa e lo sfavorito con quota più alta; un valore basso mantiene le quote vicine al valore base.',
    recommended: 'Valore consigliato: 0.50 (compreso tra 0.10 e 1.00)',
  },
};

export type AdminTab = 'MATCH_ENGINE' | 'PLAYERS_ROSTER' | 'USER_CLAIMS' | 'GLOBAL_SETTINGS';

interface EditingPlayerState {
  id: string;
  name: string;
  nickname: string;
  wants_to_be_gk: boolean;
  tokensDraft: string;
  futAttrsDraft: {
    tiro: string;
    velocita: string;
    passaggio: string;
    resistenza: string;
    difesa: string;
    portiere: string;
  };
}

export const AdminBackofficeView: React.FC<{
  onBack?: () => void;
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
}> = ({ onBack, activeTab: controlledTab, onTabChange }) => {
  const {
    dbEnvironment,
    config,
    players,
    users,
    match,
    engineResult,
    updateMatchDetails,
    updateDraftConvocati,
    selectBalancingProposal,
    swapPlayersBetweenTeams,
    publishMatchForBets,
    closeBetsAndStartMatch,
    finishMatchAndOpenVoting,
    consolidateVotesAndArchiveMatch,
    startNewWeeklyDraftMatch,
    createNewPlayer,
    updatePlayerOverride,
    updatePlayerPhoto,
    deletePlayer,
    approveAccountClaim,
    rejectAccountClaim,
    unlinkAccountClaim,
    assignPlayerToUser,
    updateGlobalSettings,
    showToast,
  } = useApp();

  const [internalTab, setInternalTab] = useState<AdminTab>('MATCH_ENGINE');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (tab: AdminTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  // Tab 1 state: Convocati selection, Date/Time/Location, Score input, Manual Swap, Proposal switcher
  const initialParsed = parseMatchDateLabel(
    match?.date_label ?? 'Giovedì 12 Novembre — Ore 21:00 · Sporting Club'
  );
  const [draftConvocati, setDraftConvocati] = useState<string[]>(
    match?.convocati_ids ?? []
  );
  const [matchDateText, setMatchDateText] = useState<string>(initialParsed.dateText);
  const [matchTimeText, setMatchTimeText] = useState<string>(initialParsed.timeText);
  const [matchLocationText, setMatchLocationText] = useState<string>(
    initialParsed.locationText
  );
  const [scoreG1Draft, setScoreG1Draft] = useState<string>('6');
  const [scoreG2Draft, setScoreG2Draft] = useState<string>('5');
  const [swapP1, setSwapP1] = useState<string>('');
  const [swapP2, setSwapP2] = useState<string>('');
  const [newMatchDateText, setNewMatchDateText] = useState<string>('Giovedì 19 Novembre');
  const [newMatchTimeText, setNewMatchTimeText] = useState<string>('21:00');
  const [newMatchLocationText, setNewMatchLocationText] = useState<string>('Sporting Club');
  const [selectedProposalTab, setSelectedProposalTab] = useState<'A' | 'B' | 'CUSTOM'>('A');

  React.useEffect(() => {
    if (match) {
      setDraftConvocati(match.convocati_ids);
      const parsed = parseMatchDateLabel(match.date_label);
      setMatchDateText(parsed.dateText);
      setMatchTimeText(parsed.timeText);
      setMatchLocationText(parsed.locationText);
      if (match.selected_solution) {
        setSelectedProposalTab(match.selected_solution);
      }
    }
  }, [match]);

  // Tab 2 state: Add New Player (FUT 40-99 with string draft for smooth typing)
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNickname, setNewPlayerNickname] = useState('');
  const [newPlayerWantsGk, setNewPlayerWantsGk] = useState(false);
  const [newPlayerFutDraft, setNewPlayerFutDraft] = useState<Record<string, string>>({
    tiro: '72',
    velocita: '74',
    passaggio: '70',
    resistenza: '72',
    difesa: '68',
    portiere: '50',
  });

  // Editing player state
  const [editingPlayer, setEditingPlayer] = useState<EditingPlayerState | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [userLinkDrafts, setUserLinkDrafts] = useState<Record<string, string>>({});

  // Tab 4 state: Global Settings form & active info popover
  const [cfgDraft, setCfgDraft] = useState<GlobalConfig>(config);
  const [activeVariableInfoKey, setActiveVariableInfoKey] = useState<string | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [infoModalTab, setInfoModalTab] = useState<'INTUITIVE' | 'STAGES' | 'POLAR' | 'FORMULAS'>('INTUITIVE');

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const pendingUsers = useMemo(
    () => users.filter((u) => u.auth_status === 'PENDING_APPROVAL'),
    [users]
  );

  const toggleDraftConvocato = (id: string) => {
    setDraftConvocati((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
  };

  const handleApplyDraftConvocati = async () => {
    const composedLabel = buildMatchDateLabel(
      matchDateText,
      matchTimeText,
      matchLocationText
    );
    await updateDraftConvocati(draftConvocati, composedLabel);
  };

  const handleSaveMatchDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const composedLabel = buildMatchDateLabel(
      matchDateText,
      matchTimeText,
      matchLocationText
    );
    await updateMatchDetails(composedLabel);
  };

  const handleSwapSubmit = async () => {
    if (!swapP1 || !swapP2) return;
    await swapPlayersBetweenTeams(swapP1, swapP2);
    setSwapP1('');
    setSwapP2('');
  };

  const parseDraftStat = (val: string, fallback = 70): number => {
    const n = parseInt(val, 10);
    if (isNaN(n)) return fallback;
    return Math.min(99, Math.max(40, n));
  };

  const handleAddNewPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    const weights: PlayerWeights = {
      tiro: futStatToWeight(parseDraftStat(newPlayerFutDraft.tiro, 72)),
      velocita: futStatToWeight(parseDraftStat(newPlayerFutDraft.velocita, 74)),
      passaggio: futStatToWeight(parseDraftStat(newPlayerFutDraft.passaggio, 70)),
      resistenza: futStatToWeight(parseDraftStat(newPlayerFutDraft.resistenza, 72)),
      difesa: futStatToWeight(parseDraftStat(newPlayerFutDraft.difesa, 68)),
      portiere: futStatToWeight(parseDraftStat(newPlayerFutDraft.portiere, 50)),
    };

    await createNewPlayer({
      name: newPlayerName.trim(),
      nickname: newPlayerNickname.trim() || undefined,
      weights,
      wantsToBeGk: newPlayerWantsGk,
    });

    setNewPlayerName('');
    setNewPlayerNickname('');
    setNewPlayerFutDraft({
      tiro: '72',
      velocita: '74',
      passaggio: '70',
      resistenza: '72',
      difesa: '68',
      portiere: '50',
    });
    setNewPlayerWantsGk(false);
  };

  const startEditingPlayer = (p: Player) => {
    setDeleteConfirmId(null);
    const baseInitial = p.initial_weights ?? p.weights;
    setEditingPlayer({
      id: p.id,
      name: p.name,
      nickname: p.nickname || '',
      wants_to_be_gk: p.wants_to_be_gk,
      tokensDraft: String(p.stats.tokens),
      futAttrsDraft: {
        tiro: String(weightToFutStat(baseInitial.tiro)),
        velocita: String(weightToFutStat(baseInitial.velocita)),
        passaggio: String(weightToFutStat(baseInitial.passaggio)),
        resistenza: String(weightToFutStat(baseInitial.resistenza)),
        difesa: String(weightToFutStat(baseInitial.difesa)),
        portiere: String(weightToFutStat(baseInitial.portiere)),
      },
    });
  };

  const saveEditingPlayer = async () => {
    if (!editingPlayer) return;
    const original = players.find((p) => p.id === editingPlayer.id);
    if (!original) return;

    const newInitialWeights: PlayerWeights = {
      tiro: futStatToWeight(parseDraftStat(editingPlayer.futAttrsDraft.tiro, 70)),
      velocita: futStatToWeight(parseDraftStat(editingPlayer.futAttrsDraft.velocita, 70)),
      passaggio: futStatToWeight(parseDraftStat(editingPlayer.futAttrsDraft.passaggio, 70)),
      resistenza: futStatToWeight(parseDraftStat(editingPlayer.futAttrsDraft.resistenza, 70)),
      difesa: futStatToWeight(parseDraftStat(editingPlayer.futAttrsDraft.difesa, 70)),
      portiere: futStatToWeight(parseDraftStat(editingPlayer.futAttrsDraft.portiere, 50)),
    };

    const tokensParsed = parseInt(editingPlayer.tokensDraft, 10);
    const tokensFinal = isNaN(tokensParsed) || tokensParsed < 0 ? 0 : tokensParsed;

    const updated: Player = {
      ...original,
      name: editingPlayer.name.trim() || original.name,
      nickname: editingPlayer.nickname.trim() || undefined,
      wants_to_be_gk: editingPlayer.wants_to_be_gk,
      initial_weights: newInitialWeights,
      weights: newInitialWeights,
      manual_override: false,
      stats: {
        ...original.stats,
        tokens: tokensFinal,
      },
    };

    await updatePlayerOverride(updated);
    setEditingPlayer(null);
  };

  const handleDeletePlayer = async (id: string) => {
    await deletePlayer(id);
    setDeleteConfirmId(null);
    if (editingPlayer?.id === id) {
      setEditingPlayer(null);
    }
  };

  const handleAdminPhotoUpload = async (playerId: string, file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await preprocessPlayerPhoto(file);
      await updatePlayerPhoto(playerId, dataUrl);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Errore durante il caricamento della foto.'
      );
    }
  };

  const team1AllIds = match
    ? [
        ...(match.team_1.gk_id ? [match.team_1.gk_id] : []),
        ...match.team_1.outfield_ids,
      ]
    : [];
  const team2AllIds = match
    ? [
        ...(match.team_2.gk_id ? [match.team_2.gk_id] : []),
        ...match.team_2.outfield_ids,
      ]
    : [];

  const tabMeta: Record<AdminTab, { title: string; subtitle: string }> = {
    MATCH_ENGINE: {
      title: 'Gestione Partita & Squadre',
      subtitle: 'Seleziona i 10 convocati, bilancia le formazioni, inserisci il risultato e apri le votazioni.',
    },
    PLAYERS_ROSTER: {
      title: `Rosa Giocatori (${players.length})`,
      subtitle: 'Aggiungi nuovi giocatori e modifica i Valori Iniziali FUT (40–99) mantenendo l’evoluzione EMA dei voti.',
    },
    USER_CLAIMS: {
      title: `Utenti & Collegamento Giocatori (${pendingUsers.length} in attesa)`,
      subtitle: 'Gestisci le associazioni tra gli account registrati (incluso il Direttore) e i profili della rosa.',
    },
    GLOBAL_SETTINGS: {
      title: 'Regole & Parametri del Motore',
      subtitle: 'Configura i pesi dei ruoli, il moltiplicatore del portiere, i premi Token e la sensibilità delle quote.',
    },
  };

  return (
    <div className="space-y-6">
      {/* Compact Contextual Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
            {tabMeta[activeTab].title}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {tabMeta[activeTab].subtitle}
          </p>
        </div>

        {/* Fallback inline tabs only if rendered standalone without App header control */}
        {controlledTab === undefined && (
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {(
              [
                ['MATCH_ENGINE', 'Partita'],
                ['PLAYERS_ROSTER', `Rosa (${players.length})`],
                ['USER_CLAIMS', `Utenti (${pendingUsers.length})`],
                ['GLOBAL_SETTINGS', 'Regole'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === id
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* =====================================================================
          TAB 1: GESTIONE MATCH CORRENTE & MOTORE MATEMATICO A 3 STADI
         ===================================================================== */}
      {activeTab === 'MATCH_ENGINE' && (
        <div className="space-y-6">
          {!match ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Plus className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-xl font-display font-bold text-white">
                  Nessuna partita attiva
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Crea una nuova partita in stato DRAFT per impostare la data, selezionare i 10 convocati e calcolare le squadre con il motore matematico.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 max-w-2xl mx-auto text-left">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Data Match
                  </label>
                  <input
                    type="text"
                    value={newMatchDateText}
                    onChange={(e) => setNewMatchDateText(e.target.value)}
                    placeholder="Es: Giovedì 19 Novembre"
                    className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white w-full focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Orario
                  </label>
                  <input
                    type="text"
                    value={newMatchTimeText}
                    onChange={(e) => setNewMatchTimeText(e.target.value)}
                    placeholder="Es: 21:00"
                    className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white w-full focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Luogo / Campo
                  </label>
                  <input
                    type="text"
                    value={newMatchLocationText}
                    onChange={(e) => setNewMatchLocationText(e.target.value)}
                    placeholder="Es: Sporting Club"
                    className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white w-full focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    startNewWeeklyDraftMatch(
                      buildMatchDateLabel(
                        newMatchDateText,
                        newMatchTimeText,
                        newMatchLocationText
                      )
                    )
                  }
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs whitespace-nowrap cursor-pointer transition-colors"
                >
                  Crea Prima Partita (DRAFT)
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Logistica Match: Data, Ora e Luogo */}
              <form
                onSubmit={handleSaveMatchDetails}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                      Logistica e Dettagli Incontro
                    </div>
                    <h2 className="text-lg sm:text-xl font-display font-bold text-white mt-0.5">
                      Data, Orario e Luogo del Match
                    </h2>
                  </div>
                  <div className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 font-mono-tabular">
                    Anteprima:{' '}
                    <span className="text-white font-semibold">
                      {buildMatchDateLabel(
                        matchDateText,
                        matchTimeText,
                        matchLocationText
                      )}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 mt-4 items-end">
                  {/* Data */}
                  <div className="md:col-span-5">
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="match-date-input"
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        Data della Partita
                      </label>
                      <label className="text-[11px] text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1">
                        <span>Scegli da calendario</span>
                        <input
                          type="date"
                          aria-label="Seleziona data dal calendario"
                          onChange={(e) => {
                            const formatted = formatIsoDateToItalian(e.target.value);
                            if (formatted) setMatchDateText(formatted);
                          }}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    <input
                      id="match-date-input"
                      type="text"
                      value={matchDateText}
                      onChange={(e) => setMatchDateText(e.target.value)}
                      placeholder="Es: Giovedì 12 Novembre"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  {/* Ora */}
                  <div className="md:col-span-2">
                    <label
                      htmlFor="match-time-input"
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      Orario
                    </label>
                    <input
                      id="match-time-input"
                      type="text"
                      value={matchTimeText}
                      onChange={(e) => setMatchTimeText(e.target.value)}
                      placeholder="Es: 21:00"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono-tabular focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  {/* Luogo */}
                  <div className="md:col-span-3">
                    <label
                      htmlFor="match-location-input"
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      Luogo / Campo
                    </label>
                    <input
                      id="match-location-input"
                      type="text"
                      value={matchLocationText}
                      onChange={(e) => setMatchLocationText(e.target.value)}
                      placeholder="Es: Sporting Club"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  {/* Pulsante Salva */}
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Salva Dettagli
                    </button>
                  </div>
                </div>
              </form>

              {/* Match State Machine Progression Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                  <div>
                    <div className="text-xs text-slate-400 font-mono-tabular">
                      ID Match Attivo: {match.id} · Stato Corrente:{' '}
                      <strong className="text-emerald-400">{match.status}</strong>
                </div>
                <h2 className="text-2xl font-display font-bold text-white mt-0.5">
                  Macchina a Stati del Match Settimanale (5 Stati Sequenziali)
                </h2>
              </div>

              {/* Monitor Votazioni Post-Match (Modulo 03 - 2.1) */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-mono-tabular">
                Monitor Votazioni Anonime:{' '}
                <strong className="text-emerald-400">
                  {match.voting_tracker.voters_completed_ids.length}/10
                </strong>{' '}
                giocatori hanno votato
              </div>
            </div>

            {/* 5-Step Pipeline Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-5 text-xs font-mono-tabular">
              {(['DRAFT', 'OPEN_FOR_BETS', 'IN_PLAY', 'VOTING_OPEN', 'ARCHIVED'] as const).map(
                (st, idx) => {
                  const isCurrent = match.status === st;
                  return (
                    <div
                      key={st}
                      className={`p-3 rounded-xl border text-center ${
                        isCurrent
                          ? 'bg-emerald-500/20 border-emerald-400 text-white font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div>Stadio {idx + 1}</div>
                      <div className="mt-0.5 truncate">{st}</div>
                    </div>
                  );
                }
              )}
            </div>

            {/* Contextual Action Controls per State */}
            <div className="mt-6 bg-slate-950 border border-slate-800 rounded-2xl p-5">
              {match.status === 'DRAFT' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-slate-300">
                    <div className="font-semibold text-white text-sm">
                      Fase 1 (DRAFT): Configura i 10 Convocati, scegli Soluzione A o B e Pubblica
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      Finché il match è in stato DRAFT puoi modificare liberamente i 10 convocati o eseguire uno swap manuale.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={publishMatchForBets}
                    className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Pubblica Formazioni e Apri Scommesse (→ OPEN_FOR_BETS)
                  </button>
                </div>
              )}

              {match.status === 'OPEN_FOR_BETS' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-slate-300">
                    <div className="font-semibold text-white text-sm">
                      Fase 2 (OPEN_FOR_BETS): Scommesse 1X2 Aperte al Pubblico
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      Quando i 10 giocatori stanno per scendere in campo, blocca le scommesse e avvia la partita.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => startNewWeeklyDraftMatch(match.date_label)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
                    >
                      Riporta in DRAFT (Modifica Convocati)
                    </button>
                    <button
                      type="button"
                      onClick={closeBetsAndStartMatch}
                      className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-4 h-4" /> Chiudi Scommesse / Inizia Match (→ IN_PLAY)
                    </button>
                  </div>
                </div>
              )}

              {match.status === 'IN_PLAY' && (
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="text-xs text-slate-300">
                    <div className="font-semibold text-white text-sm">
                      Fase 3 (IN_PLAY): Inserisci Risultato Finale, Liquida Scommesse e Apri Votazioni
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      Allo sblocco di VOTING_OPEN il sistema liquida istantaneamente le scommesse vincenti e accredita +1 presenza e +1 vittoria alle classifiche.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                      <label htmlFor="score-g1" className="text-xs text-slate-300">
                        Gol Gabry:
                      </label>
                      <input
                        id="score-g1"
                        type="text"
                        inputMode="numeric"
                        value={scoreG1Draft}
                        onChange={(e) => setScoreG1Draft(e.target.value)}
                        onBlur={() => {
                          const val = Math.max(0, Math.min(30, parseInt(scoreG1Draft, 10) || 0));
                          setScoreG1Draft(String(val));
                        }}
                        className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono-tabular text-sm text-white focus:border-emerald-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                      <label htmlFor="score-g2" className="text-xs text-slate-300">
                        Gol Piero:
                      </label>
                      <input
                        id="score-g2"
                        type="text"
                        inputMode="numeric"
                        value={scoreG2Draft}
                        onChange={(e) => setScoreG2Draft(e.target.value)}
                        onBlur={() => {
                          const val = Math.max(0, Math.min(30, parseInt(scoreG2Draft, 10) || 0));
                          setScoreG2Draft(String(val));
                        }}
                        className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono-tabular text-sm text-white focus:border-emerald-400 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const s1 = Math.max(0, Math.min(30, parseInt(scoreG1Draft, 10) || 0));
                        const s2 = Math.max(0, Math.min(30, parseInt(scoreG2Draft, 10) || 0));
                        finishMatchAndOpenVoting(s1, s2);
                      }}
                      className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Trophy className="w-4 h-4" /> Termina Match e Apri Votazioni (→ VOTING_OPEN)
                    </button>
                  </div>
                </div>
              )}

              {match.status === 'VOTING_OPEN' && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-slate-300">
                    <div className="font-semibold text-white text-sm">
                      Fase 4 (VOTING_OPEN): Finestra Voto Anonimo Post-Partita ({match.voting_tracker.voters_completed_ids.length}/10 hanno votato)
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      Cliccando su Consolida Voti e Archivia, i voti anonimi aggiornano i pesi [0, 1] dei giocatori tramite formula EMA (η = {config.ema_learning_rate_eta}) e ricalcolano le Carte FUT.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={consolidateVotesAndArchiveMatch}
                    className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Consolida Voti (EMA) e Archivia Match (→ ARCHIVED)
                  </button>
                </div>
              )}

              {match.status === 'ARCHIVED' && (
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="text-xs text-slate-300">
                    <div className="font-semibold text-emerald-400 text-sm">
                      Fase 5 (ARCHIVED): Match Consolidato e Carte FUT Aggiornate
                    </div>
                    <p className="text-slate-400 mt-0.5">
                      Crea la partita della settimana successiva (stato DRAFT) per selezionare i nuovi 10 convocati.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <input
                      type="text"
                      value={newMatchDateText}
                      onChange={(e) => setNewMatchDateText(e.target.value)}
                      placeholder="Data (es. Giovedì 19 Novembre)"
                      aria-label="Data nuovo match"
                      className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white w-44"
                    />
                    <input
                      type="text"
                      value={newMatchTimeText}
                      onChange={(e) => setNewMatchTimeText(e.target.value)}
                      placeholder="Ora (es. 21:00)"
                      aria-label="Ora nuovo match"
                      className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white w-24 font-mono-tabular"
                    />
                    <input
                      type="text"
                      value={newMatchLocationText}
                      onChange={(e) => setNewMatchLocationText(e.target.value)}
                      placeholder="Luogo (es. Sporting Club)"
                      aria-label="Luogo nuovo match"
                      className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white w-40"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        startNewWeeklyDraftMatch(
                          buildMatchDateLabel(
                            newMatchDateText,
                            newMatchTimeText,
                            newMatchLocationText
                          )
                        )
                      }
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Crea Nuovo Match in DRAFT
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Convocati Selector (Active when DRAFT, or preview with option to unlock DRAFT) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-xl font-display font-bold text-white">
                  Selezione dei 10 Giocatori Convocati ({draftConvocati.length}/10 selezionati)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {match.status === 'DRAFT'
                    ? 'Seleziona esattamente 10 giocatori attivi per ricalcolare in tempo reale il Motore Matematico.'
                    : 'Il match ha superato la fase DRAFT. Clicca "Riporta in DRAFT" se desideri sostituire un convocato dell’ultimo minuto.'}
                </p>
              </div>

              {match.status === 'DRAFT' && (
                <button
                  type="button"
                  disabled={draftConvocati.length !== 10}
                  onClick={handleApplyDraftConvocati}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs cursor-pointer"
                >
                  Ricalcola Motore su questi 10 Convocati
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 mt-4">
              {players
                .filter((p) => p.is_active)
                .map((p) => {
                  const isSelected = draftConvocati.includes(p.id);
                  const ovr = getPlayerFutOverall(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={match.status !== 'DRAFT'}
                      onClick={() => toggleDraftConvocato(p.id)}
                      className={`p-3 rounded-2xl border text-left transition-colors ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      } ${
                        match.status === 'DRAFT'
                          ? 'cursor-pointer hover:border-slate-700'
                          : 'opacity-80 cursor-default'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono-tabular">
                        <span className="font-bold text-emerald-400">
                          {p.wants_to_be_gk ? 'POR' : p.computed.role_label}
                        </span>
                        <span>FUT {ovr}</span>
                      </div>
                      <div className="font-semibold text-sm truncate mt-1">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono-tabular">
                        {p.wants_to_be_gk
                          ? `Portiere · FUT ${weightToFutStat(p.weights.portiere)}`
                          : `Ruolo: ${p.computed.role_label}`}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Motore Matematico: Unico Riquadro Proposte (A / B / Bozza Corrente) */}
          {engineResult && (
            <UnifiedProposalsCard
              engineResult={engineResult}
              match={match}
              config={config}
              playerMap={playerMap}
              activeTab={selectedProposalTab}
              onTabChange={setSelectedProposalTab}
              onSelectProposal={selectBalancingProposal}
              team1AllIds={team1AllIds}
              team2AllIds={team2AllIds}
              swapP1={swapP1}
              setSwapP1={setSwapP1}
              swapP2={swapP2}
              setSwapP2={setSwapP2}
              onSwapSubmit={handleSwapSubmit}
              onOpenInfoModal={() => {
                setInfoModalTab('STAGES');
                setIsInfoModalOpen(true);
              }}
            />
          )}
          </>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: ANAGRAFICA GIOCATORI E OVERRIDE PESI
         ===================================================================== */}
      {activeTab === 'PLAYERS_ROSTER' && (
        <div className="space-y-6">
          {/* Add New Player Form (FUT 40-99 only) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="pb-4 border-b border-slate-800">
              <h2 className="text-xl font-display font-bold text-white">
                Inserisci Nuovo Giocatore nella Rosa
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Inserisci nome, soprannome e i valori di abilità in scala FUT da 40 a 99 (convertiti automaticamente a backend).
              </p>
            </div>

            <form onSubmit={handleAddNewPlayer} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="new-player-name"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Nome Giocatore:
                  </label>
                  <input
                    id="new-player-name"
                    type="text"
                    required
                    maxLength={60}
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Es. Marco Rossi"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="new-player-nickname"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Soprannome / Nickname (opzionale):
                  </label>
                  <input
                    id="new-player-nickname"
                    type="text"
                    maxLength={60}
                    value={newPlayerNickname}
                    onChange={(e) => setNewPlayerNickname(e.target.value)}
                    placeholder="Es. Il Bomber"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2.5 cursor-pointer bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 w-full hover:border-slate-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={newPlayerWantsGk}
                      onChange={(e) => setNewPlayerWantsGk(e.target.checked)}
                      className="w-4 h-4 accent-emerald-400"
                    />
                    <span className="text-xs font-medium text-slate-200">
                      Disponibile come Portiere
                    </span>
                  </label>
                </div>
              </div>

              {/* 6 FUT Attribute Inputs */}
              <div>
                <div className="text-xs font-semibold text-slate-300 mb-2">
                  Attributi Giocatore (Scala FUT 40 – 99):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  {(
                    [
                      ['tiro', 'Tiro'],
                      ['velocita', 'Velocità'],
                      ['passaggio', 'Passaggio'],
                      ['resistenza', 'Resistenza'],
                      ['difesa', 'Difesa'],
                      ['portiere', 'Portiere'],
                    ] as const
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3"
                    >
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {label}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newPlayerFutDraft[key]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewPlayerFutDraft((prev) => ({
                            ...prev,
                            [key]: val,
                          }));
                        }}
                        onBlur={() => {
                          setNewPlayerFutDraft((prev) => {
                            const raw = prev[key];
                            const parsed = parseInt(raw, 10);
                            const clamped = isNaN(parsed) ? 70 : Math.min(99, Math.max(40, parsed));
                            return {
                              ...prev,
                              [key]: String(clamped),
                            };
                          });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 focus:outline-none rounded-lg px-2.5 py-1.5 font-mono-tabular text-sm text-white"
                      />
                      <div className="text-[10px] text-slate-500 mt-1">
                        Scala 40-99
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Aggiungi Giocatore alla Rosa
              </button>
            </form>
          </div>

          {/* Roster Table with Inline Edit & Delete */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-xl font-display font-bold text-white">
                  Rosa Giocatori ({players.length} Giocatori)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualizza le statistiche attuali e modifica in qualsiasi momento i Valori Iniziali (40–99) assegnati dal Direttore.
                </p>
              </div>
            </div>

            {/* Spiegazione Valore Iniziale + Evoluzione EMA */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">
                      Valore Iniziale del Direttore & Evoluzione Continua (EMA)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Quando aggiungi o modifichi un giocatore imposti il suo <strong className="text-white">Valore Iniziale</strong>. Dopo ogni partita, i voti aggiornano il <strong className="text-emerald-400">Valore Attuale</strong> tramite media EMA. Se modifichi il Valore Iniziale, il Valore Attuale si ricalcola automaticamente mantenendo l&apos;effetto dei voti già ricevuti.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono-tabular">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-sans">
                    <th className="py-2.5 px-3 min-w-[160px]">Giocatore</th>
                    <th className="py-2.5 px-3">Ruolo · OVR</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Evoluzione Voti</th>
                    <th className="py-2.5 px-3">Tiro</th>
                    <th className="py-2.5 px-3">Velocità</th>
                    <th className="py-2.5 px-3">Passaggio</th>
                    <th className="py-2.5 px-3">Resistenza</th>
                    <th className="py-2.5 px-3">Difesa</th>
                    <th className="py-2.5 px-3">Portiere</th>
                    <th className="py-2.5 px-3">Token</th>
                    <th className="py-2.5 px-3 text-right min-w-[150px]">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {players.map((p) => {
                    const isEditing = editingPlayer?.id === p.id;
                    const isDeleting = deleteConfirmId === p.id;
                    const initWeights = p.initial_weights ?? p.weights;

                    if (isEditing && editingPlayer) {
                      return (
                        <tr key={p.id} className="bg-slate-950/90 border-2 border-emerald-500/40">
                          <td className="py-3 px-3 font-sans" colSpan={3}>
                            <div className="space-y-1.5">
                              <div>
                                <label className="block text-[10px] text-slate-400">Nome:</label>
                                <input
                                  type="text"
                                  value={editingPlayer.name}
                                  onChange={(e) =>
                                    setEditingPlayer({
                                      ...editingPlayer,
                                      name: e.target.value,
                                    })
                                  }
                                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs font-semibold"
                                  placeholder="Nome"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400">Soprannome:</label>
                                <input
                                  type="text"
                                  value={editingPlayer.nickname}
                                  onChange={(e) =>
                                    setEditingPlayer({
                                      ...editingPlayer,
                                      nickname: e.target.value,
                                    })
                                  }
                                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                                  placeholder="Nickname"
                                />
                              </div>
                              <div className="pt-1 border-t border-slate-800 text-[10px] text-emerald-400 font-medium">
                                Stai modificando i Valori Iniziali (40–99). L&apos;effetto dei voti ricevuti verrà mantenuto.
                              </div>
                            </div>
                          </td>

                          {(
                            [
                              'tiro',
                              'velocita',
                              'passaggio',
                              'resistenza',
                              'difesa',
                            ] as const
                          ).map((k) => {
                            const curVal = weightToFutStat(p.weights[k]);
                            const oldInitVal = weightToFutStat(initWeights[k]);
                            const diffVotes = curVal - oldInitVal;
                            return (
                              <td key={k} className="py-3 px-3">
                                <div className="space-y-1">
                                  <div className="text-[9px] text-slate-400 font-sans">Val. Iniziale</div>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={editingPlayer.futAttrsDraft[k]}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditingPlayer({
                                        ...editingPlayer,
                                        futAttrsDraft: {
                                          ...editingPlayer.futAttrsDraft,
                                          [k]: val,
                                        },
                                      });
                                    }}
                                    onBlur={() => {
                                      setEditingPlayer((prev) => {
                                        if (!prev) return null;
                                        const parsed = parseInt(prev.futAttrsDraft[k], 10);
                                        const clamped = isNaN(parsed) ? 70 : Math.min(99, Math.max(40, parsed));
                                        return {
                                          ...prev,
                                          futAttrsDraft: {
                                            ...prev.futAttrsDraft,
                                            [k]: String(clamped),
                                          },
                                        };
                                      });
                                    }}
                                    className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center font-bold text-white text-xs focus:border-emerald-400 focus:outline-none"
                                  />
                                  {diffVotes !== 0 && (
                                    <div className="text-[10px] text-emerald-400 font-mono-tabular">
                                      Voti: {diffVotes > 0 ? `+${diffVotes}` : diffVotes}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              <div className="text-[9px] text-slate-400 font-sans">Val. Iniziale</div>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editingPlayer.futAttrsDraft.portiere}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditingPlayer({
                                    ...editingPlayer,
                                    futAttrsDraft: {
                                      ...editingPlayer.futAttrsDraft,
                                      portiere: val,
                                    },
                                  });
                                }}
                                onBlur={() => {
                                  setEditingPlayer((prev) => {
                                    if (!prev) return null;
                                    const parsed = parseInt(prev.futAttrsDraft.portiere, 10);
                                    const clamped = isNaN(parsed) ? 50 : Math.min(99, Math.max(40, parsed));
                                    return {
                                      ...prev,
                                      futAttrsDraft: {
                                        ...prev.futAttrsDraft,
                                        portiere: String(clamped),
                                      },
                                    };
                                  });
                                }}
                                className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center font-bold text-white text-xs focus:border-emerald-400 focus:outline-none"
                              />
                              <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-400 font-sans">
                                <input
                                  type="checkbox"
                                  checked={editingPlayer.wants_to_be_gk}
                                  onChange={(e) =>
                                    setEditingPlayer({
                                      ...editingPlayer,
                                      wants_to_be_gk: e.target.checked,
                                    })
                                  }
                                  className="accent-emerald-400"
                                />
                                Portiere
                              </label>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              <div className="text-[9px] text-slate-400 font-sans">Token</div>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editingPlayer.tokensDraft}
                                onChange={(e) =>
                                  setEditingPlayer({
                                    ...editingPlayer,
                                    tokensDraft: e.target.value,
                                  })
                                }
                                onBlur={() => {
                                  setEditingPlayer((prev) => {
                                    if (!prev) return null;
                                    const parsed = parseInt(prev.tokensDraft, 10);
                                    return {
                                      ...prev,
                                      tokensDraft: String(isNaN(parsed) || parsed < 0 ? 0 : parsed),
                                    };
                                  });
                                }}
                                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center font-bold text-amber-300 text-xs focus:border-amber-400 focus:outline-none"
                              />
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={saveEditingPlayer}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1"
                              >
                                <Save className="w-3.5 h-3.5" /> Salva
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPlayer(null)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                              >
                                Annulla
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    const initOvr = getPlayerNaturalFutOverall(p);
                    const curOvr = getPlayerFutOverall(p);
                    const ovrDelta = curOvr - initOvr;
                    const totalVotesReceived = Object.values(p.attr_votes_count || {}).reduce(
                      (acc, v) => acc + (v || 0),
                      0
                    );

                    return (
                      <tr key={p.id} className="hover:bg-slate-950/60">
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex items-center gap-2.5">
                            {p.avatar_url ? (
                              <img
                                src={p.avatar_url}
                                alt={p.name}
                                className="w-9 h-9 rounded-xl object-cover border border-emerald-500/40 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-display font-bold text-xs flex items-center justify-center shrink-0">
                                {p.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-white">
                                {p.name}
                              </div>
                              {p.nickname && (
                                <div className="text-[11px] text-emerald-400/90 italic">
                                  «{p.nickname}»
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-0.5">
                                <label className="text-[10px] text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1">
                                  <Camera className="w-3 h-3" />
                                  <span>{p.avatar_url ? 'Cambia foto' : 'Carica foto'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) =>
                                      handleAdminPhotoUpload(p.id, e.target.files?.[0])
                                    }
                                  />
                                </label>
                                {p.avatar_url && (
                                  <button
                                    type="button"
                                    onClick={() => updatePlayerPhoto(p.id, '')}
                                    className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                                  >
                                    Rimuovi
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-emerald-400 font-bold">
                            {p.wants_to_be_gk ? 'POR' : p.computed.role_label} ·{' '}
                            {curOvr}
                          </div>
                          {ovrDelta !== 0 && (
                            <div className="text-[10px] text-slate-400">
                              Iniz: {initOvr} ({ovrDelta > 0 ? `+${ovrDelta}` : ovrDelta})
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          {totalVotesReceived > 0 ? (
                            <div className="space-y-0.5">
                              <span className="text-emerald-400 font-semibold text-[11px]">
                                Evoluzione EMA
                              </span>
                              <div className="text-[10px] text-slate-400 font-mono-tabular">
                                {totalVotesReceived} voti ricevuti
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="text-slate-300 font-medium text-[11px]">
                                Valore Iniziale
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono-tabular">
                                0 voti ricevuti
                              </div>
                            </div>
                          )}
                        </td>
                        {(
                          [
                            'tiro',
                            'velocita',
                            'passaggio',
                            'resistenza',
                            'difesa',
                          ] as const
                        ).map((k) => {
                          const curStat = weightToFutStat(p.weights[k]);
                          const initStat = weightToFutStat(initWeights[k]);
                          return (
                            <td key={k} className="py-2.5 px-3 text-slate-200">
                              <div className="font-semibold">{curStat}</div>
                              {curStat !== initStat && (
                                <div className="text-[10px] text-slate-500">
                                  Iniz: {initStat}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-slate-200">
                          <div className="font-semibold">
                            {weightToFutStat(p.weights.portiere)} {p.wants_to_be_gk ? '(POR)' : ''}
                          </div>
                          {weightToFutStat(p.weights.portiere) !== weightToFutStat(initWeights.portiere) && (
                            <div className="text-[10px] text-slate-500">
                              Iniz: {weightToFutStat(initWeights.portiere)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-amber-300 font-bold">
                          {p.stats.tokens}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          {isDeleting ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-[10px] text-rose-300">Confermi?</span>
                              <button
                                type="button"
                                onClick={() => handleDeletePlayer(p.id)}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Sì, elimina
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[11px] cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEditingPlayer(p)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Edit3 className="w-3 h-3 text-emerald-400" /> Modifica Iniziali
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(p.id)}
                                title="Elimina giocatore dalla rosa"
                                aria-label={`Elimina ${p.name}`}
                                className="p-1 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: UTENTI & ASSOCIAZIONI GIOCATORI (ACCOUNT CLAIMING & LINKING)
         ===================================================================== */}
      {activeTab === 'USER_CLAIMS' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h2 className="text-xl font-display font-bold text-white">
              Coda Richieste di Associazione Pendenti (PENDING_APPROVAL)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Approvando una richiesta, l’account viene collegato al profilo giocatore e riceve automaticamente +{config.initial_tokens} Token di Benvenuto.
            </p>

            {pendingUsers.length === 0 ? (
              <div className="mt-4 p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                Nessuna richiesta in attesa di approvazione in questo momento.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingUsers.map((u) => {
                  const claimedPlayer = playerMap.get(u.linked_player_id);
                  return (
                    <div
                      key={u.uid}
                      className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="text-xs">
                        <div className="text-slate-300">
                          L’account{' '}
                          <strong className="text-white">{u.email}</strong> (
                          {u.display_name}) richiede di essere associato al giocatore{' '}
                          <strong className="text-emerald-400 text-sm">
                            {claimedPlayer?.name ?? u.linked_player_id}
                          </strong>
                          . Approvi?
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => approveAccountClaim(u.uid)}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" /> Approva (+{config.initial_tokens} Token)
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectAccountClaim(u.uid)}
                          className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <X className="w-4 h-4" /> Rifiuta
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <div className="mb-4">
              <h3 className="text-xl font-display font-bold text-white">
                Gestione Connessioni Utenti ↔ Giocatori (Tutti gli Account)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Collega, cambia o scollega liberamente il profilo giocatore associato a qualsiasi account utente registrato (incluso l&apos;account del Direttore).
              </p>
            </div>

            {users.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                Nessun utente registrato trovato.
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => {
                  const currentLinkedId = u.linked_player_id || '';
                  const draftSelectedId =
                    userLinkDrafts[u.uid] !== undefined
                      ? userLinkDrafts[u.uid]
                      : currentLinkedId;
                  const linkedPlayer = playerMap.get(currentLinkedId);
                  const hasUnsavedChange = draftSelectedId !== currentLinkedId;

                  return (
                    <div
                      key={u.uid}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white text-sm">
                            {u.display_name}
                          </span>
                          <span className="text-slate-400">({u.email})</span>
                          {u.is_admin && (
                            <span className="text-emerald-400 font-semibold">
                              · Direttore
                            </span>
                          )}
                          <span className="text-slate-500">
                            · Stato: {u.auth_status}
                          </span>
                        </div>
                        <div className="text-slate-400">
                          Giocatore attuale:{' '}
                          {linkedPlayer ? (
                            <strong className="text-emerald-400">
                              {linkedPlayer.name} ({linkedPlayer.wants_to_be_gk ? 'POR' : linkedPlayer.computed.role_label})
                            </strong>
                          ) : (
                            <span className="text-amber-400">
                              Nessun giocatore collegato
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <select
                          aria-label={`Seleziona giocatore per ${u.display_name}`}
                          value={draftSelectedId}
                          onChange={(e) =>
                            setUserLinkDrafts((prev) => ({
                              ...prev,
                              [u.uid]: e.target.value,
                            }))
                          }
                          className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400 min-w-[220px]"
                        >
                          <option value="">— Nessun giocatore collegato —</option>
                          {players.map((p) => {
                            const ownerUser = users.find(
                              (other) =>
                                other.linked_player_id === p.id && other.uid !== u.uid
                            );
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.wants_to_be_gk ? 'POR' : p.computed.role_label})
                                {ownerUser ? ` — già di ${ownerUser.display_name}` : ''}
                              </option>
                            );
                          })}
                        </select>

                        <button
                          type="button"
                          disabled={!hasUnsavedChange}
                          onClick={async () => {
                            await assignPlayerToUser(u.uid, draftSelectedId);
                            setUserLinkDrafts((prev) => {
                              const next = { ...prev };
                              delete next[u.uid];
                              return next;
                            });
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Salva Associazione
                        </button>

                        {currentLinkedId && (
                          <button
                            type="button"
                            onClick={async () => {
                              await unlinkAccountClaim(u.uid);
                              setUserLinkDrafts((prev) => {
                                const next = { ...prev };
                                delete next[u.uid];
                                return next;
                              });
                            }}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs cursor-pointer transition-colors"
                          >
                            Scollega
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: PANNELLO IMPOSTAZIONI E IPERPARAMETRI
         ===================================================================== */}
      {activeTab === 'GLOBAL_SETTINGS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-display font-bold text-white">
                Impostazioni e Parametri del Sistema
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Clicca su qualsiasi parametro per visualizzare una spiegazione dettagliata del suo funzionamento e il valore consigliato.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCfgDraft(DEFAULT_GLOBAL_CONFIG)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Ripristina Default
              </button>
              <button
                type="button"
                onClick={() => updateGlobalSettings(cfgDraft)}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" /> Salva Configurazione
              </button>
            </div>
          </div>

          {/* Interactive Info Panel if a variable is clicked */}
          {activeVariableInfoKey && GLOBAL_VARS_DOC[activeVariableInfoKey] && (
            <div className="bg-slate-950 border-2 border-emerald-500/50 rounded-2xl p-4 text-xs space-y-2 relative shadow-lg">
              <button
                type="button"
                onClick={() => setActiveVariableInfoKey(null)}
                className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                aria-label="Chiudi spiegazione"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-wide">
                  {GLOBAL_VARS_DOC[activeVariableInfoKey].category}
                </span>
                <span className="font-bold text-white text-sm">
                  {GLOBAL_VARS_DOC[activeVariableInfoKey].label}
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed max-w-3xl">
                {GLOBAL_VARS_DOC[activeVariableInfoKey].explanation}
              </p>
              <div className="text-emerald-400 font-semibold text-[11px] pt-0.5">
                {GLOBAL_VARS_DOC[activeVariableInfoKey].recommended}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Sezione 1: Classificazione Ruoli & Coefficienti Polari */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                <div className="font-semibold text-emerald-400 text-sm flex items-center gap-2">
                  <span>Classificazione dei Ruoli & Coefficienti Polari</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInfoModalTab('POLAR');
                    setIsInfoModalOpen(true);
                  }}
                  className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Spiega Formula Poli
                </button>
              </div>

              {/* Soglia Tau */}
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setActiveVariableInfoKey(
                      activeVariableInfoKey === 'role_threshold_tau'
                        ? null
                        : 'role_threshold_tau'
                    )
                  }
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-emerald-400 mb-1 cursor-pointer"
                >
                  <span>Soglia di Specializzazione Ruolo (τ)</span>
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <input
                  type="number"
                  step={0.01}
                  value={cfgDraft.role_threshold_tau}
                  onChange={(e) =>
                    setCfgDraft({
                      ...cfgDraft,
                      role_threshold_tau: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 font-mono-tabular text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Definisce il distacco minimo (|δ| &gt; 0.20) tra polo offensivo e difensivo per essere Attaccante o Difensore anziché Tuttocampista.
                </span>
              </div>

              {/* Polo Attacco (S_A) */}
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Valutazione Offensiva — Polo Attacco (S_A)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">T, V, P, R</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      key: 'attack_tiro',
                      docKey: 'polar_att_tiro',
                      label: 'Tiro in Attacco',
                      fallback: 'a',
                      def: 0.50,
                    },
                    {
                      key: 'attack_velocita',
                      docKey: 'polar_att_vel',
                      label: 'Velocità in Attacco',
                      fallback: 'b',
                      def: 0.25,
                    },
                    {
                      key: 'attack_passaggio',
                      docKey: 'polar_att_pas',
                      label: 'Passaggio in Attacco',
                      fallback: 'd',
                      def: 0.15,
                    },
                    {
                      key: 'attack_resistenza',
                      docKey: 'polar_att_res',
                      label: 'Resistenza in Attacco',
                      fallback: 'c',
                      def: 0.10,
                    },
                  ].map(({ key, docKey, label, fallback, def }) => {
                    const currentVal =
                      cfgDraft.polar_weights[key as keyof typeof cfgDraft.polar_weights] ??
                      cfgDraft.polar_weights[fallback as keyof typeof cfgDraft.polar_weights] ??
                      def;
                    return (
                      <div key={key}>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveVariableInfoKey(
                              activeVariableInfoKey === docKey ? null : docKey
                            )
                          }
                          className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-amber-400 mb-1 cursor-pointer"
                        >
                          <span className="truncate">{label}</span>
                          <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                        </button>
                        <input
                          type="number"
                          step={0.05}
                          value={currentVal}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setCfgDraft({
                              ...cfgDraft,
                              polar_weights: {
                                ...cfgDraft.polar_weights,
                                [key]: val,
                                [fallback]: val,
                              },
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-tabular text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Polo Difesa (S_D) */}
              <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Valutazione Difensiva — Polo Difesa (S_D)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">D, R, P, V</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      key: 'defense_difesa',
                      docKey: 'polar_dif_dif',
                      label: 'Difesa in Copertura',
                      fallback: 'a',
                      def: 0.50,
                    },
                    {
                      key: 'defense_resistenza',
                      docKey: 'polar_dif_res',
                      label: 'Resistenza in Copertura',
                      fallback: 'b',
                      def: 0.25,
                    },
                    {
                      key: 'defense_passaggio',
                      docKey: 'polar_dif_pas',
                      label: 'Passaggio in Uscita',
                      fallback: 'd',
                      def: 0.15,
                    },
                    {
                      key: 'defense_velocita',
                      docKey: 'polar_dif_vel',
                      label: 'Velocità nel Recupero',
                      fallback: 'c',
                      def: 0.10,
                    },
                  ].map(({ key, docKey, label, fallback, def }) => {
                    const currentVal =
                      cfgDraft.polar_weights[key as keyof typeof cfgDraft.polar_weights] ??
                      cfgDraft.polar_weights[fallback as keyof typeof cfgDraft.polar_weights] ??
                      def;
                    return (
                      <div key={key}>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveVariableInfoKey(
                              activeVariableInfoKey === docKey ? null : docKey
                            )
                          }
                          className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-cyan-400 mb-1 cursor-pointer"
                        >
                          <span className="truncate">{label}</span>
                          <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                        </button>
                        <input
                          type="number"
                          step={0.05}
                          value={currentVal}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setCfgDraft({
                              ...cfgDraft,
                              polar_weights: {
                                ...cfgDraft.polar_weights,
                                [key]: val,
                              },
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-tabular text-white focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sezione 2: Bilanciamento Squadre Macro */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="font-semibold text-emerald-400 text-sm">
                Bilanciamento Squadre Macro
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Proposta A (Equilibrata)
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'w1', docKey: 'macro_A_w1', label: 'Parità Ruoli' },
                      { key: 'w2', docKey: 'macro_A_w2', label: 'Uguaglianza Forza' },
                      { key: 'w3', docKey: 'macro_A_w3', label: 'Omogeneità Reparti' },
                    ].map(({ key, docKey, label }) => (
                      <div key={`A_${key}`}>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveVariableInfoKey(
                              activeVariableInfoKey === docKey ? null : docKey
                            )
                          }
                          className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-emerald-400 mb-1 cursor-pointer"
                        >
                          <span className="truncate">{label}</span>
                          <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                        </button>
                        <input
                          type="number"
                          step={0.1}
                          value={cfgDraft.macro_weights_A[key as keyof typeof cfgDraft.macro_weights_A]}
                          onChange={(e) =>
                            setCfgDraft({
                              ...cfgDraft,
                              macro_weights_A: {
                                ...cfgDraft.macro_weights_A,
                                [key]: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-tabular text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Proposta B (Speculare per Ruoli)
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'w1', docKey: 'macro_B_w1', label: 'Parità Ruoli' },
                      { key: 'w2', docKey: 'macro_B_w2', label: 'Uguaglianza Forza' },
                      { key: 'w3', docKey: 'macro_B_w3', label: 'Omogeneità Reparti' },
                    ].map(({ key, docKey, label }) => (
                      <div key={`B_${key}`}>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveVariableInfoKey(
                              activeVariableInfoKey === docKey ? null : docKey
                            )
                          }
                          className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-emerald-400 mb-1 cursor-pointer"
                        >
                          <span className="truncate">{label}</span>
                          <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                        </button>
                        <input
                          type="number"
                          step={0.1}
                          value={cfgDraft.macro_weights_B[key as keyof typeof cfgDraft.macro_weights_B]}
                          onChange={(e) =>
                            setCfgDraft({
                              ...cfgDraft,
                              macro_weights_B: {
                                ...cfgDraft.macro_weights_B,
                                [key]: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-tabular text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sezione 3: Calcolo Forza Complessiva */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="font-semibold text-emerald-400 text-sm">
                Calcolo della Forza Complessiva
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="col-span-2 sm:col-span-3">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveVariableInfoKey(
                        activeVariableInfoKey === 'gk_lambda' ? null : 'gk_lambda'
                      )
                    }
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-emerald-400 mb-1 cursor-pointer"
                  >
                    <span>Impatto Decisivo del Portiere</span>
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <input
                    type="number"
                    step={0.1}
                    value={cfgDraft.gk_multiplier_lambda}
                    onChange={(e) =>
                      setCfgDraft({
                        ...cfgDraft,
                        gk_multiplier_lambda: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-tabular text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {[
                  { key: 'a1', docKey: 'alpha_a1', label: 'Importanza Tiro' },
                  { key: 'a2', docKey: 'alpha_a2', label: 'Importanza Regia' },
                  { key: 'a3', docKey: 'alpha_a3', label: 'Importanza Difesa' },
                  { key: 'a4', docKey: 'alpha_a4', label: 'Importanza Corsa' },
                ].map(({ key, docKey, label }) => (
                  <div key={key}>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveVariableInfoKey(
                          activeVariableInfoKey === docKey ? null : docKey
                        )
                      }
                      className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-emerald-400 mb-1 cursor-pointer"
                    >
                      <span className="truncate">{label}</span>
                      <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                    </button>
                    <input
                      type="number"
                      step={0.05}
                      value={cfgDraft.micro_weights_alpha[key as keyof typeof cfgDraft.micro_weights_alpha]}
                      onChange={(e) =>
                        setCfgDraft({
                          ...cfgDraft,
                          micro_weights_alpha: {
                            ...cfgDraft.micro_weights_alpha,
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-tabular text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Sezione 4: Evoluzione Voti ed Economia Token */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="font-semibold text-amber-400 text-sm">
                Evoluzione Voti ed Economia Token
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveVariableInfoKey(
                        activeVariableInfoKey === 'ema_eta' ? null : 'ema_eta'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-amber-300 mb-1 cursor-pointer"
                  >
                    <span className="truncate">Velocità Voti</span>
                    <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                  </button>
                  <input
                    type="number"
                    step={0.01}
                    min={0.05}
                    max={0.5}
                    value={cfgDraft.ema_learning_rate_eta}
                    onChange={(e) =>
                      setCfgDraft({
                        ...cfgDraft,
                        ema_learning_rate_eta: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-tabular text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveVariableInfoKey(
                        activeVariableInfoKey === 'initial_tokens'
                          ? null
                          : 'initial_tokens'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-amber-300 mb-1 cursor-pointer"
                  >
                    <span className="truncate">Bonus Benvenuto</span>
                    <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                  </button>
                  <input
                    type="number"
                    value={cfgDraft.initial_tokens}
                    onChange={(e) =>
                      setCfgDraft({
                        ...cfgDraft,
                        initial_tokens: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-tabular text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveVariableInfoKey(
                        activeVariableInfoKey === 'attendance_reward'
                          ? null
                          : 'attendance_reward'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-amber-300 mb-1 cursor-pointer"
                  >
                    <span className="truncate">Premio Voto</span>
                    <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                  </button>
                  <input
                    type="number"
                    value={cfgDraft.attendance_reward_tokens}
                    onChange={(e) =>
                      setCfgDraft({
                        ...cfgDraft,
                        attendance_reward_tokens: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-tabular text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                {[
                  { oddKey: '1', docKey: 'odd_1', label: 'Quota Vittoria 1' },
                  { oddKey: 'X', docKey: 'odd_X', label: 'Quota Pareggio X' },
                  { oddKey: '2', docKey: 'odd_2', label: 'Quota Vittoria 2' },
                ].map(({ oddKey, docKey, label }) => (
                  <div key={oddKey}>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveVariableInfoKey(
                          activeVariableInfoKey === docKey ? null : docKey
                        )
                      }
                      className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-amber-300 mb-1 cursor-pointer"
                    >
                      <span className="truncate">{label}</span>
                      <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                    </button>
                    <input
                      type="number"
                      step={0.05}
                      value={cfgDraft.bet_odds[oddKey as keyof typeof cfgDraft.bet_odds]}
                      onChange={(e) =>
                        setCfgDraft({
                          ...cfgDraft,
                          bet_odds: {
                            ...cfgDraft.bet_odds,
                            [oddKey]: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-tabular text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                ))}

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveVariableInfoKey(
                        activeVariableInfoKey === 'dynamic_odds_sensitivity'
                          ? null
                          : 'dynamic_odds_sensitivity'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-amber-300 mb-1 cursor-pointer"
                  >
                    <span className="truncate">Sensibilità Quote Dinamiche</span>
                    <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                  </button>
                  <input
                    type="number"
                    step={0.05}
                    min={0.1}
                    max={1.0}
                    value={cfgDraft.dynamic_odds_sensitivity ?? 0.5}
                    onChange={(e) =>
                      setCfgDraft({
                        ...cfgDraft,
                        dynamic_odds_sensitivity: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono-tabular text-white focus:border-amber-400 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Regola l&apos;impatto del divario di forza sulle quote 1X2 (0.10 bassa, 1.00 alta)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guida Interattiva al Meccanismo di Bilanciamento */}
      <BalancingInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        initialTab={infoModalTab}
      />
    </div>
  );
};

interface UnifiedProposalsCardProps {
  engineResult: BalancingEngineResult;
  match: Match;
  config: GlobalConfig;
  playerMap: Map<string, Player>;
  activeTab: 'A' | 'B' | 'CUSTOM';
  onTabChange: (tab: 'A' | 'B' | 'CUSTOM') => void;
  onSelectProposal: (sol: 'A' | 'B') => void;
  team1AllIds: string[];
  team2AllIds: string[];
  swapP1: string;
  setSwapP1: (id: string) => void;
  swapP2: string;
  setSwapP2: (id: string) => void;
  onSwapSubmit: () => void;
  onOpenInfoModal: () => void;
}

const UnifiedProposalsCard: React.FC<UnifiedProposalsCardProps> = ({
  engineResult,
  match,
  config,
  playerMap,
  activeTab,
  onTabChange,
  onSelectProposal,
  team1AllIds,
  team2AllIds,
  swapP1,
  setSwapP1,
  swapP2,
  setSwapP2,
  onSwapSubmit,
  onOpenInfoModal,
}) => {
  const oddsA = useMemo(
    () =>
      computeMatchOdds(
        engineResult.proposal_A.team_1.total_power,
        engineResult.proposal_A.team_2.total_power,
        config
      ),
    [engineResult.proposal_A, config]
  );

  const oddsB = useMemo(
    () =>
      computeMatchOdds(
        engineResult.proposal_B.team_1.total_power,
        engineResult.proposal_B.team_2.total_power,
        config
      ),
    [engineResult.proposal_B, config]
  );

  const oddsCurrent = useMemo(
    () =>
      computeMatchOdds(
        match.team_1.total_power,
        match.team_2.total_power,
        config
      ),
    [match.team_1.total_power, match.team_2.total_power, config]
  );

  const activeOdds = activeTab === 'A' ? oddsA : activeTab === 'B' ? oddsB : oddsCurrent;

  const renderTeamRoster = (
    title: string,
    power: number,
    colorClass: string,
    gkId: string | null,
    outfieldIds: string[]
  ) => {
    const gk = gkId ? playerMap.get(gkId) : null;
    return (
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
            <h4 className="font-bold text-white text-sm">{title}</h4>
          </div>
          <div className="text-xs font-semibold text-slate-300">
            Forza Squadra: <span className="text-emerald-400 font-bold">{power.toFixed(1)}</span>
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
          {gk && (
            <div className="flex items-center justify-between bg-slate-900/90 px-3 py-2 rounded-xl border border-amber-500/30">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                  POR
                </span>
                <span className="font-semibold text-white">{gk.name}</span>
                {gk.nickname && (
                  <span className="text-slate-400 text-[11px]">({gk.nickname})</span>
                )}
              </div>
              <span className="text-amber-300 font-semibold text-[11px]">
                FUT Portiere {weightToFutStat(gk.weights.portiere)}
              </span>
            </div>
          )}

          {outfieldIds.map((id) => {
            const p = playerMap.get(id);
            if (!p) return null;
            const futOvr = getPlayerFutOverall(p);
            return (
              <div
                key={id}
                className="flex items-center justify-between bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800/70"
              >
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                    {p.computed.role_label}
                  </span>
                  <span className="font-medium text-white">{p.name}</span>
                  {p.nickname && (
                    <span className="text-slate-400 text-[11px]">({p.nickname})</span>
                  )}
                </div>
                <span className="text-slate-300 font-bold text-xs">
                  FUT {futOvr}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
      {/* Container Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] tracking-wider uppercase font-mono">
              Motore di Bilanciamento
            </span>
            <h3 className="text-lg font-display font-bold text-white">
              Proposte di Formazione & Bozza Partita
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Passa tra Proposta A (massimo equilibrio di forza), Proposta B (ruoli speculari) e la Bozza Corrente con scambi custom.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenInfoModal}
          className="px-3.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-white font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-sm"
        >
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          <span>Come Funziona il Bilanciamento?</span>
        </button>
      </div>

      {/* 3-Way Tab Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl">
        <button
          type="button"
          onClick={() => onTabChange('A')}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'A'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <span>Proposta A (Equilibrata)</span>
          {match.selected_solution === 'A' && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                activeTab === 'A'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              Attiva
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange('B')}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'B'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <span>Proposta B (Ruoli Speculari)</span>
          {match.selected_solution === 'B' && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                activeTab === 'B'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              Attiva
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange('CUSTOM')}
          className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'CUSTOM'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <span>Bozza Corrente / Custom</span>
          {match.selected_solution === 'CUSTOM' && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                activeTab === 'CUSTOM'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              Custom
            </span>
          )}
        </button>
      </div>

      {/* Dynamic Odds & Active Proposal Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span className="text-slate-400 font-medium">Quote Dinamiche Match:</span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold font-mono-tabular">
            1: {activeOdds['1'].toFixed(2)}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 font-bold font-mono-tabular">
            X: {activeOdds['X'].toFixed(2)}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 font-bold font-mono-tabular">
            2: {activeOdds['2'].toFixed(2)}
          </span>
        </div>

        <div>
          {activeTab === 'A' && (
            match.selected_solution === 'A' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                <Check className="w-3.5 h-3.5" /> Proposta A Attiva
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSelectProposal('A')}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors shadow-sm"
              >
                Applica Proposta A al Match
              </button>
            )
          )}

          {activeTab === 'B' && (
            match.selected_solution === 'B' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                <Check className="w-3.5 h-3.5" /> Proposta B Attiva
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSelectProposal('B')}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors shadow-sm"
              >
                Applica Proposta B al Match
              </button>
            )
          )}

          {activeTab === 'CUSTOM' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
              {match.selected_solution === 'CUSTOM'
                ? 'Formazione con Scambi Personalizzati'
                : `Bozza attiva basata su Proposta ${match.selected_solution}`}
            </span>
          )}
        </div>
      </div>

      {/* Tab Specific Content */}
      {activeTab === 'A' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              <strong className="text-white">Proposta A</strong>: Massima parità di forza complessiva tra le due squadre.
            </span>
            <span className="font-semibold text-emerald-400">
              Indice di Equilibrio: {engineResult.proposal_A.micro.balance_percentage}%
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderTeamRoster(
              'Squadra Gabry',
              engineResult.proposal_A.team_1.total_power,
              'bg-emerald-400',
              engineResult.proposal_A.team_1.gk_id,
              engineResult.proposal_A.team_1.outfield_ids
            )}
            {renderTeamRoster(
              'Squadra Piero',
              engineResult.proposal_A.team_2.total_power,
              'bg-sky-400',
              engineResult.proposal_A.team_2.gk_id,
              engineResult.proposal_A.team_2.outfield_ids
            )}
          </div>
        </div>
      )}

      {activeTab === 'B' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              <strong className="text-white">Proposta B</strong>: Privilegia la perfetta specularità dei ruoli (attaccanti e difensori).
            </span>
            <span className="font-semibold text-emerald-400">
              Indice di Equilibrio: {engineResult.proposal_B.micro.balance_percentage}%
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderTeamRoster(
              'Squadra Gabry',
              engineResult.proposal_B.team_1.total_power,
              'bg-emerald-400',
              engineResult.proposal_B.team_1.gk_id,
              engineResult.proposal_B.team_1.outfield_ids
            )}
            {renderTeamRoster(
              'Squadra Piero',
              engineResult.proposal_B.team_2.total_power,
              'bg-sky-400',
              engineResult.proposal_B.team_2.gk_id,
              engineResult.proposal_B.team_2.outfield_ids
            )}
          </div>
        </div>
      )}

      {activeTab === 'CUSTOM' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              <strong className="text-white">Bozza Corrente</strong>: Visualizza i giocatori attualmente schierati ed effettua scambi manuali.
            </span>
            <span className="text-slate-400">
              Stato: <strong className="text-white">{match.selected_solution}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderTeamRoster(
              'Squadra Gabry',
              match.team_1.total_power,
              'bg-emerald-400',
              match.team_1.gk_id,
              match.team_1.outfield_ids
            )}
            {renderTeamRoster(
              'Squadra Piero',
              match.team_2.total_power,
              'bg-sky-400',
              match.team_2.gk_id,
              match.team_2.outfield_ids
            )}
          </div>

          {/* Manual Swap Tool Embedded in Custom Tab */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
                  Scambio Manuale tra Giocatori (Squadra Gabry ↔ Squadra Piero)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Scambia qualsiasi giocatore tra le due formazioni. Le quote dinamiche si ricalcoleranno istantaneamente.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Seleziona giocatore Squadra 1 per swap"
                value={swapP1}
                onChange={(e) => setSwapP1(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400"
              >
                <option value="">Giocatore Squadra 1...</option>
                {team1AllIds.map((id) => {
                  const p = playerMap.get(id);
                  return (
                    <option key={id} value={id}>
                      G1: {p?.name ?? id} ({p?.wants_to_be_gk ? 'POR' : p?.computed.role_label})
                    </option>
                  );
                })}
              </select>

              <span className="text-slate-500 font-bold">↔</span>

              <select
                aria-label="Seleziona giocatore Squadra 2 per swap"
                value={swapP2}
                onChange={(e) => setSwapP2(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400"
              >
                <option value="">Giocatore Squadra 2...</option>
                {team2AllIds.map((id) => {
                  const p = playerMap.get(id);
                  return (
                    <option key={id} value={id}>
                      G2: {p?.name ?? id} ({p?.wants_to_be_gk ? 'POR' : p?.computed.role_label})
                    </option>
                  );
                })}
              </select>

              <button
                type="button"
                disabled={!swapP1 || !swapP2}
                onClick={onSwapSubmit}
                className="px-4 py-2 rounded-xl bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs cursor-pointer shadow-sm transition-colors"
              >
                Esegui Scambio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
