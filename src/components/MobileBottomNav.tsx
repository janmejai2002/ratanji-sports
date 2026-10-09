import React from 'react';
import {
  Activity,
  Users,
  Clock,
  Shield,
  Trophy,
  Flame,
  Radio,
  Lock
} from 'lucide-react';
import { sounds } from '../utils/audio';
import { mobileHaptics } from '../utils/haptics';

interface MobileBottomNavProps {
  activeTab: 'matchCenter' | 'contingent' | 'referee' | 'admin';
  setActiveTab: (tab: 'matchCenter' | 'contingent' | 'referee' | 'admin') => void;
  currentUser: {
    id: string;
    name: string;
    role: 'spectator' | 'referee' | 'admin';
    badge?: string;
  };
  onOpenLogin: (initialTab?: 'referee' | 'committee') => void;
  sunlightMode: boolean;
  liveMatchesCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenLogin,
  sunlightMode,
  liveMatchesCount = 0,
}) => {
  const isReferee = currentUser.role === 'referee' || currentUser.role === 'admin';
  const isAdmin = currentUser.role === 'admin';

  const handleTabClick = (tab: 'matchCenter' | 'contingent' | 'referee' | 'admin') => {
    sounds.playClick(1000);
    mobileHaptics.tap();

    if (tab === 'referee' && !isReferee) {
      onOpenLogin('referee');
      return;
    }

    if (tab === 'admin' && !isAdmin) {
      onOpenLogin('committee');
      return;
    }

    setActiveTab(tab);
  };

  return (
    <nav
      className={`fixed bottom-0 inset-x-0 z-40 md:hidden border-t transition-colors pb-safe ${
        sunlightMode
          ? 'bg-white/95 border-slate-200 text-slate-900 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur-md'
          : 'bg-slate-950/95 border-slate-800 text-slate-100 backdrop-blur-md'
      }`}
      aria-label="Mobile Bottom Navigation"
    >
      <div className="grid grid-cols-4 items-center h-16 max-w-lg mx-auto px-2">
        {/* 1. Match Center Tab */}
        <button
          onClick={() => handleTabClick('matchCenter')}
          className={`relative flex flex-col items-center justify-center h-full rounded-xl transition-all active:scale-95 touch-manipulation ${
            activeTab === 'matchCenter'
              ? sunlightMode
                ? 'text-[#013B83] font-bold'
                : 'text-amber-400 font-bold'
              : sunlightMode
              ? 'text-slate-500 hover:text-slate-800'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Activity className="w-5 h-5" />
            {liveMatchesCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-red-600 text-[9px] font-black font-mono text-white animate-pulse">
                {liveMatchesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Matches</span>
          {activeTab === 'matchCenter' && (
            <span className={`w-6 h-1 rounded-full mt-0.5 ${sunlightMode ? 'bg-[#013B83]' : 'bg-amber-400'}`} />
          )}
        </button>

        {/* 2. Contingents Tab */}
        <button
          onClick={() => handleTabClick('contingent')}
          className={`relative flex flex-col items-center justify-center h-full rounded-xl transition-all active:scale-95 touch-manipulation ${
            activeTab === 'contingent'
              ? sunlightMode
                ? 'text-[#013B83] font-bold'
                : 'text-amber-400 font-bold'
              : sunlightMode
              ? 'text-slate-500 hover:text-slate-800'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">Contingents</span>
          {activeTab === 'contingent' && (
            <span className={`w-6 h-1 rounded-full mt-0.5 ${sunlightMode ? 'bg-[#013B83]' : 'bg-amber-400'}`} />
          )}
        </button>

        {/* 3. Referee Pad Tab */}
        <button
          onClick={() => handleTabClick('referee')}
          className={`relative flex flex-col items-center justify-center h-full rounded-xl transition-all active:scale-95 touch-manipulation ${
            activeTab === 'referee'
              ? sunlightMode
                ? 'text-emerald-700 font-bold'
                : 'text-emerald-400 font-bold'
              : sunlightMode
              ? 'text-slate-500 hover:text-slate-800'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Clock className="w-5 h-5" />
            {!isReferee && (
              <Lock className="w-2.5 h-2.5 absolute -top-1 -right-1 text-slate-400" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">
            {isReferee ? 'Referee Pad' : 'Ref Access'}
          </span>
          {activeTab === 'referee' && (
            <span className={`w-6 h-1 rounded-full mt-0.5 ${sunlightMode ? 'bg-emerald-700' : 'bg-emerald-400'}`} />
          )}
        </button>

        {/* 4. Committee Admin Tab */}
        <button
          onClick={() => handleTabClick('admin')}
          className={`relative flex flex-col items-center justify-center h-full rounded-xl transition-all active:scale-95 touch-manipulation ${
            activeTab === 'admin'
              ? sunlightMode
                ? 'text-[#013B83] font-bold'
                : 'text-blue-400 font-bold'
              : sunlightMode
              ? 'text-slate-500 hover:text-slate-800'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Shield className="w-5 h-5" />
            {!isAdmin && (
              <Lock className="w-2.5 h-2.5 absolute -top-1 -right-1 text-slate-400" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">
            {isAdmin ? 'Committee' : 'Admin'}
          </span>
          {activeTab === 'admin' && (
            <span className={`w-6 h-1 rounded-full mt-0.5 ${sunlightMode ? 'bg-[#013B83]' : 'bg-blue-400'}`} />
          )}
        </button>
      </div>
    </nav>
  );
};
