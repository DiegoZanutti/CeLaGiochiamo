import {
  AllAttrKey,
  AnalyticalPlayerSheet,
  BalancingEngineResult,
  BalancingProposal,
  BetOdds,
  BetPick,
  GlobalConfig,
  MacroPartitionMetrics,
  Match,
  MicroForceMetrics,
  OutfieldAttrKey,
  Player,
  PlayerComputed,
  PlayerWeights,
  RoleLabel,
  RoleState,
  TeamLineup,
  VotingQuestion,
} from '../types/models';

export const OUTFIELD_ATTRS: OutfieldAttrKey[] = [
  'tiro',
  'velocita',
  'passaggio',
  'resistenza',
  'difesa',
];

export const ATTR_LABELS: Record<AllAttrKey, string> = {
  tiro: 'Tiro',
  velocita: 'Velocità',
  passaggio: 'Passaggio',
  resistenza: 'Resistenza',
  difesa: 'Difesa',
  portiere: 'Portiere',
};

export const ATTR_SHORT_LABELS: Record<AllAttrKey, string> = {
  tiro: 'TIR',
  velocita: 'VEL',
  passaggio: 'PAS',
  resistenza: 'RES',
  difesa: 'DIF',
  portiere: 'POR',
};

/**
 * Clips a value to [min, max].
 */
export function clip(val: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Modulo 05 (4.1): Mappatura Matematica su Scala FUT [40, 99]
 * Stat_FUT(w) = round(40 + 59 * w)
 */
export function weightToFutStat(w: number): number {
  const clamped = clip(w, 0, 1);
  return Math.round(40 + 59 * clamped);
}

/**
 * Inverse mapping from FUT stat [40, 99] to weight [0, 1].
 */
export function futStatToWeight(futStat: number): number {
  return Number(clip((futStat - 40) / 59, 0, 1).toFixed(4));
}

/**
 * Modulo 05 (4.2): Overall FUT e Tier Estetico della Card
 */
export function getPlayerFutOverall(player: Player): number {
  const moveOvr = weightToFutStat(player.computed.overall);
  if (player.wants_to_be_gk) {
    const gkOvr = weightToFutStat(player.weights.portiere);
    return Math.max(moveOvr, gkOvr);
  }
  return moveOvr;
}

export type FutCardTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'SPECIAL';

export function getFutCardTier(ovr: number): FutCardTier {
  if (ovr < 65) return 'BRONZE';
  if (ovr < 75) return 'SILVER';
  if (ovr < 85) return 'GOLD';
  return 'SPECIAL';
}

/**
 * Modulo 02 (1.1, 2.2, 2.3): Calcolo Overall M_i, Poli S_A, S_D, Indice delta_i e Ruolo C_i
 */
export function computePlayerMetrics(
  weights: PlayerWeights,
  wantsToBeGk: boolean,
  config: Pick<GlobalConfig, 'polar_weights' | 'role_threshold_tau'>
): {
  M_i: number;
  S_A: number;
  S_D: number;
  delta_i: number;
  C_i: RoleState;
  computed: PlayerComputed;
} {
  const { tiro: wT, velocita: wV, passaggio: wP, resistenza: wR, difesa: wD } = weights;
  const pw = config.polar_weights;
  const tau = config.role_threshold_tau;

  // Coefficienti di affinità offensiva (S_A)
  const wAttT = pw.attack_tiro ?? pw.a ?? 0.50;
  const wAttV = pw.attack_velocita ?? pw.b ?? 0.25;
  const wAttP = pw.attack_passaggio ?? pw.d ?? 0.15;
  const wAttR = pw.attack_resistenza ?? pw.c ?? 0.10;

  // Coefficienti di affinità difensiva (S_D)
  const wDifD = pw.defense_difesa ?? pw.a ?? 0.50;
  const wDifR = pw.defense_resistenza ?? pw.b ?? 0.25;
  const wDifP = pw.defense_passaggio ?? pw.d ?? 0.15;
  const wDifV = pw.defense_velocita ?? pw.c ?? 0.10;

  const M_i = (wT + wV + wP + wR + wD) / 5;

  const S_A = wAttT * wT + wAttV * wV + wAttP * wP + wAttR * wR;
  const S_D = wDifD * wD + wDifR * wR + wDifP * wP + wDifV * wV;

  const denom = S_A + S_D;
  const delta_i = denom === 0 ? 0 : clip((S_A - S_D) / denom, -1, 1);

  let C_i: RoleState = 0;
  if (delta_i > tau) {
    C_i = 1;
  } else if (delta_i < -tau) {
    C_i = -1;
  } else {
    C_i = 0;
  }

  let role_label: RoleLabel = 'TUT';
  if (wantsToBeGk) {
    role_label = 'POR';
  } else if (C_i === 1) {
    role_label = 'ATT';
  } else if (C_i === -1) {
    role_label = 'DIF';
  } else {
    role_label = 'TUT';
  }

  return {
    M_i: Number(M_i.toFixed(4)),
    S_A: Number(S_A.toFixed(4)),
    S_D: Number(S_D.toFixed(4)),
    delta_i: Number(delta_i.toFixed(4)),
    C_i,
    computed: {
      overall: Number(M_i.toFixed(4)),
      delta_index: Number(delta_i.toFixed(4)),
      role_state: C_i,
      role_label,
    },
  };
}

/**
 * Helper to generate all k-combinations of an array.
 */
function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k < 0 || k > arr.length) return [];
  if (k === arr.length) return [arr.slice()];

  const results: T[][] = [];
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      results.push(current.slice());
      return;
    }
    for (let i = start; i <= arr.length - (k - current.length); i++) {
      current.push(arr[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return results;
}

/**
 * Shannon Entropy helper: - sum_{t in {p,n,z}} (t/m) * log2(t/m), with 0*log2(0) = 0
 */
function teamRoleEntropy(p: number, n: number, z: number, m: number): number {
  if (m <= 0) return 0;
  let h = 0;
  for (const t of [p, n, z]) {
    if (t > 0) {
      const prob = t / m;
      h -= prob * Math.log2(prob);
    }
  }
  return h;
}

/**
 * Computes team lineup and micro force metrics for a given assignment of G1 and G2.
 */
export function evaluateTeamSplit(
  g1Gk: AnalyticalPlayerSheet | null,
  g2Gk: AnalyticalPlayerSheet | null,
  g1Outfield: AnalyticalPlayerSheet[],
  g2Outfield: AnalyticalPlayerSheet[],
  config: GlobalConfig
): {
  team_1: TeamLineup;
  team_2: TeamLineup;
  micro: MicroForceMetrics;
} {
  const lambdaGk = config.gk_multiplier_lambda;
  const { a1, a2, a3, a4 } = config.micro_weights_alpha;

  const m1 = g1Outfield.length;
  const m2 = g2Outfield.length;

  // 1. Total Power F^(1) and F^(2)
  const sumM1 = g1Outfield.reduce((acc, s) => acc + s.M_i, 0);
  const sumM2 = g2Outfield.reduce((acc, s) => acc + s.M_i, 0);
  const gkPower1 = g1Gk ? lambdaGk * g1Gk.player.weights.portiere : 0;
  const gkPower2 = g2Gk ? lambdaGk * g2Gk.player.weights.portiere : 0;

  const F1 = sumM1 + gkPower1;
  const F2 = sumM2 + gkPower2;
  const Phi_tot = Math.pow(F1 - F2, 2);

  // 2. Vectorial Balance on the 5 Fundamentals (Phi_attr)
  const avgAttrs1: Record<OutfieldAttrKey, number> = {
    tiro: 0,
    velocita: 0,
    passaggio: 0,
    resistenza: 0,
    difesa: 0,
  };
  const avgAttrs2: Record<OutfieldAttrKey, number> = {
    tiro: 0,
    velocita: 0,
    passaggio: 0,
    resistenza: 0,
    difesa: 0,
  };

  let Phi_attr = 0;
  for (const attr of OUTFIELD_ATTRS) {
    const w1 =
      m1 > 0
        ? g1Outfield.reduce((acc, s) => acc + s.player.weights[attr], 0) / m1
        : 0;
    const w2 =
      m2 > 0
        ? g2Outfield.reduce((acc, s) => acc + s.player.weights[attr], 0) / m2
        : 0;
    avgAttrs1[attr] = Number(w1.toFixed(4));
    avgAttrs2[attr] = Number(w2.toFixed(4));
    Phi_attr += Math.pow(w1 - w2, 2);
  }

  // 3. Continuous Tactical Barycenter Balance (Phi_delta)
  const avgDelta1 =
    m1 > 0 ? g1Outfield.reduce((acc, s) => acc + s.delta_i, 0) / m1 : 0;
  const avgDelta2 =
    m2 > 0 ? g2Outfield.reduce((acc, s) => acc + s.delta_i, 0) / m2 : 0;
  const Phi_delta = Math.pow(avgDelta1 - avgDelta2, 2);

  // 4. Internal Variance / Homogeneity Balance (Phi_var)
  const meanM1 = m1 > 0 ? sumM1 / m1 : 0;
  const meanM2 = m2 > 0 ? sumM2 / m2 : 0;
  const var1 =
    m1 > 0
      ? g1Outfield.reduce((acc, s) => acc + Math.pow(s.M_i - meanM1, 2), 0) / m1
      : 0;
  const var2 =
    m2 > 0
      ? g2Outfield.reduce((acc, s) => acc + Math.pow(s.M_i - meanM2, 2), 0) / m2
      : 0;
  const Phi_var = Math.pow(var1 - var2, 2);

  const L_forza =
    a1 * Phi_tot + a2 * Phi_attr + a3 * Phi_delta + a4 * Phi_var;

  // Balance percentage (100% when L_forza = 0, decaying smoothly)
  const balance_percentage = Number(
    (100 * Math.exp(-2.5 * Math.sqrt(L_forza))).toFixed(1)
  );

  const roleCounts1 = {
    att: g1Outfield.filter((s) => s.C_i === 1).length,
    dif: g1Outfield.filter((s) => s.C_i === -1).length,
    tut: g1Outfield.filter((s) => s.C_i === 0).length,
  };
  const roleCounts2 = {
    att: g2Outfield.filter((s) => s.C_i === 1).length,
    dif: g2Outfield.filter((s) => s.C_i === -1).length,
    tut: g2Outfield.filter((s) => s.C_i === 0).length,
  };

  return {
    team_1: {
      gk_id: g1Gk ? g1Gk.player.id : null,
      outfield_ids: g1Outfield.map((s) => s.player.id),
      total_power: Number(F1.toFixed(3)),
      avg_attrs: avgAttrs1,
      avg_delta: Number(avgDelta1.toFixed(3)),
      variance_m: Number(var1.toFixed(4)),
      role_counts: roleCounts1,
    },
    team_2: {
      gk_id: g2Gk ? g2Gk.player.id : null,
      outfield_ids: g2Outfield.map((s) => s.player.id),
      total_power: Number(F2.toFixed(3)),
      avg_attrs: avgAttrs2,
      avg_delta: Number(avgDelta2.toFixed(3)),
      variance_m: Number(var2.toFixed(4)),
      role_counts: roleCounts2,
    },
    micro: {
      Phi_tot: Number(Phi_tot.toFixed(5)),
      Phi_attr: Number(Phi_attr.toFixed(5)),
      Phi_delta: Number(Phi_delta.toFixed(5)),
      Phi_var: Number(Phi_var.toFixed(5)),
      L_forza: Number(L_forza.toFixed(5)),
      balance_percentage,
    },
  };
}

/**
 * Modulo 02: Motore Matematico Gerarchico a 3 Stadi per 10 Giocatori Convocati
 */
export function runThreeStageBalancingEngine(
  convocati: Player[],
  config: GlobalConfig
): BalancingEngineResult {
  if (convocati.length !== 10) {
    throw new Error(
      `Il motore matematico richiede esattamente 10 giocatori convocati (ricevuti: ${convocati.length}).`
    );
  }

  // =========================================================================
  // STADIO I: Filtraggio Portieri e Classificazione nei 3 Stati di Movimento
  // =========================================================================
  const gkCandidates = convocati
    .filter((p) => p.wants_to_be_gk)
    .sort((a, b) => b.weights.portiere - a.weights.portiere);

  const K = Math.min(gkCandidates.length, 2);
  const activeGks = gkCandidates.slice(0, K);
  const excessGks = gkCandidates.slice(K);
  const activeGkIdSet = new Set(activeGks.map((p) => p.id));
  const excessGkIdSet = new Set(excessGks.map((p) => p.id));

  const analytical_sheets: AnalyticalPlayerSheet[] = convocati.map((player) => {
    const metrics = computePlayerMetrics(
      player.weights,
      player.wants_to_be_gk,
      config
    );
    const isActiveGk = activeGkIdSet.has(player.id);
    const wasExcessGk = excessGkIdSet.has(player.id);

    let assigned_match_role: 'GK_ACTIVE' | 'ATT' | 'TUT' | 'DIF' = 'TUT';
    if (isActiveGk) {
      assigned_match_role = 'GK_ACTIVE';
    } else if (metrics.C_i === 1) {
      assigned_match_role = 'ATT';
    } else if (metrics.C_i === -1) {
      assigned_match_role = 'DIF';
    } else {
      assigned_match_role = 'TUT';
    }

    return {
      player,
      M_i: metrics.M_i,
      S_A: metrics.S_A,
      S_D: metrics.S_D,
      delta_i: metrics.delta_i,
      C_i: metrics.C_i,
      assigned_match_role,
      was_excess_gk_converted: wasExcessGk,
    };
  });

  const activeGkSheets = activeGks.map(
    (gk) => analytical_sheets.find((s) => s.player.id === gk.id)!
  );
  const outfieldSheets = analytical_sheets.filter(
    (s) => !activeGkIdSet.has(s.player.id)
  );

  const M_P = outfieldSheets.filter((s) => s.C_i === 1);
  const M_N = outfieldSheets.filter((s) => s.C_i === -1);
  const M_0 = outfieldSheets.filter((s) => s.C_i === 0);

  const N_P = M_P.length;
  const N_N = M_N.length;
  const N_0 = M_0.length;

  // Number of active GKs in G1 and G2
  const k1 = K >= 1 ? 1 : 0;
  const k2 = K === 2 ? 1 : 0;
  const m1 = 5 - k1;
  const m2 = 5 - k2;

  // =========================================================================
  // STADIO II: Ottimizzazione Macro-Strutturale della Distribuzione dei Ruoli
  // =========================================================================
  const domainPartitions: MacroPartitionMetrics[] = [];

  for (let p1 = 0; p1 <= N_P; p1++) {
    for (let n1 = 0; n1 <= N_N; n1++) {
      const z1 = m1 - p1 - n1;
      if (z1 < 0 || z1 > N_0) continue;

      const p2 = N_P - p1;
      const n2 = N_N - n1;
      const z2 = N_0 - z1;

      const J_alg = Math.pow(p1 - n1, 2) + Math.pow(p2 - n2, 2);
      const J_diff =
        Math.pow(p1 - p2, 2) + Math.pow(n1 - n2, 2) + Math.pow(z1 - z2, 2);
      const H_tot =
        teamRoleEntropy(p1, n1, z1, m1) + teamRoleEntropy(p2, n2, z2, m2);

      const { w1: w1A, w2: w2A, w3: w3A } = config.macro_weights_A;
      const { w1: w1B, w2: w2B, w3: w3B } = config.macro_weights_B;

      const cost_A = w1A * J_alg + w2A * J_diff - w3A * H_tot;
      const cost_B = w1B * J_alg + w2B * J_diff - w3B * H_tot;

      domainPartitions.push({
        p1,
        n1,
        z1,
        p2,
        n2,
        z2,
        J_alg: Number(J_alg.toFixed(4)),
        J_diff: Number(J_diff.toFixed(4)),
        H_tot: Number(H_tot.toFixed(4)),
        cost_A: Number(cost_A.toFixed(4)),
        cost_B: Number(cost_B.toFixed(4)),
      });
    }
  }

  const bestMacroA = [...domainPartitions].sort((a, b) => a.cost_A - b.cost_A)[0];
  const bestMacroB = [...domainPartitions].sort((a, b) => a.cost_B - b.cost_B)[0];

  // Check if A and B represent the exact same role partition (or mirror image when k1 == k2)
  const isSameOrMirrorPartition = (
    part1: MacroPartitionMetrics,
    part2: MacroPartitionMetrics
  ) => {
    const exactMatch =
      part1.p1 === part2.p1 && part1.n1 === part2.n1 && part1.z1 === part2.z1;
    const mirrorMatch =
      k1 === k2 &&
      part1.p1 === part2.p2 &&
      part1.n1 === part2.n2 &&
      part1.z1 === part2.z2;
    return exactMatch || mirrorMatch;
  };

  const coinciding = isSameOrMirrorPartition(bestMacroA, bestMacroB);

  // =========================================================================
  // STADIO III: Ottimizzazione Micro-Allocativa di Forza (MIQP Combinatorio)
  // =========================================================================
  function solveStageIIIForPartition(partition: MacroPartitionMetrics) {
    const pCombos = getCombinations(M_P, partition.p1);
    const nCombos = getCombinations(M_N, partition.n1);
    const zCombos = getCombinations(M_0, partition.z1);

    // GK combinations:
    // If K === 2, to avoid mirror duplicates when K=2, we can test both GK assignments (or fix GK1 to G1 if symmetric, wait: testing both GK assignments when partition is asymmetric ensures we don't miss pairing the stronger GK with the weaker outfield partition!)
    const gkAssignments: Array<{
      g1Gk: AnalyticalPlayerSheet | null;
      g2Gk: AnalyticalPlayerSheet | null;
    }> = [];

    if (K === 2) {
      gkAssignments.push({ g1Gk: activeGkSheets[0], g2Gk: activeGkSheets[1] });
      gkAssignments.push({ g1Gk: activeGkSheets[1], g2Gk: activeGkSheets[0] });
    } else if (K === 1) {
      gkAssignments.push({ g1Gk: activeGkSheets[0], g2Gk: null });
    } else {
      gkAssignments.push({ g1Gk: null, g2Gk: null });
    }

    const candidates: Array<{
      team_1: TeamLineup;
      team_2: TeamLineup;
      micro: MicroForceMetrics;
      signature: string;
    }> = [];

    const seenSignatures = new Set<string>();

    for (const gkPair of gkAssignments) {
      for (const pChoice of pCombos) {
        for (const nChoice of nCombos) {
          for (const zChoice of zCombos) {
            const g1Outfield = [...pChoice, ...nChoice, ...zChoice];
            const g1IdSet = new Set(g1Outfield.map((s) => s.player.id));
            const g2Outfield = outfieldSheets.filter(
              (s) => !g1IdSet.has(s.player.id)
            );

            // Build canonical signature so mirror swaps (G1 <-> G2) aren't counted as two distinct solutions
            const team1Ids = [
              gkPair.g1Gk?.player.id ?? '',
              ...g1Outfield.map((s) => s.player.id).sort(),
            ].join(',');
            const team2Ids = [
              gkPair.g2Gk?.player.id ?? '',
              ...g2Outfield.map((s) => s.player.id).sort(),
            ].join(',');
            const canonicalSig = [team1Ids, team2Ids].sort().join('||');

            if (seenSignatures.has(canonicalSig)) continue;
            seenSignatures.add(canonicalSig);

            const evaluated = evaluateTeamSplit(
              gkPair.g1Gk,
              gkPair.g2Gk,
              g1Outfield,
              g2Outfield,
              config
            );

            candidates.push({
              ...evaluated,
              signature: canonicalSig,
            });
          }
        }
      }
    }

    candidates.sort((a, b) => a.micro.L_forza - b.micro.L_forza);
    return candidates;
  }

  const candidatesA = solveStageIIIForPartition(bestMacroA);
  const bestA = candidatesA[0];

  let bestB: {
    team_1: TeamLineup;
    team_2: TeamLineup;
    micro: MicroForceMetrics;
  };
  let macroForB = bestMacroB;

  if (!coinciding) {
    const candidatesB = solveStageIIIForPartition(bestMacroB);
    bestB = candidatesB[0];
  } else {
    // Spec Section 3.3 Note:
    // "Se per simmetria del pool le Soluzioni A e B coincidono nella stessa partizione di ruoli,
    // lo Stadio III restituirà la prima e la seconda miglior combinazione di giocatori per quella partizione"
    bestB = candidatesA.length > 1 ? candidatesA[1] : candidatesA[0];
    macroForB = bestMacroA;
  }

  const proposal_A: BalancingProposal = {
    id: 'A',
    title: 'Proposta A — Ottimo di Simmetria',
    subtitle: 'Privilegia moduli speculari ruolo per ruolo (J_diff minimo)',
    macro: bestMacroA,
    micro: bestA.micro,
    team_1: bestA.team_1,
    team_2: bestA.team_2,
  };

  const proposal_B: BalancingProposal = {
    id: 'B',
    title: coinciding
      ? 'Proposta B — Alternativa di Forza (Pool Simmetrico)'
      : 'Proposta B — Ottimo di Compensazione Tattica',
    subtitle: coinciding
      ? 'Seconda miglior allocazione micro-forza a parità di modulo simmetrico'
      : 'Pareggia il baricentro algebrico (q1 = q2) tramite i tuttocampisti',
    macro: macroForB,
    micro: bestB.micro,
    team_1: bestB.team_1,
    team_2: bestB.team_2,
  };

  return {
    analytical_sheets,
    active_gks_ids: activeGks.map((p) => p.id),
    excess_gks_ids: excessGks.map((p) => p.id),
    pool_counts: { N_P, N_N, N_0, K },
    proposal_A,
    proposal_B,
    coinciding_macro_partitions: coinciding,
  };
}

/**
 * Recalculates Team 1 and Team 2 metrics after a manual player swap by Admin.
 */
export function recalculateAfterManualSwap(
  convocati: Player[],
  team1Ids: { gk_id: string | null; outfield_ids: string[] },
  team2Ids: { gk_id: string | null; outfield_ids: string[] },
  config: GlobalConfig
): {
  team_1: TeamLineup;
  team_2: TeamLineup;
  micro: MicroForceMetrics;
} {
  const playerMap = new Map(convocati.map((p) => [p.id, p]));
  const toSheet = (id: string, isGk: boolean): AnalyticalPlayerSheet => {
    const p = playerMap.get(id)!;
    const m = computePlayerMetrics(p.weights, p.wants_to_be_gk, config);
    return {
      player: p,
      M_i: m.M_i,
      S_A: m.S_A,
      S_D: m.S_D,
      delta_i: m.delta_i,
      C_i: m.C_i,
      assigned_match_role: isGk
        ? 'GK_ACTIVE'
        : m.C_i === 1
          ? 'ATT'
          : m.C_i === -1
            ? 'DIF'
            : 'TUT',
      was_excess_gk_converted: false,
    };
  };

  const g1Gk = team1Ids.gk_id ? toSheet(team1Ids.gk_id, true) : null;
  const g2Gk = team2Ids.gk_id ? toSheet(team2Ids.gk_id, true) : null;
  const g1Out = team1Ids.outfield_ids.map((id) => toSheet(id, false));
  const g2Out = team2Ids.outfield_ids.map((id) => toSheet(id, false));

  return evaluateTeamSplit(g1Gk, g2Gk, g1Out, g2Out, config);
}

/**
 * Modulo 04 (2): Algoritmo di Generazione Equa delle 5 Domande (Least-Voted First)
 */
export function generateFairQuestionnaire(
  voterPlayerId: string,
  match: Match,
  allPlayers: Player[],
  rng: () => number = Math.random
): VotingQuestion[] {
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
  const activeGkSet = new Set(match.active_gks_ids);

  // Passo 1: I 9 candidati (tutti i convocati tranne il votante stesso)
  const candidates = match.convocati_ids.filter((id) => id !== voterPlayerId);

  // Ordina per votes_received_count crescente con shuffle casuale a pari merito
  const withNoise = candidates.map((id) => ({
    id,
    receivedCount: match.voting_tracker.received_count_by_player[id] ?? 0,
    tieBreaker: rng(),
  }));

  withNoise.sort((a, b) => {
    if (a.receivedCount !== b.receivedCount) {
      return a.receivedCount - b.receivedCount;
    }
    return a.tieBreaker - b.tieBreaker;
  });

  const selected5 = withNoise.slice(0, 5).map((item) => item.id);

  // Passo 2: Selezione della caratteristica per ciascuno dei 5 giocatori
  const questionPools: Record<AllAttrKey, string[]> = {
    tiro: [
      `Come valuti le conclusioni e il senso del gol di {name}?`,
      `Quanto è stato incisivo e pericoloso al tiro {name}?`,
      `Precisione balistica e freddezza: che voto dai ai tiri di {name}?`,
      `Come ha tirato e finalizzato {name}?`,
      `Ogni volta che ha calciato verso la porta, che impressione ti ha fatto {name}?`,
    ],
    velocita: [
      `Quanto è stato rapido e scattante {name}?`,
      `Corsa, scatto e ripartenze: come valuti la velocità di {name}?`,
      `Cambio di passo e reattività sul breve: come ha brillato {name}?`,
      `Quanto ha saputo bruciare gli avversari in velocità {name}?`,
      `Esplosività atletica: che voto dai al passo di {name}?`,
    ],
    passaggio: [
      `Quanto è stato preciso nei passaggi e nella visione di gioco {name}?`,
      `Qualità nei passaggi e geometrie di manovra: come ha orchestrato {name}?`,
      `Assist, filtranti e gestione della palla: come valuti {name}?`,
      `Ha fatto girare la squadra col pallone giusto al momento giusto? Vota il tocco di {name}.`,
      `Pulizia tecnica nei passaggi e lucidità: che voto merita {name}?`,
    ],
    resistenza: [
      `Quanta tenuta atletica e corsa ha dimostrato {name}?`,
      `Tenuta atletica e fiato sui 50 minuti: come ha retto {name}?`,
      `Costanza di rendimento, pressing e km percorsi: quanto ha lottato {name}?`,
      `Ha corso con intensità dall'inizio al fischio finale? Valuta la resistenza di {name}.`,
      `Spirito di sacrificio e serbatoio di energie: che voto dai al motore di {name}?`,
    ],
    difesa: [
      `Quanto è stato solido in marcatura e nei contrasti {name}?`,
      `Senso della posizione e diagonali difensive: quanto è stato attento {name}?`,
      `Grinta nei tackle e chiusure decisive: come valuti la fase difensiva di {name}?`,
      `Ha alzato il muro difensivo contro gli attaccanti? Vota le coperture di {name}.`,
      `Pulizia negli anticipi e determinazione nei duelli: come giudichi {name}?`,
    ],
    portiere: [
      `Come si è comportato {name} tra i pali e nelle uscite come Portiere?`,
      `Riflessi felini e sicurezza della porta: che voto dai alla prestazione da portiere di {name}?`,
      `Interventi decisivi e parate salva-risultato: come ha difeso la porta {name}?`,
      `Reattività sui tiri ravvicinati e comando dell'area per {name}: che voto merita?`,
      `Guanti caldi: quante volte {name} ha negato il gol agli avversari?`,
    ],
  };

  return selected5.map((targetId) => {
    const targetPlayer = playerMap.get(targetId);
    const targetName = targetPlayer?.name ?? targetId;
    const isActiveGk = activeGkSet.has(targetId);

    if (isActiveGk) {
      const gkPool = questionPools.portiere;
      const qIdx = Math.floor(rng() * gkPool.length) % gkPool.length;
      return {
        target_player_id: targetId,
        target_player_name: targetName,
        is_active_gk_in_match: true,
        attribute: 'portiere' as AllAttrKey,
        attribute_label: ATTR_LABELS.portiere,
        question_text: gkPool[qIdx].replace('{name}', targetName),
      };
    }

    // Giocatore di Movimento: attributo con il minor numero di valutazioni storiche
    const counts = targetPlayer?.attr_votes_count ?? {
      tiro: 0,
      velocita: 0,
      passaggio: 0,
      resistenza: 0,
      difesa: 0,
      portiere: 0,
    };

    const attrCandidates = OUTFIELD_ATTRS.map((attr) => ({
      attr,
      count: counts[attr] ?? 0,
      tieBreaker: rng(),
    }));

    attrCandidates.sort((a, b) => {
      if (a.count !== b.count) return a.count - b.count;
      return a.tieBreaker - b.tieBreaker;
    });

    const chosenAttr = attrCandidates[0].attr;
    const pool = questionPools[chosenAttr];
    const qIdx = Math.floor(rng() * pool.length) % pool.length;

    return {
      target_player_id: targetId,
      target_player_name: targetName,
      is_active_gk_in_match: false,
      attribute: chosenAttr,
      attribute_label: ATTR_LABELS[chosenAttr],
      question_text: pool[qIdx].replace('{name}', targetName),
    };
  });
}

/**
 * Modulo 04 (3.1): Normalizzazione Lineare [4, 10] -> [0, 1]
 * u_{j,k} = clip_{[0,1]}((v_bar - 4) / 6)
 */
export function normalizeVoteToUnit(avgVote: number): number {
  return Number(clip((avgVote - 4) / 6, 0, 1).toFixed(4));
}

/**
 * Modulo 04 (3.2): Aggiornamento tramite Media Mobile Esponenziale (EMA)
 * w^(nuovo) = (1 - eta) * w^(vecchio) + eta * u_{j,k}
 */
export function computeEmaWeightUpdate(
  oldWeight: number,
  normalizedPerformance: number,
  eta: number
): number {
  const updated = (1 - eta) * oldWeight + eta * normalizedPerformance;
  return Number(clip(updated, 0, 1).toFixed(4));
}

/**
 * Modulo 04 (3): Consolidamento Fine Match dei Pesi e Ricalcolo Overall / Ruolo
 * Aggiorna i pesi attuali (weights) di ogni giocatore partendo dal valore precedente
 * (che nasce da initial_weights) e applicando la formula EMA con i voti ricevuti.
 */
export function consolidateMatchVotesEMA(
  players: Player[],
  match: Match,
  config: GlobalConfig
): Player[] {
  const eta = config.ema_learning_rate_eta;
  const accumulators = match.voting_tracker.anonymous_accumulators;

  return players.map((player) => {
    const playerAcc = accumulators[player.id];
    if (!playerAcc) return player;

    const initialBase: PlayerWeights = player.initial_weights
      ? { ...player.initial_weights }
      : { ...player.weights };

    const currentBase: PlayerWeights = { ...player.weights };
    const newWeights: PlayerWeights = { ...currentBase };
    const newAttrVotesCount = { ...player.attr_votes_count };
    let hasChanged = false;

    const allKeys: AllAttrKey[] = [
      'tiro',
      'velocita',
      'passaggio',
      'resistenza',
      'difesa',
      'portiere',
    ];

    for (const key of allKeys) {
      const entry = playerAcc[key];
      if (entry && entry.count >= 1) {
        const avgVote = entry.sum / entry.count;
        const u_jk = normalizeVoteToUnit(avgVote);
        newWeights[key] = computeEmaWeightUpdate(currentBase[key], u_jk, eta);
        newAttrVotesCount[key] = (newAttrVotesCount[key] ?? 0) + entry.count;
        hasChanged = true;
      }
    }

    if (!hasChanged) return player;

    const recomputed = computePlayerMetrics(
      newWeights,
      player.wants_to_be_gk,
      config
    );

    return {
      ...player,
      initial_weights: initialBase,
      weights: newWeights,
      natural_weights: newWeights,
      manual_override: false,
      attr_votes_count: newAttrVotesCount,
      computed: recomputed.computed,
    };
  });
}

/**
 * Ricalcola i pesi attuali (weights) quando il Direttore modifica i Valori Iniziali (initial_weights),
 * mantenendo intatto l'effetto positivo o negativo accumulato tramite i voti passati (delta EMA).
 */
export function recalculateWeightsFromNewInitial(
  currentWeights: PlayerWeights,
  oldInitialWeights: PlayerWeights,
  newInitialWeights: PlayerWeights
): PlayerWeights {
  const allKeys: AllAttrKey[] = [
    'tiro',
    'velocita',
    'passaggio',
    'resistenza',
    'difesa',
    'portiere',
  ];
  const updated: PlayerWeights = { ...newInitialWeights };

  for (const k of allKeys) {
    const emaDelta = (currentWeights[k] ?? oldInitialWeights[k]) - (oldInitialWeights[k] ?? currentWeights[k]);
    updated[k] = Number(clip(newInitialWeights[k] + emaDelta, 0, 1).toFixed(4));
  }

  return updated;
}

/**
 * Calcola l'Overall FUT derivante dai Valori Iniziali impostati dal Direttore.
 */
export function getPlayerInitialFutOverall(player: Player): number {
  const initWeights = player.initial_weights ?? player.weights;
  const { tiro, velocita, passaggio, resistenza, difesa } = initWeights;
  const initOverallUnit = (tiro + velocita + passaggio + resistenza + difesa) / 5;
  const moveOvr = weightToFutStat(initOverallUnit);
  if (player.wants_to_be_gk) {
    const gkOvr = weightToFutStat(initWeights.portiere);
    return Math.max(moveOvr, gkOvr);
  }
  return moveOvr;
}

/**
 * Alias di compatibilità per il calcolo dell'Overall FUT iniziale/naturale.
 */
export function getPlayerNaturalFutOverall(player: Player): number {
  return getPlayerInitialFutOverall(player);
}

/**
 * Ripristina i pesi attuali di un giocatore ai suoi Valori Iniziali.
 */
export function restorePlayerToNaturalStats(
  player: Player,
  config: GlobalConfig
): Player {
  const initialWeights = player.initial_weights ?? player.weights;
  const recomputed = computePlayerMetrics(
    initialWeights,
    player.wants_to_be_gk,
    config
  );

  return {
    ...player,
    manual_override: false,
    initial_weights: initialWeights,
    weights: initialWeights,
    natural_weights: initialWeights,
    computed: recomputed.computed,
  };
}

/**
 * Modulo 05 (2.2): Calcolo Quote (Fisse o con adeguamento dinamico +/- 0.15)
 */
export function computeMatchOdds(
  team1Power: number,
  team2Power: number,
  config: GlobalConfig
): BetOdds {
  const baseOdds = { ...config.bet_odds };
  if (config.dynamic_odds_enabled === false) {
    return baseOdds;
  }
  const sensitivity = config.dynamic_odds_sensitivity ?? 0.50;
  const diff = team1Power - team2Power;
  // Adeguamento proporzionale controllato dalla sensibilità del Direttore
  const maxDelta = Math.min(0.85, Math.max(0.20, sensitivity * 0.9));
  const adjustment = clip(diff * sensitivity, -maxDelta, maxDelta);
  return {
    '1': Number(Math.max(1.10, baseOdds['1'] - adjustment).toFixed(2)),
    'X': Number(Math.max(1.20, baseOdds['X'] - Math.abs(adjustment) * 0.20).toFixed(2)),
    '2': Number(Math.max(1.10, baseOdds['2'] + adjustment).toFixed(2)),
  };
}

/**
 * Modulo 03 (1.4) & Modulo 05 (2.2): Determinazione esito e liquidazione scommesse + presenze/vittorie
 */
export function determineMatchWinner(
  scoreTeam1: number,
  scoreTeam2: number
): BetPick {
  if (scoreTeam1 > scoreTeam2) return '1';
  if (scoreTeam2 > scoreTeam1) return '2';
  return 'X';
}

export function settleMatchAndBets(
  players: Player[],
  match: Match,
  scoreTeam1: number,
  scoreTeam2: number
): {
  updatedPlayers: Player[];
  updatedMatch: Match;
} {
  const winner: BetPick = determineMatchWinner(scoreTeam1, scoreTeam2);
  const winningOdds = match.odds[winner];

  const team1PlayerIds = new Set<string>([
    ...(match.team_1.gk_id ? [match.team_1.gk_id] : []),
    ...match.team_1.outfield_ids,
  ]);
  const team2PlayerIds = new Set<string>([
    ...(match.team_2.gk_id ? [match.team_2.gk_id] : []),
    ...match.team_2.outfield_ids,
  ]);
  const convocatiSet = new Set<string>(match.convocati_ids);

  const settledBets: Record<string, typeof match.bets[string]> = {};
  for (const [playerId, bet] of Object.entries(match.bets)) {
    const isWon = bet.pick === winner;
    const payout = isWon ? Math.round(bet.amount * winningOdds) : 0;
    settledBets[playerId] = {
      ...bet,
      potential_payout: Math.round(bet.amount * match.odds[bet.pick]),
      settled: true,
      status: isWon ? 'WON' : 'LOST',
    };
  }

  const updatedPlayers = players.map((player) => {
    let stats = { ...player.stats };

    // 1. Aggiornamento presenze e vittorie per i 10 convocati
    if (convocatiSet.has(player.id)) {
      stats.matches_played += 1;
      if (winner === 'X') {
        stats.matches_drawn += 1;
      } else if (winner === '1' && team1PlayerIds.has(player.id)) {
        stats.matches_won += 1;
      } else if (winner === '2' && team2PlayerIds.has(player.id)) {
        stats.matches_won += 1;
      }
    }

    // 2. Liquidazione scommessa se l'utente ha scommesso
    const bet = match.bets[player.id];
    if (bet && !bet.settled) {
      stats.bets_total += 1;
      if (bet.pick === winner) {
        const payout = Math.round(bet.amount * winningOdds);
        stats.tokens += payout;
        stats.bets_won += 1;
        stats.bets_net_profit = (stats.bets_net_profit ?? 0) + (payout - bet.amount);
      } else {
        stats.bets_net_profit = (stats.bets_net_profit ?? 0) - bet.amount;
      }
    }

    return {
      ...player,
      stats,
    };
  });

  const updatedMatch: Match = {
    ...match,
    status: 'VOTING_OPEN',
    score: {
      team_1: scoreTeam1,
      team_2: scoreTeam2,
      winner,
    },
    bets: settledBets,
  };

  return {
    updatedPlayers,
    updatedMatch,
  };
}
