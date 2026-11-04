import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  appleProvider,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  AllAttrKey,
  BalancingEngineResult,
  BetPick,
  GlobalConfig,
  Match,
  Player,
  PlayerWeights,
  UserAccount,
} from '../types/models';
import {
  buildTestDatabaseSnapshot,
  DatabaseEnvironment,
  DEFAULT_GLOBAL_CONFIG,
  getResolvedDatabaseEnvironment,
  getResolvedDirettoreEmail,
  isUserEmailDirettore,
} from '../db/testDatabase';
import {
  computeMatchOdds,
  computePlayerMetrics,
  consolidateMatchVotesEMA,
  recalculateAfterManualSwap,
  recalculateWeightsFromNewInitial,
  restorePlayerToNaturalStats,
  runThreeStageBalancingEngine,
  settleMatchAndBets,
} from '../engine/mathEngine';

interface AppContextValue {
  dbEnvironment: DatabaseEnvironment;
  isLoggedIn: boolean;
  isDirettore: boolean;
  config: GlobalConfig;
  players: Player[];
  users: UserAccount[];
  match: Match | null;
  currentUser: UserAccount | null;
  currentPlayer: Player | null;
  firebaseUser: FirebaseUser | null;
  isFirestoreSynced: boolean;
  engineResult: BalancingEngineResult | null;
  toastMessage: string | null;
  clearToast: () => void;
  showToast: (msg: string) => void;

  // Auth
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginAsDemoUser: (uid: string) => void;
  logoutUser: () => Promise<void>;

  // Account Claiming (Modulo 01)
  submitAccountClaim: (playerId: string, newPlayerName?: string) => Promise<void>;
  approveAccountClaim: (uid: string) => Promise<void>;
  rejectAccountClaim: (uid: string) => Promise<void>;
  unlinkAccountClaim: (uid: string) => Promise<void>;
  assignPlayerToUser: (uid: string, playerId: string) => Promise<void>;

  // Betting 1X2 (Modulo 05)
  placeBet: (pick: BetPick, amount: number) => Promise<void>;

  // Anonymous Voting (Modulo 04)
  submitAnonymousVotes: (
    votes: Array<{ targetPlayerId: string; attribute: AllAttrKey; score: number }>
  ) => Promise<void>;

  // Backoffice Match Lifecycle & Balancing Engine (Modulo 02 & 03)
  updateMatchDetails: (dateLabel: string) => Promise<void>;
  updateDraftConvocati: (convocatiIds: string[], dateLabel?: string) => Promise<void>;
  selectBalancingProposal: (solution: 'A' | 'B') => Promise<void>;
  swapPlayersBetweenTeams: (player1Id: string, player2Id: string) => Promise<void>;
  publishMatchForBets: () => Promise<void>;
  closeBetsAndStartMatch: () => Promise<void>;
  finishMatchAndOpenVoting: (scoreTeam1: number, scoreTeam2: number) => Promise<void>;
  consolidateVotesAndArchiveMatch: () => Promise<void>;
  startNewWeeklyDraftMatch: (dateLabel: string) => Promise<void>;

  // Backoffice Players & Settings (Modulo 03)
  createNewPlayer: (params: {
    name: string;
    nickname?: string;
    weights: PlayerWeights;
    wantsToBeGk: boolean;
    initialTokens?: number;
  }) => Promise<void>;
  updatePlayerOverride: (updatedPlayer: Player) => Promise<void>;
  updatePlayerPhoto: (playerId: string, avatarUrl: string) => Promise<void>;
  togglePlayerOverride: (playerId: string, enableOverride: boolean) => Promise<void>;
  deletePlayer: (playerId: string) => Promise<void>;
  updateGlobalSettings: (newConfig: GlobalConfig) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function stripUndefinedDeep<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (val !== undefined) {
      cleaned[key] = stripUndefinedDeep(val);
    }
  }
  return cleaned as T;
}

function sanitizePlayerRecord(raw: Player): Player {
  const cleanNickname = (raw.nickname || '').trim().slice(0, 60);
  const baseWeights: PlayerWeights = {
    tiro: Number(raw.weights?.tiro ?? 0.6),
    velocita: Number(raw.weights?.velocita ?? 0.6),
    passaggio: Number(raw.weights?.passaggio ?? 0.6),
    resistenza: Number(raw.weights?.resistenza ?? 0.6),
    difesa: Number(raw.weights?.difesa ?? 0.6),
    portiere: Number(raw.weights?.portiere ?? 0.2),
  };
  const initWeights: PlayerWeights = raw.initial_weights
    ? {
        tiro: Number(raw.initial_weights.tiro ?? baseWeights.tiro),
        velocita: Number(raw.initial_weights.velocita ?? baseWeights.velocita),
        passaggio: Number(raw.initial_weights.passaggio ?? baseWeights.passaggio),
        resistenza: Number(raw.initial_weights.resistenza ?? baseWeights.resistenza),
        difesa: Number(raw.initial_weights.difesa ?? baseWeights.difesa),
        portiere: Number(raw.initial_weights.portiere ?? baseWeights.portiere),
      }
    : { ...baseWeights };

  const sanitized: Player = {
    id: raw.id,
    name: (raw.name || '').trim().slice(0, 60) || raw.id,
    nickname: cleanNickname,
    avatar_url: raw.avatar_url ?? '',
    claimed_by_uid: raw.claimed_by_uid ?? '',
    claim_status: raw.claim_status ?? 'UNCLAIMED',
    is_active: Boolean(raw.is_active),
    weights: baseWeights,
    initial_weights: initWeights,
    wants_to_be_gk: Boolean(raw.wants_to_be_gk),
    computed: raw.computed,
    attr_votes_count: {
      tiro: Number(raw.attr_votes_count?.tiro ?? 0),
      velocita: Number(raw.attr_votes_count?.velocita ?? 0),
      passaggio: Number(raw.attr_votes_count?.passaggio ?? 0),
      resistenza: Number(raw.attr_votes_count?.resistenza ?? 0),
      difesa: Number(raw.attr_votes_count?.difesa ?? 0),
      portiere: Number(raw.attr_votes_count?.portiere ?? 0),
    },
    stats: {
      tokens: Number(raw.stats?.tokens ?? 0),
      matches_played: Number(raw.stats?.matches_played ?? 0),
      matches_won: Number(raw.stats?.matches_won ?? 0),
      matches_drawn: Number(raw.stats?.matches_drawn ?? 0),
      bets_total: Number(raw.stats?.bets_total ?? 0),
      bets_won: Number(raw.stats?.bets_won ?? 0),
      bets_net_profit: Number(raw.stats?.bets_net_profit ?? 0),
      votes_completed_matches: Number(raw.stats?.votes_completed_matches ?? 0),
    },
  };

  return sanitized;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Database environment determined exclusively by secret / env var (default: 'test')
  const dbEnvironment = useMemo<DatabaseEnvironment>(
    () => getResolvedDatabaseEnvironment(),
    []
  );

  const isProd = dbEnvironment === 'PRODUCTION_DB';

  const STORAGE_KEYS = useMemo(() => {
    const prefix = isProd ? 'calcetto_prod_v5' : 'calcetto_test_v5';
    return {
      CONFIG: `${prefix}_config`,
      PLAYERS: `${prefix}_players`,
      USERS: `${prefix}_users`,
      MATCH: `${prefix}_match`,
      ACTIVE_UID: `${prefix}_active_uid`,
    };
  }, [isProd]);

  const initialTestSnapshot = useMemo(
    () => buildTestDatabaseSnapshot('ASYMMETRIC_POOL'),
    []
  );

  const [config, setConfig] = useState<GlobalConfig>(() => {
    const loaded = loadFromStorage(
      STORAGE_KEYS.CONFIG,
      isProd ? DEFAULT_GLOBAL_CONFIG : initialTestSnapshot.config
    );
    return {
      ...loaded,
      dynamic_odds_enabled: true,
      dynamic_odds_sensitivity: loaded.dynamic_odds_sensitivity ?? 0.5,
    };
  });
  const [players, setPlayers] = useState<Player[]>(() =>
    loadFromStorage(
      STORAGE_KEYS.PLAYERS,
      isProd ? [] : initialTestSnapshot.players
    )
  );
  const [users, setUsers] = useState<UserAccount[]>(() =>
    loadFromStorage(
      STORAGE_KEYS.USERS,
      isProd ? [] : initialTestSnapshot.users
    )
  );
  const [match, setMatch] = useState<Match | null>(() =>
    loadFromStorage<Match | null>(
      STORAGE_KEYS.MATCH,
      isProd ? null : initialTestSnapshot.match
    )
  );
  const [activeUid, setActiveUid] = useState<string | null>(() =>
    loadFromStorage<string | null>(STORAGE_KEYS.ACTIVE_UID, null)
  );
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirestoreSynced, setIsFirestoreSynced] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => setToastMessage(msg);
  const clearToast = () => setToastMessage(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
      localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      localStorage.setItem(STORAGE_KEYS.MATCH, JSON.stringify(match));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_UID, JSON.stringify(activeUid));
    } catch {
      // Ignore storage quota errors
    }
  }, [config, players, users, match, activeUid, STORAGE_KEYS]);

  // Production Firestore: Real-time listeners & initial fetch (strictly only in PRODUCTION_DB)
  useEffect(() => {
    if (!isProd) {
      setIsFirestoreSynced(false);
      return;
    }

    testFirestoreConnection();

    // 1. Realtime listener for players in Firestore
    const unsubPlayers = onSnapshot(
      collection(db, 'players'),
      (snapshot) => {
        const remotePlayers = snapshot.docs.map((d) =>
          sanitizePlayerRecord(d.data() as Player)
        );
        setPlayers(remotePlayers);
      },
      (err) => {
        console.warn('Firestore players snapshot:', err.message);
      }
    );

    // 2. Fetch config and active match (if configured in Firestore)
    let unsubMatch: (() => void) | null = null;
    const fetchConfigAndMatch = async () => {
      try {
        const cfgRef = doc(db, 'config', 'global_settings');
        const cfgSnap = await getDoc(cfgRef);
        if (cfgSnap.exists()) {
          const rawRemoteCfg = cfgSnap.data() as GlobalConfig;
          const remoteCfg: GlobalConfig = {
            ...rawRemoteCfg,
            dynamic_odds_enabled: true,
            dynamic_odds_sensitivity: rawRemoteCfg.dynamic_odds_sensitivity ?? 0.5,
          };
          setConfig(remoteCfg);

          if (remoteCfg.active_match_id) {
            unsubMatch = onSnapshot(
              doc(db, 'matches', remoteCfg.active_match_id),
              (mSnap) => {
                if (mSnap.exists()) {
                  const remoteMatch = mSnap.data() as Match;
                  const recomputedOdds = computeMatchOdds(
                    remoteMatch.team_1.total_power,
                    remoteMatch.team_2.total_power,
                    remoteCfg
                  );
                  setMatch({
                    ...remoteMatch,
                    odds: recomputedOdds,
                  });
                } else {
                  setMatch(null);
                }
              },
              (err) => console.warn('Firestore match snapshot:', err.message)
            );
          } else {
            setMatch(null);
          }
        } else {
          setMatch(null);
        }
      } catch (err) {
        console.warn('Firestore initial fetch:', err);
      }
    };

    fetchConfigAndMatch();

    return () => {
      unsubPlayers();
      if (unsubMatch) unsubMatch();
    };
  }, [isProd]);

  const upsertLocalFirebaseUser = (fbUser: FirebaseUser): UserAccount => {
    const isDirettoreBySecret = isUserEmailDirettore(fbUser.email);
    const fallbackRecord: UserAccount = {
      uid: fbUser.uid,
      email: fbUser.email || '',
      display_name: fbUser.displayName || fbUser.email || 'Utente Google',
      linked_player_id: '',
      auth_status: isDirettoreBySecret ? 'VALIDATED' : 'UNCLAIMED',
      is_admin: isDirettoreBySecret,
      created_at: Date.now(),
    };

    setUsers((prev) => {
      const existing = prev.find((u) => u.uid === fbUser.uid);
      if (existing) {
        const merged: UserAccount = {
          ...existing,
          email: fbUser.email || existing.email,
          display_name: existing.display_name || fbUser.displayName || fbUser.email || 'Utente Google',
          is_admin: isDirettoreBySecret,
          auth_status: isDirettoreBySecret
            ? 'VALIDATED'
            : existing.linked_player_id
              ? existing.auth_status
              : 'UNCLAIMED',
        };
        return prev.map((u) => (u.uid === fbUser.uid ? merged : u));
      }
      return [...prev, fallbackRecord];
    });
    setActiveUid(fbUser.uid);
    return fallbackRecord;
  };

  // Auth state listener (works in both TEST_DB and PRODUCTION_DB; syncs with Firestore in PRODUCTION_DB)
  useEffect(() => {
    let unsubUsers: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (unsubUsers) {
        unsubUsers();
        unsubUsers = null;
      }

      if (fbUser) {
        const isDirettoreBySecret = isUserEmailDirettore(fbUser.email);
        const immediateUser = upsertLocalFirebaseUser(fbUser);

        if (!isProd) {
          return;
        }

        try {
          const userRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            await setDoc(userRef, immediateUser).catch(() => {});
          } else {
            const existingUser = userSnap.data() as UserAccount;
            const updatedExisting: UserAccount = {
              ...existingUser,
              email: fbUser.email || existingUser.email,
              display_name:
                existingUser.display_name || fbUser.displayName || fbUser.email || 'Utente Google',
              is_admin: isDirettoreBySecret,
              auth_status: isDirettoreBySecret
                ? 'VALIDATED'
                : existingUser.linked_player_id
                  ? existingUser.auth_status
                  : 'UNCLAIMED',
            };
            if (
              updatedExisting.is_admin !== existingUser.is_admin ||
              updatedExisting.auth_status !== existingUser.auth_status ||
              updatedExisting.email !== existingUser.email
            ) {
              await setDoc(userRef, updatedExisting).catch(() => {});
            }
            setUsers((prev) => [
              ...prev.filter((u) => u.uid !== fbUser.uid),
              updatedExisting,
            ]);
            setActiveUid(fbUser.uid);
          }

          // Real-time listener on users collection (with rule-compliant filter) so Backoffice sees all registered users
          const usersQuery = query(
            collection(db, 'users'),
            where('auth_status', 'in', ['UNCLAIMED', 'PENDING_APPROVAL', 'VALIDATED'])
          );
          unsubUsers = onSnapshot(
            usersQuery,
            (snapshot) => {
              const remoteUsers = snapshot.docs.map((d) => {
                const u = d.data() as UserAccount;
                const dir = isUserEmailDirettore(u.email);
                return {
                  ...u,
                  is_admin: dir,
                  auth_status: dir ? 'VALIDATED' : u.auth_status,
                };
              });
              setUsers((prev) => {
                const currentAuthUser = prev.find((u) => u.uid === fbUser.uid) || immediateUser;
                const hasCurrentInRemote = remoteUsers.some((u) => u.uid === fbUser.uid);
                if (remoteUsers.length === 0) {
                  return prev.length > 0 ? prev : [currentAuthUser];
                }
                return hasCurrentInRemote ? remoteUsers : [...remoteUsers, currentAuthUser];
              });
            },
            (err) => {
              console.warn('Firestore users snapshot:', err.message);
            }
          );

          setIsFirestoreSynced(true);
        } catch (err) {
          console.warn('Firestore auth sync error:', err);
        }
      } else {
        setIsFirestoreSynced(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUsers) unsubUsers();
    };
  }, [isProd]);

  async function syncDocToFirestore(
    logicalCollection: 'config' | 'players' | 'users' | 'matches',
    docId: string,
    data: unknown,
    op: OperationType = OperationType.WRITE
  ) {
    if (!isProd || !auth.currentUser) return;
    const path = `${logicalCollection}/${docId}`;
    try {
      const payload = stripUndefinedDeep(
        logicalCollection === 'players'
          ? sanitizePlayerRecord(data as Player)
          : data
      );
      await setDoc(doc(db, logicalCollection, docId), payload);
    } catch (err) {
      handleFirestoreError(err, op, path);
    }
  }

  const currentUser = useMemo<UserAccount | null>(() => {
    if (!activeUid) return null;
    return users.find((u) => u.uid === activeUid) || null;
  }, [users, activeUid]);

  const isLoggedIn = Boolean(currentUser);

  const isDirettore = useMemo<boolean>(() => {
    if (!currentUser) return false;
    if (!isProd && currentUser.uid === 'uid_admin_diego') {
      return true;
    }
    return isUserEmailDirettore(currentUser.email);
  }, [currentUser, isProd]);

  const currentPlayer = useMemo<Player | null>(() => {
    if (!currentUser || !currentUser.linked_player_id) return null;
    return players.find((p) => p.id === currentUser.linked_player_id) || null;
  }, [players, currentUser]);

  const engineResult = useMemo<BalancingEngineResult | null>(() => {
    if (!match || match.convocati_ids.length !== 10) return null;
    const convocatiPlayers = match.convocati_ids
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is Player => Boolean(p));
    if (convocatiPlayers.length !== 10) return null;
    try {
      return runThreeStageBalancingEngine(convocatiPlayers, config);
    } catch {
      return null;
    }
  }, [match, players, config]);

  // Auth actions
  const loginWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        upsertLocalFirebaseUser(cred.user);
      }
      showToast('Accesso Google completato con successo!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore durante il login Google';
      showToast(`Login Google: ${msg}`);
    }
  };

  const loginWithApple = async () => {
    try {
      const cred = await signInWithPopup(auth, appleProvider);
      if (cred.user) {
        upsertLocalFirebaseUser(cred.user);
      }
      showToast('Accesso Apple completato con successo!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore durante il login Apple';
      showToast(`Login Apple: ${msg}`);
    }
  };

  const loginAsDemoUser = (uid: string) => {
    setActiveUid(uid);
    const target = users.find((u) => u.uid === uid);
    if (target) {
      showToast(`Accesso effettuato come ${target.display_name}`);
    }
  };

  const logoutUser = async () => {
    if (auth.currentUser) {
      await signOut(auth);
    }
    setActiveUid(null);
    showToast('Sessione disconnessa.');
  };

  // Modulo 01: Account Claiming
  const submitAccountClaim = async (playerId: string, newPlayerName?: string) => {
    if (!currentUser) {
      showToast('Accedi prima di associare il tuo profilo.');
      return;
    }
    const autoValidate =
      isDirettore ||
      currentUser.is_admin === true ||
      isUserEmailDirettore(currentUser.email);
    const nextStatus = autoValidate ? ('VALIDATED' as const) : ('PENDING_APPROVAL' as const);

    let targetPlayerId = playerId;
    let updatedPlayers = [...players];

    // If user previously had another player linked, free that old player
    if (currentUser.linked_player_id && currentUser.linked_player_id !== playerId) {
      const prevId = currentUser.linked_player_id;
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === prevId
          ? { ...p, claimed_by_uid: '', claim_status: 'UNCLAIMED' as const }
          : p
      );
      const freedP = updatedPlayers.find((p) => p.id === prevId);
      if (freedP) {
        await syncDocToFirestore('players', freedP.id, freedP, OperationType.UPDATE);
      }
    }

    if (playerId === 'NEW_PLAYER' && newPlayerName && newPlayerName.trim()) {
      const cleanId = `player_${newPlayerName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
      const defaultWeights: PlayerWeights = {
        tiro: 0.6,
        velocita: 0.6,
        passaggio: 0.6,
        resistenza: 0.6,
        difesa: 0.6,
        portiere: 0.2,
      };
      const m = computePlayerMetrics(defaultWeights, false, config);
      const createdPlayer: Player = {
        id: cleanId,
        name: newPlayerName.trim().slice(0, 60),
        avatar_url: '',
        claimed_by_uid: currentUser.uid,
        claim_status: nextStatus,
        is_active: true,
        weights: defaultWeights,
        initial_weights: defaultWeights,
        wants_to_be_gk: false,
        computed: m.computed,
        attr_votes_count: {
          tiro: 0,
          velocita: 0,
          passaggio: 0,
          resistenza: 0,
          difesa: 0,
          portiere: 0,
        },
        stats: {
          tokens: autoValidate ? config.initial_tokens : 0,
          matches_played: 0,
          matches_won: 0,
          matches_drawn: 0,
          bets_total: 0,
          bets_won: 0,
          bets_net_profit: 0,
          votes_completed_matches: 0,
        },
      };
      updatedPlayers.push(createdPlayer);
      targetPlayerId = cleanId;
      await syncDocToFirestore('players', createdPlayer.id, createdPlayer, OperationType.CREATE);
    } else {
      updatedPlayers = updatedPlayers.map((p) => {
        if (p.id === targetPlayerId) {
          const welcomeTokens =
            autoValidate && p.stats.tokens === 0
              ? config.initial_tokens
              : p.stats.tokens;
          return {
            ...p,
            claimed_by_uid: currentUser.uid,
            claim_status: nextStatus,
            stats: {
              ...p.stats,
              tokens: welcomeTokens,
            },
          };
        }
        return p;
      });
      const targetP = updatedPlayers.find((p) => p.id === targetPlayerId);
      if (targetP) {
        await syncDocToFirestore('players', targetP.id, targetP, OperationType.UPDATE);
      }
    }

    const updatedUser: UserAccount = {
      ...currentUser,
      linked_player_id: targetPlayerId,
      auth_status: nextStatus,
    };

    setPlayers(updatedPlayers);
    setUsers((prev) =>
      prev.map((u) => (u.uid === currentUser.uid ? updatedUser : u))
    );
    await syncDocToFirestore('users', updatedUser.uid, updatedUser, OperationType.UPDATE);
    showToast(
      autoValidate
        ? 'Profilo giocatore collegato e convalidato!'
        : 'Richiesta inviata. Il Direttore confermerà la tua associazione.'
    );
  };

  const approveAccountClaim = async (uid: string) => {
    const userToApprove = users.find((u) => u.uid === uid);
    if (!userToApprove || !userToApprove.linked_player_id) return;

    const updatedUser: UserAccount = {
      ...userToApprove,
      auth_status: 'VALIDATED',
    };

    const updatedPlayers = players.map((p) => {
      if (p.id === userToApprove.linked_player_id) {
        const welcomeTokens =
          p.stats.tokens === 0 ? config.initial_tokens : p.stats.tokens;
        return {
          ...p,
          claimed_by_uid: uid,
          claim_status: 'VALIDATED' as const,
          stats: {
            ...p.stats,
            tokens: welcomeTokens,
          },
        };
      }
      return p;
    });

    setUsers((prev) => prev.map((u) => (u.uid === uid ? updatedUser : u)));
    setPlayers(updatedPlayers);

    await syncDocToFirestore('users', updatedUser.uid, updatedUser, OperationType.UPDATE);
    const linkedP = updatedPlayers.find((p) => p.id === userToApprove.linked_player_id);
    if (linkedP) {
      await syncDocToFirestore('players', linkedP.id, linkedP, OperationType.UPDATE);
    }

    showToast(
      `Profilo di ${userToApprove.display_name} approvato! Accreditati +${config.initial_tokens} Token di benvenuto.`
    );
  };

  const rejectAccountClaim = async (uid: string) => {
    const userToReject = users.find((u) => u.uid === uid);
    if (!userToReject) return;

    const oldPlayerId = userToReject.linked_player_id;
    const isAdminUser =
      userToReject.is_admin || isUserEmailDirettore(userToReject.email);
    const updatedUser: UserAccount = {
      ...userToReject,
      linked_player_id: '',
      auth_status: isAdminUser ? 'VALIDATED' : 'UNCLAIMED',
    };

    const updatedPlayers = players.map((p) =>
      p.id === oldPlayerId
        ? { ...p, claimed_by_uid: '', claim_status: 'UNCLAIMED' as const }
        : p
    );

    setUsers((prev) => prev.map((u) => (u.uid === uid ? updatedUser : u)));
    setPlayers(updatedPlayers);

    await syncDocToFirestore('users', updatedUser.uid, updatedUser, OperationType.UPDATE);
    const oldP = updatedPlayers.find((p) => p.id === oldPlayerId);
    if (oldP) {
      await syncDocToFirestore('players', oldP.id, oldP, OperationType.UPDATE);
    }
    showToast(`Associazione profilo di ${userToReject.display_name} rimossa.`);
  };

  const unlinkAccountClaim = async (uid: string) => {
    await rejectAccountClaim(uid);
  };

  const assignPlayerToUser = async (uid: string, playerId: string) => {
    const targetUser = users.find((u) => u.uid === uid);
    if (!targetUser) return;

    const cleanPlayerId = playerId.trim();
    if (!cleanPlayerId) {
      await unlinkAccountClaim(uid);
      return;
    }

    const targetPlayer = players.find((p) => p.id === cleanPlayerId);
    if (!targetPlayer) return;

    const oldPlayerIdForThisUser = targetUser.linked_player_id;
    const previousOwnerUidOfTargetPlayer = targetPlayer.claimed_by_uid;

    const updatedUsers = users.map((u) => {
      if (u.uid === uid) {
        return {
          ...u,
          linked_player_id: cleanPlayerId,
          auth_status: 'VALIDATED' as const,
        };
      }
      if (
        previousOwnerUidOfTargetPlayer &&
        u.uid === previousOwnerUidOfTargetPlayer &&
        u.uid !== uid
      ) {
        const isOtherAdmin = u.is_admin || isUserEmailDirettore(u.email);
        return {
          ...u,
          linked_player_id: '',
          auth_status: isOtherAdmin ? ('VALIDATED' as const) : ('UNCLAIMED' as const),
        };
      }
      return u;
    });

    const updatedPlayers = players.map((p) => {
      if (p.id === cleanPlayerId) {
        const welcomeTokens =
          p.stats.tokens === 0 ? config.initial_tokens : p.stats.tokens;
        return {
          ...p,
          claimed_by_uid: uid,
          claim_status: 'VALIDATED' as const,
          stats: {
            ...p.stats,
            tokens: welcomeTokens,
          },
        };
      }
      if (oldPlayerIdForThisUser && p.id === oldPlayerIdForThisUser && p.id !== cleanPlayerId) {
        return {
          ...p,
          claimed_by_uid: '',
          claim_status: 'UNCLAIMED' as const,
        };
      }
      return p;
    });

    setUsers(updatedUsers);
    setPlayers(updatedPlayers);

    for (const u of updatedUsers) {
      const orig = users.find((x) => x.uid === u.uid);
      if (
        !orig ||
        orig.linked_player_id !== u.linked_player_id ||
        orig.auth_status !== u.auth_status
      ) {
        await syncDocToFirestore('users', u.uid, u, OperationType.UPDATE);
      }
    }

    for (const p of updatedPlayers) {
      const orig = players.find((x) => x.id === p.id);
      if (
        !orig ||
        orig.claimed_by_uid !== p.claimed_by_uid ||
        orig.claim_status !== p.claim_status ||
        orig.stats.tokens !== p.stats.tokens
      ) {
        await syncDocToFirestore('players', p.id, p, OperationType.UPDATE);
      }
    }

    showToast(
      `Utente "${targetUser.display_name}" collegato al giocatore "${targetPlayer.name}".`
    );
  };

  // Modulo 05: Scommesse 1X2
  const placeBet = async (pick: BetPick, amount: number) => {
    if (!match) {
      showToast('Nessuna partita attiva su cui scommettere.');
      return;
    }
    if (!currentUser || currentUser.auth_status !== 'VALIDATED' || !currentPlayer) {
      showToast('Devi aver effettuato l’accesso con un profilo validato per scommettere.');
      return;
    }
    if (match.status !== 'OPEN_FOR_BETS') {
      showToast('Le scommesse sono attualmente chiuse per questa partita.');
      return;
    }
    if (match.bets[currentPlayer.id]) {
      showToast('Hai già piazzato la tua scommessa per questo match.');
      return;
    }
    const cleanAmount = Math.floor(amount);
    if (cleanAmount < 1 || cleanAmount > currentPlayer.stats.tokens) {
      showToast('Importo puntata non valido rispetto al tuo saldo Token.');
      return;
    }
    if (config.max_bet_amount && cleanAmount > config.max_bet_amount) {
      showToast(`Puntata massima: ${config.max_bet_amount} Token.`);
      return;
    }

    const currentLiveOdds = computeMatchOdds(
      match.team_1.total_power,
      match.team_2.total_power,
      config
    );
    const oddsForPick = currentLiveOdds[pick];
    const potential_payout = Math.round(cleanAmount * oddsForPick);

    const updatedPlayer: Player = {
      ...currentPlayer,
      stats: {
        ...currentPlayer.stats,
        tokens: currentPlayer.stats.tokens - cleanAmount,
      },
    };

    const updatedMatch: Match = {
      ...match,
      bets: {
        ...match.bets,
        [currentPlayer.id]: {
          pick,
          amount: cleanAmount,
          potential_payout,
          settled: false,
          status: 'PENDING',
        },
      },
    };

    setPlayers((prev) =>
      prev.map((p) => (p.id === updatedPlayer.id ? updatedPlayer : p))
    );
    setMatch(updatedMatch);

    await syncDocToFirestore('players', updatedPlayer.id, updatedPlayer, OperationType.UPDATE);
    await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);

    showToast(
      `Scommessa piazzata: ${cleanAmount} Token sul segno ${pick} (Vincita: ${potential_payout} Token)`
    );
  };

  // Modulo 04: Invio dei 5 voti anonimi e Riscatto Token Presenza
  const submitAnonymousVotes = async (
    votes: Array<{ targetPlayerId: string; attribute: AllAttrKey; score: number }>
  ) => {
    if (!match) {
      showToast('Nessuna partita attiva.');
      return;
    }
    if (!currentPlayer || !currentUser || currentUser.auth_status !== 'VALIDATED') {
      showToast('Devi avere un profilo giocatore validato per votare.');
      return;
    }
    if (match.status !== 'VOTING_OPEN') {
      showToast('La finestra di voto non è aperta.');
      return;
    }
    if (!match.convocati_ids.includes(currentPlayer.id)) {
      showToast('Solo i 10 giocatori convocati nel match possono votare.');
      return;
    }
    if (match.voting_tracker.voters_completed_ids.includes(currentPlayer.id)) {
      showToast('Hai già votato per questo match.');
      return;
    }
    if (votes.length !== 5) {
      showToast('Rispondi a tutte le 5 domande per completare la valutazione.');
      return;
    }

    const newReceivedCount = { ...match.voting_tracker.received_count_by_player };
    const newAccumulators: Match['voting_tracker']['anonymous_accumulators'] = JSON.parse(
      JSON.stringify(match.voting_tracker.anonymous_accumulators)
    );

    for (const v of votes) {
      newReceivedCount[v.targetPlayerId] = (newReceivedCount[v.targetPlayerId] ?? 0) + 1;
      if (!newAccumulators[v.targetPlayerId]) {
        newAccumulators[v.targetPlayerId] = {};
      }
      const prevAcc = newAccumulators[v.targetPlayerId][v.attribute] ?? {
        sum: 0,
        count: 0,
      };
      newAccumulators[v.targetPlayerId][v.attribute] = {
        sum: Number((prevAcc.sum + v.score).toFixed(2)),
        count: prevAcc.count + 1,
      };
    }

    const updatedMatch: Match = {
      ...match,
      voting_tracker: {
        voters_completed_ids: [
          ...match.voting_tracker.voters_completed_ids,
          currentPlayer.id,
        ],
        received_count_by_player: newReceivedCount,
        anonymous_accumulators: newAccumulators,
      },
    };

    const reward = config.attendance_reward_tokens;
    const updatedVoter: Player = {
      ...currentPlayer,
      stats: {
        ...currentPlayer.stats,
        tokens: currentPlayer.stats.tokens + reward,
        votes_completed_matches: currentPlayer.stats.votes_completed_matches + 1,
      },
    };

    setMatch(updatedMatch);
    setPlayers((prev) =>
      prev.map((p) => (p.id === updatedVoter.id ? updatedVoter : p))
    );

    await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
    await syncDocToFirestore('players', updatedVoter.id, updatedVoter, OperationType.UPDATE);

    showToast(
      `Voti registrati con successo! Riscattati +${reward} Token Presenza.`
    );
  };

  // Modulo 03: Backoffice Match Management (Il Direttore)
  const updateDraftConvocati = async (convocatiIds: string[], dateLabel?: string) => {
    if (!match) return;
    if (match.status !== 'DRAFT') {
      showToast('I convocati possono essere modificati solo in bozza (DRAFT).');
      return;
    }
    if (convocatiIds.length !== 10) {
      showToast(`Seleziona esattamente 10 giocatori (attuali: ${convocatiIds.length}).`);
      return;
    }

    const convocatiPlayers = convocatiIds
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is Player => Boolean(p));

    const res = runThreeStageBalancingEngine(convocatiPlayers, config);
    const chosenProposal =
      match.selected_solution === 'B' ? res.proposal_B : res.proposal_A;
    const newOdds = computeMatchOdds(
      chosenProposal.team_1.total_power,
      chosenProposal.team_2.total_power,
      config
    );

    const updatedMatch: Match = {
      ...match,
      date_label: dateLabel ? dateLabel.trim() : match.date_label,
      convocati_ids: convocatiIds,
      active_gks_ids: res.active_gks_ids,
      selected_solution: match.selected_solution === 'B' ? 'B' : 'A',
      team_1: chosenProposal.team_1,
      team_2: chosenProposal.team_2,
      odds: newOdds,
    };

    setMatch(updatedMatch);
    await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
    showToast('Convocati salvati e formazioni aggiornate.');
  };

  const updateMatchDetails = async (dateLabel: string) => {
    if (!match) return;
    const trimmed = dateLabel.trim().slice(0, 120);
    if (!trimmed) {
      showToast('Inserisci data, ora e luogo validi.');
      return;
    }
    const updatedMatch: Match = {
      ...match,
      date_label: trimmed,
    };
    setMatch(updatedMatch);
    await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
    showToast('Data, ora e luogo del match aggiornati.');
  };

  const selectBalancingProposal = async (solution: 'A' | 'B') => {
    if (!match || !engineResult) return;
    const chosen =
      solution === 'A' ? engineResult.proposal_A : engineResult.proposal_B;
    const newOdds = computeMatchOdds(
      chosen.team_1.total_power,
      chosen.team_2.total_power,
      config
    );
    const updatedMatch: Match = {
      ...match,
      selected_solution: solution,
      team_1: chosen.team_1,
      team_2: chosen.team_2,
      odds: newOdds,
    };
    setMatch(updatedMatch);
    await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
    showToast(`Formazione impostata su Proposta ${solution}.`);
  };

  const swapPlayersBetweenTeams = async (player1Id: string, player2Id: string) => {
    if (!match) return;
    const t1All = [
      ...(match.team_1.gk_id ? [match.team_1.gk_id] : []),
      ...match.team_1.outfield_ids,
    ];
    const t2All = [
      ...(match.team_2.gk_id ? [match.team_2.gk_id] : []),
      ...match.team_2.outfield_ids,
    ];

    const p1InT1 = t1All.includes(player1Id);
    const p2InT2 = t2All.includes(player2Id);
    const p1InT2 = t2All.includes(player1Id);
    const p2InT1 = t1All.includes(player2Id);

    if (!((p1InT1 && p2InT2) || (p1InT2 && p2InT1))) {
      showToast('Seleziona un giocatore per ciascuna squadra per lo scambio.');
      return;
    }

    const fromT1 = p1InT1 ? player1Id : player2Id;
    const fromT2 = p1InT1 ? player2Id : player1Id;

    const newT1Gk = match.team_1.gk_id === fromT1 ? fromT2 : match.team_1.gk_id;
    const newT2Gk = match.team_2.gk_id === fromT2 ? fromT1 : match.team_2.gk_id;

    const newT1Out = match.team_1.outfield_ids.map((id) =>
      id === fromT1 ? fromT2 : id
    );
    const newT2Out = match.team_2.outfield_ids.map((id) =>
      id === fromT2 ? fromT1 : id
    );

    const convocatiPlayers = match.convocati_ids
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is Player => Boolean(p));

    const recalculated = recalculateAfterManualSwap(
      convocatiPlayers,
      { gk_id: newT1Gk, outfield_ids: newT1Out },
      { gk_id: newT2Gk, outfield_ids: newT2Out },
      config
    );

    const newOdds = computeMatchOdds(
      recalculated.team_1.total_power,
      recalculated.team_2.total_power,
      config
    );

    const updatedMatch: Match = {
      ...match,
      selected_solution: 'CUSTOM',
      team_1: recalculated.team_1,
      team_2: recalculated.team_2,
      odds: newOdds,
    };

    setMatch(updatedMatch);
    await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
    showToast('Scambio manuale completato con ricalcolo quote dinamiche.');
  };

  const publishMatchForBets = async () => {
    if (!match) return;
    const newOdds = computeMatchOdds(
      match.team_1.total_power,
      match.team_2.total_power,
      config
    );
    const updatedMatch: Match = {
      ...match,
      status: 'OPEN_FOR_BETS',
      odds: newOdds,
    };
    setMatch(updatedMatch);
    await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
    showToast('Match pubblicato e scommesse aperte!');
  };

  const closeBetsAndStartMatch = async () => {
    if (!match) return;
    const lockedOdds = computeMatchOdds(
      match.team_1.total_power,
      match.team_2.total_power,
      config
    );
    const updatedMatch: Match = {
      ...match,
      status: 'IN_PLAY',
      odds: lockedOdds,
    };
    setMatch(updatedMatch);
    await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
    showToast('Scommesse chiuse. Match in corso.');
  };

  const finishMatchAndOpenVoting = async (scoreTeam1: number, scoreTeam2: number) => {
    if (!match) return;
    const { updatedPlayers, updatedMatch } = settleMatchAndBets(
      players,
      match,
      scoreTeam1,
      scoreTeam2
    );
    setPlayers(updatedPlayers);
    setMatch(updatedMatch);

    await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
    for (const p of updatedPlayers) {
      await syncDocToFirestore('players', p.id, p, OperationType.UPDATE);
    }

    showToast(
      `Risultato finale ${scoreTeam1}-${scoreTeam2} registrato. Scommesse liquidate e voti aperti.`
    );
  };

  const consolidateVotesAndArchiveMatch = async () => {
    if (!match) return;
    const updatedPlayers = consolidateMatchVotesEMA(players, match, config);
    const updatedMatch: Match = {
      ...match,
      status: 'ARCHIVED',
    };

    setPlayers(updatedPlayers);
    setMatch(updatedMatch);

    await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
    for (const p of updatedPlayers) {
      await syncDocToFirestore('players', p.id, p, OperationType.UPDATE);
    }

    showToast('Voti consolidati e Carte FUT aggiornate.');
  };

  const startNewWeeklyDraftMatch = async (dateLabel: string) => {
    const newId = `match_${Date.now()}`;
    const defaultConvocati = players
      .filter((p) => p.is_active)
      .slice(0, 10)
      .map((p) => p.id);
    const convocatiPlayers = players.filter((p) => defaultConvocati.includes(p.id));

    let active_gks_ids: string[] = [];
    let team_1 = {
      gk_id: null as string | null,
      outfield_ids: [] as string[],
      total_power: 0,
      avg_attrs: { tiro: 0, velocita: 0, passaggio: 0, resistenza: 0, difesa: 0 },
    };
    let team_2 = {
      gk_id: null as string | null,
      outfield_ids: [] as string[],
      total_power: 0,
      avg_attrs: { tiro: 0, velocita: 0, passaggio: 0, resistenza: 0, difesa: 0 },
    };
    let odds: Record<BetPick, number> = { '1': 1.85, 'X': 3.2, '2': 2.1 };

    if (convocatiPlayers.length === 10) {
      try {
        const res = runThreeStageBalancingEngine(convocatiPlayers, config);
        active_gks_ids = res.active_gks_ids;
        team_1 = res.proposal_A.team_1;
        team_2 = res.proposal_A.team_2;
        odds = computeMatchOdds(
          res.proposal_A.team_1.total_power,
          res.proposal_A.team_2.total_power,
          config
        );
      } catch (err) {
        console.warn('Balancing engine info:', err);
      }
    }

    const receivedInit: Record<string, number> = {};
    for (const id of defaultConvocati) {
      receivedInit[id] = 0;
    }

    const newMatch: Match = {
      id: newId,
      date_label: dateLabel.trim() || 'Prossima Partita — Ore 21:00',
      status: 'DRAFT',
      convocati_ids: defaultConvocati,
      active_gks_ids,
      selected_solution: 'A',
      team_1,
      team_2,
      score: { team_1: null, team_2: null, winner: null },
      odds,
      bets: {},
      voting_tracker: {
        voters_completed_ids: [],
        received_count_by_player: receivedInit,
        anonymous_accumulators: {},
      },
    };

    const newConfig = { ...config, active_match_id: newId };
    setConfig(newConfig);
    setMatch(newMatch);

    await syncDocToFirestore('config', 'global_settings', newConfig, OperationType.UPDATE);
    await syncDocToFirestore('matches', newMatch.id, newMatch, OperationType.CREATE);

    showToast('Nuovo match creato in bozza.');
  };

  const createNewPlayer = async (params: {
    name: string;
    nickname?: string;
    weights: PlayerWeights;
    wantsToBeGk: boolean;
    initialTokens?: number;
  }) => {
    const cleanName = params.name.trim().slice(0, 60);
    if (!cleanName) return;
    const cleanNickname = (params.nickname || '').trim().slice(0, 60);

    const id = `player_${cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
    const m = computePlayerMetrics(params.weights, params.wantsToBeGk, config);

    const newPlayer: Player = sanitizePlayerRecord({
      id,
      name: cleanName,
      ...(cleanNickname ? { nickname: cleanNickname } : {}),
      avatar_url: '',
      claimed_by_uid: '',
      claim_status: 'UNCLAIMED',
      is_active: true,
      weights: params.weights,
      initial_weights: params.weights,
      wants_to_be_gk: params.wantsToBeGk,
      computed: m.computed,
      attr_votes_count: {
        tiro: 0,
        velocita: 0,
        passaggio: 0,
        resistenza: 0,
        difesa: 0,
        portiere: 0,
      },
      stats: {
        tokens: params.initialTokens ?? 0,
        matches_played: 0,
        matches_won: 0,
        matches_drawn: 0,
        bets_total: 0,
        bets_won: 0,
        bets_net_profit: 0,
        votes_completed_matches: 0,
      },
    });

    setPlayers((prev) => [...prev, newPlayer]);
    await syncDocToFirestore('players', newPlayer.id, newPlayer, OperationType.CREATE);
    showToast(`Giocatore "${cleanName}" aggiunto.`);
  };

  const updatePlayerOverride = async (updatedPlayer: Player) => {
    const original = players.find((p) => p.id === updatedPlayer.id);

    const oldInitial: PlayerWeights =
      original?.initial_weights ?? original?.weights ?? updatedPlayer.weights;
    const newInitial: PlayerWeights =
      updatedPlayer.initial_weights ?? updatedPlayer.weights;

    // Ricalcola i pesi attuali mantenendo l'effetto dei voti passati (delta EMA)
    const activeWeights: PlayerWeights = original
      ? recalculateWeightsFromNewInitial(original.weights, oldInitial, newInitial)
      : newInitial;

    const m = computePlayerMetrics(
      activeWeights,
      updatedPlayer.wants_to_be_gk,
      config
    );

    const cleanNickname = updatedPlayer.nickname?.trim().slice(0, 60);
    const { nickname: _discardedNickname, ...restPlayer } = updatedPlayer;

    const finalized: Player = sanitizePlayerRecord({
      ...restPlayer,
      name: updatedPlayer.name.trim().slice(0, 60),
      ...(cleanNickname ? { nickname: cleanNickname } : {}),
      initial_weights: newInitial,
      weights: activeWeights,
      computed: m.computed,
    });

    const nextPlayers = players.map((p) => (p.id === finalized.id ? finalized : p));
    setPlayers(nextPlayers);
    await syncDocToFirestore('players', finalized.id, finalized, OperationType.UPDATE);

    if (match && match.convocati_ids.includes(finalized.id) && match.status !== 'ARCHIVED') {
      const convocatiPlayers = match.convocati_ids
        .map((id) => nextPlayers.find((p) => p.id === id))
        .filter((p): p is Player => Boolean(p));

      if (convocatiPlayers.length === 10) {
        const recalculated = recalculateAfterManualSwap(
          convocatiPlayers,
          { gk_id: match.team_1.gk_id, outfield_ids: match.team_1.outfield_ids },
          { gk_id: match.team_2.gk_id, outfield_ids: match.team_2.outfield_ids },
          config
        );
        const newOdds = computeMatchOdds(
          recalculated.team_1.total_power,
          recalculated.team_2.total_power,
          config
        );
        const updatedMatch: Match = {
          ...match,
          team_1: recalculated.team_1,
          team_2: recalculated.team_2,
          odds: newOdds,
        };
        setMatch(updatedMatch);
        await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
      }
    }

    showToast(`Valori iniziali e profilo di ${finalized.name} aggiornati.`);
  };

  const updatePlayerPhoto = async (playerId: string, avatarUrl: string) => {
    const target = players.find((p) => p.id === playerId);
    if (!target) return;

    const updated: Player = {
      ...target,
      avatar_url: avatarUrl,
    };

    setPlayers((prev) => prev.map((p) => (p.id === playerId ? updated : p)));
    await syncDocToFirestore('players', updated.id, updated, OperationType.UPDATE);
    showToast(
      avatarUrl
        ? `Foto di ${target.name} aggiornata sulla FUT Card!`
        : `Foto di ${target.name} rimossa.`
    );
  };

  const togglePlayerOverride = async (playerId: string, _enableOverride: boolean) => {
    const target = players.find((p) => p.id === playerId);
    if (!target) return;
    const updated = restorePlayerToNaturalStats(target, config);
    setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    await syncDocToFirestore('players', updated.id, updated, OperationType.UPDATE);
    showToast(`Statistiche di ${target.name} allineate.`);
  };

  const deletePlayer = async (playerId: string) => {
    const targetPlayer = players.find((p) => p.id === playerId);
    if (!targetPlayer) return;

    // 1. Decouple any linked user account
    const updatedUsers = users.map((u) => {
      if (u.linked_player_id === playerId) {
        return {
          ...u,
          linked_player_id: '',
          auth_status: 'UNCLAIMED' as const,
        };
      }
      return u;
    });

    const affectedUsers = updatedUsers.filter((u, i) => u !== users[i]);
    for (const affUser of affectedUsers) {
      await syncDocToFirestore('users', affUser.uid, affUser, OperationType.UPDATE);
    }
    setUsers(updatedUsers);

    // 2. Remove from active match if in convocati or teams
    if (match) {
      let matchChanged = false;
      const updatedConvocati = match.convocati_ids.filter((id) => id !== playerId);
      if (updatedConvocati.length !== match.convocati_ids.length) {
        matchChanged = true;
      }
      const updatedGks = match.active_gks_ids.filter((id) => id !== playerId);
      const updatedTeam1Outfield = match.team_1.outfield_ids.filter((id) => id !== playerId);
      const updatedTeam1Gk = match.team_1.gk_id === playerId ? null : match.team_1.gk_id;
      const updatedTeam2Outfield = match.team_2.outfield_ids.filter((id) => id !== playerId);
      const updatedTeam2Gk = match.team_2.gk_id === playerId ? null : match.team_2.gk_id;

      const updatedBets = { ...match.bets };
      if (updatedBets[playerId]) {
        delete updatedBets[playerId];
        matchChanged = true;
      }

      if (matchChanged) {
        const updatedMatch: Match = {
          ...match,
          convocati_ids: updatedConvocati,
          active_gks_ids: updatedGks,
          team_1: {
            ...match.team_1,
            gk_id: updatedTeam1Gk,
            outfield_ids: updatedTeam1Outfield,
          },
          team_2: {
            ...match.team_2,
            gk_id: updatedTeam2Gk,
            outfield_ids: updatedTeam2Outfield,
          },
          bets: updatedBets,
        };
        setMatch(updatedMatch);
        await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
      }
    }

    // 3. Remove player from state
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));

    // 4. Delete document from Firestore if in production mode
    if (isProd && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'players', playerId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `players/${playerId}`);
      }
    }

    showToast(`Giocatore "${targetPlayer.name}" eliminato.`);
  };

  const updateGlobalSettings = async (newConfig: GlobalConfig) => {
    const normalizedConfig: GlobalConfig = {
      ...newConfig,
      dynamic_odds_enabled: true,
      dynamic_odds_sensitivity: newConfig.dynamic_odds_sensitivity ?? 0.5,
    };
    setConfig(normalizedConfig);
    const recomputedPlayers = players.map((p) => {
      const m = computePlayerMetrics(p.weights, p.wants_to_be_gk, normalizedConfig);
      return {
        ...p,
        computed: m.computed,
      };
    });
    setPlayers(recomputedPlayers);

    await syncDocToFirestore('config', 'global_settings', normalizedConfig, OperationType.UPDATE);

    if (match && match.status !== 'ARCHIVED') {
      const convocatiPlayers = match.convocati_ids
        .map((id) => recomputedPlayers.find((p) => p.id === id))
        .filter((p): p is Player => Boolean(p));

      let nextTeam1 = match.team_1;
      let nextTeam2 = match.team_2;

      if (convocatiPlayers.length === 10) {
        const recalculated = recalculateAfterManualSwap(
          convocatiPlayers,
          { gk_id: match.team_1.gk_id, outfield_ids: match.team_1.outfield_ids },
          { gk_id: match.team_2.gk_id, outfield_ids: match.team_2.outfield_ids },
          normalizedConfig
        );
        nextTeam1 = recalculated.team_1;
        nextTeam2 = recalculated.team_2;
      }

      const newOdds = computeMatchOdds(
        nextTeam1.total_power,
        nextTeam2.total_power,
        normalizedConfig
      );

      const updatedMatch: Match = {
        ...match,
        team_1: nextTeam1,
        team_2: nextTeam2,
        odds: newOdds,
      };
      setMatch(updatedMatch);
      await syncDocToFirestore('matches', updatedMatch.id, updatedMatch, OperationType.UPDATE);
    }

    showToast('Impostazioni e quote match aggiornate.');
  };

  return (
    <AppContext.Provider
      value={{
        dbEnvironment,
        isLoggedIn,
        isDirettore,
        config,
        players,
        users,
        match,
        currentUser,
        currentPlayer,
        firebaseUser,
        isFirestoreSynced,
        engineResult,
        toastMessage,
        clearToast,
        showToast,
        loginWithGoogle,
        loginWithApple,
        loginAsDemoUser,
        logoutUser,
        submitAccountClaim,
        approveAccountClaim,
        rejectAccountClaim,
        unlinkAccountClaim,
        assignPlayerToUser,
        placeBet,
        submitAnonymousVotes,
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
        togglePlayerOverride,
        deletePlayer,
        updateGlobalSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
