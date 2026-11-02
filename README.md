# Calcetto 5vs5 Pro Manager — Knowledge Base & System Overview

Applicazione web mobile-first per l'organizzazione settimanale di partite di **Calcio a 5 (5 vs 5)** tra amici, con motore matematico gerarchico a 3 stadi per il bilanciamento delle squadre (`Squadra Gabry` vs `Squadra Piero`), sistema di scommesse 1X2 con Token in-app, votazioni anonime post-partita (*Least-Voted First*) con aggiornamento EMA dei pesi, Galleria Carte FUT e 4 Classifiche ufficiali.

---

## Indice dei File della Knowledge Base (`docs/knowledge-base/`)

| Modulo | File | Argomento Principale |
| :---: | :--- | :--- |
| **01** | [`01_panoramica_progetto_ruoli_e_autenticazione.md`](docs/knowledge-base/01_panoramica_progetto_ruoli_e_autenticazione.md) | Visione generale, separazione `User` / `Player`, macchina a stati dell'Account Claiming e ruolo Direttore (`is_admin`). |
| **02** | [`02_modello_matematico_bilanciamento_calcetto_5vs5.md`](docs/knowledge-base/02_modello_matematico_bilanciamento_calcetto_5vs5.md) | Specifica matematica completa del motore di bilanciamento a 3 stadi (Classificazione Ruoli, Ottimizzazione Macro di Pareto A/B, Ottimizzazione Micro MIQP). |
| **03** | [`03_ciclo_di_vita_del_match_e_backoffice_admin.md`](docs/knowledge-base/03_ciclo_di_vita_del_match_e_backoffice_admin.md) | Macchina a stati del match (`DRAFT` → `OPEN_FOR_BETS` → `IN_PLAY` → `VOTING_OPEN` → `ARCHIVED`), Backoffice del Direttore e parametri configurabili. |
| **04** | [`04_sistema_di_voto_anonimo_ed_evoluzione_pesi.md`](docs/knowledge-base/04_sistema_di_voto_anonimo_ed_evoluzione_pesi.md) | Questionario post-match anonimo a 5 domande (*Least-Voted First*), riscatto Token Presenza e aggiornamento dei pesi con Media Mobile Esponenziale (EMA). |
| **05** | [`05_economia_token_scommesse_1x2_classifiche_e_carte_fut.md`](docs/knowledge-base/05_economia_token_scommesse_1x2_classifiche_e_carte_fut.md) | Economia circolare dei Token ("Zero Bailout"), regole scommesse 1X2, le 4 Classifiche ufficiali e conversione su scala FUT `[40, 99]`. |
| **06** | [`06_architettura_database_ottimizzata_e_specifiche_ui.md`](docs/knowledge-base/06_architettura_database_ottimizzata_e_specifiche_ui.md) | Architettura Firestore denormalizzata ("Zero-Waste"), schema delle 4 collezioni (`config`, `players`, `users`, `matches`), sandbox di test e struttura UI/UX. |

---

## Sintesi dei Moduli della Knowledge Base

### Modulo 01 — Panoramica del Progetto, Ruoli Utente e Onboarding (`Firebase Auth`)
- **Separazione tra Utente e Giocatore**:
  - **`Player` (Profilo Giocatore)**: creato dal Direttore nel Backoffice con nome, soprannome, foto opzionale, 5 caratteristiche di movimento (`tiro`, `velocita`, `passaggio`, `resistenza`, `difesa`), abilità `portiere`, flag `wants_to_be_gk` e statistiche storiche.
  - **`User` (Account Utente)**: creato al login con Google tramite Firebase Authentication e collegato a un profilo `Player`.
- **Ciclo di Account Claiming (`auth_status`)**:
  1. `UNCLAIMED`: l'utente autenticato sceglie quale giocatore della rosa rappresenta (dal proprio **Profilo**, oppure associato direttamente dal Direttore nel **Backoffice**).
  2. `PENDING_APPROVAL`: navigazione in sola lettura in attesa di approvazione da parte del Direttore.
  3. `VALIDATED`: associazione attiva (`user.uid <-> player.id`), accredito una tantum del **Bonus di Benvenuto** (`100 Token` di default) e abilitazione a scommesse 1X2 e votazioni post-match.
- **Ruolo Direttore (`is_admin: true`)**: accesso completo al **Backoffice Direttore**, inclusa la gestione delle associazioni `Utente <-> Giocatore` (anche per il proprio account).

---

### Modulo 02 — Modello Matematico di Bilanciamento Calcetto 5vs5
Il motore divide i 10 convocati in due squadre da 5 giocatori (`Squadra Gabry` e `Squadra Piero`) tramite un **Modello Gerarchico a 3 Stadi**:

1. **Stadio I — Gestione Portieri e Classificazione Individuale nei 3 Ruoli**:
   - Seleziona fino a $K = \min(n, 2)$ portieri attivi tra chi ha `wants_to_be_gk = true`, ordinati per peso `portiere` ($w_{\text{GK}}$); eventuali portieri in eccesso vengono riconvertiti in giocatori di movimento.
   - Per ogni giocatore di movimento calcola l'affinità offensiva $S_{A,i}$ e difensiva $S_{D,i}$ con pesi polari $(a, b, c, d) = (0.50, 0.25, 0.10, 0.15)$ e ricava l'indice relativo normalizzato $\delta_i = \frac{S_{A,i} - S_{D,i}}{S_{A,i} + S_{D,i}} \in [-1, +1]$.
   - Con soglia $\tau = 0.20$, classifica ogni giocatore in:
     - **Attaccante (`ATT`, $+1$)** se $\delta_i > +\tau$
     - **Tuttocampista (`TUT`, $0$)** se $-\tau \le \delta_i \le +\tau$
     - **Difensore (`DIF`, $-1$)** se $\delta_i < -\tau$

2. **Stadio II — Ottimizzazione Macro-Strutturale dei Ruoli (Frontiera di Pareto)**:
   - Valuta le partizioni ammissibili dei ruoli tra le due squadre minimizzando $J = w_1 J_{\text{alg}} + w_2 J_{\text{diff}} - w_3 H_{\text{tot}}$:
     - **Soluzione A (Ottimo di Simmetria)** con pesi $(1.0, 2.0, 0.1)$: privilegia moduli speculari ruolo per ruolo ($J_{\text{diff}}$ minimo).
     - **Soluzione B (Ottimo di Compensazione Tattica)** con pesi $(3.0, 1.0, 0.1)$: privilegia il pareggio della carica netta offensiva/difensiva ($J_{\text{alg}}$ minimo) compensando con i tuttocampisti.

3. **Stadio III — Ottimizzazione Micro-Allocativa di Forza (Esplorazione Esatta MIQP)**:
   - Esplora tutte le combinazioni ammissibili ($\Omega \le 252$) per trovare il minimo globale della funzione di costo:
     $$L_{\text{forza}}(\mathbf{u}) = \alpha_1 \Phi_{\text{tot}}(\mathbf{u}) + \alpha_2 \Phi_{\text{attr}}(\mathbf{u}) + \alpha_3 \Phi_{\delta}}(\mathbf{u}) + \alpha_4 \Phi_{\text{var}}(\mathbf{u})$$
   - Bilancia simultaneamente la potenza totale comprensiva dei portieri ($\Phi_{\text{tot}}$), le medie sui 5 fondamentali ($\Phi_{\text{attr}}$), il baricentro tattico continuo ($\Phi_{\delta}$) e la varianza interna ($\Phi_{\text{var}}$).

---

### Modulo 03 — Ciclo di Vita del Match e Backoffice Direttore
- **Macchina a 5 Stati del Match (`status`)**:
  1. `DRAFT`: selezione dei 10 convocati, impostazione/modifica di **data, ora e luogo** del match, confronto tra **Proposta A** e **Proposta B** ed eventuale swap manuale tra giocatori.
  2. `OPEN_FOR_BETS`: formazioni pubblicate su **Match & Scommesse** (`Squadra Gabry` vs `Squadra Piero`) e apertura delle puntate 1X2 per tutti gli utenti `VALIDATED`.
  3. `IN_PLAY`: chiusura delle scommesse all'inizio della partita sul campo.
  4. `VOTING_OPEN`: inserimento del risultato finale, liquidazione istantanea delle scommesse 1X2, aggiornamento presenze/vittorie e apertura del questionario post-match per i 10 partecipanti.
  5. `ARCHIVED`: consolidamento dei voti anonimi ricevuti, aggiornamento EMA dei pesi dei giocatori e archiviazione della partita.
- **Funzioni del Backoffice**:
  - Gestione Match corrente e modifica di data/ora/luogo.
  - Anagrafica Giocatori: inserimento nuovi giocatori, caricamento/rimozione foto profilo e modifica dei **valori iniziali (`initial_weights`)** con ricalcolo automatico dei pesi attuali mantenendo l'effetto storico dei voti passati.
  - Gestione Utenti & Associazioni: approvazione richieste pendenti e menu a tendina per collegare, cambiare o scollegare qualsiasi account utente con un giocatore della rosa.
  - Pannello Variabili Globali (`config/global_settings`).

---

### Modulo 04 — Sistema di Voto Anonimo (*Least-Voted First*) ed Evoluzione Pesi
- **Questionario Equo Dinamico (*Least-Voted First*)**:
  - Durante `VOTING_OPEN`, ciascuno dei 10 convocati valuta **5 compagni/avversari** (voti da `4.0` a `10.0` a step di `0.5`) per riscattare i **Token Presenza** (`+50 Token` di default).
  - I 5 giocatori da valutare sono scelti tra gli altri 9 partecipanti ordinandoli per minor numero di voti ricevuti nel match corrente (`received_count_by_player`), garantendo uno scarto massimo $\le 1$ voto tra tutti i partecipanti.
  - Per i portieri attivi viene valutato l'attributo `portiere`; per i giocatori di movimento viene selezionato l'attributo tra `{tiro, velocita, passaggio, resistenza, difesa}` con il minor numero di voti storici (`attr_votes_count`).
- **Anonimato Garantito**:
  - I voti vengono sommati direttamente negli accumulatori aggregati `anonymous_accumulators[playerId][attr] = { sum, count }` senza mai salvare chi ha assegnato quale voto.
- **Aggiornamento EMA a Fine Match**:
  - La media match $\bar{v}_{j,k} \in [4, 10]$ viene normalizzata in $[0, 1]$ tramite $u_{j,k} = \text{clip}_{[0,1]}\left(\frac{\bar{v}_{j,k} - 4}{6}\right)$.
  - Il peso viene aggiornato con Media Mobile Esponenziale:
    $$w_{j,k}^{(\text{nuovo})} = (1 - \eta) \cdot w_{j,k}^{(\text{vecchio})} + \eta \cdot u_{j,k} \quad (\text{default } \eta = 0.15)$$

---

### Modulo 05 — Economia Token, Scommesse 1X2, Classifiche e Galleria FUT
- **Economia Circolare "Zero Bailout"**:
  - `100 Token` alla prima validazione (`initial_tokens`) + `50 Token` per ogni presenza in campo con votazione completata (`attendance_reward_tokens`).
  - Nessuna ricarica gratuita se si azzera il saldo: per ottenere nuovi Token occorre scendere in campo e partecipare alle partite.
- **Scommesse 1X2**:
  - Una puntata per match sugli esiti `1` (`Squadra Gabry`), `X` (`Pari`) o `2` (`Squadra Piero`) con quote configurabili (default `1.85 / 3.50 / 1.85`).
- **Le 4 Classifiche Ufficiali**:
  1. **Oracolo**: migliori scommettitori per pronostici 1X2 vinti (`bets_won` e win rate %).
  2. **Paperoni**: giocatori con il saldo Token più alto (`tokens` e profitto netto scommesse).
  3. **Re del Campo**: giocatori con più vittorie reali in campo (`matches_won` e % vittorie).
  4. **Stakanovisti (Presenze)**: giocatori con più partite disputate (`matches_played` e votazioni completate).
- **Galleria Carte FUT e Player Card**:
  - Conversione affine intera da $[0, 1]$ a scala FUT $[40, 99]$: $\text{Stat}_{\text{FUT}}(w) = \text{round}(40 + 59 \cdot w)$.
  - Design a scudetto FUT con foto giocatore pre-processata (o silhouette), bandiera tricolore, stemma club, 6 attributi (`VEL`, `RES`, `TIR`, `DIF`, `PAS`, `POR`) e 4 tier cromatici (**Bronzo** $<65$, **Argento** $65\text{--}74$, **Oro** $75\text{--}84$, **Special** $\ge 85$).

---

### Modulo 06 — Architettura Database Ottimizzata (`Firestore`) e Specifiche UI
- **Denormalizzazione Strategica ("Zero-Waste")**:
  - Tutte le statistiche per le 4 Classifiche e per le Carte FUT risiedono nella collezione `players/{playerId}` (1 sola query per caricare Galleria FUT e Classifiche).
  - Scommesse (`bets`) e accumulatori anonimi dei voti (`voting_tracker`) sono incorporati direttamente nel singolo documento `matches/{matchId}`.
- **Le 4 Collezioni Firestore**:
  - `config/global_settings`: iperparametri del motore matematico, tassi EMA, premi Token, quote 1X2 e `active_match_id`.
  - `players/{playerId}`: anagrafica, avatar, `initial_weights`, `weights`, metriche calcolate, contatori voti e statistiche per le classifiche.
  - `users/{uid}`: profilo di autenticazione Google, stato validazione (`UNCLAIMED`, `PENDING_APPROVAL`, `VALIDATED`), `linked_player_id` e flag `is_admin`.
  - `matches/{matchId}`: dettagli data/ora/luogo, convocati, formazioni `team_1` (`Squadra Gabry`) e `team_2` (`Squadra Piero`), punteggio, quote, mappa scommesse e `voting_tracker`.
- **Sicurezza Firestore (`security_spec.md` & `firestore.rules`)**:
  - Protezione PII su `/users/{uid}`, validazione rigorosa degli schemi e limiti dimensionali dei campi (incluso supporto per foto profilo pre-processate fino a `250 KB`).
