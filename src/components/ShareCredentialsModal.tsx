import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  Shield,
  Clock,
  Users,
  Eye,
  EyeOff,
  LogIn,
  Key,
  ExternalLink,
  Sparkles,
  Smartphone,
  Info
} from 'lucide-react';
import { sounds } from '../utils/audio';
import { api } from '../utils/api';

export interface PredefinedAccountInfo {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'spectator' | 'referee' | 'admin';
  badge: string;
  description: string;
}

export const PREDEFINED_ACCOUNTS_CLIENT: PredefinedAccountInfo[] = [
  {
    id: 'usr-admin-1',
    name: 'Sports Committee Admin',
    email: 'admin@xlri.edu',
    password: 'xlri-admin-2026',
    role: 'admin',
    badge: 'Committee Executive',
    description: 'Full authority: schedule fixtures, assign referees, verify submitted scorecards, and publish results to official championship standings.',
  },
  {
    id: 'usr-ref-1',
    name: 'Rohan Verma (Official REF-023)',
    email: 'referee@xlri.edu',
    password: 'xlri-ref-2026',
    role: 'referee',
    badge: 'Assigned Referee / Umpire',
    description: 'On-field scoring console: match clock, whistle sound synthesizer, +Goal/+Point/+Card logging, and scorecard submission.',
  },
  {
    id: 'ply-26bm001',
    name: 'Kabir Mehta (Senior Football Captain)',
    email: 'captain@xlri.edu',
    password: 'xlri-play-2026',
    role: 'spectator',
    badge: 'Contingent Captain',
    description: 'Seniors Batch 2026 contingent athlete: roster management, contingent stats, injury tracker, and player profile.',
  },
  {
    id: 'usr-spec-1',
    name: 'Public Spectator (Campus Guest)',
    email: 'spectator@xlri.edu',
    password: 'xlri-guest-2026',
    role: 'spectator',
    badge: 'Campus Spectator',
    description: 'General public & XLRI students: live scores, Up Next fixtures, Inter-batch Tug-of-War Hype Bar, and Trash Talk Banter Wall.',
  },
];

interface ShareCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sunlightMode: boolean;
  localIp: string;
  onSelectRole: (role: 'spectator' | 'referee' | 'admin', userId?: string) => void;
}

export const ShareCredentialsModal: React.FC<ShareCredentialsModalProps> = ({
  isOpen,
  onClose,
  sunlightMode,
  localIp,
  onSelectRole,
}) => {
  const [activeTab, setActiveTab] = useState<'cards' | 'login'>('cards');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPassId, setCopiedPassId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Form states
  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const mobileUrl = `http://${localIp}:5173`;

  const copyLink = () => {
    sounds.playClick();
    navigator.clipboard.writeText(mobileUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const copyPassword = (id: string, pass: string) => {
    sounds.playClick();
    navigator.clipboard.writeText(pass);
    setCopiedPassId(id);
    setTimeout(() => setCopiedPassId(null), 2500);
  };

  const togglePasswordVisibility = (id: string) => {
    sounds.playClick();
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleQuickLogin = (account: PredefinedAccountInfo) => {
    sounds.playWhistle();
    onSelectRole(account.role, account.id);
    onClose();
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccess(null);

    try {
      const res = await api.post('/api/auth/login', {
        email: inputEmail,
        password: inputPassword,
      });

      sounds.playWhistle();
      setLoginSuccess(`Signed in successfully as ${res.user.name}`);
      setTimeout(() => {
        onSelectRole(res.user.role, res.user.id);
        onClose();
      }, 700);
    } catch (err: any) {
      sounds.playClick(300);
      setLoginError(err.message || 'Invalid username or password. Check predefined accounts.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border-t sm:border shadow-2xl transition-all pb-safe animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${
          sunlightMode
            ? 'bg-white border-slate-900 text-slate-950'
            : 'bg-slate-900 border-amber-500/40 text-slate-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Grab Bar */}
        <div className="w-12 h-1.5 rounded-full bg-slate-600/60 mx-auto mt-2.5 mb-1 sm:hidden" />
        {/* Header */}
        <div
          className={`sticky top-0 z-10 px-6 py-4 border-b flex items-center justify-between ${
            sunlightMode ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black">
              <Share2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-tight flex items-center gap-2">
                Sports Committee Sharing &amp; Access
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  DEMO PASSES
                </span>
              </h2>
              <p className="text-xs opacity-75">
                Share with XLRI sports committee &amp; referees with pre-configured credentials
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-black/10 text-slate-400 hover:text-white transition font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Direct Mobile / Wi-Fi Share Box */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              sunlightMode
                ? 'bg-amber-50 border-amber-400 text-slate-950'
                : 'bg-black/40 border-amber-500/30 text-amber-200'
            }`}
          >
            <div className="space-y-1">
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 text-amber-500">
                <Smartphone className="w-3.5 h-3.5" />
                Campus Wi-Fi / Mobile Phone URL
              </div>
              <div className="text-sm font-mono font-bold break-all select-all">
                {mobileUrl}
              </div>
              <p className="text-[11px] opacity-75">
                Committee members on campus Wi-Fi can open this link on Chrome/Safari.
              </p>
            </div>

            <button
              onClick={copyLink}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-2 shadow active:scale-95 transition whitespace-nowrap"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? 'Copied Link!' : 'Copy Phone Link'}
            </button>
          </div>

          {/* Tab Switcher: Predefined Accounts Cards vs Direct Login */}
          <div className="flex border-b border-slate-700/60 gap-4">
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('cards');
              }}
              className={`pb-2 text-xs font-bold transition-all relative ${
                activeTab === 'cards'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Predefined Role Passes (4)
            </button>
            <button
              onClick={() => {
                sounds.playClick();
                setActiveTab('login');
              }}
              className={`pb-2 text-xs font-bold transition-all relative ${
                activeTab === 'login'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Manual Sign In Form
            </button>
          </div>

          {/* TAB 1: Predefined Accounts Cards */}
          {activeTab === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {PREDEFINED_ACCOUNTS_CLIENT.map((acc) => {
                const isPassVisible = showPasswords[acc.id] || false;
                const isCopied = copiedPassId === acc.id;

                let roleIcon = <Users className="w-4 h-4" />;
                let roleColor = 'text-blue-400 border-blue-500/30 bg-blue-500/10';
                if (acc.role === 'admin') {
                  roleIcon = <Shield className="w-4 h-4" />;
                  roleColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
                } else if (acc.role === 'referee') {
                  roleIcon = <Clock className="w-4 h-4" />;
                  roleColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
                }

                return (
                  <div
                    key={acc.id}
                    className={`rounded-xl border p-4 flex flex-col justify-between transition hover:border-amber-400/60 ${
                      sunlightMode
                        ? 'bg-slate-50 border-slate-300'
                        : 'bg-slate-950/70 border-white/10'
                    }`}
                  >
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${roleColor}`}
                        >
                          {roleIcon}
                          {acc.badge}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          Role: {acc.role}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-white">{acc.name}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {acc.description}
                      </p>

                      {/* Credentials Block */}
                      <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-[10px] text-slate-500 uppercase">User / Email:</span>
                          <span className="font-bold text-amber-300 select-all">{acc.email}</span>
                        </div>

                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-[10px] text-slate-500 uppercase">Password:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-emerald-400 select-all">
                              {isPassVisible ? acc.password : '••••••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(acc.id)}
                              className="p-1 hover:text-white text-slate-400 transition"
                              title={isPassVisible ? 'Hide' : 'Reveal'}
                            >
                              {isPassVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button
                              onClick={() => copyPassword(acc.id, acc.password)}
                              className="p-1 hover:text-white text-slate-400 transition"
                              title="Copy password"
                            >
                              {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 1-Click Launch Button */}
                    <button
                      onClick={() => handleQuickLogin(acc)}
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-black text-slate-200 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      1-Click Sign In as {acc.role.toUpperCase()}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: Manual Sign In Form */}
          {activeTab === 'login' && (
            <form onSubmit={handleManualLogin} className="max-w-md mx-auto space-y-4">
              <div className="text-xs text-slate-400 leading-relaxed">
                Enter any of the committee predefined passwords (e.g.{' '}
                <span className="font-mono text-amber-300">admin@xlri.edu</span> /{' '}
                <span className="font-mono text-emerald-300">xlri-admin-2026</span>) to authenticate.
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs font-medium flex items-center gap-2">
                  <Info className="w-4 h-4 text-red-400 shrink-0" />
                  {loginError}
                </div>
              )}

              {loginSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {loginSuccess}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase">
                  Email or Role Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. admin@xlri.edu or referee@xlri.edu"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-slate-700 text-sm text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase">Password</label>
                <input
                  type="password"
                  required
                  placeholder="e.g. xlri-admin-2026"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-slate-700 text-sm text-white placeholder-slate-500 focus:border-amber-400 outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow active:scale-95 transition"
              >
                <LogIn className="w-4 h-4" />
                Sign In to Scoring System
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
