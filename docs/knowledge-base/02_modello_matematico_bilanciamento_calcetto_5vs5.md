# Specifica Tecnica e Matematica: Motore di Bilanciamento Squadre di Calcio a 5 (5 vs 5)

Questo documento definisce l'architettura matematica completa per un sistema di matchmaking e bilanciamento automatico di due squadre di calcio a 5 ($G_1$ e $G_2$), composti da 10 giocatori totali (5 per squadra). 

Il motore opera attraverso un **Modello Gerarchico a Tre Stadi**:
1. **Stadio I — Filtraggio Portieri e Classificazione Individuale a 3 Stati:** estrazione dei portieri attivi e mappatura delle caratteristiche continue dei giocatori di movimento in 3 ruoli tattici discreti (**Attaccante, Tuttocampista, Difensore**).
2. **Stadio II — Ottimizzazione Macro-Strutturale dei Ruoli (Frontiera di Pareto):** determinazione delle 2 migliori configurazioni di modulo tattico per le due squadre (**Soluzione A: Simmetria di Ruolo** e **Soluzione B: Compensazione Tattica**).
3. **Stadio III — Ottimizzazione Micro-Allocativa di Forza (MIQP):** selezione esatta dei singoli giocatori per ciascuna delle 2 configurazioni, minimizzando lo scarto di forza complessiva, lo sbilanciamento sui 5 fondamentali, il baricentro tattico continuo e la varianza interna.

---

## 1. Struttura dei Dati di Input (Il Giocatore)

Sia $\mathcal{U} = \{1, 2, \dots, 10\}$ l'insieme dei 10 giocatori convocati. Ogni giocatore $i \in \mathcal{U}$ è descritto dal vettore di input:

$$\mathbf{p}_i = \big(\mathbf{w}_i, \, w_{\text{GK}, i}, \, b_{\text{GK}, i}\big)$$

### 1.1 Parametri del Giocatore
* **Vettore delle 5 Caratteristiche di Movimento:** $\mathbf{w}_i = (w_{T,i}, w_{V,i}, w_{P,i}, w_{R,i}, w_{D,i}) \in [0, 1]^5$, dove:
  * $w_{T,i} \in [0, 1]$: **Tiro** (finalizzazione offensiva)
  * $w_{V,i} \in [0, 1]$: **Velocità** (scatto e transizione)
  * $w_{P,i} \in [0, 1]$: **Passaggio** (regia, tecnica e visione di gioco)
  * $w_{R,i} \in [0, 1]$: **Resistenza** (tenuta atletica, pressing e copertura)
  * $w_{D,i} \in [0, 1]$: **Difesa** (marcatura, contrasto e interdizione)
* **Forza Media di Movimento (Overall $M_i$):**
  $$M_i = \frac{w_{T,i} + w_{V,i} + w_{P,i} + w_{R,i} + w_{D,i}}{5} \in [0, 1]$$
* **Forza Specifica Portiere:** $w_{\text{GK}, i} \in [0, 1]$ (valuta l'abilità tra i pali; non influisce sul calcolo del ruolo di movimento).
* **Booleano di Autodeterminazione Portiere:** $b_{\text{GK}, i} \in \{0, 1\}$ ($1$ se il giocatore dichiara di voler giocare in porta, $0$ altrimenti).

---

## 2. Stadio I: Gestione Portieri e Classificazione nei 3 Stati di Movimento

### 2.1 Selezione dei Portieri Attivi e Riconversione degli Esclusi
1. Si individua l'insieme dei candidati portieri $\mathcal{K} = \{ i \in \mathcal{U} \mid b_{\text{GK}, i} = 1 \}$, con cardinalità $n = |\mathcal{K}|$.
2. Si ordinano gli elementi di $\mathcal{K}$ in ordine decrescente rispetto al peso portiere $w_{\text{GK}, i}$:
   $$w_{\text{GK}, i_{(1)}} \ge w_{\text{GK}, i_{(2)}} \ge \dots \ge w_{\text{GK}, i_{(n)}}$$
3. Il numero di portieri attivi impiegati in porta nella partita è:
   $$K = \min(n, 2) \in \{0, 1, 2\}$$
4. L'insieme dei 10 giocatori viene diviso in due insiemi disgiunti:
   * **Portieri Attivi ($\mathcal{K}^*$):** i primi $K$ candidati della graduatoria.
     * Se $K = 2$: $k_1 = 1$ portiere in $G_1$, $k_2 = 1$ portiere in $G_2$.
     * Se $K = 1$: $k_1 = 1$ portiere in $G_1$, $k_2 = 0$ portieri in $G_2$.
     * Se $K = 0$: $k_1 = 0, k_2 = 0$ (nessun portiere di ruolo).
   * **Giocatori di Movimento ($\mathcal{M} = \mathcal{U} \setminus \mathcal{K}^*$):** i restanti $10 - K \in \{8, 9, 10\}$ giocatori. Gli eventuali $\max(0, n - 2)$ portieri scartati vengono riconvertiti automaticamente in giocatori di movimento e classificati tramite il loro vettore $\mathbf{w}_i$.

---

### 2.2 Calcolo dei Poli ($S_A, S_D$) e dell'Indice Relativo di Ruolo ($\delta_i$)
Per ogni giocatore di movimento $i \in \mathcal{M}$, si calcolano due punteggi lineari simmetrici: **Affinità Offensiva ($S_{A,i}$)** e **Affinità Difensiva ($S_{D,i}$)**, usando i coefficienti strutturali $(a, b, c, d) = (0.50, \, 0.25, \, 0.10, \, 0.15)$ con $a+b+c+d = 1$:

$$\begin{cases}
S_{A,i} = 0.50 \, w_{T,i} + 0.25 \, w_{V,i} + 0.10 \, w_{R,i} + 0.15 \, w_{P,i} \\[4pt]
S_{D,i} = 0.50 \, w_{D,i} + 0.25 \, w_{R,i} + 0.10 \, w_{V,i} + 0.15 \, w_{P,i}
\end{cases}$$

Per separare la vocazione tattica del giocatore dalla sua bravura assoluta $M_i$, si calcola lo **scarto relativo normalizzato** $\delta_i \in [-1, +1]$:

$$\delta_i = \frac{S_{A,i} - S_{D,i}}{S_{A,i} + S_{D,i}} = \frac{0.50 \, (w_{T,i} - w_{D,i}) + 0.15 \, (w_{V,i} - w_{R,i})}{0.50 \, (w_{T,i} + w_{D,i}) + 0.35 \, (w_{V,i} + w_{R,i}) + 0.30 \, w_{P,i}}$$

*(Convenzione per il caso limite: se $S_{A,i} + S_{D,i} = 0$, si pone $\delta_i = 0$).*

---

### 2.3 Regola di Classificazione a Soglia nei 3 Stati ($C_i$)
Fissata la soglia di specializzazione $\tau = 0.20$ (che equivale a richiedere un rapporto di predominanza di almeno $60\%$ contro $40\%$ tra i due poli, ovvero $\frac{S_A}{S_D} > \frac{1+\tau}{1-\tau} = 1.5$), ciascun giocatore $i \in \mathcal{M}$ viene assegnato a uno dei 3 stati discreti $C_i \in \{-1, 0, +1\}$:

$$C_i = \begin{cases} 
+1 \quad (\textbf{Attaccante / Positivo}) & \text{se } \delta_i > +0.20 \\[4pt]
\phantom{+}0 \quad (\textbf{Tuttocampista / Neutro}) & \text{se } -0.20 \le \delta_i \le +0.20 \\[4pt]
-1 \quad (\textbf{Difensore / Negativo}) & \text{se } \delta_i < -0.20 
\end{cases}$$

Si ottengono così i 3 sottoinsiemi di ruolo $\mathcal{M}_P = \{i \in \mathcal{M} \mid C_i = +1\}$, $\mathcal{M}_N = \{i \in \mathcal{M} \mid C_i = -1\}$, $\mathcal{M}_0 = \{i \in \mathcal{M} \mid C_i = 0\}$ e il vettore dei conteggi del pool di movimento:

$$\mathbf{N}_{\mathcal{M}} = (N_P, N_N, N_0) \quad \text{con} \quad N_P + N_N + N_0 = 10 - K$$

---

## 3. Stadio II: Ottimizzazione Macro-Strutturale della Distribuzione dei Ruoli

Le squadre $G_1$ e $G_2$ dispongono di $m_1 = 5 - k_1$ e $m_2 = 5 - k_2$ posti per i giocatori di movimento.  
La ripartizione dei ruoli nella squadra $G_r$ ($r \in \{1, 2\}$) è rappresentata dal vettore $\mathbf{x}^{(r)} = (p_r, n_r, z_r) \in \mathbb{N}_0^3$, dove:
* $p_r$: numero di Attaccanti ($+1$) in $G_r$;
* $n_r$: numero di Difensori ($-1$) in $G_r$;
* $z_r$: numero di Tuttocampisti ($0$) in $G_r$.

### 3.1 Dominio Ammissibile delle Configurazioni di Ruolo ($\mathcal{D}_K$)
Poiché $\mathbf{x}^{(2)} = \mathbf{N}_{\mathcal{M}} - \mathbf{x}^{(1)}$, lo spazio delle decisioni macro-strutturali è definito unicamente dalla scelta di $\mathbf{x}^{(1)} \in \mathcal{D}_K$:

$$\mathcal{D}_K = \left\{ (p_1, n_1, z_1) \in \mathbb{N}_0^3 \;\middle|\; p_1 + n_1 + z_1 = 5 - k_1, \;\; 0 \le p_1 \le N_P, \;\; 0 \le n_1 \le N_N, \;\; 0 \le z_1 \le N_0 \right\}$$

---

### 3.2 Metriche di Equilibrio Strutturale
Per ogni partizione candidata $(\mathbf{x}^{(1)}, \mathbf{x}^{(2)})$ si calcolano tre indicatori:

1. **Squilibrio Algebrico di Carica ($J_{\text{alg}}$):**
   Misura lo sbilanciamento tra attaccanti e difensori all'interno di ciascuna squadra ($q_r = p_r - n_r$):
   $$J_{\text{alg}}(\mathbf{x}^{(1)}, \mathbf{x}^{(2)}) = (p_1 - n_1)^2 + (p_2 - n_2)^2$$
   *(Minimizzare $J_{\text{alg}}$ forza entrambe le squadre ad avere la stessa carica netta $q_1 \approx q_2$).*

2. **Discrepanza Strutturale Inter-Squadra ($J_{\text{diff}}$):**
   Misura la distanza euclidea quadratica tra i moduli delle due squadre:
   $$J_{\text{diff}}(\mathbf{x}^{(1)}, \mathbf{x}^{(2)}) = \|\mathbf{x}^{(1)} - \mathbf{x}^{(2)}\|_2^2 = (p_1 - p_2)^2 + (n_1 - n_2)^2 + (z_1 - z_2)^2$$
   *(Minimizzare $J_{\text{diff}}$ rende la composizione delle due squadre il più possibile speculare).*

3. **Entropia Tattica Complessiva ($H_{\text{tot}}$):**
   Misura la varietà interna dei ruoli tramite l'entropia di Shannon (con $0 \log_2 0 = 0$):
   $$H_{\text{tot}}(\mathbf{x}^{(1)}, \mathbf{x}^{(2)}) = - \sum_{r=1}^2 \sum_{t \in \{p, n, z\}} \frac{t_r}{m_r} \log_2 \left(\frac{t_r}{m_r}\right)$$

---

### 3.3 Estrazione delle 2 Soluzioni Ottimali di Ruolo (Simmetria vs Compensazione)
Per offrire due opzioni tattiche complementari quando il pool di partenza è asimmetrico o dispari, il motore risolve la funzione di costo $J(\mathbf{x}^{(1)}) = w_1 J_{\text{alg}} + w_2 J_{\text{diff}} - w_3 H_{\text{tot}}$ con due set di pesi distinti:

* **Soluzione Strutturale A — Ottimo di Simmetria:**  
  Si ottiene minimizzando con pesi $(w_1, w_2, w_3) = (1.0, \, 2.0, \, 0.1)$ (ovvero $w_2 > \frac{1}{2}w_1$).  
  *Comportamento:* Privilegia la parità numerica ruolo per ruolo ($J_{\text{diff}}$ minimo). Divide equamente i tuttocampisti e contrappone un eventuale attaccante dispari a un difensore dispari nell'altra squadra (es. sul pool $(1, 3, 4)$ genera $(1, 1, 2) \text{ vs } (0, 2, 2)$).
* **Soluzione Strutturale B — Ottimo di Compensazione Tattica:**  
  Si ottiene minimizzando con pesi $(w_1, w_2, w_3) = (3.0, \, 1.0, \, 0.1)$ (ovvero $w_1 > 2w_2$).  
  *Comportamento:* Privilegia il pareggio del baricentro algebrico ($J_{\text{alg}}$ minimo, $q_1 = q_2$). Alla squadra rimasta senza attaccanti (o con più difensori) assegna più tuttocampisti per compensare la minore spinta offensiva (es. sul pool $(1, 3, 4)$ genera $(1, 2, 1) \text{ vs } (0, 1, 3)$).

*(Nota: Se per simmetria del pool le Soluzioni A e B coincidono nella stessa partizione di ruoli, lo Stadio III restituirà la prima e la seconda miglior combinazione di giocatori per quella partizione).*

---

## 4. Stadio III: Ottimizzazione Micro-Allocativa dei Giocatori (Equilibrio di Forza)

Fissata una configurazione di ruoli ottimale $\mathbf{x}^{(1)} = (p_1, n_1, z_1)$ dallo Stadio II, si deve scegliere quali specifici giocatori assegnare a $G_1$ e quali a $G_2$.

Si definisce il vettore binario di assegnazione $\mathbf{u} = (u_1, u_2, \dots, u_{10}) \in \{0, 1\}^{10}$, dove:
* $u_i = 1$ se il giocatore $i$ appartiene a $G_1$;
* $u_i = 0$ se il giocatore $i$ appartiene a $G_2$.

### 4.1 Vincoli Esatti di Quota Ruolo
Il vettore $\mathbf{u}$ deve appartenere allo spazio ammissibile $\mathcal{U}(\mathbf{x}^{(1)})$:

$$\begin{cases}
\displaystyle\sum_{i \in \mathcal{M}_P} u_i = p_1 & (\text{vincolo Attaccanti}) \\[8pt]
\displaystyle\sum_{i \in \mathcal{M}_N} u_i = n_1 & (\text{vincolo Difensori}) \\[8pt]
\displaystyle\sum_{i \in \mathcal{M}_0} u_i = z_1 & (\text{vincolo Tuttocampisti}) \\[8pt]
\displaystyle\sum_{g \in \mathcal{K}^*} u_g = k_1 & (\text{vincolo Portieri Attivi})
\end{cases}$$

Poiché il numero totale di combinazioni ammissibili è $\Omega = \binom{N_P}{p_1} \binom{N_N}{n_1} \binom{N_0}{z_1} \binom{K}{k_1} \le 252$, l'algoritmo esplora **tutte** le combinazioni ammissibili trovando sempre il minimo globale esatto.

---

### 4.2 Le 4 Componenti della Funzione di Costo di Forza ($L_{\text{forza}}$)

Per ogni combinazione candidata $\mathbf{u} \in \mathcal{U}(\mathbf{x}^{(1)})$, si calcolano quattro termini di penalità quadratica:

#### 1. Squilibrio di Potenza Totale e Compensazione Portieri ($\Phi_{\text{tot}}$)
Calcola la differenza quadratica tra la forza complessiva dei 5 giocatori di $G_1$ e dei 5 giocatori di $G_2$, includendo il peso specifico dei portieri attivi ($\lambda_{\text{GK}} = 1.0$):

$$F^{(1)}(\mathbf{u}) = \sum_{i \in \mathcal{M}} u_i \, M_i + \lambda_{\text{GK}} \sum_{g \in \mathcal{K}^*} u_g \, w_{\text{GK}, g}$$

$$F^{(2)}(\mathbf{u}) = \sum_{i \in \mathcal{M}} (1 - u_i) \, M_i + \lambda_{\text{GK}} \sum_{g \in \mathcal{K}^*} (1 - u_g) \, w_{\text{GK}, g}$$

$$\Phi_{\text{tot}}(\mathbf{u}) = \left( F^{(1)}(\mathbf{u}) - F^{(2)}(\mathbf{u}) \right)^2$$

> **Effetto chiave:** Se una squadra riceve il portiere più debole (o se $K=1$ e una squadra è senza portiere di ruolo), $\Phi_{\text{tot}}$ compensa automaticamente quella squadra assegnandole giocatori di movimento con Overall $M_i$ più alto.

#### 2. Squilibrio Vettoriale sui 5 Fondamentali ($\Phi_{\text{attr}}$)
Calcola la distanza euclidea quadratica tra le medie delle due squadre su ciascuna delle 5 caratteristiche $k \in \{T, V, P, R, D\}$:

$$\bar{W}_k^{(1)}(\mathbf{u}) = \frac{1}{m_1} \sum_{i \in \mathcal{M}} u_i \, w_{k,i}, \qquad \bar{W}_k^{(2)}(\mathbf{u}) = \frac{1}{m_2} \sum_{i \in \mathcal{M}} (1 - u_i) \, w_{k,i}$$

$$\Phi_{\text{attr}}(\mathbf{u}) = \sum_{k \in \{T, V, P, R, D\}} \left( \bar{W}_k^{(1)}(\mathbf{u}) - \bar{W}_k^{(2)}(\mathbf{u}) \right)^2$$

> **Effetto chiave:** Garantisce che entrambe le squadre siano bilanciate non solo nella media generale, ma anche in Tiro, Velocità, Passaggio, Resistenza e Difesa presi singolarmente.

#### 3. Squilibrio del Baricentro Tattico Continuo ($\Phi_{\delta}$)
Confronta la media degli indici continui $\delta_i$ dei giocatori di movimento delle due squadre:

$$\bar{\delta}^{(1)}(\mathbf{u}) = \frac{1}{m_1} \sum_{i \in \mathcal{M}} u_i \, \delta_i, \qquad \bar{\delta}^{(2)}(\mathbf{u}) = \frac{1}{m_2} \sum_{i \in \mathcal{M}} (1 - u_i) \, \delta_i$$

$$\Phi_{\delta}(\mathbf{u}) = \left( \bar{\delta}^{(1)}(\mathbf{u}) - \bar{\delta}^{(2)}(\mathbf{u}) \right)^2$$

> **Effetto chiave:** A parità di ruolo discreto, assegna alla squadra che ha meno attaccanti i difensori e i tuttocampisti con propensione più offensiva ($\delta_i$ più alto).

#### 4. Squilibrio di Omogeneità / Varianza Interna ($\Phi_{\text{var}}$)
Confronta la varianza dei valori assoluti $M_i$ dei giocatori di movimento all'interno di ciascuna squadra:

$$\sigma^2(G_1) = \frac{1}{m_1} \sum_{i \in \mathcal{M}} u_i \left(M_i - \bar{M}^{(1)}\right)^2, \qquad \sigma^2(G_2) = \frac{1}{m_2} \sum_{i \in \mathcal{M}} (1 - u_i) \left(M_i - \bar{M}^{(2)}\right)^2$$

$$\Phi_{\text{var}}(\mathbf{u}) = \left( \sigma^2(G_1) - \sigma^2(G_2) \right)^2$$

> **Effetto chiave:** Evita che una squadra concentri il giocatore più forte e quello più debole contro una squadra di giocatori tutti medi.

---

### 4.3 Funzione Obiettivo Finale di Selezione Giocatori
La combinazione ottima di giocatori $\mathbf{u}^*$ per una data configurazione di ruoli $\mathbf{x}^{(1)}$ è:

$$\mathbf{u}^* = \arg\min_{\mathbf{u} \in \mathcal{U}(\mathbf{x}^{(1)})} L_{\text{forza}}(\mathbf{u}) = \alpha_1 \, \Phi_{\text{tot}}(\mathbf{u}) + \alpha_2 \, \Phi_{\text{attr}}(\mathbf{u}) + \alpha_3 \, \Phi_{\delta}(\mathbf{u}) + \alpha_4 \, \Phi_{\text{var}}(\mathbf{u})$$

con pesi di taratura standard:
* $\alpha_1 = 2.00$ (Priorità 1: Pareggio della forza totale comprensiva dei portieri)
* $\alpha_2 = 1.00$ (Priorità 2: Pareggio vettoriale dei 5 fondamentali tecnici/atletici)
* $\alpha_3 = 0.50$ (Priorità 3: Pareggio della propensione offensiva/difensiva continua $\delta$)
* $\alpha_4 = 0.25$ (Priorità 4: Pareggio della distribuzione dei top player / varianza interna)

---

## 5. Riepilogo delle Costanti di Configurazione del Sistema

| Costante | Simbolo | Valore Default | Ruolo nel Modello |
| :--- | :---: | :---: | :--- |
| Peso primario ruolo (Tiro / Difesa) | $a$ | $0.50$ | Determina la spinta principale di ruolo in $S_A$ e $S_D$ |
| Peso atletico dominante (Vel. in Att / Res. in Dif) | $b$ | $0.25$ | Secondo contributore polare in $S_A$ e $S_D$ |
| Peso atletico incrociato (Res. in Att / Vel. in Dif) | $c$ | $0.10$ | Contributo incrociato per terzini veloci e punte di pressing |
| Peso regia centrale (Passaggio) | $d$ | $0.15$ | Stabilizzatore neutro comune a $S_A$ e $S_D$ |
| Soglia di specializzazione ruolo | $\tau$ | $0.20$ | Separa i Tuttocampisti ($|\delta| \le 0.20$) da Attaccanti e Difensori |
| Moltiplicatore peso Portiere | $\lambda_{\text{GK}}$ | $1.00$ | Peso della forza del portiere nel calcolo della potenza totale $F^{(r)}$ |
| Pesi Macro Soluzione A (Simmetria) | $(w_1, w_2, w_3)_A$ | $(1.0, 2.0, 0.1)$ | Privilegia moduli speculari tra $G_1$ e $G_2$ |
| Pesi Macro Soluzione B (Compensazione) | $(w_1, w_2, w_3)_B$ | $(3.0, 1.0, 0.1)$ | Privilegia il pareggio di carica netta $q_1 = q_2$ tramite i tuttocampisti |
| Pesi Micro Forza $(\alpha_1, \alpha_2, \alpha_3, \alpha_4)$ | $\boldsymbol{\alpha}$ | $(2.0, 1.0, 0.5, 0.25)$ | Pesi di selezione della formazione più equilibrata nello Stadio III |

---

## 6. Struttura dell'Output Atteso dall'Applicazione

Per ogni esecuzione su un gruppo di 10 giocatori, il motore restituisce:
1. **Scheda Analitica dei 10 Giocatori:** per ogni giocatore mostra l'Overall $M_i$, i punteggi $S_{A,i}$ e $S_{D,i}$, l'indice $\delta_i \in [-1, +1]$ e il ruolo assegnato (**Portiere Attivo**, **Attaccante**, **Tuttocampista**, **Difensore**, segnalando eventuali portieri in esubero riconvertiti in movimento).
2. **Proposta 1 (Soluzione A — Simmetria di Modulo):**
   * Elenco dei 5 giocatori di $G_1$ e dei 5 giocatori di $G_2$ con i rispettivi ruoli.
   * Confronto tra $G_1$ e $G_2$ su: Potenza Totale ($F^{(1)}$ vs $F^{(2)}$), Medie sui 5 fondamentali ($\bar{W}_T, \bar{W}_V, \bar{W}_P, \bar{W}_R, \bar{W}_D$) e Indice di Equilibrio percentuale.
3. **Proposta 2 (Soluzione B — Compensazione Tattica):**
   * Elenco dei 5 giocatori di $G_1$ e dei 5 giocatori di $G_2$ con i rispettivi ruoli.
   * Confronto analitico completo delle metriche di squadra.