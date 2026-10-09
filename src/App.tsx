import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, type UserSession } from './components/Navbar';
import { LoginModal, type AuthenticatedUser } from './components/LoginModal';
import { MatchCenter } from './components/MatchCenter';
import { ContingentTab } from './components/ContingentTab';
import { RefereePad } from './components/RefereePad';
import { AdminPortal } from './components/AdminPortal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { api, subscribeToLiveEvents } from './utils/api';
import { sounds } from './utils/audio';
import { getOrCreateAnonymousUser } from './utils/anonymous';

export default function App() {
  const [activeTab, setActiveTab] = useState<'matchCenter' | 'contingent' | 'referee' | 'admin'>('matchCenter');
  const [currentUser, setCurrentUser] = useState<UserSession>(() => {
    try {
      const saved = localStorage.getItem('ratanjee_auth_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u && (u.role === 'admin' || u.role === 'referee')) {
          return u;
        }
      }
    } catch {}
    return getOrCreateAnonymousUser();
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ratanjee_auth_user');
      if (saved) {
        const u = JSON.parse(saved);
        return Boolean(u && (u.role === 'admin' || u.role === 'referee'));
      }
    } catch {}
    return false;
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginInitialTab, setLoginInitialTab] = useState<'referee' | 'committee'>('committee');

  const [sunlightMode, setSunlightMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);

  const [matches, setMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);

  // Check URL query parameters for direct login triggers (e.g. from 403 access restricted page)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const loginParam = params.get('login');
      if (loginParam === 'committee') {
        setLoginInitialTab('committee');
        setIsLoginModalOpen(true);
      } else if (loginParam === 'referee') {
        setLoginInitialTab('referee');
        setIsLoginModalOpen(true);
      }
    } catch {}
  }, []);

  // Load matches and standings with current RBAC context
  const loadData = useCallback(() => {
    api.get<any[]>('/api/matches', currentUser.role, currentUser.id)
      .then((data) => {
        if (Array.isArray(data)) setMatches(data);
      })
      .catch(() => {});

    api.get<any>('/api/standings', currentUser.role, currentUser.id)
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.standings || [];
        setStandings(list);
      })
      .catch(() => {});
  }, [currentUser]);

  // Handle privileged login completion
  const handleLoginSuccess = (user: AuthenticatedUser) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('ratanjee_auth_user', JSON.stringify(user));
      document.cookie = `ratanji_role=${user.role}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `ratanji_user=${user.id}; path=/; max-age=86400; SameSite=Lax`;
    } catch {}
    if (user.role === 'admin') {
      setActiveTab('admin');
    } else if (user.role === 'referee') {
      setActiveTab('referee');
    } else {
      setActiveTab('matchCenter');
    }
  };

  // Handle sign out back to anonymous spectator
  const handleLogout = () => {
    const anon = getOrCreateAnonymousUser();
    setCurrentUser(anon);
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('ratanjee_auth_user');
      document.cookie = 'ratanji_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'ratanji_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    } catch {}
    setActiveTab('matchCenter');
    sounds.playWhistle();
  };

  // Safe tab selection with authentication and role guard
  const handleSelectTab = (tab: 'matchCenter' | 'contingent' | 'referee' | 'admin') => {
    if (tab === 'referee') {
      if (!isAuthenticated || (currentUser.role !== 'referee' && currentUser.role !== 'admin')) {
        sounds.playClick();
        setLoginInitialTab('referee');
        setIsLoginModalOpen(true);
        return;
      }
    }
    if (tab === 'admin') {
      if (!isAuthenticated || currentUser.role !== 'admin') {
        sounds.playClick();
        setLoginInitialTab('committee');
        setIsLoginModalOpen(true);
        return;
      }
    }
    setActiveTab(tab);
  };

  // Real-time synchronization bus listener
  useEffect(() => {
    loadData();

    const unsubscribe = subscribeToLiveEvents((event) => {
      setIsLiveConnected(true);
      if (
        event.type === 'MATCH_EVENT' ||
        event.type === 'match:event' ||
        event.type === 'STANDINGS_UPDATE' ||
        event.type === 'standings:update' ||
        event.type === 'MATCH_STATUS_CHANGE' ||
        event.type === 'match:status' ||
        event.type === 'DEMO_RESET'
      ) {
        loadData();
        sounds.playClick(600);
      }
    });

    return () => unsubscribe();
  }, [loadData]);

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        sunlightMode
          ? 'bg-slate-50 text-slate-900'
          : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Top Navigation Bar with Base Screen Header & Login Action */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        onOpenLogin={(tab) => {
          setLoginInitialTab(tab || 'committee');
          setIsLoginModalOpen(true);
        }}
        onLogout={handleLogout}
        sunlightMode={sunlightMode}
        setSunlightMode={setSunlightMode}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        isLiveConnected={isLiveConnected}
      />

      {/* Main Base Container with Mobile Bottom Nav Clearance */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 pb-28 md:pb-8 flex flex-col gap-6">
        {activeTab === 'matchCenter' && (
          <MatchCenter
            sunlightMode={sunlightMode}
            matches={matches}
            standings={standings}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'contingent' && (
          <ContingentTab
            sunlightMode={sunlightMode}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'referee' && isAuthenticated && (currentUser.role === 'referee' || currentUser.role === 'admin') && (
          <RefereePad
            sunlightMode={sunlightMode}
            onRefresh={loadData}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'admin' && isAuthenticated && currentUser.role === 'admin' && (
          <AdminPortal
            sunlightMode={sunlightMode}
            matches={matches}
            standings={standings}
            onRefresh={loadData}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (1-Thumb Reachability) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        currentUser={currentUser}
        onOpenLogin={(tab) => {
          setLoginInitialTab(tab || 'committee');
          setIsLoginModalOpen(true);
        }}
        sunlightMode={sunlightMode}
        liveMatchesCount={
          matches.filter(
            (m) =>
              m.status === 'Live' ||
              m.status === 'LIVE' ||
              m.status === 'In_Progress' ||
              m.status === 'IN_PROGRESS'
          ).length
        }
      />

      {/* Committee & Official Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        sunlightMode={sunlightMode}
        onLoginSuccess={handleLoginSuccess}
        initialTab={loginInitialTab}
      />

      {/* Footer (with mobile clearance) */}
      <footer
        className={`border-t px-6 py-4 pb-20 md:pb-4 text-center text-xs transition-colors ${
          sunlightMode
            ? 'bg-white border-slate-200 text-slate-600'
            : 'border-slate-800/80 bg-slate-950 text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md overflow-hidden shrink-0 border border-white/10 shadow-sm bg-[#013B83]">
              <img src="/xlri-shield-square.png" alt="XLRI Crest" className="w-full h-full object-cover" />
            </div>
            <span className="font-semibold text-slate-400">
              RATANJEE &bull; XLRI Delhi Sports Committee
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Official Inter-Batch Sports Management &amp; Scoring System
          </span>
        </div>
      </footer>
    </div>
  );
}
