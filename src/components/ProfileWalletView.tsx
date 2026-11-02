import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { FutCard } from './FutCard';
import { preprocessPlayerPhoto } from '../lib/imageProcessor';
import {
  Camera,
  Clock,
  Coins,
  LogIn,
  LogOut,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';

interface ProfileWalletViewProps {
  onOpenBackoffice?: () => void;
  onOpenLogin?: () => void;
}

export const ProfileWalletView: React.FC<ProfileWalletViewProps> = ({
  onOpenBackoffice,
  onOpenLogin,
}) => {
  const {
    currentUser,
    currentPlayer,
    players,
    config,
    isLoggedIn,
    isDirettore,
    loginWithGoogle,
    logoutUser,
    submitAccountClaim,
    unlinkAccountClaim,
    updatePlayerPhoto,
    showToast,
  } = useApp();

  const availablePlayers = players.filter(
    (p) => p.claim_status === 'UNCLAIMED' || p.id === currentUser?.linked_player_id
  );

  const [selectedClaimId, setSelectedClaimId] = useState<string>(
    availablePlayers[0]?.id ?? 'NEW_PLAYER'
  );
  const [newPlayerCustomName, setNewPlayerCustomName] = useState<string>('');
  const [isChangingPlayer, setIsChangingPlayer] = useState<boolean>(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (availablePlayers.length > 0 && selectedClaimId !== 'NEW_PLAYER') {
      const exists = availablePlayers.some((p) => p.id === selectedClaimId);
      if (!exists) {
        setSelectedClaimId(availablePlayers[0].id);
      }
    }
  }, [availablePlayers, selectedClaimId]);

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClaimId === 'NEW_PLAYER' && !newPlayerCustomName.trim()) {
      return;
    }
    await submitAccountClaim(selectedClaimId, newPlayerCustomName);
    setIsChangingPlayer(false);
    setNewPlayerCustomName('');
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentPlayer) return;
    setIsProcessingPhoto(true);
    try {
      const processedDataUrl = await preprocessPlayerPhoto(file);
      await updatePlayerPhoto(currentPlayer.id, processedDataUrl);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Errore durante l’elaborazione della foto.'
      );
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // If not logged in
  if (!isLoggedIn || !currentUser) {
    return (
      <div className="max-w-md mx-auto my-12 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-xl space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
          <LogIn className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-extrabold text-white">
            Accedi al tuo Profilo
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visualizza la tua Card FUT, controlla il tuo saldo Token e gestisci il tuo account.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenLogin || loginWithGoogle}
          className="w-full py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
        >
          Accedi Ora
        </button>
      </div>
    );
  }

  const needsPlayerLink =
    currentUser.auth_status === 'UNCLAIMED' ||
    (!currentUser.linked_player_id && currentUser.auth_status !== 'PENDING_APPROVAL') ||
    (!currentPlayer && currentUser.auth_status === 'VALIDATED');

  const initials = (currentPlayer?.name || currentUser.display_name || 'G')
    .trim()
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Prominent Backoffice Entry Card for Il Direttore */}
      {isDirettore && (
        <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Ruolo: Il Direttore
            </div>
            <h2 className="text-xl font-display font-bold text-white mt-1.5">
              Backoffice del Direttore
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestione convocazioni, motore di bilanciamento matematico, approvazioni e parametri di gioco.
            </p>
          </div>
          {onOpenBackoffice && (
            <button
              type="button"
              onClick={onOpenBackoffice}
              className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow"
            >
              <Settings className="w-4 h-4" />
              Apri Backoffice
            </button>
          )}
        </div>
      )}

      {/* Profile Header & Account Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-4">
            {/* Profile Avatar Preview */}
            <div className="relative shrink-0">
              {currentPlayer?.avatar_url ? (
                <img
                  src={currentPlayer.avatar_url}
                  alt={currentPlayer.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-400/60 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-400 font-display font-extrabold text-xl sm:text-2xl flex items-center justify-center">
                  {initials}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs text-slate-400">
                Stato account: <strong className="text-emerald-400">{currentUser.auth_status}</strong>
                {isDirettore ? ' · Direttore' : ''}
                {currentPlayer ? (
                  <span>
                    {' · '}Giocatore collegato: <strong className="text-white">{currentPlayer.name}</strong>
                  </span>
                ) : (
                  <span className="text-amber-400"> · Nessun giocatore collegato</span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">
                {currentUser.display_name}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {currentPlayer && (
              <button
                type="button"
                onClick={() => setIsChangingPlayer((prev) => !prev)}
                className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {isChangingPlayer ? 'Annulla Cambio' : 'Cambia Giocatore'}
              </button>
            )}
            <button
              type="button"
              onClick={logoutUser}
              className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnetti
            </button>
          </div>
        </div>

        {/* STATE: UNCLAIMED or Direttore without linked player or Changing Player */}
        {(needsPlayerLink || isChangingPlayer) && (
          <div className="pt-5 space-y-4">
            <div className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" /> Associa il tuo profilo giocatore
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              {isDirettore
                ? 'Seleziona il tuo profilo giocatore dalla rosa (oppure creane uno nuovo) per collegare immediatamente il tuo account Direttore e partecipare a partite, scommesse e votazioni.'
                : `Scegli il tuo nome nella lista dei giocatori per collegare la tua Card FUT e ricevere il bonus di +${config.initial_tokens} Token non appena Il Direttore approverà la richiesta.`}
            </p>

            <form onSubmit={handleClaimSubmit} className="space-y-3 max-w-md">
              <select
                value={selectedClaimId}
                onChange={(e) => setSelectedClaimId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-400"
              >
                {availablePlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    Sono {p.name} ({p.wants_to_be_gk ? 'POR' : p.computed.role_label})
                  </option>
                ))}
                <option value="NEW_PLAYER">Sono un nuovo giocatore (Crea profilo)</option>
              </select>

              {selectedClaimId === 'NEW_PLAYER' && (
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={newPlayerCustomName}
                  onChange={(e) => setNewPlayerCustomName(e.target.value)}
                  placeholder="Il tuo nome o soprannome..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500"
                />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {isDirettore ? 'Collega Subito al Mio Account' : 'Invia Richiesta al Direttore'}
                </button>
                {currentPlayer && (
                  <button
                    type="button"
                    onClick={async () => {
                      await unlinkAccountClaim(currentUser.uid);
                      setIsChangingPlayer(false);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Scollega Attuale
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* STATE: PENDING_APPROVAL */}
        {currentUser.auth_status === 'PENDING_APPROVAL' && !isChangingPlayer && (
          <div className="pt-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                Richiesta di associazione inviata
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                La tua richiesta per &ldquo;{currentPlayer?.name ?? currentUser.linked_player_id}&rdquo; è in attesa di approvazione da parte del Direttore.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* STATE: VALIDATED — Personal FUT Card, Photo Upload & Wallet Stats */}
      {currentUser.auth_status === 'VALIDATED' && currentPlayer && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center space-y-4">
            <div className="text-xs text-slate-400 font-medium">
              La tua Card FUT Ufficiale
            </div>
            <div className="w-60">
              <FutCard player={currentPlayer} />
            </div>

            {/* Photo Upload & Preprocessing Controls */}
            <div className="w-full pt-3 border-t border-slate-800 flex flex-col items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoFileChange}
                className="sr-only"
                id="profile-photo-upload"
              />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <label
                  htmlFor="profile-photo-upload"
                  className={`px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
                    isProcessingPhoto ? 'opacity-60 pointer-events-none' : ''
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isProcessingPhoto
                    ? 'Ottimizzazione foto...'
                    : currentPlayer.avatar_url
                    ? 'Cambia Foto Card'
                    : 'Carica Foto Card'}
                </label>

                {currentPlayer.avatar_url && (
                  <button
                    type="button"
                    onClick={() => updatePlayerPhoto(currentPlayer.id, '')}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Rimuovi
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 text-center max-w-xs">
                Ritaglio automatico sul volto e ottimizzazione luci per lo scudetto FUT e il tuo profilo.
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="text-xs text-emerald-400 font-medium">Profilo Convalidato</div>
                <h3 className="text-xl font-display font-bold text-white mt-0.5">
                  Statistiche & Wallet
                </h3>
              </div>

              <div className="bg-slate-950 border border-amber-500/30 rounded-2xl px-4 py-2 text-right">
                <div className="text-[10px] text-slate-400">Saldo Token</div>
                <div className="text-xl font-display font-extrabold text-amber-300 font-mono-tabular flex items-center gap-1.5 justify-end">
                  <Coins className="w-4 h-4" /> {currentPlayer.stats.tokens}
                </div>
              </div>
            </div>

            {/* 4 Stat Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-tabular">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
                <div className="text-xs text-slate-400 font-sans">Partite</div>
                <div className="text-xl font-bold text-white mt-0.5">
                  {currentPlayer.stats.matches_played}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
                <div className="text-xs text-slate-400 font-sans">Vittorie</div>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">
                  {currentPlayer.stats.matches_won}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
                <div className="text-xs text-slate-400 font-sans">Scommesse</div>
                <div className="text-xl font-bold text-amber-300 mt-0.5">
                  {currentPlayer.stats.bets_won}/{currentPlayer.stats.bets_total}
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
                <div className="text-xs text-slate-400 font-sans">Votazioni</div>
                <div className="text-xl font-bold text-sky-400 mt-0.5">
                  {currentPlayer.stats.votes_completed_matches}
                </div>
              </div>
            </div>

            {/* Token Rules */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-200">Regole Token:</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div>• +{config.initial_tokens} Token di Benvenuto</div>
                <div>• +{config.attendance_reward_tokens} Token per presenza e voto</div>
                <div>• Zero Bailout: guadagna token giocando</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
