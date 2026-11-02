# Modulo 04: Algoritmo del Questionario Equo (Least-Voted First) ed Evoluzione Pesi

## 1. Regole di Accesso al Riscatto dei Token Presenza
* Quando il match entra nello stato `VOTING_OPEN`, ciascuno dei **10 giocatori convocati** che possiede un account validato può riscattare i propri **Token Presenza** ($T_{\text{pres}}$, default `50 Token`).
* Per sbloccare l'accredito dei token, il giocatore deve rispondere obbligatoriamente a **5 domande a risposta chiusa (voto intero o mezzo punto da $4$ a $10$)** relative alla prestazione nel match di 5 compagni/avversari scelti dal sistema.
* I voti sono **rigorosamente anonimi**: né i giocatori né l'Admin possono vedere il singolo voto assegnato da un utente specifico, ma solo l'aggregato finale.

---

## 2. Algoritmo di Generazione Equa delle 5 Domande (*Least-Voted First*)

Poiché non è garantito che tutti i 10 giocatori accedano contemporaneamente a votare, l'assegnazione delle 5 domande avviene **dinamicamente al momento dell'apertura del questionario** da parte del giocatore votante $i \in \mathcal{M}_{\text{match}}$:

### Passo 1: Selezione dei 5 Giocatori da Valutare
1. Si considerano i 9 giocatori candidabili $j \in \mathcal{M}_{\text{match}} \setminus \{i\}$ (tutti i partecipanti al match tranne il votante stesso).
2. Per ciascun candidato $j$, si legge dal contatore del match corrente il numero di valutazioni già ricevute finora: `votes_received_count[j]`.
3. Si ordinano i 9 candidati in senso **crescente** rispetto a `votes_received_count[j]` (applicando uno *shuffle* casuale tra i giocatori a pari merito per evitare bias d'ordine).
4. Si selezionano i **primi 5 giocatori** della lista ordinata.
   * *Risultato matematico:* La discrepanza massima di voti ricevuti tra qualsiasi coppia di giocatori della partita non supera mai $\le 1$ voto, garantendo un'equidistribuzione ottimale indipendentemente da quanti giocatori completeranno il questionario.

### Passo 2: Selezione della Caratteristica da Domandare per ciascuno dei 5 Giocatori
Per ciascuno dei 5 giocatori selezionati $j$:
* **Caso 1 — Il giocatore $j$ è stato impiegato come Portiere Attivo nel match ($j \in \mathcal{K}^*$):**
  * La domanda riguarda **esclusivamente** la caratteristica **Portiere ($w_{\text{GK}}$)**.
  * *Template domanda:* `"Come si è comportato [Nome_j] tra i pali come Portiere?"`
* **Caso 2 — Il giocatore $j$ è stato impiegato come Giocatore di Movimento ($j \in \mathcal{M}$):**
  * Si legge dal profilo del giocatore $j$ il contatore storico delle valutazioni ricevute sulle 5 caratteristiche: `attr_votes_count[j] = {T, V, P, R, D}`.
  * Si seleziona l'attributo $k^* \in \{T, V, P, R, D\}$ con il **minor numero di valutazioni storiche** (con scelta casuale in caso di parità).
  * *Template domande per attributo:*
    * **Tiro ($T$):** `"Come ha tirato e finalizzato [Nome_j]?"`
    * **Velocità ($V$):** `"Quanto è stato rapido e scattante [Nome_j]?"`
    * **Passaggio ($P$):** `"Quanto è stato preciso nei passaggi e nella visione di gioco [Nome_j]?"`
    * **Resistenza ($R$):** `"Quanta tenuta atletica e corsa ha dimostrato [Nome_j]?"`
    * **Difesa ($D$):** `"Quanto è stato solido in marcatura e nei contrasti [Nome_j]?"`

### Passo 3: Invio Risposte e Riscatto Token
Quando il giocatore $i$ invia tutti e 5 i voti $v_1, v_2, v_3, v_4, v_5 \in [4, 10]$:
1. I 5 voti vengono sommati negli accumulatori anonimi del match per il rispettivo giocatore e attributo (`sum_votes[j][k] += v`, `count_votes[j][k] += 1`).
2. Il giocatore $i$ viene marcato nel match come `has_voted = true`.
3. Il saldo del giocatore $i$ viene incrementato immediatamente di $+T_{\text{pres}}$ token.

---

## 3. Modello Matematico di Aggiornamento dei Pesi (Consolidamento Fine Match)

Quando l'Admin archivia il match (`ARCHIVED`), il sistema aggiorna i pesi dei giocatori che hanno ricevuto almeno un voto su una data caratteristica $k \in \{T, V, P, R, D, \text{GK}\}$.

### 3.1 Media del Match e Normalizzazione Lineare $[4, 10] \to [0, 1]$
Siano $v_{j,k}^{(1)}, \dots, v_{j,k}^{(m)}$ gli $m \ge 1$ voti (in scala $4\text{--}10$) ricevuti dal giocatore $j$ sulla caratteristica $k$ nella partita appena conclusa.
La media grezza della prestazione è:

$$\bar{v}_{j,k} = \frac{1}{m} \sum_{s=1}^m v_{j,k}^{(s)} \in [4, 10]$$

Questa viene proiettata linearmente nel dominio $[0, 1]$ del motore matematico tramite la trasformazione:

$$u_{j,k} = \text{clip}_{[0,1]}\left( \frac{\bar{v}_{j,k} - 4}{6} \right)$$

| Voto Medio in Pagella ($\bar{v}_{j,k}$) | Valore Normalizzato ($u_{j,k} \in [0,1]$) | Equivalente Scala FUT ($40\text{--}99$) |
| :---: | :---: | :---: |
| $4.0$ | $0.000$ | $40$ |
| $6.0$ (Sufficienza) | $0.333$ | $60$ |
| $7.0$ (Buona prova) | $0.500$ | $70$ |
| $8.0$ (Ottima prova) | $0.667$ | $80$ |
| $9.0$ (Prestazione top) | $0.833$ | $90$ |
| $10.0$ (Perfezione) | $1.000$ | $99$ |

### 3.2 Aggiornamento tramite Media Mobile Esponenziale (EMA)
Per evitare che una singola serata storta (o un singolo voto estremo) stravolga il ruolo tattico del giocatore, il peso $w_{j,k}$ viene aggiornato usando una **Media Mobile Esponenziale** con parametro di inerzia $\eta \in [0.05, 0.50]$ (default $\eta = 0.15$, configurabile dall'Admin):

$$w_{j,k}^{(\text{nuovo})} = (1 - \eta) \cdot w_{j,k}^{(\text{vecchio})} + \eta \cdot u_{j,k}$$

*(Se un giocatore non ha ricevuto alcun voto sull'attributo $k$ in quella partita, cioè $m = 0$, l'attributo resta invariato: $w_{j,k}^{(\text{nuovo})} = w_{j,k}^{(\text{vecchio})}$).*

Una volta aggiornati i 5 pesi di movimento, vengono ricalcolati e salvati automaticamente sul profilo del giocatore:
* il nuovo Overall $M_j = \frac{1}{5}\sum w_{j,k}$;
* il nuovo indice di ruolo continuo $\delta_j \in [-1, +1]$ e il relativo badge di ruolo (*ATT, TUT, DIF*).