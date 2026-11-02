# Modulo 06: Architettura Database Ottimizzata (Zero-Waste), Ambiente di Test e Specifiche UI/UX

## 1. Principi di Ottimizzazione del Database (Firestore / NoSQL)
Per restare ampiamente dentro i limiti del piano gratuito di Firebase (Free Tier: 50.000 letture/giorno, 20.000 scritture/giorno) e garantire scalabilità immediata quando si aggiungono nuovi giocatori:
1. **Denormalizzazione Strategica dei Contatori:** Tutte le statistiche per le 4 Classifiche e per le Carte FUT sono salvate direttamente dentro il documento `players/{playerId}`. In questo modo, caricare la Galleria FUT o tutte e 4 le Classifiche richiede **una sola query sulla collezione `players`** (es. 25 letture se ci sono 25 amici nel gruppo), senza mai dover rileggere lo storico delle partite o delle scommesse passate!
2. **Scommesse e Voti Incorporati nel Documento Match (`matches/{matchId}`):** Poiché una partita di calcetto coinvolge 10 giocatori in campo e circa 10–30 scommettitori, invece di creare migliaia di documenti separati nelle sottocollezioni `bets` e `votes`, le scommesse e gli accumulatori anonimi dei voti della settimana sono **mappati direttamente dentro il singolo documento del match attivo**.
   * *Vantaggio:* Leggere lo stato del match corrente consuma **1 sola lettura documento**; inviare i 5 voti post-partita e riscattare i token consuma **1 sola transazione atomica** su 2 documenti (`matches/{matchId}` e `players/{playerId}`).
3. **Separazione tra Database di Produzione e Database di Test (Sandbox):**
   * **Collezioni di Produzione:** `config`, `players`, `users`, `matches`.
   * **Collezioni Isolate dell'Ambiente di Test:** `test_config`, `test_players`, `test_users`, `test_matches`.
   * L'applicazione non utilizza alcun `seedData` statico cablato né espone la Knowledge Base nell'interfaccia utente: dispone invece di un **Laboratorio Database di Test** (`src/db/testDatabase.ts`) che permette di generare dinamicamente 5 scenari matematici e di ciclo di vita (*Pool Asimmetrico*, *Pool Simmetrico*, *Singolo Portiere $K=1$*, *Stress Test Votazioni & EMA*, *Database Pulito Clean Slate*), simulare scommesse 1X2 e votazioni *Least-Voted First* di massa e ispezionare i documenti JSON in tempo reale.

---

## 2. Schema Completo delle Collezioni (4 Collezioni Logiche)

### 2.1 Collezione `config` / `test_config` (1 solo documento: `global_settings`)
Contiene tutti i parametri modificabili dall'Admin nel Backoffice:
```json
{
  "role_threshold_tau": 0.20,
  "polar_weights": { "a": 0.50, "b": 0.25, "c": 0.10, "d": 0.15 },
  "macro_weights_A": { "w1": 1.0, "w2": 2.0, "w3": 0.1 },
  "macro_weights_B": { "w1": 3.0, "w2": 1.0, "w3": 0.1 },
  "gk_multiplier_lambda": 1.00,
  "micro_weights_alpha": { "a1": 2.0, "a2": 1.0, "a3": 0.5, "a4": 0.25 },
  "ema_learning_rate_eta": 0.15,
  "initial_tokens": 100,
  "attendance_reward_tokens": 50,
  "bet_odds": { "1": 1.85, "X": 3.50, "2": 1.85 },
  "active_match_id": "match_2026_11_05"
}
```

### 2.2 Collezione `players/{playerId}` / `test_players/{playerId}`
Contiene pesi, statistiche per le 4 classifiche e collegamento all'utente autenticato:
```json
{
  "id": "player_marco",
  "name": "Marco",
  "avatar_url": "",
  "claimed_by_uid": "firebase_uid_123",
  "claim_status": "VALIDATED",
  "is_active": true,

  "weights": {
    "tiro": 0.78,
    "velocita": 0.82,
    "passaggio": 0.65,
    "resistenza": 0.70,
    "difesa": 0.35,
    "portiere": 0.20
  },
  "wants_to_be_gk": false,

  "computed": {
    "overall": 0.66,
    "delta_index": 0.28,
    "role_state": 1,
    "role_label": "ATT"
  },

  "attr_votes_count": {
    "tiro": 12, "velocita": 11, "passaggio": 12, "resistenza": 11, "difesa": 11, "portiere": 0
  },

  "stats": {
    "tokens": 240,
    "matches_played": 18,
    "matches_won": 11,
    "matches_drawn": 2,
    "bets_total": 15,
    "bets_won": 9,
    "votes_completed_matches": 17
  }
}
```

### 2.3 Collezione `users/{uid}` / `test_users/{uid}`
Leggerissimo: serve solo a mappare il login Firebase verso il `playerId` e i permessi:
```json
{
  "uid": "firebase_uid_123",
  "email": "marco@example.com",
  "display_name": "Marco Rossi",
  "linked_player_id": "player_marco",
  "auth_status": "VALIDATED",
  "is_admin": false,
  "created_at": 1730000000000
}
```

### 2.4 Collezione `matches/{matchId}` / `test_matches/{matchId}`
Incorpora convocati, le 2 proposte del modello matematico, la formazione scelta, la mappa delle scommesse e gli accumulatori anonimi dei voti:
```json
{
  "id": "match_2026_11_05",
  "date_label": "Giovedì 5 Novembre - Ore 21:00",
  "status": "OPEN_FOR_BETS",
  "convocati_ids": ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"],
  "active_gks_ids": ["p1", "p2"],

  "selected_solution": "A",
  "team_1": {
    "gk_id": "p1",
    "outfield_ids": ["p3", "p5", "p7", "p9"],
    "total_power": 3.26,
    "avg_attrs": { "tiro": 0.64, "velocita": 0.68, "passaggio": 0.62, "resistenza": 0.70, "difesa": 0.61 }
  },
  "team_2": {
    "gk_id": "p2",
    "outfield_ids": ["p4", "p6", "p8", "p10"],
    "total_power": 3.27,
    "avg_attrs": { "tiro": 0.63, "velocita": 0.69, "passaggio": 0.64, "resistenza": 0.68, "difesa": 0.63 }
  },

  "score": { "team_1": null, "team_2": null, "winner": null },
  "odds": { "1": 1.85, "X": 3.50, "2": 1.85 },

  "bets": {
    "player_marco": { "pick": "1", "amount": 30, "potential_payout": 56, "settled": false }
  },

  "voting_tracker": {
    "voters_completed_ids": ["p3", "p7"],
    "received_count_by_player": {
      "p1": 1, "p2": 1, "p3": 1, "p4": 1, "p5": 1, "p6": 1, "p7": 1, "p8": 1, "p9": 1, "p10": 1
    },
    "anonymous_accumulators": {
      "p1": { "portiere": { "sum": 8.0, "count": 1 } },
      "p3": { "tiro": { "sum": 7.5, "count": 1 } }
    }
  }
}
```
> **Garanzia di Anonimato nel Database:** Come si vede in `voting_tracker`, quando un giocatore vota, il suo ID viene aggiunto a `voters_completed_ids` (per impedirgli di votare due volte e accreditargli i 50 token), mentre i suoi 5 voti vengono sommati direttamente dentro `anonymous_accumulators[targetPlayerId][attributo]`. Non viene salvato da nessuna parte il legame `votante -> voto assegnato`.

---

## 3. Struttura di Navigazione e UI/UX (Mobile-First)

L'interfaccia utente utilizza una **Bottom Navigation Bar** con 4 voci per tutti gli utenti (più la 5ª voce per l'Admin) e un selettore rapido per la Console **Ambiente: DB di Test / Produzione**:

1. **🏟️ Match & Scommesse (Home):**
   * Mostra lo stato del match della settimana.
   * Campo da calcetto grafico con i 5 giocatori schierati per parte e i radar/barre di confronto tra Squadra 1 e Squadra 2.
   * Widget di scommessa 1X2 con slider per scegliere i token da puntare.
   * A partita finita (`VOTING_OPEN`), mostra ai 10 partecipanti il pulsante in evidenza **"Valuta 5 compagni e Riscatta +50 Token"**.
2. **🃏 Galleria FUT:**
   * Griglia di Carte FUT interattive con filtro per ruolo (`Tutti`, `POR`, `DIF`, `TUT`, `ATT`) e barra di ricerca.
   * Toccando una Card si apre il dettaglio con il grafico radar dei 5 attributi, l'indice tattico $\delta_i$ su una barra da Difensore ($-1$) ad Attaccante ($+1$), e il riepilogo presenze/vittorie.
3. **🏆 Classifiche:**
   * Selettore a 4 tab: **Oracolo** (Scommesse vinte), **Paperoni** (Saldo Token), **Re del Campo** (Vittorie in campo), **Presenze** (Partite giocate).
4. **👤 Profilo & Wallet:**
   * Mostra la propria Card FUT personale, il saldo Token attuale, lo stato di validazione dell'account e le proprie statistiche personali.
5. **⚙️ Backoffice (Visibile solo se `is_admin == true`):**
   * Accesso ai 4 tab amministrativi: *Gestione Match e Generatore Squadre (Soluzione A vs B)*, *Anagrafica Giocatori e Pesi*, *Approvazione Utenti*, *Settings Globali*.