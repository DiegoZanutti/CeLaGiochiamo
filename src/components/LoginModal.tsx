import React from 'react';
import { useApp } from '../context/AppContext';
import { LogIn, Sparkles, User, X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const {
    loginWithGoogle,
    loginWithApple,
    loginAsDemoUser,
    users,
    dbEnvironment,
  } = useApp();

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    await loginWithGoogle();
    onClose();
  };

  const handleAppleLogin = async () => {
    await loginWithApple();
    onClose();
  };

  const handleDemoLogin = (uid: string) => {
    loginAsDemoUser(uid);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi finestra di accesso"
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center pt-2 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-6 h-6" />
          </div>
          <h2 id="login-title" className="text-2xl font-display font-extrabold text-white">
            Accedi a Ce La Giochiamo!
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Entra con il tuo account per visualizzare il tuo profilo, scommettere e votare.
          </p>
        </div>

        <div className="space-y-3">
          {/* Primary Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-semibold text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
              />
            </svg>
            Accedi con Google
          </button>

          {/* Apple Login */}
          <button
            type="button"
            onClick={handleAppleLogin}
            className="w-full py-3 px-4 rounded-xl bg-black hover:bg-neutral-900 border border-slate-700 text-white font-semibold text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-sm"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.7-11.64-13.98-6.19-9.59-11.04-20.44-14.55-32.55-3.51-12.11-5.27-23.75-5.27-34.92 0-14.7 3.7-27.1 11.11-37.2 7.41-10.1 16.74-15.28 28-15.53 4.8 0 10.14 1.28 16.03 3.84 5.88 2.56 9.87 3.89 11.96 3.89 1.7 0 5.89-1.39 12.57-4.16 6.69-2.78 12.37-3.99 17.06-3.63 13.08.77 23.49 5.82 31.23 15.15-11.53 7.02-17.15 16.48-16.85 28.37.3 9.4 3.99 17.29 11.07 23.66 7.07 6.37 15.62 10.04 25.64 11.01-2.23 6.94-4.8 13.78-7.72 20.52zM119.22 31.81c0-7.14 2.65-13.94 7.95-20.4 5.3-6.46 11.83-10.51 19.59-12.16.59 2.12.89 4.29.89 6.51 0 7.03-2.73 13.95-8.19 20.76-5.46 6.81-12.06 10.9-19.8 12.27-.14-2.32-.44-4.65-.44-6.98z" />
            </svg>
            Accedi con Apple
          </button>
        </div>

        {/* Quick Profiles strictly for Test Environment */}
        {dbEnvironment === 'TEST_DB' && users.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Profili dimostrativi di test:</span>
            </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {users.map((u) => {
              const isDir = u.is_admin || u.email.toLowerCase().includes('diego');
              return (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => handleDemoLogin(u.uid)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isDir
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {u.display_name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {isDir ? 'Il Direttore' : u.auth_status}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium shrink-0">
                    Scegli →
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
