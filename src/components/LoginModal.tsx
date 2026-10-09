import React, { useState, useEffect } from 'react';
import {
  Shield,
  Clock,
  LogIn,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  Info,
  Lock,
  ChevronRight,
  UserCheck,
  Zap,
  Radio
} from 'lucide-react';
import { sounds } from '../utils/audio';
import { api } from '../utils/api';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'referee' | 'spectator';
  badge: string;
  code?: string;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  sunlightMode: boolean;
  onLoginSuccess: (user: AuthenticatedUser) => void;
  initialTab?: 'referee' | 'committee';
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  sunlightMode,
  onLoginSuccess,
  initialTab = 'referee',
}) => {
  const [tab, setTab] = useState<'referee' | 'committee'>(initialTab);
  const [refereeCode, setRefereeCode] = useState('');

  // Committee credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sync initial tab when reopened
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setErrorMessage(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Direct Referee Login via ID/Code
  const handleRefereeLogin = async (codeToUse?: string) => {
    const code = (codeToUse || refereeCode).trim();
    if (!code) {
      setErrorMessage('Please enter your Referee ID or official code.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await api.post('/api/referees/login', {
        code_or_id: code,
      });

      sounds.playWhistle();
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      sounds.playClick(300);
      setErrorMessage(err.message || `Referee ID "${code}" not found. Please verify with Sports Committee.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Committee Admin Login
  const handleCommitteeLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await api.post('/api/auth/login', {
        email: email.trim(),
        password: password.trim(),
      });

      sounds.playWhistle();
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      sounds.playClick(300);
      setErrorMessage(err.message || 'Invalid committee credentials. Please check your username/password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border-t sm:border shadow-2xl transition-all pb-safe animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${
          sunlightMode
            ? 'bg-white border-slate-200 text-slate-900 shadow-xl'
            : 'bg-slate-900 border-amber-500/30 text-slate-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Grab Bar */}
        <div className="w-12 h-1.5 rounded-full bg-slate-600/60 mx-auto mt-2.5 mb-1 sm:hidden" />
        {/* Header */}
        <div
          className={`sticky top-0 z-10 px-6 py-4 border-b flex items-center justify-between ${
            sunlightMode ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-md bg-[#013B83]">
              <img src="/xlri-shield-square.png" alt="XLRI Crest" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-tight flex items-center gap-2">
                Official Tournament Sign In
              </h2>
              <p className={`text-xs ${sunlightMode ? 'text-slate-500' : 'opacity-75'}`}>
                Referee Access &bull; Sports Committee Executive Console
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className={`p-1.5 rounded-lg transition font-bold ${sunlightMode ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-black/10 text-slate-400 hover:text-white'}`}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher: Referee vs Committee */}
        <div className="px-6 pt-4">
          <div className={`flex rounded-xl p-1 gap-1 border ${sunlightMode ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/10'}`}>
            <button
              onClick={() => {
                sounds.playClick();
                setTab('referee');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                tab === 'referee'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : sunlightMode
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4 text-emerald-300" />
              Referee Access (ID Pass)
            </button>

            <button
              onClick={() => {
                sounds.playClick();
                setTab('committee');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                tab === 'committee'
                  ? 'bg-amber-500 text-black shadow-md'
                  : sunlightMode
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4 text-black" />
              Sports Committee Admin
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs font-semibold animate-in fade-in">
              {errorMessage}
            </div>
          )}

          {/* TAB 1: REFEREE DIRECT LOGIN */}
          {tab === 'referee' && (
            <div className="space-y-4">
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  sunlightMode
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                }`}
              >
                <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Fast Referee Access:</span> Enter your assigned Referee ID (e.g. <strong className="font-mono">REF-023</strong>) to access the on-field scoring pad for your assigned matches. No password required for verified tournament IDs.
                </div>
              </div>

              {/* Referee Code Input Box */}
              <div className={`p-4 rounded-xl border space-y-3 ${sunlightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-slate-800'}`}>
                <label className={`text-[11px] font-bold uppercase tracking-wider block ${sunlightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                  Enter Your Official Referee ID / Code:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={refereeCode}
                    onChange={(e) => setRefereeCode(e.target.value.toUpperCase())}
                    placeholder="e.g. REF-023"
                    className={`flex-1 px-3.5 py-2.5 rounded-xl border font-mono font-bold text-sm tracking-wider uppercase focus:outline-none focus:border-emerald-500 ${
                      sunlightMode
                        ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                        : 'bg-black border-slate-700 text-white'
                    }`}
                  />
                  <button
                    onClick={() => handleRefereeLogin()}
                    disabled={isLoading}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center gap-1.5"
                  >
                    <LogIn className="w-4 h-4" />
                    Enter Console
                  </button>
                </div>
              </div>

              {/* Official notice */}
              <div className={`p-3.5 rounded-xl border text-[11px] ${sunlightMode ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-black/30 border-slate-800 text-slate-400'}`}>
                Official field credentials are issued by the XLRI Sports Committee. For access disputes or ID reissuance, visit the Committee Desk at the Main Sports Complex.
              </div>
            </div>
          )}

          {/* TAB 2: SPORTS COMMITTEE ADMIN */}
          {tab === 'committee' && (
            <div className="space-y-4">
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  sunlightMode
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                }`}
              >
                <Shield className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Sports Committee Console:</span> Authorized executives sign in with their university committee credentials to manage fixtures, assign referees, and certify official scores.
                </div>
              </div>

              {/* Manual Committee Credentials Form */}
              <form onSubmit={handleCommitteeLogin} className="space-y-3.5">
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${sunlightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                    Committee Email or Username
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@xlri.edu"
                    className={`w-full px-3.5 py-2.5 rounded-xl border font-medium text-xs focus:outline-none focus:border-amber-500 ${
                      sunlightMode
                        ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                        : 'bg-black border-slate-700 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${sunlightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                    Committee Security Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={`w-full px-3.5 py-2.5 rounded-xl border font-medium text-xs focus:outline-none focus:border-amber-500 pr-10 ${
                        sunlightMode
                          ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                          : 'bg-black border-slate-700 text-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 top-2.5 ${sunlightMode ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In with Committee Credentials
                </button>
              </form>
            </div>
          )}

          {/* Public Spectator Notice */}
          <div
            className={`p-3 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
              sunlightMode
                ? 'bg-slate-50 border-slate-200 text-slate-600'
                : 'bg-black/30 border-slate-800 text-slate-400'
            }`}
          >
            <span>Public Spectators browse match scores automatically without login.</span>
            <span className="font-mono text-amber-500 font-bold">Anonymous Guest</span>
          </div>
        </div>
      </div>
    </div>
  );
};
