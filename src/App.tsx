/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { MatchHomeView } from './components/MatchHomeView';
import { FutGalleryView } from './components/FutGalleryView';
import { LeaderboardsView } from './components/LeaderboardsView';
import { ProfileWalletView } from './components/ProfileWalletView';
import { AdminBackofficeView, AdminTab } from './components/AdminBackofficeView';
import { LoginModal } from './components/LoginModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setClientDatabaseEnvironment } from './db/testDatabase';
import {
  ArrowLeft,
  Calculator,
  Database,
  LayoutGrid,
  LogIn,
  LogOut,
  Settings,
  Shield,
  Trophy,
  User,
  UserCheck,
  Users,
  Volleyball,
  X,
} from 'lucide-react';

type MainSection = 'MATCH' | 'GALLERY' | 'LEADERBOARDS' | 'PROFILE' | 'ADMIN';

const MainShell: React.FC = () => {
  const {
    currentUser,
    isLoggedIn,
    isDirettore,
    players,
    users,
    dbEnvironment,
    logoutUser,
    toastMessage,
    clearToast,
  } = useApp();

  const [activeSection, setActiveSection] = useState<MainSection>('MATCH');
  const [adminTab, setAdminTab] = useState<AdminTab>('MATCH_ENGINE');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  const pendingUsersCount = useMemo(
    () => users.filter((u) => u.auth_status === 'PENDING_APPROVAL').length,
    [users]
  );

  const navItems: Array<{
    id: MainSection;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'MATCH',
      label: 'Match & Scommesse',
      shortLabel: 'Match',
      icon: <Volleyball className="w-5 h-5" />,
    },
    {
      id: 'GALLERY',
      label: 'Carte FUT',
      shortLabel: 'Carte FUT',
      icon: <LayoutGrid className="w-5 h-5" />,
    },
    {
      id: 'LEADERBOARDS',
      label: 'Classifiche',
      shortLabel: 'Classifiche',
      icon: <Trophy className="w-5 h-5" />,
    },
    ...(isLoggedIn
      ? [
          {
            id: 'PROFILE' as MainSection,
            label: 'Profilo',
            shortLabel: 'Profilo',
            icon: <User className="w-5 h-5" />,
          },
        ]
      : []),
    ...(isDirettore
      ? [
          {
            id: 'ADMIN' as MainSection,
            label: 'Direttore',
            shortLabel: 'Direttore',
            icon: <Shield className="w-5 h-5" />,
          },
        ]
      : []),
  ];

  const adminNavItems: Array<{
    id: AdminTab;
    label: string;
    count?: number;
    highlightCount?: boolean;
    icon: React.ReactNode;
  }> = [
    {
      id: 'MATCH_ENGINE',
      label: 'Partita',
      icon: <Calculator className="w-4 h-4" />,
    },
    {
      id: 'PLAYERS_ROSTER',
      label: 'Rosa',
      count: players.length,
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'USER_CLAIMS',
      label: 'Utenti',
      count: pendingUsersCount,
      highlightCount: pendingUsersCount > 0,
      icon: <UserCheck className="w-4 h-4" />,
    },
    {
      id: 'GLOBAL_SETTINGS',
      label: 'Regole',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col pb-20 md:pb-10">
      {/* Top Bar: Contextual Replacement when in Backoffice (ADMIN) */}
      {activeSection === 'ADMIN' ? (
        <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-emerald-500/30 px-4 sm:px-6 h-14 flex items-center justify-between gap-4 shadow-lg shadow-slate-950/50">
          {/* Zone 1: Back to App + Mode Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('MATCH')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-200 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Torna all&apos;App</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-display font-bold text-emerald-400 uppercase tracking-wider">
              <span className="text-slate-700">·</span>
              <Shield className="w-3.5 h-3.5" />
              <span>Direttore</span>
            </div>
          </div>

          {/* Zone 2: 4 Direct Backoffice Sections (Partita, Rosa, Utenti, Regole) */}
          <nav
            aria-label="Menu Direttore"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {adminNavItems.map((item) => {
              const active = adminTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAdminTab(item.id)}
                  className={`h-14 px-1 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    active
                      ? 'text-emerald-400 border-emerald-400 font-bold'
                      : 'text-slate-400 border-transparent hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.count !== undefined && (
                    <span
                      className={`font-mono-tabular text-xs px-1.5 py-0.5 rounded-md font-bold ${
                        item.highlightCount
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : active
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Compact DB Environment Switch & Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setClientDatabaseEnvironment(
                  dbEnvironment === 'PRODUCTION_DB' ? 'test' : 'production'
                );
                window.location.reload();
              }}
              title={
                dbEnvironment === 'PRODUCTION_DB'
                  ? 'Attivo: Cloud Firestore (Clicca per passare a Sandbox Test)'
                  : 'Attivo: Sandbox Test (Clicca per passare a Cloud Firestore)'
              }
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                dbEnvironment === 'PRODUCTION_DB'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>
                {dbEnvironment === 'PRODUCTION_DB' ? 'Firestore Cloud' : 'Sandbox Locale'}
              </span>
            </button>
            <button
              type="button"
              onClick={logoutUser}
              title="Disconnetti"
              aria-label="Disconnetti"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
          {/* Zone 1: Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('MATCH');
            }}
            className="text-lg sm:text-xl font-display font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Ce La Giochiamo!
          </a>

          {/* Zone 2: Navigation Links */}
          <nav
            aria-label="Navigazione principale"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
          >
            {navItems.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 flex items-center gap-1.5 ${
                    active
                      ? 'text-emerald-400 border-emerald-400 font-semibold'
                      : item.id === 'ADMIN'
                      ? 'text-emerald-300/90 border-transparent hover:text-emerald-300 font-semibold'
                      : 'text-slate-400 border-transparent hover:text-white'
                  }`}
                >
                  {item.id === 'ADMIN' && <Shield className="w-3.5 h-3.5" />}
                  <span>{item.label}</span>
                  {item.id === 'ADMIN' && pendingUsersCount > 0 && (
                    <span className="font-mono-tabular text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                      {pendingUsersCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Login or User Chip */}
          <div className="flex items-center shrink-0">
            {!isLoggedIn ? (
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Accedi
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('PROFILE')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="font-semibold max-w-[120px] truncate">
                    {currentUser?.display_name || 'Profilo'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={logoutUser}
                  title="Disconnetti"
                  aria-label="Disconnetti"
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
          <div
            role="status"
            className="bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 rounded-2xl px-4 py-3 text-xs font-medium flex items-center justify-between gap-3 shadow-lg"
          >
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={clearToast}
              aria-label="Chiudi notifica"
              className="text-emerald-300 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1">
        {activeSection === 'MATCH' && (
          <MatchHomeView
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}
        {activeSection === 'GALLERY' && <FutGalleryView />}
        {activeSection === 'LEADERBOARDS' && <LeaderboardsView />}
        {activeSection === 'PROFILE' && (
          <ProfileWalletView
            onOpenBackoffice={() => setActiveSection('ADMIN')}
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}
        {activeSection === 'ADMIN' && (
          <AdminBackofficeView
            activeTab={adminTab}
            onTabChange={setAdminTab}
            onBack={() => setActiveSection('MATCH')}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (Contextual when in Backoffice) */}
      {activeSection === 'ADMIN' ? (
        <nav
          aria-label="Navigazione mobile Direttore"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-emerald-500/30 h-16 px-2 grid grid-cols-4 items-center"
        >
          {adminNavItems.map((item) => {
            const active = adminTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAdminTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center transition-colors cursor-pointer relative ${
                  active ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  {item.icon}
                  {item.count !== undefined && (
                    <span
                      className={`font-mono-tabular text-[10px] px-1 rounded font-bold ${
                        item.highlightCount
                          ? 'bg-amber-500/20 text-amber-300'
                          : active
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap truncate">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      ) : (
        <nav
          aria-label="Navigazione mobile"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 h-16 px-2 grid items-center"
          style={{
            gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
          }}
        >
          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  active ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap truncate">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
