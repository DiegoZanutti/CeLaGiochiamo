# Modulo 01: Panoramica del Progetto, Ruoli Utente e Onboarding (Firebase Auth)

## 1. Visione Generale dell'Applicazione
La WebApp (Mobile-First) gestisce l'organizzazione settimanale delle partite di Calcio a 5 (5 vs 5) tra un gruppo scalabile di amici, integrando:
1. **Motore Matematico a 3 Stadi** per la generazione di 2 proposte di formazioni bilanciate (nel Backoffice Admin).
2. **Sistema di Scommesse 1X2 con Token in-app** aperto a tutti gli utenti registrati e validati.
3. **Sistema di Votazione Anonima Post-Partita** (5 domande mirate) che consente ai 10 partecipanti al match di riscattare i Token Presenza e aggiorna automaticamente gli attributi dei giocatori.
4. **Galleria Carte FUT e 4 Classifiche Generali** (*Oracolo*, *Paperoni*, *Re del Campo*, *Stakanovisti / Presenze*).

---

## 2. Architettura dei Ruoli e Stati Utente

L'applicazione distingue tra due entità logiche che vengono collegate tramite una procedura di *Account Claiming* (Rivendicazione Profilo):
* **Profilo Giocatore (`Player`):** creata dall'Admin nel Backoffice (contiene nome/soprannome, i 5 pesi di movimento, il peso portiere, il flag portiere e tutte le statistiche storiche di campo). Può esistere anche senza che il giocatore si sia ancora registrato nell'app.
* **Account Utente (`User`):** creato quando una persona effettua il login con Google tramite **Firebase Authentication**.

### 2.1 Macchina a Stati dell'Account Utente (`auth_status`)
Ogni utente autenticato con Google attraversa 3 stati:

1. **`UNCLAIMED` (Non Associato):**
   * L'utente ha effettuato il primo accesso con Google ma non ha ancora indicato quale giocatore della rosa rappresenta.
   * **UI mostrata:** Schermata *"Chi sei?"* che mostra la lista dei profili `Player` non ancora associati ad altri utenti (più un'opzione *"Sono un nuovo giocatore / Spettatore esterno"*).
2. **`PENDING_APPROVAL` (In Attesa di Approvazione):**
   * L'utente ha selezionato il proprio nome (es. *"Sono Marco"*) e ha inviato la richiesta.
   * **Permessi:** Può navigare nell'app in **sola lettura** (vedere il match in programma, le classifiche e la Galleria Carte FUT), ma **non può** scommettere né votare/riscattare token.
   * **Azioni Admin:** Nel Backoffice compare una notifica nella coda approvazioni: *"L'account Google `marco.rossi@gmail.com` dichiara di essere il giocatore **Marco**. Approvi?"*.
3. **`VALIDATED` (Validato / Attivo):**
   * L'Admin ha approvato l'associazione (`user.uid <--> player.id`).
   * Al momento della prima validazione, l'utente riceve il **Bonus di Benvenuto** (configurabile dall'Admin nei Settings, default: `100 Token`).
   * **Permessi:** Accesso completo a scommesse 1X2 e, quando figura tra i 10 convocati di un match concluso, accesso al questionario di valutazione per riscattare i Token Presenza.

### 2.2 Ruolo Amministratore (`is_admin: true`)
* L'Admin è un utente validato che possiede il flag `is_admin = true`.
* Ha accesso esclusivo alla sezione **Backoffice Admin** tramite la barra di navigazione.