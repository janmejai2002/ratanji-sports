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
  UserCheck
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
  onToggleDemoBar: () => void;
  isDemoBarOpen: boolean;
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
  onToggleDemoBar,
  isDemoBarOpen,
}) => {
  return (
    <header
      className={`border-b sticky top-0 z-50 transition-colors ${
        sunlightMode
          ? 'bg-white border-slate-900 text-slate-950 shadow-md'
          : 'bg-slate-950/95 border-slate-800 text-slate-100 backdrop-blur'
      }`}
    >
      {/* Mario Kart / Grand Prix Racing Checkered Micro-Ribbon */}
      <div className="h-1 w-full racing-checkers-gold opacity-80" />

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border flex items-center justify-center shadow-nb-sm transform -skew-x-6 ${
                sunlightMode
                  ? 'bg-amber-400 border-slate-950 text-slate-950 font-black'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}
            >
              <Trophy className="w-5 h-5 transform skew-x-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black italic tracking-tighter text-xl uppercase flex items-center gap-1.5">
                  RATANJEE <span className={sunlightMode ? 'text-amber-600' : 'text-amber-400'}>'26</span>
                </span>
                <span
                  className={`text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded border transform -skew-x-6 ${
                    sunlightMode
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  <span className="inline-block skew-x-6">XLRI DELHI</span>
                </span>
              </div>
              <p className={`text-[10px] font-bold tracking-tight uppercase ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                Arcade Grand Prix &bull; Live Scoring Engine
              </p>
            </div>
          </div>

          {/* Mobile Connection Pill & Quick Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-1 rounded-full border border-slate-800 bg-slate-900">
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
            sunlightMode ? 'bg-slate-100 border-slate-300' : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          {/* 1. Match Center (Public Base View) */}
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('matchCenter');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              activeTab === 'matchCenter'
                ? sunlightMode
                  ? 'bg-slate-950 text-white shadow'
                  : 'bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/20'
                : sunlightMode
                ? 'text-slate-700 hover:text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Match Center
          </button>

          {/* 2. Contingents Directory (Public Base View) */}
          <button
            onClick={() => {
              sounds.playClick();
              setActiveTab('contingent');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
              activeTab === 'contingent'
                ? sunlightMode
                  ? 'bg-slate-950 text-white shadow'
                  : 'bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/20'
                : sunlightMode
                ? 'text-slate-700 hover:text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Contingents
          </button>

          {/* 3. Referee Scoring Pad (Only for Referee or Admin) */}
          {(currentUser.role === 'referee' || currentUser.role === 'admin') && (
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('referee');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                activeTab === 'referee'
                  ? sunlightMode
                    ? 'bg-slate-950 text-white shadow'
                    : 'bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/20'
                  : sunlightMode
                  ? 'text-slate-700 hover:text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                activeTab === 'admin'
                  ? sunlightMode
                    ? 'bg-slate-950 text-white shadow'
                    : 'bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/20'
                  : sunlightMode
                  ? 'text-slate-700 hover:text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
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

          {/* Committee Demo Tools Toggle */}
          <button
            onClick={() => {
              sounds.playClick();
              onToggleDemoBar();
            }}
            title="Toggle Sports Committee Presentation Tools (Live Simulator, DB Reset, Wi-Fi Link)"
            className={`p-1.5 px-2 rounded-lg border font-bold flex items-center gap-1 text-xs transition-transform active:scale-90 ${
              isDemoBarOpen
                ? 'bg-amber-500 text-black border-amber-600 shadow'
                : sunlightMode
                ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                : 'bg-slate-900 text-amber-300 border-slate-800 hover:border-amber-400/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Demo Mode</span>
          </button>

          {/* Sunlight Mode Toggle */}
          <button
            onClick={() => {
              sounds.playClick();
              setSunlightMode((prev) => !prev);
            }}
            title={sunlightMode ? 'Switch to Dark Stadium Mode' : 'Switch to High-Contrast Sunlight Mode (Outdoor)'}
            className={`p-2 rounded-lg border font-bold flex items-center gap-1 text-xs transition-transform active:scale-90 ${
              sunlightMode
                ? 'bg-amber-400 text-slate-950 border-slate-950 shadow'
                : 'bg-slate-900 text-amber-300 border-slate-800 hover:border-amber-400/50'
            }`}
          >
            {sunlightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            <span className="hidden sm:inline text-[11px]">
              {sunlightMode ? 'Stadium' : 'Sun'}
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
            title={soundEnabled ? 'Mute Stadium Audio' : 'Unmute Stadium Audio'}
            className={`p-2 rounded-lg border transition-transform active:scale-90 ${
              sunlightMode
                ? 'bg-slate-100 border-slate-300 text-slate-900'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
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
