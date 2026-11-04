import {
  AllAttrKey,
  BetPick,
  GlobalConfig,
  Match,
  MatchStatus,
  Player,
  PlayerWeights,
  UserAccount,
} from '../types/models';
import {
  computeMatchOdds,
  computePlayerMetrics,
  generateFairQuestionnaire,
  runThreeStageBalancingEngine,
} from '../engine/mathEngine';

export type DatabaseEnvironment = 'TEST_DB' | 'PRODUCTION_DB';

export function getResolvedDatabaseEnvironment(): DatabaseEnvironment {
  // 1. Check URL query params: ?env=production or ?env=test
  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlEnv = params.get('env');
      if (urlEnv) {
        const lower = urlEnv.toLowerCase();
        if (lower === 'production' || lower === 'prod') {
          localStorage.setItem('calcetto_forced_db_env', 'production');
          return 'PRODUCTION_DB';
        }
        if (lower === 'test') {
          localStorage.setItem('calcetto_forced_db_env', 'test');
          return 'TEST_DB';
        }
      }
    } catch {}
  }

  // 2. Check localStorage override if user toggled in UI
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('calcetto_forced_db_env');
      if (stored === 'production' || stored === 'prod') return 'PRODUCTION_DB';
      if (stored === 'test') return 'TEST_DB';
    } catch {}
  }

  // 3. Fallback to Vite env variable (VITE_APP_ENV)
  const envVal = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_ENV) || '';
  if (envVal.toLowerCase() === 'production' || envVal.toLowerCase() === 'prod') {
    return 'PRODUCTION_DB';
  }
  return 'TEST_DB';
}

export function setClientDatabaseEnvironment(env: 'production' | 'test' | 'default'): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (env === 'default') {
      localStorage.removeItem('calcetto_forced_db_env');
    } else {
      localStorage.setItem('calcetto_forced_db_env', env);
    }
  } catch {}
}

function normalizeEmailAddress(email: string): string {
  const cleaned = email.trim().toLowerCase();
  if (!cleaned) return '';
  if (!cleaned.includes('@') && cleaned.endsWith('.gmail.com')) {
    return `${cleaned.slice(0, -'.gmail.com'.length)}@gmail.com`;
  }
  return cleaned;
}

export function getResolvedDirettoriEmails(): string[] {
  const raw = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DIRETTORE_EMAIL) || '';
  return raw
    .split(/[,;\s]+/)
    .map((e: string) => normalizeEmailAddress(e))
    .filter(Boolean);
}

export function isUserEmailDirettore(email?: string | null): boolean {
  if (!email) return false;
  const normalized = normalizeEmailAddress(email);
  if (!normalized) return false;
  return getResolvedDirettoriEmails().includes(normalized);
}

export function getResolvedDirettoreEmail(): string {
  return getResolvedDirettoriEmails()[0] || '';
}

export type TestScenarioId =
  | 'ASYMMETRIC_POOL'
  | 'SYMMETRIC_POOL'
  | 'SINGLE_GK_COMPENSATION'
  | 'VOTING_EMA_STRESS'
  | 'EMPTY_CLEAN_SLATE';

export interface TestDatabaseSnapshot {
  scenarioId: TestScenarioId;
  config: GlobalConfig;
  players: Player[];
  users: UserAccount[];
  match: Match;
}

export interface TestScenarioDescriptor {
  id: TestScenarioId;
  title: string;
  subtitle: string;
  initialMatchStatus: MatchStatus;
  highlights: string[];
}

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  role_threshold_tau: 0.2,
  polar_weights: {
    a: 0.5,
    b: 0.25,
    c: 0.1,
    d: 0.15,
    attack_tiro: 0.5,
    attack_velocita: 0.25,
    attack_passaggio: 0.15,
    attack_resistenza: 0.1,
    defense_difesa: 0.5,
    defense_resistenza: 0.25,
    defense_passaggio: 0.15,
    defense_velocita: 0.1,
  },
  macro_weights_A: { w1: 1.0, w2: 2.0, w3: 0.1 },
  macro_weights_B: { w1: 3.0, w2: 1.0, w3: 0.1 },
  gk_multiplier_lambda: 1.0,
  micro_weights_alpha: { a1: 2.0, a2: 1.0, a3: 0.5, a4: 0.25 },
  ema_learning_rate_eta: 0.15,
  initial_tokens: 100,
  attendance_reward_tokens: 50,
  bet_odds: { '1': 1.85, 'X': 3.5, '2': 1.85 },
  dynamic_odds_enabled: true,
  dynamic_odds_sensitivity: 0.5,
  max_bet_amount: 500,
  active_match_id: 'match_test_active',
};

export const TEST_SCENARIOS: TestScenarioDescriptor[] = [
  {
    id: 'ASYMMETRIC_POOL',
    title: 'Scenario 1 — Pool Asimmetrico (1 ATT, 3 DIF, 4 TUT + 2 GK)',
    subtitle:
      'Divergenza netta nello Stadio II tra Soluzione A (Simmetria: 1-1-2 vs 0-2-2) e Soluzione B (Compensazione: 1-2-1 vs 0-1-3).',
    initialMatchStatus: 'OPEN_FOR_BETS',
    highlights: [
      '14 giocatori nel DB di Test (10 convocati + 4 non convocati tra cui 3° portiere e profili da rivendicare)',
      'Match in stato OPEN_FOR_BETS pronto per collaudare scommesse 1X2 e confronto moduli A vs B',
      '1 richiesta PENDING_APPROVAL pronta in coda nel Backoffice Admin',
    ],
  },
  {
    id: 'SYMMETRIC_POOL',
    title: 'Scenario 2 — Pool Perfettamente Simmetrico (2 ATT, 2 DIF, 4 TUT + 2 GK)',
    subtitle:
      'Testa la regola speciale dello Stadio III quando le partizioni di ruolo A e B coincidono in (1, 1, 2) vs (1, 1, 2).',
    initialMatchStatus: 'DRAFT',
    highlights: [
      'Il motore restituisce la 1ª e la 2ª miglior allocazione micro-forza MIQP per lo stesso modulo speculare',
      'Match in stato DRAFT per testare il selettore dei 10 convocati e lo swap manuale',
    ],
  },
  {
    id: 'SINGLE_GK_COMPENSATION',
    title: 'Scenario 3 — Singolo Portiere di Ruolo (K = 1, m1 = 4, m2 = 5)',
    subtitle:
      'Testa la compensazione automatica Φ_tot quando una sola squadra ha il portiere attivo e l’altra gioca con 5 giocatori di movimento.',
    initialMatchStatus: 'DRAFT',
    highlights: [
      'Solo 1 portiere candidato (K = 1) tra i 10 convocati',
      'Verifica come Φ_tot assegni giocatori di movimento con Overall M_i superiore alla squadra priva di portiere di ruolo',
    ],
  },
  {
    id: 'VOTING_EMA_STRESS',
    title: 'Scenario 4 — Stress Test Votazioni Anonime & Consolidamento EMA',
    subtitle:
      'Match appena terminato (Risultato 6-5, stato VOTING_OPEN) con scommesse già liquidate e finestra di voto aperta.',
    initialMatchStatus: 'VOTING_OPEN',
    highlights: [
      'Permette di testare subito il questionario a 5 domande Least-Voted First e l’accredito di +50 Token Presenza',
      'Pronto per testare il pulsante "Consolida Voti (EMA) e Archivia Match" verificando l’evoluzione delle Carte FUT',
    ],
  },
  {
    id: 'EMPTY_CLEAN_SLATE',
    title: 'Scenario 5 — Database Pulito (Setup Iniziale Stagione)',
    subtitle:
      'Rosa con 10 giocatori base a statistiche azzerate (0 presenze, 100 Token iniziali) e match in stato DRAFT.',
    initialMatchStatus: 'DRAFT',
    highlights: [
      'Ideale per simulare l’inizio della stagione da zero (0 scommesse, 0 partite giocate, 0 voti storici)',
    ],
  },
];

interface PlayerBlueprint {
  id: string;
  name: string;
  nickname?: string;
  claimed_by_uid: string;
  claim_status: 'UNCLAIMED' | 'PENDING_APPROVAL' | 'VALIDATED';
  wants_to_be_gk: boolean;
  weights: PlayerWeights;
  votesCount?: number;
  tokens?: number;
  played?: number;
  won?: number;
  betsTotal?: number;
  betsWon?: number;
  netProfit?: number;
}

function createPlayerEntity(
  bp: PlayerBlueprint,
  config: GlobalConfig,
  zeroStats = false
): Player {
  const m = computePlayerMetrics(bp.weights, bp.wants_to_be_gk, config);
  const baseVotes = zeroStats ? 0 : bp.votesCount ?? 8;

  return {
    id: bp.id,
    name: bp.name,
    ...(bp.nickname ? { nickname: bp.nickname } : {}),
    avatar_url: '',
    claimed_by_uid: bp.claimed_by_uid,
    claim_status: bp.claim_status,
    is_active: true,
    weights: { ...bp.weights },
    wants_to_be_gk: bp.wants_to_be_gk,
    computed: m.computed,
    attr_votes_count: {
      tiro: baseVotes,
      velocita: baseVotes,
      passaggio: baseVotes + (zeroStats ? 0 : 1),
      resistenza: baseVotes,
      difesa: Math.max(0, baseVotes - (zeroStats ? 0 : 1)),
      portiere: bp.wants_to_be_gk ? baseVotes + (zeroStats ? 0 : 4) : 0,
    },
    stats: {
      tokens: zeroStats
        ? bp.claim_status === 'VALIDATED'
          ? config.initial_tokens
          : 0
        : bp.tokens ?? 200,
      matches_played: zeroStats ? 0 : bp.played ?? 12,
      matches_won: zeroStats ? 0 : bp.won ?? 6,
      matches_drawn: zeroStats ? 0 : 1,
      bets_total: zeroStats ? 0 : bp.betsTotal ?? 10,
      bets_won: zeroStats ? 0 : bp.betsWon ?? 5,
      bets_net_profit: zeroStats ? 0 : bp.netProfit ?? 20,
      votes_completed_matches: zeroStats ? 0 : bp.played ?? 12,
    },
  };
}

const BASE_BLUEPRINTS: PlayerBlueprint[] = [
  {
    id: 'player_gigi',
    name: 'Gigi',
    nickname: 'Superman',
    claimed_by_uid: 'uid_gigi',
    claim_status: 'VALIDATED',
    wants_to_be_gk: true,
    weights: { tiro: 0.35, velocita: 0.48, passaggio: 0.58, resistenza: 0.55, difesa: 0.68, portiere: 0.88 },
    tokens: 310,
    played: 19,
    won: 12,
    betsTotal: 16,
    betsWon: 10,
    netProfit: 115,
  },
  {
    id: 'player_samir',
    name: 'Samir',
    nickname: 'La Saracinesca',
    claimed_by_uid: 'uid_samir',
    claim_status: 'VALIDATED',
    wants_to_be_gk: true,
    weights: { tiro: 0.32, velocita: 0.45, passaggio: 0.54, resistenza: 0.52, difesa: 0.64, portiere: 0.83 },
    tokens: 225,
    played: 17,
    won: 9,
    betsTotal: 14,
    betsWon: 7,
    netProfit: 35,
  },
  {
    id: 'player_marco',
    name: 'Marco',
    nickname: 'Il Bomber',
    claimed_by_uid: 'uid_admin_diego',
    claim_status: 'VALIDATED',
    wants_to_be_gk: false,
    weights: { tiro: 0.86, velocita: 0.84, passaggio: 0.72, resistenza: 0.68, difesa: 0.32, portiere: 0.2 },
    tokens: 280,
    played: 18,
    won: 11,
    betsTotal: 15,
    betsWon: 11,
    netProfit: 145,
  },
  {
    id: 'player_giorgio',
    name: 'Giorgio',
    nickname: 'Il Muro',
    claimed_by_uid: 'uid_giorgio',
    claim_status: 'VALIDATED',
    wants_to_be_gk: false,
    weights: { tiro: 0.28, velocita: 0.58, passaggio: 0.64, resistenza: 0.84, difesa: 0.9, portiere: 0.35 },
    tokens: 390,
    played: 20,
    won: 13,
    betsTotal: 18,
    betsWon: 12,
    netProfit: 190,
  },
  {
    id: 'player_paolo',
    name: 'Paolo',
    nickname: 'La Roccia',
    claimed_by_uid: 'uid_paolo',
    claim_status: 'VALIDATED',
    wants_to_be_gk: false,
    weights: { tiro: 0.3, velocita: 0.62, passaggio: 0.66, resistenza: 0.8, difesa: 0.86, portiere: 0.25 },
    tokens: 175,
    played: 16,
    won: 9,
    betsTotal: 12,
    betsWon: 6,
    netProfit: -15,
  },
  {
    id: 'player_leonardo',
    name: 'Leonardo',
    nickname: 'Il Mastino',
    claimed_by_uid: 'uid_leonardo',
    claim_status: 'VALIDATED',
    wants_to_be_gk: false,
    weights: { tiro: 0.26, velocita: 0.54, passaggio: 0.6, resistenza: 0.78, difesa: 0.84, portiere: 0.3 },
    tokens: 140,
    played: 15,
    won: 7,
    betsTotal: 14,
    betsWon: 5,
    netProfit: -40,
  },
  {
    id: 'player_nicolo',
    name: 'Nicolò',
    nickname: 'Il Diez',
    claimed_by_uid: 'uid_nicolo',
    claim_status: 'VALIDATED',
    wants_to_be_gk: false,
    weights: { tiro: 0.72, velocita: 0.76, passaggio: 0.84, resistenza: 0.82, difesa: 0.68, portiere: 0.2 },
    tokens: 420,
    played: 19,
    won: 14,
    betsTotal: 17,
    betsWon: 11,
    netProfit: 210,
  },
  {
    id: 'player_sandro',
    name: 'Sandro',
    nickname: 'Il Capitano',
    claimed_by_uid: 'uid_sandro',
    claim_status: 'VALIDATED',
    wants_to_be_gk: false,
    weights: { tiro: 0.66, velocita: 0.7, passaggio: 0.75, resistenza: 0.78, difesa: 0.64, portiere: 0.22 },
    tokens: 195,
    played: 16,
    won: 8,
    betsTotal: 10,
    betsWon: 6,
    netProfit: 25,
  },
  {
    id: 'player_claudio',
    name: 'Claudio',
    nickname: 'Il Metronomo',
    claimed_by_uid: 'uid_claudio',
    claim_status: 'VALIDATED',
    wants_to_be_gk: false,
    weights: { tiro: 0.68, velocita: 0.68, passaggio: 0.78, resistenza: 0.7, difesa: 0.62, portiere: 0.18 },
    tokens: 160,
    played: 14,
    won: 7,
    betsTotal: 11,
    betsWon: 5,
    netProfit: -10,
  },
  {
    id: 'player_matteo',
    name: 'Matteo',
    nickname: 'Tuttofare',
    claimed_by_uid: 'uid_matteo',
    claim_status: 'VALIDATED',
    wants_to_be_gk: false,
    weights: { tiro: 0.62, velocita: 0.66, passaggio: 0.7, resistenza: 0.72, difesa: 0.64, portiere: 0.25 },
    tokens: 90,
    played: 13,
    won: 6,
    betsTotal: 12,
    betsWon: 4,
    netProfit: -55,
  },
  {
    id: 'player_federico',
    name: 'Federico',
    claimed_by_uid: 'uid_federico',
    claim_status: 'VALIDATED',
    wants_to_be_gk: false,
    weights: { tiro: 0.85, velocita: 0.88, passaggio: 0.66, resistenza: 0.68, difesa: 0.3, portiere: 0.15 },
    tokens: 210,
    played: 12,
    won: 8,
    betsTotal: 9,
    betsWon: 6,
    netProfit: 60,
  },
  {
    id: 'player_davide',
    name: 'Davide',
    claimed_by_uid: 'uid_pending_davide',
    claim_status: 'PENDING_APPROVAL',
    wants_to_be_gk: false,
    weights: { tiro: 0.74, velocita: 0.72, passaggio: 0.68, resistenza: 0.64, difesa: 0.4, portiere: 0.2 },
    tokens: 0,
    played: 6,
    won: 3,
    betsTotal: 0,
    betsWon: 0,
    netProfit: 0,
  },
  {
    id: 'player_alessandro',
    name: 'Alessandro',
    claimed_by_uid: '',
    claim_status: 'UNCLAIMED',
    wants_to_be_gk: false,
    weights: { tiro: 0.78, velocita: 0.75, passaggio: 0.82, resistenza: 0.62, difesa: 0.38, portiere: 0.15 },
    tokens: 0,
    played: 8,
    won: 4,
    betsTotal: 0,
    betsWon: 0,
    netProfit: 0,
  },
  {
    id: 'player_simone',
    name: 'Simone (3° GK)',
    claimed_by_uid: '',
    claim_status: 'UNCLAIMED',
    wants_to_be_gk: true,
    weights: { tiro: 0.55, velocita: 0.6, passaggio: 0.62, resistenza: 0.65, difesa: 0.58, portiere: 0.64 },
    tokens: 0,
    played: 5,
    won: 2,
    betsTotal: 0,
    betsWon: 0,
    netProfit: 0,
  },
];

export function buildTestUsers(): UserAccount[] {
  return [
    {
      uid: 'uid_admin_diego',
      email: getResolvedDirettoreEmail() || 'direttore@calcetto-test.it',
      display_name: 'Il Direttore (Admin / Marco)',
      linked_player_id: 'player_marco',
      auth_status: 'VALIDATED',
      is_admin: true,
      created_at: 1730000000000,
    },
    {
      uid: 'uid_nicolo',
      email: 'nicolo@calcetto-test.it',
      display_name: 'Nicolò (Giocatore Validato)',
      linked_player_id: 'player_nicolo',
      auth_status: 'VALIDATED',
      is_admin: false,
      created_at: 1730000100000,
    },
    {
      uid: 'uid_pending_davide',
      email: 'davide@calcetto-test.it',
      display_name: 'Davide (In Attesa Approvazione)',
      linked_player_id: 'player_davide',
      auth_status: 'PENDING_APPROVAL',
      is_admin: false,
      created_at: 1730050000000,
    },
    {
      uid: 'uid_unclaimed_guest',
      email: 'ospite@calcetto-test.it',
      display_name: 'Nuovo Utente Non Associato',
      linked_player_id: '',
      auth_status: 'UNCLAIMED',
      is_admin: false,
      created_at: 1730080000000,
    },
  ];
}

/**
 * Dynamically builds a complete 4-collection Test Database Snapshot for a given scenario.
 */
export function buildTestDatabaseSnapshot(
  scenarioId: TestScenarioId = 'ASYMMETRIC_POOL'
): TestDatabaseSnapshot {
  const zeroStats = scenarioId === 'EMPTY_CLEAN_SLATE';
  const matchId = `match_test_${scenarioId.toLowerCase()}`;
  const config: GlobalConfig = {
    ...DEFAULT_GLOBAL_CONFIG,
    active_match_id: matchId,
  };

  const players = BASE_BLUEPRINTS.map((bp) =>
    createPlayerEntity(bp, config, zeroStats)
  );
  const users = buildTestUsers();

  let convocatiIds: string[] = [
    'player_gigi',
    'player_samir',
    'player_marco',
    'player_giorgio',
    'player_paolo',
    'player_leonardo',
    'player_nicolo',
    'player_sandro',
    'player_claudio',
    'player_matteo',
  ];

  if (scenarioId === 'SYMMETRIC_POOL') {
    // Replace 1 DIF (player_leonardo) with 1 ATT (player_federico) -> 2 GK, 2 ATT, 2 DIF, 4 TUT
    convocatiIds = [
      'player_gigi',
      'player_samir',
      'player_marco',
      'player_federico',
      'player_giorgio',
      'player_paolo',
      'player_nicolo',
      'player_sandro',
      'player_claudio',
      'player_matteo',
    ];
  } else if (scenarioId === 'SINGLE_GK_COMPENSATION') {
    // Replace 2nd GK (player_samir) with outfield ATT (player_federico) -> K = 1 GK + 9 Outfield
    convocatiIds = [
      'player_gigi',
      'player_federico',
      'player_marco',
      'player_giorgio',
      'player_paolo',
      'player_leonardo',
      'player_nicolo',
      'player_sandro',
      'player_claudio',
      'player_matteo',
    ];
  }

  const convocatiPlayers = players.filter((p) => convocatiIds.includes(p.id));
  const engineRes = runThreeStageBalancingEngine(convocatiPlayers, config);

  const receivedCount: Record<string, number> = {};
  for (const id of convocatiIds) {
    receivedCount[id] = scenarioId === 'VOTING_EMA_STRESS' ? 1 : 0;
  }

  const isVotingScenario = scenarioId === 'VOTING_EMA_STRESS';
  const status: MatchStatus =
    scenarioId === 'ASYMMETRIC_POOL'
      ? 'OPEN_FOR_BETS'
      : isVotingScenario
        ? 'VOTING_OPEN'
        : 'DRAFT';

  const match: Match = {
    id: matchId,
    date_label: `Test Match (${scenarioId}) — Giovedì Ore 21:00`,
    status,
    convocati_ids: convocatiIds,
    active_gks_ids: engineRes.active_gks_ids,
    selected_solution: 'A',
    team_1: engineRes.proposal_A.team_1,
    team_2: engineRes.proposal_A.team_2,
    score: isVotingScenario
      ? { team_1: 6, team_2: 5, winner: '1' }
      : { team_1: null, team_2: null, winner: null },
    odds: computeMatchOdds(
      engineRes.proposal_A.team_1.total_power,
      engineRes.proposal_A.team_2.total_power,
      config
    ),
    bets:
      zeroStats || status === 'DRAFT'
        ? {}
        : {
            player_giorgio: {
              pick: '1',
              amount: 40,
              potential_payout: 74,
              settled: isVotingScenario,
              status: isVotingScenario ? 'WON' : 'PENDING',
            },
            player_nicolo: {
              pick: '2',
              amount: 50,
              potential_payout: 93,
              settled: isVotingScenario,
              status: isVotingScenario ? 'LOST' : 'PENDING',
            },
            player_gigi: {
              pick: 'X',
              amount: 20,
              potential_payout: 70,
              settled: isVotingScenario,
              status: isVotingScenario ? 'LOST' : 'PENDING',
            },
          },
    voting_tracker: {
      voters_completed_ids: isVotingScenario
        ? ['player_gigi', 'player_giorgio']
        : [],
      received_count_by_player: receivedCount,
      anonymous_accumulators: isVotingScenario
        ? {
            player_gigi: { portiere: { sum: 8.5, count: 1 } },
            player_samir: { portiere: { sum: 7.5, count: 1 } },
            player_marco: { difesa: { sum: 7.5, count: 1 } },
            player_giorgio: { tiro: { sum: 6.5, count: 1 } },
            player_paolo: { tiro: { sum: 7.0, count: 1 } },
            player_leonardo: { tiro: { sum: 6.5, count: 1 } },
            player_nicolo: { tiro: { sum: 8.5, count: 1 } },
            player_sandro: { velocita: { sum: 7.5, count: 1 } },
            player_claudio: { resistenza: { sum: 7.5, count: 1 } },
            player_matteo: { passaggio: { sum: 7.0, count: 1 } },
          }
        : {},
    },
  };

  return {
    scenarioId,
    config,
    players,
    users,
    match,
  };
}

/**
 * Helper for Test Environment: Simulates 1X2 bets from all validated players who haven't bet yet.
 */
export function simulateBulkBetsOnSnapshot(
  players: Player[],
  match: Match
): { updatedPlayers: Player[]; updatedMatch: Match; countAdded: number } {
  const picks: BetPick[] = ['1', 'X', '2'];
  const newBets = { ...match.bets };
  let countAdded = 0;

  const updatedPlayers = players.map((p, idx) => {
    if (
      p.claim_status !== 'VALIDATED' ||
      newBets[p.id] ||
      p.stats.tokens < 15
    ) {
      return p;
    }
    const pick = picks[idx % 3];
    const stake = Math.min(30, Math.max(10, Math.floor(p.stats.tokens * 0.15)));
    const payout = Math.round(stake * match.odds[pick]);

    newBets[p.id] = {
      pick,
      amount: stake,
      potential_payout: payout,
      settled: false,
      status: 'PENDING',
    };
    countAdded += 1;

    return {
      ...p,
      stats: {
        ...p.stats,
        tokens: p.stats.tokens - stake,
      },
    };
  });

  return {
    updatedPlayers,
    updatedMatch: { ...match, bets: newBets },
    countAdded,
  };
}

/**
 * Helper for Test Environment: Simulates the Least-Voted First questionnaire for all remaining convocati.
 */
export function simulateBulkVotesOnSnapshot(
  players: Player[],
  match: Match,
  config: GlobalConfig
): { updatedPlayers: Player[]; updatedMatch: Match; votersAdded: number } {
  let workingMatch: Match = JSON.parse(JSON.stringify(match));
  let workingPlayers: Player[] = JSON.parse(JSON.stringify(players));
  let votersAdded = 0;

  for (const voterId of workingMatch.convocati_ids) {
    if (workingMatch.voting_tracker.voters_completed_ids.includes(voterId)) {
      continue;
    }

    const questions = generateFairQuestionnaire(
      voterId,
      workingMatch,
      workingPlayers
    );

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      // Deterministic realistic vote between 6.5 and 8.5
      const grade = 6.5 + ((i + votersAdded) % 5) * 0.5;
      workingMatch.voting_tracker.received_count_by_player[q.target_player_id] =
        (workingMatch.voting_tracker.received_count_by_player[
          q.target_player_id
        ] ?? 0) + 1;

      if (!workingMatch.voting_tracker.anonymous_accumulators[q.target_player_id]) {
        workingMatch.voting_tracker.anonymous_accumulators[q.target_player_id] = {};
      }
      const prev = workingMatch.voting_tracker.anonymous_accumulators[
        q.target_player_id
      ][q.attribute as AllAttrKey] ?? { sum: 0, count: 0 };

      workingMatch.voting_tracker.anonymous_accumulators[q.target_player_id][
        q.attribute as AllAttrKey
      ] = {
        sum: Number((prev.sum + grade).toFixed(2)),
        count: prev.count + 1,
      };
    }

    workingMatch.voting_tracker.voters_completed_ids.push(voterId);
    votersAdded += 1;

    workingPlayers = workingPlayers.map((p) =>
      p.id === voterId
        ? {
            ...p,
            stats: {
              ...p.stats,
              tokens: p.stats.tokens + config.attendance_reward_tokens,
              votes_completed_matches: p.stats.votes_completed_matches + 1,
            },
          }
        : p
    );
  }

  return {
    updatedPlayers: workingPlayers,
    updatedMatch: workingMatch,
    votersAdded,
  };
}
