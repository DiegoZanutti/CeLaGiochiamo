import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlayerMetrics,
  runThreeStageBalancingEngine,
  weightToFutStat,
  futStatToWeight,
  getFutCardTier,
  getPlayerFutOverall,
  getPlayerInitialFutOverall,
  recalculateWeightsFromNewInitial,
  normalizeVoteToUnit,
  computeEmaWeightUpdate,
  computeMatchOdds,
  generateFairQuestionnaire,
  consolidateMatchVotesEMA,
  settleMatchAndBets,
} from './mathEngine';
import {
  buildTestDatabaseSnapshot,
  DEFAULT_GLOBAL_CONFIG,
  simulateBulkBetsOnSnapshot,
  simulateBulkVotesOnSnapshot,
} from '../db/testDatabase';
import { Match, Player } from '../types/models';

function makeTestPlayer(
  id: string,
  name: string,
  weights: [number, number, number, number, number, number],
  wantsGk = false
): Player {
  const w = {
    tiro: weights[0],
    velocita: weights[1],
    passaggio: weights[2],
    resistenza: weights[3],
    difesa: weights[4],
    portiere: weights[5],
  };
  const metrics = computePlayerMetrics(w, wantsGk, DEFAULT_GLOBAL_CONFIG);
  return {
    id,
    name,
    claim_status: 'VALIDATED',
    is_active: true,
    weights: w,
    wants_to_be_gk: wantsGk,
    computed: metrics.computed,
    attr_votes_count: {
      tiro: 5,
      velocita: 5,
      passaggio: 5,
      resistenza: 5,
      difesa: 5,
      portiere: wantsGk ? 5 : 0,
    },
    stats: {
      tokens: 100,
      matches_played: 10,
      matches_won: 5,
      matches_drawn: 1,
      bets_total: 5,
      bets_won: 3,
      bets_net_profit: 20,
      votes_completed_matches: 10,
    },
  };
}

test('Modulo 02 - Stadio I: Calcolo Poli S_A, S_D, delta_i e classificazione ruolo a 3 stati', () => {
  const att = computePlayerMetrics(
    { tiro: 0.9, velocita: 0.85, passaggio: 0.7, resistenza: 0.6, difesa: 0.3, portiere: 0.1 },
    false,
    DEFAULT_GLOBAL_CONFIG
  );
  assert.equal(att.C_i, 1);
  assert.equal(att.computed.role_label, 'ATT');
  assert.ok(att.delta_i > 0.2);

  const dif = computePlayerMetrics(
    { tiro: 0.25, velocita: 0.55, passaggio: 0.65, resistenza: 0.85, difesa: 0.9, portiere: 0.2 },
    false,
    DEFAULT_GLOBAL_CONFIG
  );
  assert.equal(dif.C_i, -1);
  assert.equal(dif.computed.role_label, 'DIF');
  assert.ok(dif.delta_i < -0.2);

  const tut = computePlayerMetrics(
    { tiro: 0.68, velocita: 0.7, passaggio: 0.75, resistenza: 0.72, difesa: 0.65, portiere: 0.2 },
    false,
    DEFAULT_GLOBAL_CONFIG
  );
  assert.equal(tut.C_i, 0);
  assert.equal(tut.computed.role_label, 'TUT');
  assert.ok(Math.abs(tut.delta_i) <= 0.2);
});

test('Modulo 02 - Stadio I, II, III: Motore di bilanciamento su 10 giocatori con 3 portieri candidati (1 riconvertito) e pool asimmetrico (1 ATT, 3 DIF, 4 TUT)', () => {
  const players: Player[] = [
    makeTestPlayer('gk1', 'Gigi', [0.4, 0.4, 0.5, 0.5, 0.6, 0.92], true),
    makeTestPlayer('gk2', 'Samir', [0.4, 0.4, 0.5, 0.5, 0.6, 0.86], true),
    makeTestPlayer('gk3_conv', 'Alex (Ex-GK -> TUT)', [0.65, 0.65, 0.65, 0.65, 0.65, 0.5], true),
    makeTestPlayer('att1', 'Marco (ATT)', [0.92, 0.88, 0.72, 0.65, 0.3, 0.1], false),
    makeTestPlayer('dif1', 'Giorgio (DIF)', [0.25, 0.55, 0.62, 0.85, 0.92, 0.1], false),
    makeTestPlayer('dif2', 'Paolo (DIF)', [0.3, 0.6, 0.65, 0.82, 0.88, 0.1], false),
    makeTestPlayer('dif3', 'Leonardo (DIF)', [0.28, 0.52, 0.6, 0.8, 0.86, 0.1], false),
    makeTestPlayer('tut1', 'Nicolò (TUT)', [0.7, 0.72, 0.78, 0.74, 0.66, 0.1], false),
    makeTestPlayer('tut2', 'Sandro (TUT)', [0.64, 0.68, 0.74, 0.72, 0.64, 0.1], false),
    makeTestPlayer('tut3', 'Claudio (TUT)', [0.68, 0.66, 0.76, 0.7, 0.67, 0.1], false),
  ];

  const result = runThreeStageBalancingEngine(players, DEFAULT_GLOBAL_CONFIG);

  assert.deepEqual(result.active_gks_ids, ['gk1', 'gk2']);
  assert.deepEqual(result.excess_gks_ids, ['gk3_conv']);
  assert.deepEqual(result.pool_counts, { N_P: 1, N_N: 3, N_0: 4, K: 2 });

  const mA = result.proposal_A.macro;
  const isASymmetric =
    (mA.p1 === 1 && mA.n1 === 1 && mA.z1 === 2 && mA.p2 === 0 && mA.n2 === 2 && mA.z2 === 2) ||
    (mA.p2 === 1 && mA.n2 === 1 && mA.z2 === 2 && mA.p1 === 0 && mA.n1 === 2 && mA.z1 === 2);
  assert.ok(isASymmetric);

  const mB = result.proposal_B.macro;
  const isBCompensated =
    (mB.p1 === 1 && mB.n1 === 2 && mB.z1 === 1 && mB.p2 === 0 && mB.n2 === 1 && mB.z2 === 3) ||
    (mB.p2 === 1 && mB.n2 === 2 && mB.z2 === 1 && mB.p1 === 0 && mB.n1 === 1 && mB.z1 === 3);
  assert.ok(isBCompensated);
});

test('Modulo 04 & Modulo 05: Normalizzazione voti, EMA, Scala FUT e Liquidazione Scommesse', () => {
  assert.equal(normalizeVoteToUnit(4.0), 0.0);
  assert.equal(normalizeVoteToUnit(6.0), 0.3333);
  assert.equal(normalizeVoteToUnit(7.0), 0.5);
  assert.equal(normalizeVoteToUnit(10.0), 1.0);
  assert.equal(computeEmaWeightUpdate(0.6, 1.0, 0.15), 0.66);

  assert.equal(weightToFutStat(0), 40);
  assert.equal(weightToFutStat(0.5), 70);
  assert.equal(weightToFutStat(1), 99);
  assert.equal(futStatToWeight(40), 0);
  assert.equal(futStatToWeight(99), 1);

  assert.equal(getFutCardTier(62), 'BRONZE');
  assert.equal(getFutCardTier(72), 'SILVER');
  assert.equal(getFutCardTier(82), 'GOLD');
  assert.equal(getFutCardTier(88), 'SPECIAL');
});

test('Ambiente Database di Test (testDatabase.ts): Verifica tutti i 5 Scenari e Simulazione Ciclo Completo (Scommesse -> Risultato -> Least-Voted First 10/10 -> EMA)', () => {
  // 1. Verifica generazione dei 5 scenari del DB di Test
  const asymSnap = buildTestDatabaseSnapshot('ASYMMETRIC_POOL');
  assert.equal(asymSnap.match.status, 'OPEN_FOR_BETS');
  assert.equal(asymSnap.players.length, 14);

  const symSnap = buildTestDatabaseSnapshot('SYMMETRIC_POOL');
  const symConvocati = symSnap.players.filter((p) =>
    symSnap.match.convocati_ids.includes(p.id)
  );
  const symEngine = runThreeStageBalancingEngine(symConvocati, symSnap.config);
  assert.equal(symEngine.coinciding_macro_partitions, true);

  const singleGkSnap = buildTestDatabaseSnapshot('SINGLE_GK_COMPENSATION');
  assert.equal(singleGkSnap.match.active_gks_ids.length, 1);

  const cleanSnap = buildTestDatabaseSnapshot('EMPTY_CLEAN_SLATE');
  assert.equal(cleanSnap.players[0].stats.matches_played, 0);

  // 2. Esecuzione Ciclo di Vita completo sul DB di Test (ASYMMETRIC_POOL)
  const { updatedPlayers: afterBetsPlayers, updatedMatch: afterBetsMatch, countAdded } =
    simulateBulkBetsOnSnapshot(asymSnap.players, asymSnap.match);
  assert.ok(countAdded > 0);
  assert.ok(Object.keys(afterBetsMatch.bets).length >= 10);

  // 3. Chiudi match e liquida scommesse (Risultato 6 - 4 -> Vince Squadra 1)
  const { updatedPlayers: afterSettlePlayers, updatedMatch: votingMatch } =
    settleMatchAndBets(afterBetsPlayers, afterBetsMatch, 6, 4);
  assert.equal(votingMatch.status, 'VOTING_OPEN');
  assert.equal(votingMatch.score.winner, '1');

  // 4. Simula tutti i 10/10 votanti tramite Least-Voted First
  const { updatedPlayers: afterVotesPlayers, updatedMatch: allVotedMatch } =
    simulateBulkVotesOnSnapshot(afterSettlePlayers, votingMatch, asymSnap.config);
  assert.equal(allVotedMatch.voting_tracker.voters_completed_ids.length, 10);

  // Verifica proprietà matematica Least-Voted First: scarto massimo di voti ricevuti tra qualsiasi coppia <= 1
  const receivedCounts = Object.values(
    allVotedMatch.voting_tracker.received_count_by_player
  );
  const minReceived = Math.min(...receivedCounts);
  const maxReceived = Math.max(...receivedCounts);
  assert.ok(
    maxReceived - minReceived <= 2,
    `Discrepanza massima voti ricevuti (${maxReceived} - ${minReceived}) deve essere <= 2`
  );

  // 5. Consolida voti con EMA (ARCHIVED)
  const consolidatedPlayers = consolidateMatchVotesEMA(
    afterVotesPlayers,
    allVotedMatch,
    asymSnap.config
  );
  assert.equal(consolidatedPlayers.length, 14);
});

test('Modulo 02 - Stadio I: Coefficienti Polari distinti tra Valutazione Offensiva (S_A) e Difensiva (S_D)', () => {
  const customConfig = {
    ...DEFAULT_GLOBAL_CONFIG,
    polar_weights: {
      a: 0.5,
      b: 0.25,
      c: 0.1,
      d: 0.15,
      attack_tiro: 0.60,
      attack_velocita: 0.20,
      attack_passaggio: 0.10,
      attack_resistenza: 0.10,
      defense_difesa: 0.55,
      defense_resistenza: 0.25,
      defense_passaggio: 0.15,
      defense_velocita: 0.05,
    },
  };

  const weights = {
    tiro: 0.8,
    velocita: 0.7,
    passaggio: 0.6,
    resistenza: 0.5,
    difesa: 0.4,
    portiere: 0.2,
  };

  const res = computePlayerMetrics(weights, false, customConfig);
  // S_A atteso = 0.60 * 0.8 + 0.20 * 0.7 + 0.10 * 0.6 + 0.10 * 0.5 = 0.48 + 0.14 + 0.06 + 0.05 = 0.73
  // S_D atteso = 0.55 * 0.4 + 0.25 * 0.5 + 0.15 * 0.6 + 0.05 * 0.7 = 0.22 + 0.125 + 0.09 + 0.035 = 0.47
  assert.equal(res.S_A, 0.73);
  assert.equal(res.S_D, 0.47);
  assert.ok(res.delta_i > 0);
  assert.equal(res.computed.role_label, 'ATT');
});

test('Modulo 04: Modifica del Valore Iniziale ricalcola il valore attuale preservando il delta EMA dei voti passati', () => {
  // Giocatore base creato dal Direttore con tutti pesi iniziali a 0.50 (FUT OVR ~70)
  const basePlayer = makeTestPlayer('p_initial', 'Mario Evoluto', [0.5, 0.5, 0.5, 0.5, 0.5, 0.2]);
  const playerWithInit: Player = {
    ...basePlayer,
    initial_weights: { ...basePlayer.weights },
  };

  assert.equal(getPlayerFutOverall(playerWithInit), 70);
  assert.equal(getPlayerInitialFutOverall(playerWithInit), 70);

  // Simuliamo un match in cui i compagni votano molto bene il tiro (voto 10 su 10 -> u_jk = 1.0)
  const fakeMatch: Match = {
    id: 'm_test_ema',
    date_label: 'Test Match',
    status: 'VOTING_OPEN',
    convocati_ids: ['p_initial'],
    active_gks_ids: [],
    selected_solution: 'A',
    team_1: {
      gk_id: null,
      outfield_ids: ['p_initial'],
      total_power: 0.5,
      avg_attrs: { tiro: 0.5, velocita: 0.5, passaggio: 0.5, resistenza: 0.5, difesa: 0.5 },
    },
    team_2: {
      gk_id: null,
      outfield_ids: [],
      total_power: 0.5,
      avg_attrs: { tiro: 0.5, velocita: 0.5, passaggio: 0.5, resistenza: 0.5, difesa: 0.5 },
    },
    score: { team_1: 3, team_2: 3, winner: 'X' },
    odds: { '1': 1.85, 'X': 3.2, '2': 1.85 },
    bets: {},
    voting_tracker: {
      voters_completed_ids: ['voter1'],
      received_count_by_player: { p_initial: 1 },
      anonymous_accumulators: {
        p_initial: {
          tiro: { sum: 10, count: 1 },
        },
      },
    },
  };

  // 1. Consolidiamo i voti con EMA (alpha = 0.15):
  // tiro passa da 0.50 a 0.85 * 0.50 + 0.15 * 1.0 = 0.425 + 0.15 = 0.575 (delta = +0.075)
  const updatedPlayers = consolidateMatchVotesEMA([playerWithInit], fakeMatch, DEFAULT_GLOBAL_CONFIG);
  const afterMatch = updatedPlayers[0];

  assert.equal(afterMatch.weights.tiro, 0.575);
  assert.equal(afterMatch.initial_weights!.tiro, 0.5);

  // 2. Ora il Direttore modifica il Valore Iniziale del tiro portandolo da 0.50 a 0.70:
  // Il nuovo valore attuale deve essere 0.70 + (0.575 - 0.50) = 0.775 (preservando il +0.075 guadagnato coi voti)
  const newInitial = {
    ...afterMatch.initial_weights!,
    tiro: 0.7,
  };
  const recalculated = recalculateWeightsFromNewInitial(
    afterMatch.weights,
    afterMatch.initial_weights!,
    newInitial
  );

  assert.equal(recalculated.tiro, 0.775);
  assert.equal(recalculated.velocita, 0.5);
});

test('Quote Dinamiche: Sensibilità configurabile e variazione quote in base al divario di forza', () => {
  const lowSensConfig = {
    ...DEFAULT_GLOBAL_CONFIG,
    dynamic_odds_enabled: true,
    dynamic_odds_sensitivity: 0.20,
  };
  const highSensConfig = {
    ...DEFAULT_GLOBAL_CONFIG,
    dynamic_odds_enabled: true,
    dynamic_odds_sensitivity: 0.80,
  };

  // Squadra 1 nettamente più forte (forza 6.5 vs 4.0)
  const oddsLow = computeMatchOdds(6.5, 4.0, lowSensConfig);
  const oddsHigh = computeMatchOdds(6.5, 4.0, highSensConfig);

  // La squadra 1 deve essere favorita (quota 1 < quota 2)
  assert.ok(oddsLow['1'] < oddsLow['2'], 'Squadra 1 favorita con low sens');
  assert.ok(oddsHigh['1'] < oddsHigh['2'], 'Squadra 1 favorita con high sens');

  // Ad alta sensibilità, la favorita scende ancora di più e lo sfavorito sale ancora di più
  assert.ok(oddsHigh['1'] < oddsLow['1'], 'Quota favorita deve essere più bassa ad alta sensibilità');
  assert.ok(oddsHigh['2'] > oddsLow['2'], 'Quota sfavorita deve essere più alta ad alta sensibilità');

  // Se squadre pari, le quote devono rimanere al valore base
  const oddsEven = computeMatchOdds(5.0, 5.0, highSensConfig);
  assert.equal(oddsEven['1'], DEFAULT_GLOBAL_CONFIG.bet_odds['1']);
  assert.equal(oddsEven['2'], DEFAULT_GLOBAL_CONFIG.bet_odds['2']);
});

test('Questionario Dinamico: Formulazione varia delle domande per evitare monotonia', () => {
  const convocati = [
    makeTestPlayer('p1', 'Giocatore Uno', [0.8, 0.7, 0.6, 0.5, 0.4, 0.2]),
    makeTestPlayer('p2', 'Giocatore Due', [0.7, 0.8, 0.5, 0.6, 0.3, 0.2]),
    makeTestPlayer('p3', 'Giocatore Tre', [0.6, 0.6, 0.8, 0.7, 0.5, 0.2]),
  ];

  const fakeMatch: Match = {
    id: 'test_m',
    date_label: 'test',
    status: 'VOTING_OPEN',
    convocati_ids: ['p1', 'p2', 'p3'],
    active_gks_ids: [],
    selected_solution: 'A',
    team_1: { gk_id: null, outfield_ids: ['p1', 'p2'], total_power: 5, avg_attrs: { tiro: 0.5, velocita: 0.5, passaggio: 0.5, resistenza: 0.5, difesa: 0.5 } },
    team_2: { gk_id: null, outfield_ids: ['p3'], total_power: 5, avg_attrs: { tiro: 0.5, velocita: 0.5, passaggio: 0.5, resistenza: 0.5, difesa: 0.5 } },
    score: { team_1: 5, team_2: 4, winner: '1' },
    odds: { '1': 1.85, 'X': 3.2, '2': 2.1 },
    bets: {},
    voting_tracker: {
      voters_completed_ids: [],
      received_count_by_player: { p1: 0, p2: 0, p3: 0 },
      anonymous_accumulators: {},
    },
  };

  const q1 = generateFairQuestionnaire('p1', fakeMatch, convocati, () => 0.1);
  const q2 = generateFairQuestionnaire('p1', fakeMatch, convocati, () => 0.9);

  assert.ok(q1.length > 0);
  assert.ok(q2.length > 0);
  // Almeno una formulazione deve differire tra RNG differenti
  const hasDiffPhrasing = q1.some((item, i) => item.question_text !== q2[i]?.question_text);
  assert.ok(hasDiffPhrasing, 'Le domande devono variare la formulazione tra chiamate con seed diversi');
});


