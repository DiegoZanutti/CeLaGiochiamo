# Modulo 05: Economia dei Token, Scommesse 1X2, Classifiche e Galleria FUT

## 1. Economia Circolare dei Token (Senza Bailout)
I Token sono la valuta virtuale in-app e non hanno alcun valore monetario. Il sistema economico è progettato per **incentivare la presenza fisica in campo**:
1. **Dotazione Iniziale:** Ogni utente riceve `100 Token` ($T_{\text{init}}$) una tantum quando il suo profilo viene approvato dall'Admin (`VALIDATED`).
2. **Guadagno da Partecipazione Reale (Motore Primario):** Chi gioca la partita settimanale e completa le 5 domande di valutazione incassa `50 Token` ($T_{\text{pres}}$).
3. **Guadagno da Scommesse:** Chi indovina il pronostico 1X2 incassa la vincita moltiplicata per la quota corrispondente.
4. **Regola "Zero Bailout" (Incentivo al Campo):** Non esistono ricariche gratuite automatiche per chi azzera il saldo scommettendo. **Se un utente perde tutti i suoi token, l'unico modo per tornare ad avere token da scommettere è venire a giocare una partita di calcetto e riscattare il premio presenza.**

---

## 2. Sistema di Scommesse 1X2

### 2.1 Regole di Puntata
* **Chi può scommettere:** Qualsiasi utente con stato `VALIDATED` (sia i 10 giocatori convocati in campo, sia gli amici non convocati) mentre il match si trova nello stato `OPEN_FOR_BETS`.
* **Nessuna restrizione di squadra:** Trattandosi di un gioco tra amici, non vi sono blocchi sulla scelta dell'esito (ciascun utente può puntare liberamente su `1`, `X` o `2`).
* **Vincolo di puntata:** Ogni utente può effettuare **una sola scommessa per match**, scegliendo:
  * **Segno pronosticato:** `1` (Vittoria Squadra $G_1$), `X` (Pareggio), `2` (Vittoria Squadra $G_2$).
  * **Importo puntato ($B$):** intero compreso tra `1` e il proprio saldo disponibile (`user.tokens`), con un eventuale tetto massimo configurabile dall'Admin.
* All'invio della scommessa, l'importo $B$ viene scalato immediatamente dal saldo dell'utente.

### 2.2 Calcolo delle Quote e Liquidazione Vincite
Poiché il Motore Matematico crea due squadre strutturalmente paritarie, le quote di base sono simmetriche e configurabili dall'Admin nei Settings (default):
* **Segno `1` (Vittoria $G_1$):** Quota $Q_1 = 1.85$
* **Segno `X` (Pareggio):** Quota $Q_X = 3.50$
* **Segno `2` (Vittoria $G_2$):** Quota $Q_2 = 1.85$

*(Opzione avanzata opzionale nei Settings: leggero adeguamento dinamico automatico di $\pm 0.15$ sulle quote $Q_1$ e $Q_2$ qualora ci sia una piccola differenza residua tra le potenze totali $F^{(1)}$ e $F^{(2)}$).*

Quando l'Admin inserisce il risultato finale ($G_1\text{ gol}$ vs $G_2\text{ gol}$):
* Si determina l'esito reale $E^* \in \{\text{'1'}, \text{'X'}, \text{'2'}\}$.
* Ogni scommessa con segno uguale a $E^*$ viene marcata come `WON` e accredita al saldo dell'utente:
  $$\text{Vincita} = \text{round}\big( B \cdot Q_{E^*} \big)$$
* Ogni scommessa con segno diverso da $E^*$ viene marcata come `LOST`.

---

## 3. Le 4 Classifiche Ufficiali (Leaderboards)

Nella sezione **Classifiche** gli utenti possono consultare 4 graduatorie sempre aggiornate:

1. **Classifica "Oracolo" (Migliori Scommettitori):**
   * **Ordinamento primario:** Numero totale di pronostici 1X2 indovinati (`bets_won`, decrescente).   * **Ordinamento secondario (Tie-breaker):** Percentuale di successo $\text{Win Rate} = \frac{\text{bets\_won}}{\text{bets\_total}} \times 100$ (decrescente).
   * **Dati mostrati:** Posizione, Nome, Pronostici Indovinati / Totali, Win Rate %.

2. **Classifica "Paperoni" (Più Ricchi di Token):**
   * **Ordinamento primario:** Saldo Token attuale posseduto (`tokens`, decrescente).
   * **Dati mostrati:** Posizione, Nome, Saldo Token attuale, Profitto netto storico dalle scommesse.

3. **Classifica "Re del Campo" (Più Vittorie Reali Giocate):**
   * **Ordinamento primario:** Numero di partite di calcetto realmente vinte scendendo in campo (`matches_won`, decrescente).
   * **Dati mostrati:** Posizione, Nome, Vittorie Campo, Partite Giocate, % Vittorie.

4. **Classifica "Stakanovisti" (Classifica Presenze):**
   * **Ordinamento primario:** Numero totale di partite giocate (`matches_played`, decrescente).
   * **Ordinamento secondario:** Numero di votazioni post-match completate (`votes_completed_matches`).
   * **Dati mostrati:** Posizione, Nome, Presenze Totali, % di Presenza sulle partite totali organizzate.

---

## 4. Galleria Carte FUT (Conversione Visuale e Stile)

La schermata **Galleria FUT** mostra le card di tutti i giocatori registrati, filtrabili per ruolo (*Tutti, Portieri, Difensori, Tuttocampisti, Attaccanti*) e ordinabili per *Overall* o per singola statistica.

### 4.1 Mappatura Matematica su Scala FUT $[40, 99]$
Per mantenere la precisione matematica nel backend (che lavora su $[0, 1]$) ma offrire un impatto visivo identico alle card calcistiche su frontend, ogni peso $w \in [0, 1]$ viene convertito a schermo tramite la funzione affine intera:

$$\text{Stat}_{\text{FUT}}(w) = \text{round}\big( 40 + 59 \cdot w \big) \in [40, 99]$$

### 4.2 Elementi Visivi di Ogni Card FUT
* **Overall In Alto a Sinistra:** $\text{OVR} = \text{Stat}_{\text{FUT}}(M_i)$ per i giocatori di movimento (oppure $\max(\text{Stat}_{\text{FUT}}(M_i), \text{Stat}_{\text{FUT}}(w_{\text{GK},i}))$ per i portieri).
* **Badge Ruolo Sotto l'Overall:**
  * `POR` se il giocatore ha $b_{\text{GK}} = 1$.
  * `ATT` se $\delta_i > +\tau$, `DIF` se $\delta_i < -\tau$, `TUT` se $|\delta_i| \le \tau$ (calcolato dinamicamente dal modello matematico).
* **Griglia Attributi a 2 Colonne sulla Card:**
  * `TIR`: $\text{Stat}_{\text{FUT}}(w_T)$ | `PAS`: $\text{Stat}_{\text{FUT}}(w_P)$
  * `VEL`: $\text{Stat}_{\text{FUT}}(w_V)$ | `RES`: $\text{Stat}_{\text{FUT}}(w_R)$
  * `DIF`: $\text{Stat}_{\text{FUT}}(w_D)$ | `POR`: $\text{Stat}_{\text{FUT}}(w_{\text{GK}})$
* **Tier Estetico della Card (Colore Sfondo):**
  * **Bronzo:** $\text{OVR} < 65$
  * **Argento:** $65 \le \text{OVR} < 75$
  * **Oro:** $75 \le \text{OVR} < 85$
  * **Special / IF (Nero-Oro):** $\text{OVR} \ge 85$