import React, { useState } from 'react';
import {
  Sparkles,
  Users,
  Clock,
  Shield,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Copy,
  Check,
  Smartphone,
  X,
  LogIn
} from 'lucide-react';
import { sounds } from '../utils/audio';
import type { UserSession } from './Navbar';

interface DemoBannerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession;
  onSwitchSession: (user: UserSession) => void;
  activeTab: 'matchCenter' | 'contingent' | 'referee' | 'admin';
  setActiveTab: (tab: 'matchCenter' | 'contingent' | 'referee' | 'admin') => void;
  onSimulateEvent: () => void;
  isSimulating: boolean;
  setIsSimulating: (val: boolean | ((prev: boolean) => boolean)) => void;
  onResetDemo: () => void;
  sunlightMode: boolean;
  localIp: string;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSwitchSession,
  activeTab,
  setActiveTab,
  onSimulateEvent,
  isSimulating,
  setIsSimulating,
  onResetDemo,
  sunlightMode,
  localIp,
}) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const mobileUrl = `http://${localIp}:5173`;

  const copyMobileLink = () => {
    sounds.playClick();
    navigator.clipboard.writeText(mobileUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <aside
      aria-label="Sports Committee Presentation Bar"
      className={`border-b transition-colors relative z-40 animate-in slide-in-from-top-2 duration-150 ${
        sunlightMode
          ? 'bg-amber-400 text-slate-950 border-slate-900 shadow-sm'
          : 'bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 text-amber-200 border-amber-500/30'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-2">
        <div className="flex flex-col md:flex-row items-center justify-between gap-2.5">
          {/* Header Title */}
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-amber-500 text-black font-black text-xs flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <div>
                <span className="text-xs font-black tracking-wider uppercase text-black dark:text-white flex items-center gap-2">
                  COMMITTEE DEMO CONTROLS
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-black/80 text-amber-300">
                    EVALUATION
                  </span>
                </span>
                <p className="text-[11px] opacity-80 hidden lg:block">
                  Fast 1-click workflows to demonstrate real-time sync, automated scorecards, and committee audits
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              title="Close Demo Controls"
              className="p-1 rounded hover:bg-black/10 text-current transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Guided Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-start md:justify-end">
            {/* Preset 1: Base Spectator View */}
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('matchCenter');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition active:scale-95 ${
                activeTab === 'matchCenter'
                  ? 'bg-black text-amber-300 shadow'
                  : 'bg-black/20 hover:bg-black/30 text-current'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Match Center
            </button>

            {/* Preset 2: Contingents */}
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('contingent');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition active:scale-95 ${
                activeTab === 'contingent'
                  ? 'bg-black text-amber-300 shadow'
                  : 'bg-black/20 hover:bg-black/30 text-current'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Contingents
            </button>

            {/* Preset 3: Quick Switch to Referee */}
            <button
              onClick={() => {
                sounds.playWhistle();
                onSwitchSession({
                  id: 'usr-ref-1',
                  name: 'Rohan Verma (Official REF-023)',
                  role: 'referee',
                  badge: 'Official Referee',
                });
                setActiveTab('referee');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition active:scale-95 ${
                currentUser.role === 'referee'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-black/20 hover:bg-black/30 text-current'
              }`}
              title="Switch to official Referee scoring pad (Rahul Mehta REF-023)"
            >
              <Clock className="w-3.5 h-3.5" />
              Referee Mode
            </button>

            {/* Preset 4: Quick Switch to Admin */}
            <button
              onClick={() => {
                sounds.playWhistle();
                onSwitchSession({
                  id: 'usr-admin-1',
                  name: 'Sports Committee Admin',
                  role: 'admin',
                  badge: 'Committee Executive',
                });
                setActiveTab('admin');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition active:scale-95 ${
                currentUser.role === 'admin'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-black/20 hover:bg-black/30 text-current'
              }`}
              title="Switch to Sports Committee Admin portal"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin Mode
            </button>

            {/* Live Match Simulator Toggle */}
            <button
              onClick={() => {
                sounds.playClick();
                setIsSimulating((prev) => !prev);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition active:scale-95 ${
                isSimulating
                  ? 'bg-red-600 text-white shadow-lg animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
              }`}
              title="Periodically pushes live match events (goals, cards) with real-time audio"
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isSimulating ? 'Simulating...' : 'Simulate Match'}
            </button>

            {/* Share Phone Link */}
            <button
              onClick={() => {
                sounds.playClick();
                setShowShareModal(true);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow active:scale-95 transition"
              title="Share demo URL for mobile phones on campus Wi-Fi"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Share Phone Link
            </button>

            {/* Reset Demo State Button */}
            <button
              onClick={() => {
                sounds.playClick();
                onResetDemo();
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-black/30 hover:bg-black/40 text-current flex items-center gap-1 active:scale-95 transition"
              title="Reset demo data back to pristine tournament seed"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Share / Mobile Wi-Fi Modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className={`w-full max-w-md rounded-2xl border p-6 relative shadow-2xl ${
              sunlightMode
                ? 'bg-white border-slate-900 text-slate-950'
                : 'bg-slate-900 border-amber-500/40 text-slate-100'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-amber-500 uppercase tracking-wide">
              <Smartphone className="w-4 h-4" />
              Campus Wi-Fi / Hotspot Mobile URL
            </div>

            <h3 className="text-lg font-black tracking-tight mb-2">
              Share Demo with Sports Committee
            </h3>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Anyone connected to the same Wi-Fi network can open this live scoring URL directly on their phone. All updates sync instantly in real time.
            </p>

            <div className="p-4 rounded-xl bg-black/40 border border-white/10 mb-4 font-mono">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                Direct Mobile Link
              </div>
              <div className="text-sm font-bold text-amber-400 break-all select-all">
                {mobileUrl}
              </div>
            </div>

            <button
              onClick={copyMobileLink}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow active:scale-95 transition"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? 'Link Copied to Clipboard!' : 'Copy Mobile Demo Link'}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
