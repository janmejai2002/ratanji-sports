import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, type UserSession } from './components/Navbar';
import { DemoBanner } from './components/DemoBanner';
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
  const [currentUser, setCurrentUser] = useState<UserSession>(() => getOrCreateAnonymousUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginInitialTab, setLoginInitialTab] = useState<'referee' | 'committee'>('committee');
  const [isDemoBarOpen, setIsDemoBarOpen] = useState<boolean>(false);

  const [sunlightMode, setSunlightMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const [matches, setMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);

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

  // Handle one-click demo simulation event
  const handleSimulateEvent = useCallback(async () => {
    try {
      const res = await api.post('/api/demo/simulate', {}, currentUser.role, currentUser.id);
      loadData();
      if (res?.event?.event_type === 'GOAL') {
        sounds.playGoalHorn();
        sounds.playCheer();
      } else if (res?.event?.event_type === 'RED_CARD' || res?.event?.event_type === 'YELLOW_CARD') {
        sounds.playWhistle();
      } else {
        sounds.playClick(800);
      }
    } catch (e) {
      console.error('Simulation error:', e);
    }
  }, [loadData, currentUser]);

  // Periodic simulation loop when toggle is active
  useEffect(() => {
    if (!isSimulating) return;
    handleSimulateEvent();
    const interval = setInterval(() => {
      handleSimulateEvent();
    }, 6000);
    return () => clearInterval(interval);
  }, [isSimulating, handleSimulateEvent]);

  // Handle demo state reset to pristine tournament seed
  const handleResetDemo = useCallback(async () => {
    try {
      setIsSimulating(false);
      await api.post('/api/demo/reset', {}, currentUser.role, currentUser.id);
      sounds.playWhistle();
      loadData();
    } catch (e) {
      console.error('Reset demo error:', e);
    }
  }, [loadData, currentUser]);

  // Handle privileged login completion
  const handleLoginSuccess = (user: AuthenticatedUser) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
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
    setActiveTab('matchCenter');
    sounds.playWhistle();
  };

  // Safe tab selection with authentication guard
  const handleSelectTab = (tab: 'matchCenter' | 'contingent' | 'referee' | 'admin') => {
    if ((tab === 'referee' || tab === 'admin') && !isAuthenticated) {
      sounds.playClick();
      setIsLoginModalOpen(true);
      return;
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
          ? 'bg-slate-100 text-slate-950'
          : 'bg-slate-950 text-slate-100 stadium-glow'
      }`}
    >
      {/* Sports Committee Guided Demo Controls (Toggleable) */}
      <DemoBanner
        isOpen={isDemoBarOpen}
        onClose={() => setIsDemoBarOpen(false)}
        currentUser={currentUser}
        onSwitchSession={(switched) => {
          setCurrentUser(switched);
          setIsAuthenticated(switched.role !== 'spectator');
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSimulateEvent={handleSimulateEvent}
        isSimulating={isSimulating}
        setIsSimulating={setIsSimulating}
        onResetDemo={handleResetDemo}
        sunlightMode={sunlightMode}
        localIp="10.1.57.20"
      />

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
        onToggleDemoBar={() => setIsDemoBarOpen((prev) => !prev)}
        isDemoBarOpen={isDemoBarOpen}
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

        {activeTab === 'referee' && isAuthenticated && (
          <RefereePad
            sunlightMode={sunlightMode}
            onRefresh={loadData}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'admin' && isAuthenticated && (
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
            ? 'bg-white border-slate-300 text-slate-600'
            : 'border-slate-800/80 bg-slate-950 text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            RATANJEE 2026 &bull; Digital Sports Management System &bull; XLRI Delhi Sports Committee
          </span>
          <span className="font-mono text-[11px] text-amber-500 font-bold">
            High-Contrast Sunlight &amp; Dark Stadium Mode Active
          </span>
        </div>
      </footer>
    </div>
  );
}
