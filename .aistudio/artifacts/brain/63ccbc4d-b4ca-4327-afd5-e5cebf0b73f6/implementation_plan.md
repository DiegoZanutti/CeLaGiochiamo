# Piano di Modifica Aggiornato — Preprocessing Esclusivo per la Card FUT

## 1. Mantenimento Proporzioni Originali per il Resto dell'App (`/src/lib/imageProcessor.ts` & `/src/components/ProfileWalletView.tsx`)
- **`preprocessPlayerPhoto(file)`**:
  - Mantiene intatte le **proporzioni originali** dell'immagine caricata (limitando solo la risoluzione massima a `560px` sul lato lungo per il salvataggio rapido su Firestore in `player.avatar_url`), senza alterare inquadratura, proporzioni o bordi.
- **Avatar nel Profilo e nel Backoffice**:
  - L'avatar nell'intestazione del Profilo (`ProfileWalletView.tsx`) e nella lista giocatori del Backoffice (`AdminBackofficeView.tsx`) continua a usare l'immagine con le sue proporzioni originali (`object-cover rounded-2xl`).
- **Rimozione testo nel Profilo**:
  - Rimozione completa della scritta *"Rimozione automatica dello sfondo (AI Cutout) e ritaglio sul volto per la tua Card FUT."* sotto i pulsanti di caricamento foto in `ProfileWalletView.tsx`.

---

## 2. Preprocessing Geometrico Basato sugli Occhi Esclusivamente nella Card FUT (`/src/lib/imageProcessor.ts` & `/src/components/FutCard.tsx`)
- Creazione della funzione dedicata `renderFutCardCutout(avatarUrl)` (con cache in memoria per non rielaborare la stessa foto a ogni render) usata **esclusivamente dentro `FutCard.tsx`**:
  1. **Rimozione sfondo (`MediaPipe Selfie Segmenter`)** e **Rilevamento occhi (`MediaPipe BlazeFace`)** sull'immagine del giocatore.
  2. **Scala basata sulla distanza tra gli occhi (`1/6` della larghezza della card)**:
     - `targetEyeDistance = targetW / 6` (`43.33px` su larghezza card `260`, ovvero `86.67px` su canvas 2x da `520px`).
     - `scale = targetEyeDistance / eyeDistance`.
  3. **Allineamento verticale degli occhi (`60%` dal basso della metà superiore)**:
     - Considerando la metà superiore della carta dal punto più alto (`y = 8`) alla linea sotto il nome (`y = 204`, altezza `196`):
       `targetEyesY = 204 - 0.60 * (204 - 8) = 86.4` (`172.8px` su canvas 2x).
  4. **Allineamento orizzontale del viso (`2/3` della larghezza dal bordo sinistro)**:
     - `targetEyesX = (2 / 3) * targetW` (`173.33` su `260`, ovvero `346.67px` su canvas 2x).
  5. **Ritaglio lungo i bordi della Carta FUT (`FUT_SHIELD_INNER_PATH`)**:
     - Applicato solo al cutout renderizzato dentro `FutCard.tsx`.
