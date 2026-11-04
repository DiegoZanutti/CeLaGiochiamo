export type AuthStatus = 'UNCLAIMED' | 'PENDING_APPROVAL' | 'VALIDATED';
export type MatchStatus = 'DRAFT' | 'OPEN_FOR_BETS' | 'IN_PLAY' | 'VOTING_OPEN' | 'ARCHIVED';
export type RoleLabel = 'POR' | 'ATT' | 'TUT' | 'DIF';
export type RoleState = -1 | 0 | 1;
export type BetPick = '1' | 'X' | '2';
export type OutfieldAttrKey = 'tiro' | 'velocita' | 'passaggio' | 'resistenza' | 'difesa';
export type AllAttrKey = OutfieldAttrKey | 'portiere';

export interface PolarWeights {
  a: number; // default 0.50 (Primario: Tiro in Attacco, Difesa in Difesa)
  b: number; // default 0.25 (Atletico Dominante: Velocità in Attacco, Resistenza in Difesa)
  c: number; // default 0.10 (Atletico Secondario: Resistenza in Attacco, Velocità in Difesa)
  d: number; // default 0.15 (Regia: Passaggio sia in Attacco che in Difesa)

  // Coefficienti espliciti e indipendenti per Polo Attacco (S_A)
  attack_tiro?: number; // default 0.50
  attack_velocita?: number; // default 0.25
  attack_passaggio?: number; // default 0.15
  attack_resistenza?: number; // default 0.10

  // Coefficienti espliciti e indipendenti per Polo Difesa (S_D)
  defense_difesa?: number; // default 0.50
  defense_resistenza?: number; // default 0.25
  defense_passaggio?: number; // default 0.15
  defense_velocita?: number; // default 0.10
}

export interface MacroWeights {
  w1: number;
  w2: number;
  w3: number;
}

export interface MicroWeightsAlpha {
  a1: number; // default 2.0
  a2: number; // default 1.0
  a3: number; // default 0.5
  a4: number; // default 0.25
}

export interface BetOdds {
  '1': number;
  'X': number;
  '2': number;
}

export interface GlobalConfig {
  role_threshold_tau: number;
  polar_weights: PolarWeights;
  macro_weights_A: MacroWeights;
  macro_weights_B: MacroWeights;
  gk_multiplier_lambda: number;
  micro_weights_alpha: MicroWeightsAlpha;
  ema_learning_rate_eta: number;
  initial_tokens: number;
  attendance_reward_tokens: number;
  bet_odds: BetOdds;
  dynamic_odds_enabled?: boolean;
  dynamic_odds_sensitivity?: number;
  max_bet_amount?: number;
  active_match_id: string;
}

export interface PlayerWeights {
  tiro: number;
  velocita: number;
  passaggio: number;
  resistenza: number;
  difesa: number;
  portiere: number;
}

export interface PlayerComputed {
  overall: number; // M_i in [0, 1]
  delta_index: number; // delta_i in [-1, 1]
  role_state: RoleState; // -1, 0, +1
  role_label: RoleLabel; // 'POR' | 'ATT' | 'TUT' | 'DIF'
}

export interface AttrVotesCount {
  tiro: number;
  velocita: number;
  passaggio: number;
  resistenza: number;
  difesa: number;
  portiere: number;
}

export interface PlayerStats {
  tokens: number;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  bets_total: number;
  bets_won: number;
  bets_net_profit?: number;
  votes_completed_matches: number;
}

export interface Player {
  id: string;
  name: string;
  nickname?: string;
  avatar_url?: string;
  claimed_by_uid?: string;
  claim_status: AuthStatus;
  is_active: boolean;
  weights: PlayerWeights;
  wants_to_be_gk: boolean;
  computed: PlayerComputed;
  attr_votes_count: AttrVotesCount;
  stats: PlayerStats;
  initial_weights?: PlayerWeights;
}

export interface UserAccount {
  uid: string;
  email: string;
  display_name: string;
  linked_player_id: string;
  auth_status: AuthStatus;
  is_admin: boolean;
  created_at: number;
}

export interface TeamLineup {
  gk_id: string | null;
  outfield_ids: string[];
  total_power: number;
  avg_attrs: {
    tiro: number;
    velocita: number;
    passaggio: number;
    resistenza: number;
    difesa: number;
  };
  avg_delta?: number;
  variance_m?: number;
  role_counts?: {
    att: number;
    dif: number;
    tut: number;
  };
}

export interface MatchBet {
  pick: BetPick;
  amount: number;
  potential_payout: number;
  settled: boolean;
  status?: 'PENDING' | 'WON' | 'LOST';
}

export interface AnonymousAttrAccumulator {
  sum: number;
  count: number;
}

export interface VotingTracker {
  voters_completed_ids: string[];
  received_count_by_player: Record<string, number>;
  anonymous_accumulators: Record<string, Partial<Record<AllAttrKey, AnonymousAttrAccumulator>>>;
}

export interface MatchScore {
  team_1: number | null;
  team_2: number | null;
  winner: BetPick | null;
}

export interface Match {
  id: string;
  date_label: string;
  status: MatchStatus;
  convocati_ids: string[];
  active_gks_ids: string[];
  selected_solution: 'A' | 'B' | 'CUSTOM';
  team_1: TeamLineup;
  team_2: TeamLineup;
  score: MatchScore;
  odds: BetOdds;
  bets: Record<string, MatchBet>;
  voting_tracker: VotingTracker;
}

// Analytical structures returned by the 3-Stage Mathematical Engine
export interface AnalyticalPlayerSheet {
  player: Player;
  M_i: number;
  S_A: number;
  S_D: number;
  delta_i: number;
  C_i: RoleState;
  assigned_match_role: 'GK_ACTIVE' | 'ATT' | 'TUT' | 'DIF';
  was_excess_gk_converted: boolean;
}

export interface MacroPartitionMetrics {
  p1: number;
  n1: number;
  z1: number;
  p2: number;
  n2: number;
  z2: number;
  J_alg: number;
  J_diff: number;
  H_tot: number;
  cost_A: number;
  cost_B: number;
}

export interface MicroForceMetrics {
  Phi_tot: number;
  Phi_attr: number;
  Phi_delta: number;
  Phi_var: number;
  L_forza: number;
  balance_percentage: number;
}

export interface BalancingProposal {
  id: 'A' | 'B';
  title: string;
  subtitle: string;
  macro: MacroPartitionMetrics;
  micro: MicroForceMetrics;
  team_1: TeamLineup;
  team_2: TeamLineup;
}

export interface BalancingEngineResult {
  analytical_sheets: AnalyticalPlayerSheet[];
  active_gks_ids: string[];
  excess_gks_ids: string[];
  pool_counts: { N_P: number; N_N: number; N_0: number; K: number };
  proposal_A: BalancingProposal;
  proposal_B: BalancingProposal;
  coinciding_macro_partitions: boolean;
}

export interface VotingQuestion {
  target_player_id: string;
  target_player_name: string;
  is_active_gk_in_match: boolean;
  attribute: AllAttrKey;
  attribute_label: string;
  question_text: string;
}
