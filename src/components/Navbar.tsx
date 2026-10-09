import React from 'react';
import {
  Trophy,
  Activity,
  Users,
  Clock,
  Shield,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Radio,
  LogIn,
  LogOut,
  Sparkles,
  UserCheck,
  FileText
} from 'lucide-react';
import { sounds } from '../utils/audio';

export interface UserSession {
  id: string;
  name: string;
  role: 'spectator' | 'referee' | 'admin';
  badge?: string;
  email?: string;
}

interface NavbarProps {
  activeTab: 'matchCenter' | 'contingent' | 'referee' | 'admin';
  setActiveTab: (tab: 'matchCenter' | 'contingent' | 'referee' | 'admin') => void;
  currentUser: UserSession;
  isAuthenticated: boolean;
  onOpenLogin: (initialTab?: 'referee' | 'committee') => void;
  onLogout: () => void;
  sunlightMode: boolean;
  setSunlightMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean | ((prev: boolean) => boolean)) => void;
  isLiveConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  isAuthenticated,
  onOpenLogin,
  onLogout,
  sunlightMode,
  setSunlightMode,
  soundEnabled,
  setSoundEnabled,
  isLiveConnected,
}) => {
  return (
    <header
      className={`border-b sticky top-0 z-50 transition-colors ${
        sunlightMode
          ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
          : 'bg-slate-950/95 border-slate-800 text-slate-100 backdrop-blur'
      }`}
    >
      {/* Sleek hairline executive gradient line */}
      <div className={`h-0.5 w-full ${sunlightMode ? 'bg-gradient-to-r from-[#013B83] via-amber-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 via-amber-400 to-emerald-500'} opacity-80`} />

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div
              className={`p-1.5 rounded-xl border flex items-center justify-center transition-all ${
                sunlightMode
                  ? 'bg-white border-slate-200 shadow-sm'
                  : 'bg-white/[0.04] border-white/10'
              }`}
            >
              <img
                src="/xlri-shield-logo.png"
                alt="XLRI Delhi Logo"
                className="w-7 h-7 object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`font-sans font-black tracking-tight text-xl uppercase flex items-center gap-1.5 ${
                    sunlightMode ? 'text-[#013B83]' : 'text-white'
                  }`}
                >
                  RATANJEE
                </span>
                <span
                  className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
                    sunlightMode
                      ? 'bg-[#013B83]/10 text-[#013B83] border-[#013B83]/20 font-mono'
                      : 'bg-white/5 text-slate-300 border-white/10 font-mono'
                  }`}
                >
                  XLRI DELHI
                </span>
              </div>
              <p className={`text-[10px] font-medium tracking-tight uppercase ${sunlightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Official Tournament Portal &bull; Sports Committee
              </p>
            </div>
          </div>

          {/* Mobile Connection Pill & Quick Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-1 rounded-full border ${
              sunlightMode
                ? 'border-slate-200 bg-slate-100 text-slate-700'
                : 'border-slate-800 bg-slate-900 text-slate-300'
            }`}>
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {isLiveConnected ? 'LIVE' : 'SYNC'}
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Hidden on Mobile, handled by MobileBottomNav) */}
        <nav
          className={`hidden md:flex items-center p-1 rounded-xl border gap-1 w-full md:w-auto overflow-x-auto ${
            sunlightMode ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/70 border-white/[0.08] backdrop-blur-md'
          }`}
        >
          {/* 1. Match Center (Public Base View) */}
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('matchCenter');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              activeTab === 'matchCenter'
                ? sunlightMode
                  ? 'bg-[#013B83] text-white font-bold shadow-sm'
                  : 'bg-white text-slate-950 font-bold shadow-sm'
                : sunlightMode
                ? 'text-slate-600 hover:text-[#013B83] hover:bg-white/60'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${sunlightMode && activeTab === 'matchCenter' ? 'text-amber-300' : 'text-amber-500'}`} />
            Match Center
          </button>

          {/* 2. Contingents Directory (Public Base View) */}
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('contingent');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              activeTab === 'contingent'
                ? sunlightMode
                  ? 'bg-[#013B83] text-white font-bold shadow-sm'
                  : 'bg-white text-slate-950 font-bold shadow-sm'
                : sunlightMode
                ? 'text-slate-600 hover:text-[#013B83] hover:bg-white/60'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className={`w-3.5 h-3.5 ${sunlightMode && activeTab === 'contingent' ? 'text-blue-200' : 'text-blue-400'}`} />
            Contingents
          </button>

          {/* 3. Referee Scoring Pad (Only for Referee or Admin) */}
          {(currentUser.role === 'referee' || currentUser.role === 'admin') && (
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('referee');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                activeTab === 'referee'
                  ? sunlightMode
                    ? 'bg-[#013B83] text-white font-bold shadow-sm'
                    : 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : sunlightMode
                  ? 'text-slate-600 hover:text-[#013B83] hover:bg-white/60'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 ${sunlightMode && activeTab === 'referee' ? 'text-emerald-300' : 'text-emerald-400'}`} />
              Referee Console
            </button>
          )}

          {/* 4. Committee Admin Portal (Only for Admin) */}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('admin');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                activeTab === 'admin'
                  ? sunlightMode
                    ? 'bg-[#013B83] text-white font-bold shadow-sm'
                    : 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : sunlightMode
                  ? 'text-slate-600 hover:text-[#013B83] hover:bg-white/60'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Shield className={`w-3.5 h-3.5 ${sunlightMode && activeTab === 'admin' ? 'text-amber-300' : 'text-amber-400'}`} />
              Admin Portal
            </button>
          )}
        </nav>

        {/* Global Toolbar: User Status + Login/Logout + Sunlight + Audio + Demo Drawer */}
        <div className="flex items-center gap-2">
          {/* User Status / Authentication Pill */}
          {!isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div
                className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${
                  sunlightMode
                    ? 'bg-slate-100 border-slate-300 text-slate-700'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}
                title="You are browsing as an anonymous student spectator"
              >
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="font-mono text-[11px] font-bold">{currentUser.name}</span>
              </div>

              {/* Referee Fast Login Button */}
              <button
                onClick={() => {
                  sounds.playClick();
                  onOpenLogin('referee');
                }}
                className={`px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border active:scale-95 transition ${
                  sunlightMode
                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-600 text-emerald-950 font-black'
                    : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-500/40 text-emerald-300'
                }`}
                title="Enter referee scoring pad using your Referee ID pass"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Referee Access
              </button>

              {/* Committee Login Button */}
              <button
                onClick={() => {
                  sounds.playClick();
                  onOpenLogin('committee');
                }}
                className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow active:scale-95 transition ${
                  sunlightMode
                    ? 'bg-amber-500 hover:bg-amber-600 text-black border border-amber-600'
                    : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                }`}
                title="Sign in as Sports Committee Admin"
              >
                <Shield className="w-3.5 h-3.5" />
                Committee
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs shadow-sm ${
                  currentUser.role === 'admin'
                    ? sunlightMode
                      ? 'bg-amber-100 border-amber-400 text-amber-950'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : sunlightMode
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {currentUser.role === 'admin' ? (
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="font-extrabold max-w-[130px] truncate">{currentUser.name}</span>
                <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 text-white">
                  {currentUser.role}
                </span>
              </div>

              <button
                onClick={() => {
                  sounds.playClick();
                  onLogout();
                }}
                title="Sign out back to anonymous spectator"
                className="p-1.5 px-2.5 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-bold transition flex items-center gap-1 active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}

          {/* Guide HTML Manual Link */}
          <a
            href="/docs/sports-committee-guide.html"
            target="_blank"
            rel="noopener noreferrer"
            title="Read Sports Committee Operational Guide (HTML Manual)"
            className={`p-2 rounded-xl border font-bold flex items-center gap-1.5 text-xs transition-all active:scale-95 ${
              sunlightMode
                ? 'bg-slate-100 text-[#013B83] border-slate-300 hover:bg-slate-200 shadow-sm'
                : 'bg-slate-900 text-slate-300 border-white/10 hover:border-white/20 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-500" />
            <span className="hidden lg:inline text-[11px] font-semibold">Guide</span>
          </a>

          {/* Theme Mode Toggle */}
          <button
            onClick={() => {
              sounds.playClick();
              setSunlightMode((prev) => !prev);
            }}
            title={sunlightMode ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
            className={`p-2 rounded-xl border font-bold flex items-center gap-1.5 text-xs transition-all active:scale-95 ${
              sunlightMode
                ? 'bg-slate-100 text-[#013B83] border-slate-300 hover:bg-slate-200 shadow-sm'
                : 'bg-slate-900 text-amber-300 border-white/10 hover:border-white/20'
            }`}
          >
            {sunlightMode ? <Moon className="w-4 h-4 text-[#013B83]" /> : <Sun className="w-4 h-4 text-amber-400" />}
            <span className="hidden sm:inline text-[11px] font-semibold">
              {sunlightMode ? 'Dark' : 'Light'}
            </span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              setSoundEnabled((prev) => {
                const next = !prev;
                sounds.enabled = next;
                if (next) sounds.playClick();
                return next;
              });
            }}
            title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
            className={`p-2 rounded-xl border transition-all active:scale-95 ${
              sunlightMode
                ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Desktop Live Pulse */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${
              isLiveConnected
                ? sunlightMode
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                  : 'bg-emerald-950/60 border-emerald-600/40 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
            {isLiveConnected ? 'LIVE' : 'SYNC'}
          </div>
        </div>
      </div>
    </header>
  );
};
