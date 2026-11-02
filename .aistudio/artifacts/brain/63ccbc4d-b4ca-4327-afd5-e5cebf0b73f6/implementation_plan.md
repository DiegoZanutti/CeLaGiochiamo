# Disposizione Semplificata dei 5 Giocatori in Campo (Match & Scommesse)

Questo aggiornamento semplifica la visualizzazione dei 5 giocatori per squadra sul campo di **Match & Scommesse**, mostrando direttamente i 5 componenti nell'ordine della formazione senza riordinarli per propensione difensiva/offensiva o attitudine in porta e mantenendo sempre il badge ruolo originale di ogni giocatore.

## User Review & Critical Decisions

> [!IMPORTANT]
> Di seguito sono riepilogate le regole di visualizzazione sul campo che verranno applicate:

- **Ordine Diretto dei 5 Giocatori**: I 5 giocatori di ciascuna squadra (`Squadra Gabry` e `Squadra Piero`) vengono presi direttamente dalla lista della squadra (eventuale `gk_id` seguito da `outfield_ids`) e posizionati nei 5 slot a pentagono (1 vertice vicino alla porta, 2 sulle fasce, 2 centrali) senza alcun riordinamento per `delta_index` o valore `portiere`.
- **Badge Ruolo Originale per Tutti**: Nessun giocatore riceve la forzatura del badge `POR` solo perché occupa il primo slot vicino alla porta. Ogni giocatore mostra sempre il proprio ruolo effettivo (`POR` solo se ha effettivamente scelto di fare il portiere, altrimenti `DIF`, `TUT` o `ATT`).

---

## 1. Overview & Core Concept

- **Cosa fa**: Mostra i 5 giocatori di `Squadra Gabry` e i 5 giocatori di `Squadra Piero` disposti a pentagono sul campo da calcetto 5vs5, preservando l'ordine naturale della formazione e il ruolo reale di ciascun giocatore.
- **Valore aggiunto**: Evita che giocatori di movimento si ritrovino etichettati artificialmente come `POR` quando una squadra gioca con portiere a rotazione, e rimuove logiche di riordino non richieste sulla grafica del campo.

---

## 2. User Experience & Visual Design

- **Layout sul Campo 5vs5**:
  - Mantiene la struttura simmetrica a pentagono (`1 - 2 - 2` per Squadra Gabry nella metà superiore e `2 - 2 - 1` per Squadra Piero nella metà inferiore) con tutti i 10 box di dimensioni identiche (`w-[134px] sm:w-[162px] h-[52px]`).
  - Il primo giocatore della lista occupa il vertice vicino alla porta, il secondo e il terzo occupano i due slot larghi, il quarto e il quinto occupano i due slot più vicini al centrocampo.
- **Badge Ruolo**:
  - Ogni box giocatore mostra `player.wants_to_be_gk ? 'POR' : player.computed.role_label`.

---

## 3. Key Product Decisions & Trade-Offs

- **Rimozione dell'ordinamento per `delta_index` e `portiere` nella UI del campo**:
  - *Approccio scelto*: Usare direttamente l'array dei 5 ID assegnati alla squadra (`[...(team.gk_id ? [team.gk_id] : []), ...team.outfield_ids]`).
  - *Perché*: Il motore matematico usa già `gk_id` e `outfield_ids` per calcolare l'equilibrio delle squadre; sul campo visivo basta mostrare i 5 giocatori della squadra con il loro vero ruolo.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌──────────────────────────────────────────────────────────────────────┐
│                      MatchHomeView (Campo 5vs5)                      │
├──────────────────────────────────────────────────────────────────────┤
│  getTeamPlayers(team, playerMap): Player[]                           │
│    ├── Costruisce la lista ordinata dei 5 giocatori della squadra    │
│    ├── Slot [0]    -> Vertice vicino alla porta                      │
│    ├── Slot [1, 2] -> Coppia larga del pentagono                     │
│    └── Slot [3, 4] -> Coppia centrale vicino a metà campo            │
│                                                                      │
│  PitchPlayerToken(player)                                            │
│    └── Mostra roleBadge = player.wants_to_be_gk                      │
│                           ? 'POR'                                    │
│                           : player.computed.role_label               │
└──────────────────────────────────────────────────────────────────────┘
```
