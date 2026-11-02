# Modulo 03: Ciclo di Vita del Match, Backoffice Admin e Pannello Settings

## 1. Macchina a Stati del Match (`match_status`)
L'intero flusso settimanale è scandito manualmente dall'Admin tramite 5 stati sequenziali. In ogni istante esiste al massimo **un solo match attivo** (non archiviato).

1. **`DRAFT` (Creazione e Scelta Formazione — Solo Admin):**
   * L'Admin seleziona i **10 giocatori convocati** dalla lista completa dei giocatori attivi.
   * L'app esegue in tempo reale il **Motore Matematico** (vedi Modulo `modello_bilanciamento_calcetto.md`) e mostra all'Admin le due proposte ottimali:
     * **Proposta A (Ottimo di Simmetria):** massimizza la specularità dei moduli.
     * **Proposta B (Ottimo di Compensazione):** pareggia la carica algebrica tramite i tuttocampisti.
   * Per ciascuna proposta, l'Admin visualizza il confronto analitico (Potenza totale $F^{(1)}$ vs $F^{(2)}$, medie sui 5 fondamentali, ruoli assegnati, entropia). L'Admin può anche effettuare uno *swap manuale* tra due giocatori prima di confermare.
   * Quando l'Admin clicca su **"Pubblica Formazioni e Apri Scommesse"**, il match passa allo stato `OPEN_FOR_BETS`.
   * Fin quando il match non viene spostato in `OPEN_FOR_BETS`, l' **admin** può aggiornare e modificare i **10 giocatori convocati**

2. **`OPEN_FOR_BETS` (Formazioni Pubblicate — Scommesse Aperte):**
   * Il match e le due formazioni ($G_1$ Maglia Chiara vs $G_2$ Maglia Scura) diventano visibili nella Home pubblica di tutti gli utenti.
   * Tutti gli utenti con stato `VALIDATED` e saldo token $> 0$ possono piazzare una scommessa sull'esito **1, X o 2**.
   * Quando sta per iniziare la partita sul campo, l'Admin clicca su **"Chiudi Scommesse / Inizia Match"**, portando lo stato a `IN_PLAY`.

3. **`IN_PLAY` (Scommesse Chiuse — Partita in Corso):**
   * Le scommesse sono bloccate. Nella Home pubblica sono visibili le percentuali totali di scommesse piazzate su 1, X e 2.
   * Si attende l'inserimento del risultato finale da parte dell'Admin.

4. **`VOTING_OPEN` (Risultato Inserito — Votazioni e Riscatto Token Aperti):**
   * L'Admin inserisce il risultato finale (es. `Gol Squadra 1` vs `Gol Squadra 2`) e clicca su **"Termina Match e Apri Votazioni"**.
   * **Azioni automatiche istantanee allo sblocco di `VOTING_OPEN`:**
     1. Liquidazione immediata delle scommesse vincenti (accredito token ai vincitori) e aggiornamento della *Classifica Oracolo* e *Classifica Paperoni*.
     2. Aggiornamento immediato delle statistiche di presenza (+1 partita giocata a tutti i 10 convocati) e vittorie (+1 partita vinta ai 5 giocatori della squadra vincente), aggiornando *Classifica Re del Campo* e *Classifica Presenze*.
   * **Finestra di Voto:** I 10 giocatori che hanno partecipato al match vedono comparire nella propria Home il banner **"Valuta la partita e Riscatta i tuoi Token Presenza"**.

5. **`ARCHIVED` (Match Consolidato e Chiuso):**
   * Quando tutti i 10 giocatori hanno votato, oppure quando l'Admin decide di chiudere la finestra di voto per creare la partita della settimana successiva, l'Admin clicca su **"Consolida Voti e Archivia Match"**.
   * **Azione automatica:** I voti raccolti vengono aggregati e applicati ai pesi dei giocatori tramite la formula EMA (vedi Modulo 04), aggiornando le Carte FUT.

---

## 2. Funzionalità del Backoffice Admin

Il Backoffice è suddiviso in 4 tab operativi:

### Tab 1: Gestione Match Corrente
* Selettore dei 10 convocati (con filtro rapido e indicatore di chi si è candidato come portiere). Permette anche di aggiornare i giocatori finchè la formazione non passa in stato `OPEN_FOR_BETS`
* Visualizzatore comparativo tra **Soluzione A** e **Soluzione B** del motore matematico.
* Pulsanti di avanzamento stato (`Pubblica` $\to$ `Chiudi Scommesse` $\to$ `Inserisci Risultato` $\to$ `Consolida Voti e Archivia`).
* Monitor di stato votazioni post-match (es. *"Hanno già votato 7/10 giocatori"* — senza mai mostrare chi ha dato quale voto per garantire l'anonimato).

### Tab 2: Anagrafica Giocatori e Override Pesi (Scalabilità)
* **Inserimento Nuovo Giocatore:** Form per aggiungere in qualsiasi momento della stagione un nuovo amico con:
  * `Nome / Soprannome`
  * `5 Pesi Iniziali` ($w_T, w_V, w_P, w_R, w_D \in [0, 1]$, inseribili anche come valori $40\text{--}99$ convertiti automaticamente)
  * `Peso Portiere` ($w_{\text{GK}} \in [0, 1]$)
  * `Flag Vuole Fare il Portiere` ($b_{\text{GK}} \in \{\text{true}, \text{false}\}$).
* **Modifica Manuale (Admin Override):** L'Admin può modificare manualmente in qualsiasi momento i pesi, il flag portiere, il saldo token o le statistiche di qualsiasi giocatore per correggere eventuali anomalie.

### Tab 3: Approvazione Utenti (Account Claiming)
* Lista delle richieste pendenti (`PENDING_APPROVAL`) con pulsanti **Approva** o **Rifiuta**.
* Elenco delle associazioni attive `Utente Google <--> Profilo Giocatore` con possibilità di scollegare un profilo in caso di errore.

### Tab 4: Pannello Variabili Globali e Settings (`app_config`)
L'Admin può modificare da interfaccia grafica tutti gli iperparametri matematici ed economici del progetto (salvati in un singolo documento di configurazione):

| Categoria | Parametro Configurabile | Simbolo | Default |
| :--- | :--- | :---: | :---: |
| **Motore Ruoli (Stadio I)** | Soglia di specializzazione ruolo | $\tau$ | `0.20` |
| **Motore Ruoli (Stadio I)** | Coefficienti polari $(a, b, c, d)$ | $a,b,c,d$ | `0.50, 0.25, 0.10, 0.15` |
| **Motore Macro (Stadio II)** | Pesi Soluzione A $(w_1, w_2, w_3)_A$ | $\mathbf{w}_A$ | `1.0, 2.0, 0.1` |
| **Motore Macro (Stadio II)** | Pesi Soluzione B $(w_1, w_2, w_3)_B$ | $\mathbf{w}_B$ | `3.0, 1.0, 0.1` |
| **Motore Forza (Stadio III)** | Moltiplicatore peso Portiere | $\lambda_{\text{GK}}$ | `1.00` |
| **Motore Forza (Stadio III)** | Pesi Micro Forza $(\alpha_1, \alpha_2, \alpha_3, \alpha_4)$ | $\boldsymbol{\alpha}$ | `2.0, 1.0, 0.5, 0.25` |
| **Evoluzione Pesi (Voti)** | Tasso di apprendimento EMA (Inerzia) | $\eta$ | `0.15` |
| **Economia Token** | Bonus Token iniziale alla validazione | $T_{\text{init}}$ | `100` |
| **Economia Token** | Ricompensa Token per Presenza + Voto | $T_{\text{pres}}$ | `50` |
| **Economia Token** | Quote Scommesse Fisse $(Q_1, Q_X, Q_2)$ | $Q$ | `1.85, 3.50, 1.85` |