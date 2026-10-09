import React, { useState, useEffect } from 'react';
import {
  Flame,
  Clock,
  CheckCircle2,
  Trophy,
  Share2,
  Sparkles,
  MessageSquare,
  Send,
  Zap,
  TrendingUp,
  MapPin,
  Calendar,
  Volume2,
  Activity,
  Filter,
  Pin,
  PinOff,
  ExternalLink,
  Info,
  BarChart3
} from 'lucide-react';
import { sounds } from '../utils/audio';
import { mobileHaptics } from '../utils/haptics';
import { api } from '../utils/api';
import { ViralCardModal } from './ViralCardModal';
import { ShareMatchModal } from './ShareMatchModal';
import { MatchAnalyticsModal } from './MatchAnalyticsModal';
import { InfoTooltip } from './InfoTooltip';
import { calculateWinProbability } from '../services/sportsAnalytics';

interface MatchCenterProps {
  sunlightMode: boolean;
  matches: any[];
  standings: any;
  onRefresh: () => void;
}

interface BanterItem {
  id: string;
  author: string;
  batch: 'Senior' | 'Junior';
  text: string;
  time: string;
  reactions: { cooked: number; savage: number; w: number; ratio: number };
}

export const MatchCenter: React.FC<MatchCenterProps> = ({
  sunlightMode,
  matches,
  standings,
  onRefresh,
}) => {
  // Clean Home View Sub-Tabs: 'matches' (Default), 'standings', 'banter'
  const [subTab, setSubTab] = useState<'matches' | 'standings' | 'banter'>('matches');
  const [sportFilter, setSportFilter] = useState<string>('ALL');

  // Modals State
  const [selectedMatchForViral, setSelectedMatchForViral] = useState<any | null>(null);
  const [selectedMatchForShare, setSelectedMatchForShare] = useState<any | null>(null);
  const [selectedMatchForAnalytics, setSelectedMatchForAnalytics] = useState<any | null>(null);

  // Match Pinning State (persisted in localStorage)
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem('ratanjee_pinned_matches') ||
        localStorage.getItem('ratanji_pinned_matches') ||
        '[]'
      );
    } catch {
      return [];
    }
  });

  const togglePin = (matchId: string) => {
    sounds.playClick(1100);
    const updated = pinnedIds.includes(matchId)
      ? pinnedIds.filter((id) => id !== matchId)
      : [...pinnedIds, matchId];
    setPinnedIds(updated);
    try {
      localStorage.setItem('ratanjee_pinned_matches', JSON.stringify(updated));
    } catch {}
  };

  // Social Features: Inter-Batch Tug-of-War Hype Meter (Clean Day 0 Start: 0-0)
  const [seniorHype, setSeniorHype] = useState(0);
  const [juniorHype, setJuniorHype] = useState(0);

  // Social Features: Campus Live Banter Stream (Clean Day 0 Start: Empty Feed)
  const [banterFeed, setBanterFeed] = useState<BanterItem[]>([]);
  const [banterInput, setBanterInput] = useState('');
  const [banterBatch, setBanterBatch] = useState<'Senior' | 'Junior'>('Senior');

  // Load banter feed and campus hype from API
  useEffect(() => {
    api.get<any[]>('/api/banter')
      .then((data) => {
        if (Array.isArray(data)) setBanterFeed(data);
      })
      .catch(() => {});

    api.get<any>('/api/banter/hype')
      .then((data) => {
        if (data) {
          setSeniorHype(data.seniorHype ?? 0);
          setJuniorHype(data.juniorHype ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  const totalHype = seniorHype + juniorHype;
  // Guard against division-by-zero (0/0 = NaN) when starting at clean Day 0
  const seniorHypePct = totalHype === 0 ? 50 : Math.round((seniorHype / totalHype) * 100);
  const juniorHypePct = totalHype === 0 ? 50 : 100 - seniorHypePct;

  const triggerHype = async (batch: 'Senior' | 'Junior') => {
    sounds.playArcadeCoin();
    sounds.playCheer();
    mobileHaptics.highImpact();
    if (batch === 'Senior') {
      setSeniorHype((prev) => prev + 12);
    } else {
      setJuniorHype((prev) => prev + 12);
    }
    try {
      const res = await api.post<any>('/api/banter/hype', { batch, amount: 12 });
      if (res) {
        setSeniorHype(res.seniorHype ?? 0);
        setJuniorHype(res.juniorHype ?? 0);
      }
    } catch {}
  };

  const handlePostBanter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banterInput.trim()) return;

    sounds.playClick();
    const tempId = 'b-' + Date.now();
    const author = banterBatch === 'Senior' ? 'Senior Supporter' : 'Junior Supporter';
    const text = banterInput.trim();
    const newItem: BanterItem = {
      id: tempId,
      author,
      batch: banterBatch,
      text,
      time: 'Just now',
      reactions: { cooked: 0, savage: 0, w: 1, ratio: 0 },
    };

    setBanterFeed((prev) => [newItem, ...prev]);
    setBanterInput('');

    try {
      const serverPost = await api.post<any>('/api/banter', { author, batch: banterBatch, text });
      if (serverPost) {
        setBanterFeed((prev) => [serverPost, ...prev.filter((p) => p.id !== tempId)]);
      }
    } catch {}
  };

  const handleReaction = async (banterId: string, type: 'cooked' | 'savage' | 'w' | 'ratio') => {
    sounds.playClick(900);
    setBanterFeed((prev) =>
      prev.map((item) => {
        if (item.id === banterId) {
          return {
            ...item,
            reactions: {
              ...item.reactions,
              [type]: (item.reactions[type] || 0) + 1,
            },
          };
        }
        return item;
      })
    );
    try {
      await api.post(`/api/banter/${banterId}/react`, { type });
    } catch {}
  };

  // Group matches cleanly
  const matchesToFilter = sportFilter === 'ALL'
    ? matches
    : matches.filter((m) =>
        m.sport_id?.toLowerCase().includes(sportFilter.toLowerCase()) ||
        m.sport_name?.toLowerCase().includes(sportFilter.toLowerCase())
      );

  const pinnedMatches = matchesToFilter.filter((m) => pinnedIds.includes(m.id));
  const liveMatches = matchesToFilter.filter(
    (m) =>
      !pinnedIds.includes(m.id) &&
      (String(m.status).toUpperCase() === 'DRAFT' || String(m.status).toUpperCase() === 'LIVE')
  );
  const upcomingMatches = matchesToFilter.filter(
    (m) => !pinnedIds.includes(m.id) && String(m.status).toUpperCase() === 'SCHEDULED'
  );
  const completedMatches = matchesToFilter.filter(
    (m) =>
      !pinnedIds.includes(m.id) &&
      (String(m.status).toUpperCase() === 'PUBLISHED' || String(m.status).toUpperCase() === 'VERIFIED')
  );

  // Reusable Match Card Renderer: Fortune-500 Sports Intelligence Aesthetic
  const renderMatchCard = (m: any, isPinnedCard = false) => {
    const isLive = String(m.status).toUpperCase() === 'DRAFT' || String(m.status).toUpperCase() === 'LIVE';
    const isCompleted = String(m.status).toUpperCase() === 'PUBLISHED' || String(m.status).toUpperCase() === 'VERIFIED';
    const isPinned = pinnedIds.includes(m.id);
    const sportName = m.sport_name || m.sport_id?.replace('sport-', '').toUpperCase();

    // Data Science Live Win Probability
    const winOdds = calculateWinProbability(m, []);

    return (
      <div
        key={m.id}
        className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between group relative ${
          isPinnedCard
            ? 'border-amber-400/50 bg-amber-500/[0.04] shadow-lg shadow-black/40'
            : sunlightMode
            ? 'bg-white border-slate-300 shadow-sm hover:border-slate-400'
            : 'bg-slate-900/70 border-white/[0.08] hover:border-white/20 shadow-xl shadow-black/50 backdrop-blur-md'
        }`}
      >
        <div>
          {/* Card Header: Sport, Minimalist Status Badge & Controls */}
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                  isLive
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : isCompleted
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800/80 text-slate-300 border border-slate-700/60'
                }`}
              >
                {isLive ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping inline-block" />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Clock className="w-3 h-3 text-slate-400" />
                )}
                <span>{isLive ? `LIVE • ${m.current_period || 'In Play'}` : isCompleted ? 'FINAL' : 'SCHEDULED'}</span>
              </span>

              <InfoTooltip
                title={`${sportName} Official Status`}
                align="left"
                content={
                  isLive
                    ? 'Match is actively underway. Scoring events and game clock are logged directly from the referee pad with live WebSocket broadcasting.'
                    : isCompleted
                    ? 'Official match concluded, verified by the Sports Committee, and permanently committed to the Championship standings.'
                    : 'Upcoming fixture according to the official tournament master schedule.'
                }
                features={[
                  'Officiated by certified tournament referees',
                  'Instant sub-second real-time scoreboard synchronization',
                  'Result immediately updates cohort medal table and points diff'
                ]}
                sunlightMode={sunlightMode}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-amber-400 font-mono tracking-wider uppercase">
                {sportName}
              </span>

              {/* Pin Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  mobileHaptics.tap();
                  togglePin(m.id);
                }}
                className={`p-1.5 rounded-lg transition-colors ${
                  isPinned
                    ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                    : 'text-slate-400 hover:text-amber-400 hover:bg-white/5'
                }`}
                title={isPinned ? 'Unpin match from top' : 'Pin match to top for persistent tracking'}
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
              </button>

              {/* Analytics Modal Quick Launch */}
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  mobileHaptics.tap();
                  setSelectedMatchForAnalytics(m);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-white/5 transition-colors"
                title="Open Sports Data Science & Analytics Insights"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Minimalist Executive Scoreboard */}
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 mb-3 ${
            sunlightMode
              ? 'bg-[#013B83]/[0.03] border-[#013B83]/10 shadow-sm'
              : 'bg-slate-950/70 border-white/[0.06] shadow-inner'
          }`}>
            {/* Home (Seniors) */}
            <div className="flex-1 text-center min-w-0">
              <span className={`text-[11px] font-bold block uppercase tracking-wider truncate mb-1 ${
                sunlightMode ? 'text-[#013B83]' : 'text-blue-400'
              }`}>
                {m.home_cohort_name || "Seniors"}
              </span>
              <span className={`tabular-score-num text-3xl sm:text-4xl font-extrabold ${
                sunlightMode ? 'text-[#013B83]' : 'text-blue-400'
              }`}>
                {m.score_home ?? 0}
              </span>
            </div>

            {/* Match State / Clock Capsule */}
            <div className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg border ${
              sunlightMode
                ? 'bg-white border-slate-200 shadow-sm'
                : 'bg-white/[0.03] border-white/5'
            }`}>
              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                sunlightMode ? 'text-slate-700' : 'text-slate-400'
              }`}>
                {isLive ? (
                  m.current_time_seconds ? `${Math.floor(m.current_time_seconds / 60)}'` : 'LIVE'
                ) : isCompleted ? (
                  'FINAL'
                ) : (
                  'VS'
                )}
              </span>
            </div>

            {/* Away (Juniors) */}
            <div className="flex-1 text-center min-w-0">
              <span className={`text-[11px] font-bold block uppercase tracking-wider truncate mb-1 ${
                sunlightMode ? 'text-emerald-700' : 'text-emerald-400'
              }`}>
                {m.away_cohort_name || "Juniors"}
              </span>
              <span className={`tabular-score-num text-3xl sm:text-4xl font-extrabold ${
                sunlightMode ? 'text-emerald-700' : 'text-emerald-400'
              }`}>
                {m.score_away ?? 0}
              </span>
            </div>
          </div>

          {/* In-Game Win Probability Micro-Telemetry (Data Science Engine) */}
          <div className={`mb-3.5 px-3 py-2 rounded-lg border ${
            sunlightMode
              ? 'bg-slate-50/80 border-slate-200'
              : 'bg-white/[0.02] border-white/[0.05]'
          }`}>
            <div className={`flex items-center justify-between text-[10px] font-mono mb-1 ${
              sunlightMode ? 'text-slate-600' : 'text-slate-400'
            }`}>
              <span className={`font-bold ${sunlightMode ? 'text-[#013B83]' : 'text-blue-400'}`}>
                Seniors {winOdds.homePct}%
              </span>
              <span className={`flex items-center gap-1 text-[9px] uppercase tracking-wider ${
                sunlightMode ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Win Probability
                <InfoTooltip
                  title="Bayesian Win Probability Model"
                  align="center"
                  content="Real-time multi-sport predictive model incorporating live score differential, sport-specific volatility, Poisson decay, and time elapsed."
                  features={[
                    "Football/Futsal: Low-frequency Poisson expectancy",
                    "Basketball: Normal drift diffusion with period variance",
                    "Racquet Sports: Set margin & deuce probability",
                    "Cricket: Required run rate vs wickets in hand"
                  ]}
                  sunlightMode={sunlightMode}
                />
              </span>
              <span className={`font-bold ${sunlightMode ? 'text-emerald-700' : 'text-emerald-400'}`}>
                {winOdds.awayPct}% Juniors
              </span>
            </div>
            <div className={`w-full h-1.5 rounded-full overflow-hidden flex ${
              sunlightMode ? 'bg-slate-200' : 'bg-slate-800'
            }`}>
              <div style={{ width: `${winOdds.homePct}%` }} className={`${sunlightMode ? 'bg-[#013B83]' : 'bg-blue-500'} transition-all duration-300`} />
              <div style={{ width: `${winOdds.awayPct}%` }} className={`${sunlightMode ? 'bg-emerald-600' : 'bg-emerald-500'} transition-all duration-300`} />
            </div>
          </div>

          {/* Venue & Fixture Details */}
          <div className={`flex items-center justify-between text-[11px] font-mono mb-3.5 ${
            sunlightMode ? 'text-slate-500' : 'text-slate-400'
          }`}>
            <div className="flex items-center gap-1.5 truncate max-w-[210px]">
              <MapPin className={`w-3.5 h-3.5 shrink-0 ${sunlightMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <span className="truncate">{m.venue || 'XLRI Grounds'}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Clock className={`w-3.5 h-3.5 ${sunlightMode ? 'text-amber-600' : 'text-amber-400/80'}`} />
              <span>
                {m.current_time_seconds ? `${Math.floor(m.current_time_seconds / 60)}' min` : 'Scheduled'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Analytics, WhatsApp Share & Viral Brag Card */}
        <div className={`grid grid-cols-3 gap-2 pt-3 border-t ${
          sunlightMode ? 'border-slate-200' : 'border-white/[0.08]'
        }`}>
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              mobileHaptics.tap();
              setSelectedMatchForAnalytics(m);
            }}
            className={`py-2 px-2 rounded-xl border font-semibold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-colors ${
              sunlightMode
                ? 'bg-[#013B83]/10 hover:bg-[#013B83]/15 border-[#013B83]/20 text-[#013B83]'
                : 'bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300'
            }`}
            title="Open Sports Data Science & Analytics Insights"
          >
            <BarChart3 className={`w-3.5 h-3.5 shrink-0 ${sunlightMode ? 'text-[#013B83]' : 'text-blue-400'}`} />
            <span className="truncate">Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              mobileHaptics.tap();
              setSelectedMatchForShare(m);
            }}
            className={`py-2 px-2 rounded-xl border font-semibold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-colors ${
              sunlightMode
                ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                : 'bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300'
            }`}
            title="Share live scorecard to WhatsApp groups"
          >
            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${sunlightMode ? 'text-emerald-700' : 'text-emerald-400'}`} />
            <span className="truncate">Share</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              mobileHaptics.tap();
              setSelectedMatchForViral(m);
            }}
            className={`py-2 px-2 rounded-xl border font-semibold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-colors ${
              sunlightMode
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                : 'bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-200'
            }`}
            title="Generate viral campus brag card"
          >
            <Sparkles className={`w-3.5 h-3.5 shrink-0 ${sunlightMode ? 'text-amber-600' : 'text-amber-400'}`} />
            <span className="truncate">Brag Card</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in">
      {/* 1. Sleek Tournament Summary Header */}
      <div
        className={`p-5 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 transition-colors ${
          sunlightMode
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-slate-900/70 border-white/[0.08] shadow-xl backdrop-blur-md'
        }`}
      >
        <div className="flex items-center gap-3.5 w-full md:w-auto">
          <div
            className={`w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border transition-all ${
              sunlightMode
                ? 'border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5'
                : 'border-white/10 bg-[#013B83] shadow-md ring-1 ring-white/15'
            }`}
          >
            <img src="/xlri-shield-square.png" alt="XLRI Delhi Crest" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className={`text-base sm:text-lg font-black tracking-tight flex items-center gap-1.5 ${
                  sunlightMode ? 'text-[#013B83]' : 'text-white'
                }`}
              >
                RATANJEE
                <InfoTooltip
                  title="Ratanjee Memorial Trophy"
                  content="Official annual inter-batch championship between Seniors and Juniors across 15+ disciplines."
                  features={[
                    "15+ sanctioned sporting disciplines including Football, Basketball, Cricket, and Racquet sports",
                    "Official real-time officiating with sub-second event-sourcing integrity",
                    "Perpetual trophy engraved and hoisted at the Championship Gala"
                  ]}
                  sunlightMode={sunlightMode}
                />
              </h2>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  sunlightMode
                    ? 'bg-[#013B83]/10 text-[#013B83] border-[#013B83]/20 font-mono'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-mono'
                }`}
              >
                CHAMPIONSHIP
              </span>
            </div>
            <p
              className={`text-xs flex items-center gap-1.5 flex-wrap mt-0.5 ${
                sunlightMode ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              <span>Leaderboard:</span>
              <span
                className={`font-bold flex items-center gap-1 ${
                  sunlightMode ? 'text-[#013B83]' : 'text-blue-400'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${sunlightMode ? 'bg-[#013B83]' : 'bg-blue-400'}`} />
                Seniors {Array.isArray(standings) ? (standings.find((s: any) => s.cohort_id === 'cohort-seniors' || s.cohort_name === 'Seniors')?.total_points ?? 0) : 0} Pts
              </span>
              <span className={sunlightMode ? 'text-slate-400' : 'text-slate-600'}>&bull;</span>
              <span
                className={`font-bold flex items-center gap-1 ${
                  sunlightMode ? 'text-emerald-700' : 'text-emerald-400'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${sunlightMode ? 'bg-emerald-700' : 'bg-emerald-400'}`} />
                Juniors {Array.isArray(standings) ? (standings.find((s: any) => s.cohort_id === 'cohort-juniors' || s.cohort_name === 'Juniors')?.total_points ?? 0) : 0} Pts
              </span>
              <InfoTooltip
                title="Championship Points & Tiebreaker Protocol"
                content="Points allocation and tie-breaking methodology governing the official Ratanjee standings table."
                features={[
                  "Match Win: 3 Championship Points",
                  "Match Draw: 1 Championship Point",
                  "Match Loss: 0 Championship Points",
                  "Tiebreaker 1: Head-to-head match outcomes",
                  "Tiebreaker 2: Cumulative score differential (Diff)",
                  "Tiebreaker 3: Total points/goals scored (PF)"
                ]}
                sunlightMode={sunlightMode}
              />
            </p>
          </div>
        </div>

        {/* Clean Sub-View Tabs Switcher */}
        <div
          className={`flex items-center p-1 rounded-xl border gap-1 w-full md:w-auto ${
            sunlightMode ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/[0.08]'
          }`}
        >
          <button
            onClick={() => {
              sounds.playClick();
              setSubTab('matches');
            }}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              subTab === 'matches'
                ? sunlightMode
                  ? 'bg-[#013B83] text-white font-bold shadow-sm'
                  : 'bg-white text-slate-950 font-bold shadow-sm'
                : sunlightMode
                ? 'text-slate-600 hover:text-[#013B83]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${sunlightMode && subTab === 'matches' ? 'text-amber-300' : 'text-amber-500'}`} />
            Live &amp; Fixtures ({liveMatches.length + pinnedMatches.length})
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setSubTab('standings');
            }}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              subTab === 'standings'
                ? sunlightMode
                  ? 'bg-[#013B83] text-white font-bold shadow-sm'
                  : 'bg-white text-slate-950 font-bold shadow-sm'
                : sunlightMode
                ? 'text-slate-600 hover:text-[#013B83]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy className={`w-3.5 h-3.5 ${sunlightMode && subTab === 'standings' ? 'text-amber-300' : 'text-amber-500'}`} />
            Standings
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setSubTab('banter');
            }}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              subTab === 'banter'
                ? sunlightMode
                  ? 'bg-[#013B83] text-white font-bold shadow-sm'
                  : 'bg-white text-slate-950 font-bold shadow-sm'
                : sunlightMode
                ? 'text-slate-600 hover:text-[#013B83]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${sunlightMode && subTab === 'banter' ? 'text-amber-300' : 'text-amber-500'}`} />
            Campus Hype
          </button>
        </div>
      </div>

      {/* VIEW 1: Clean Live Matches & Upcoming Fixtures (Default) */}
      {subTab === 'matches' && (
        <div className="flex flex-col gap-6">
          {/* Quick Sport Filter Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-500 font-bold uppercase text-[10px] whitespace-nowrap flex items-center gap-1">
              <Filter className="w-3 h-3" /> Sport:
            </span>
            {['ALL', 'badminton', 'futsal', 'cricket', 'basketball', 'football', 'table-tennis', 'volleyball', 'tennis', 'chess'].map((s) => (
              <button
                key={s}
                onClick={() => {
                  sounds.playClick();
                  setSportFilter(s);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize transition whitespace-nowrap active:scale-95 ${
                  sportFilter === s
                    ? 'bg-white text-black font-black shadow-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {s === 'ALL' ? 'All Sports' : s.replace('-', ' ')}
              </button>
            ))}
          </div>

          {/* SECTION 0: Pinned Live Matches (If any pinned) */}
          {pinnedMatches.length > 0 && (
            <div className="space-y-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/30 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2 text-amber-400">
                  <Pin className="w-4 h-4 fill-amber-400 text-amber-400" />
                  Pinned Live Trackers ({pinnedMatches.length})
                  <InfoTooltip
                    title="Pinned Matches"
                    content="Matches pinned stay at the top for instant live tracking across campus."
                    sunlightMode={sunlightMode}
                  />
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setPinnedIds([]);
                    try {
                      localStorage.removeItem('ratanjee_pinned_matches');
                      localStorage.removeItem('ratanji_pinned_matches');
                    } catch {}
                  }}
                  className="text-[11px] font-mono text-slate-400 hover:text-amber-400"
                >
                  Clear All Pinned
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pinnedMatches.map((m) => renderMatchCard(m, true))}
              </div>
            </div>
          )}

          {/* SECTION 1: Active Live Matches Now */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`font-black text-sm uppercase tracking-wide flex items-center gap-2 ${sunlightMode ? 'text-slate-900' : 'text-white'}`}>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                Live Now On Court &amp; Field
                <InfoTooltip
                  title="Live Match Synchronization"
                  content="Field referees log goals, fouls, runs, and points with sub-250ms WebSocket real-time synchronization to this board."
                  sunlightMode={sunlightMode}
                />
              </h3>
              <span className={`text-xs font-mono ${sunlightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {liveMatches.length} Live Matches
              </span>
            </div>

            {liveMatches.length === 0 ? (
              <div className={`p-8 rounded-2xl border border-dashed text-center text-xs ${sunlightMode ? 'border-slate-300 text-slate-500 bg-white' : 'border-slate-800 text-slate-500'}`}>
                No active live matches in this filter right now. Check scheduled fixtures below.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveMatches.map((m) => renderMatchCard(m, false))}
              </div>
            )}
          </div>

          {/* SECTION 2: Upcoming Scheduled Fixtures */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-sm uppercase tracking-wide flex items-center gap-2 ${sunlightMode ? 'text-slate-900' : 'text-white'}`}>
                <Calendar className="w-4 h-4 text-amber-500" />
                Up Next &bull; Scheduled Fixtures
                <InfoTooltip
                  title="Official Match Schedule"
                  align="left"
                  content="Scheduled tournament fixtures verified by the Sports Committee. Referees open digital scoring pads at game start."
                  features={[
                    "Pre-match win odds simulations available via Analytics",
                    "Court assignments coordinated with campus facilities",
                    "Instant transition to Live state when referee initiates clock"
                  ]}
                  sunlightMode={sunlightMode}
                />
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {upcomingMatches.length} Scheduled
              </span>
            </div>

            {upcomingMatches.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center text-xs text-slate-500">
                No upcoming fixtures scheduled in this filter. Check back soon or view live matches above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {upcomingMatches.slice(0, 6).map((m) => {
                  const sportName = m.sport_name || m.sport_id?.replace('sport-', '').toUpperCase();
                  const isPinned = pinnedIds.includes(m.id);

                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all duration-200 hover:border-white/20 ${
                        sunlightMode
                          ? 'bg-white border-slate-300 shadow-sm'
                          : 'bg-slate-900/60 border-white/[0.08] backdrop-blur-md'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-[10px] font-bold uppercase text-amber-400 font-mono tracking-wider">
                            {sportName}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => togglePin(m.id)}
                              className={`p-1 rounded transition-colors ${isPinned ? 'text-amber-400' : 'text-slate-500 hover:text-white'}`}
                              title={isPinned ? 'Unpin fixture' : 'Pin fixture'}
                            >
                              <Pin className={`w-3 h-3 ${isPinned ? 'fill-current' : ''}`} />
                            </button>
                            <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded bg-white/5 border border-white/5">
                              UPCOMING
                            </span>
                          </div>
                        </div>

                        <div className="text-xs font-semibold mb-3 flex items-center gap-1.5 flex-wrap">
                          <span className={`font-bold ${sunlightMode ? 'text-[#013B83]' : 'text-blue-400'}`}>
                            {m.home_cohort_name || "Seniors"}
                          </span>
                          <span className={`text-[11px] font-normal ${sunlightMode ? 'text-slate-400' : 'text-slate-500'}`}>vs</span>
                          <span className={`font-bold ${sunlightMode ? 'text-emerald-700' : 'text-emerald-400'}`}>
                            {m.away_cohort_name || "Juniors"}
                          </span>
                        </div>
                      </div>

                      <div className={`flex items-center justify-between text-[11px] font-mono border-t pt-2.5 ${
                        sunlightMode ? 'border-slate-200 text-slate-500' : 'border-white/5 text-slate-400'
                      }`}>
                        <span className="truncate max-w-[120px]">{m.venue || 'Sports Complex'}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playClick();
                              mobileHaptics.tap();
                              setSelectedMatchForAnalytics(m);
                            }}
                            className={`font-semibold flex items-center gap-1 text-[11px] transition-colors ${
                              sunlightMode ? 'text-[#013B83] hover:text-[#013B83]/80' : 'text-blue-400 hover:text-blue-300'
                            }`}
                            title="Simulate Win Odds & Matchup Telemetry"
                          >
                            <BarChart3 className="w-3 h-3" />
                            Analytics
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedMatchForShare(m)}
                            className={`font-semibold flex items-center gap-1 text-[11px] transition-colors ${
                              sunlightMode ? 'text-emerald-700 hover:text-emerald-800' : 'text-emerald-400 hover:text-emerald-300'
                            }`}
                            title="Share fixture"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Share
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 3: Recently Concluded & Verified Results */}
          {completedMatches.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className={`font-black text-sm uppercase tracking-wide flex items-center gap-2 ${sunlightMode ? 'text-slate-900' : 'text-white'}`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Recent Concluded Results &bull; Verified
                </h3>
                <span className={`text-xs font-mono ${sunlightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {completedMatches.length} Matches Completed
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedMatches.slice(0, 4).map((m) => renderMatchCard(m, false))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Championship Standings Table */}
      {subTab === 'standings' && (
        <div
          className={`p-5 rounded-2xl border shadow-xl transition-all ${
            sunlightMode
              ? 'bg-white border-slate-200 shadow-sm'
              : 'bg-slate-900/70 border-white/[0.08] backdrop-blur-md'
          }`}
        >
          <div className={`flex items-center justify-between mb-4 border-b pb-3.5 ${
            sunlightMode ? 'border-slate-200' : 'border-white/[0.08]'
          }`}>
            <div>
              <h3 className={`font-bold text-sm uppercase tracking-wide flex items-center gap-2 ${
                sunlightMode ? 'text-[#013B83]' : 'text-white'
              }`}>
                Official Championship Leaderboard
                <InfoTooltip
                  title="Championship Standings Criteria"
                  content="Standings automatically compute from verified match results ratified by the Sports Committee. Cohort points directly decide the Ratanjee Memorial Trophy."
                  features={[
                    "Win = 3 points, Draw = 1 point, Loss = 0 points",
                    "Head-to-head outcomes serve as the primary tiebreaker",
                    "Point Differential (Diff) = Total Points For (PF) minus Points Against (PA)",
                    "Live updates reflect instantly across all campus leaderboards"
                  ]}
                  sunlightMode={sunlightMode}
                />
              </h3>
              <p className={`text-xs mt-0.5 ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                Points formula: Win = 3 pts &bull; Draw = 1 pt &bull; Loss = 0 pts. Head-to-head tiebreaker active.
              </p>
            </div>
            <Trophy className={`w-5 h-5 ${sunlightMode ? 'text-amber-600' : 'text-amber-400'}`} />
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className={`border-b text-[10px] font-mono uppercase ${
                  sunlightMode ? 'border-slate-200 text-slate-500' : 'border-white/[0.08] text-slate-400'
                }`}>
                  <th className="py-3 px-3">Rank &bull; Cohort</th>
                  <th className="py-3 px-3 text-center">Played</th>
                  <th className="py-3 px-3 text-center">W</th>
                  <th className="py-3 px-3 text-center">D</th>
                  <th className="py-3 px-3 text-center">L</th>
                  <th className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1">
                      PF
                      <InfoTooltip title="Points For" content="Total goals, runs, or points scored across all events by this cohort." />
                    </span>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1">
                      PA
                      <InfoTooltip title="Points Against" content="Total goals, runs, or points conceded across all events by this cohort." />
                    </span>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1">
                      Diff
                      <InfoTooltip title="Goal / Point Differential" content="Net differential: Points For minus Points Against. Primary secondary tiebreaker." />
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className={`divide-y font-mono ${sunlightMode ? 'divide-slate-100' : 'divide-white/[0.05]'}`}>
                {(Array.isArray(standings) && standings.length > 0 ? standings : [
                  { cohort_name: 'Seniors', played: 0, won: 0, drawn: 0, lost: 0, points_for: 0, points_against: 0, points_diff: 0, total_points: 0, cohort_id: 'cohort-seniors' },
                  { cohort_name: 'Juniors', played: 0, won: 0, drawn: 0, lost: 0, points_for: 0, points_against: 0, points_diff: 0, total_points: 0, cohort_id: 'cohort-juniors' },
                ]).map((s: any, idx: number) => {
                  const isSenior = s.cohort_id === 'cohort-seniors' || String(s.cohort_name || s.cohort).includes('Senior');
                  return (
                    <tr
                      key={s.cohort_id || idx}
                      className={
                        isSenior
                          ? sunlightMode
                            ? 'bg-[#013B83]/[0.03] hover:bg-[#013B83]/[0.06] transition-colors'
                            : 'bg-blue-500/[0.03] hover:bg-blue-500/[0.06] transition-colors'
                          : sunlightMode
                          ? 'bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06] transition-colors'
                          : 'bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06] transition-colors'
                      }
                    >
                      <td className={`py-3.5 px-3 font-semibold flex items-center gap-2.5 ${
                        sunlightMode ? 'text-slate-900' : 'text-white'
                      }`}>
                        <span className={`w-5 h-5 rounded-full ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : sunlightMode
                            ? 'bg-slate-200 text-slate-700 font-bold'
                            : 'bg-slate-800 text-slate-300 font-bold'
                        } text-[10px] flex items-center justify-center shrink-0`}>
                          {idx + 1}
                        </span>
                        <span className={`font-sans font-bold ${
                          isSenior
                            ? sunlightMode ? 'text-[#013B83]' : 'text-blue-400'
                            : sunlightMode ? 'text-emerald-700' : 'text-emerald-400'
                        }`}>
                          {isSenior ? 'Seniors' : 'Juniors'}
                        </span>
                      </td>
                      <td className={`py-3.5 px-3 text-center ${sunlightMode ? 'text-slate-700' : 'text-slate-300'}`}>{s.played ?? 0}</td>
                      <td className={`py-3.5 px-3 text-center font-bold ${sunlightMode ? 'text-emerald-700' : 'text-emerald-400'}`}>{s.won ?? 0}</td>
                      <td className={`py-3.5 px-3 text-center ${sunlightMode ? 'text-slate-500' : 'text-slate-400'}`}>{s.drawn ?? 0}</td>
                      <td className={`py-3.5 px-3 text-center ${sunlightMode ? 'text-rose-700' : 'text-rose-400'}`}>{s.lost ?? 0}</td>
                      <td className={`py-3.5 px-3 text-center ${sunlightMode ? 'text-slate-700' : 'text-slate-300'}`}>{s.points_for ?? 0}</td>
                      <td className={`py-3.5 px-3 text-center ${sunlightMode ? 'text-slate-700' : 'text-slate-300'}`}>{s.points_against ?? 0}</td>
                      <td className={`py-3.5 px-3 text-center font-semibold ${sunlightMode ? 'text-slate-900' : 'text-slate-300'}`}>{s.points_diff ?? 0}</td>
                      <td className={`py-3.5 px-3 text-right font-black ${
                        idx === 0
                          ? sunlightMode ? 'text-amber-600' : 'text-amber-400'
                          : sunlightMode ? 'text-slate-900' : 'text-slate-300'
                      } text-base`}>
                        {s.total_points ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View (< 768px) */}
          <div className="md:hidden space-y-3">
            {(Array.isArray(standings) && standings.length > 0 ? standings : [
              { cohort_name: 'Seniors', played: 0, won: 0, drawn: 0, lost: 0, points_for: 0, points_against: 0, points_diff: 0, total_points: 0, cohort_id: 'cohort-seniors' },
              { cohort_name: 'Juniors', played: 0, won: 0, drawn: 0, lost: 0, points_for: 0, points_against: 0, points_diff: 0, total_points: 0, cohort_id: 'cohort-juniors' },
            ]).map((s: any, idx: number) => {
              const isSenior = s.cohort_id === 'cohort-seniors' || String(s.cohort_name || s.cohort).includes('Senior');
              return (
                <div
                  key={s.cohort_id || idx}
                  className={`p-4 rounded-xl border ${
                    isSenior
                      ? sunlightMode
                        ? 'bg-[#013B83]/[0.03] border-[#013B83]/20'
                        : 'bg-blue-500/[0.04] border-blue-500/20'
                      : sunlightMode
                      ? 'bg-emerald-500/[0.03] border-emerald-500/20'
                      : 'bg-emerald-500/[0.04] border-emerald-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : sunlightMode
                          ? 'bg-slate-200 text-slate-700 font-bold'
                          : 'bg-slate-800 text-slate-300 font-bold'
                      } text-[10px] flex items-center justify-center shrink-0`}>
                        {idx + 1}
                      </span>
                      <span className={`font-bold text-xs uppercase ${
                        isSenior
                          ? sunlightMode ? 'text-[#013B83]' : 'text-blue-400'
                          : sunlightMode ? 'text-emerald-700' : 'text-emerald-400'
                      }`}>
                        {isSenior ? 'Seniors' : 'Juniors'}
                      </span>
                    </div>
                    <span className={`text-base font-black font-mono ${
                      sunlightMode ? 'text-amber-600' : 'text-amber-400'
                    }`}>
                      {s.total_points ?? 0} PTS
                    </span>
                  </div>

                  <div className={`grid grid-cols-4 gap-2 pt-2 border-t text-center font-mono ${
                    sunlightMode ? 'border-slate-200' : 'border-white/5'
                  }`}>
                    <div className={`p-2 rounded-lg border ${
                      sunlightMode ? 'bg-white border-slate-200' : 'bg-black/30 border-white/5'
                    }`}>
                      <span className={`text-[9px] uppercase block ${sunlightMode ? 'text-slate-500' : 'text-slate-500'}`}>Played</span>
                      <span className={`text-xs font-bold ${sunlightMode ? 'text-slate-900' : 'text-slate-200'}`}>{s.played ?? 0}</span>
                    </div>
                    <div className={`p-2 rounded-lg border ${
                      sunlightMode ? 'bg-white border-slate-200' : 'bg-black/30 border-white/5'
                    }`}>
                      <span className={`text-[9px] uppercase block ${sunlightMode ? 'text-slate-500' : 'text-slate-500'}`}>W-D-L</span>
                      <span className={`text-xs font-bold ${sunlightMode ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        {s.won ?? 0}-{s.drawn ?? 0}-{s.lost ?? 0}
                      </span>
                    </div>
                    <div className={`p-2 rounded-lg border ${
                      sunlightMode ? 'bg-white border-slate-200' : 'bg-black/30 border-white/5'
                    }`}>
                      <span className={`text-[9px] uppercase block ${sunlightMode ? 'text-slate-500' : 'text-slate-500'}`}>PF/PA</span>
                      <span className={`text-xs font-bold ${sunlightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                        {s.points_for ?? 0}/{s.points_against ?? 0}
                      </span>
                    </div>
                    <div className={`p-2 rounded-lg border ${
                      sunlightMode ? 'bg-white border-slate-200' : 'bg-black/30 border-white/5'
                    }`}>
                      <span className={`text-[9px] uppercase block ${sunlightMode ? 'text-slate-500' : 'text-slate-500'}`}>Diff</span>
                      <span className={`text-xs font-bold ${sunlightMode ? 'text-slate-900' : 'text-slate-200'}`}>{s.points_diff ?? 0}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: Campus Hype & Banter Stream */}
      {subTab === 'banter' && (
        <div className="flex flex-col gap-6">
          {/* Tug of War Cheer Meter */}
          <div
            className={`p-5 rounded-2xl border shadow-xl ${
              sunlightMode
                ? 'bg-white border-slate-200 shadow-sm'
                : 'bg-slate-900/70 border-white/[0.08] backdrop-blur-md'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className={`font-bold text-sm uppercase tracking-wide flex items-center gap-2 ${
                sunlightMode ? 'text-[#013B83]' : 'text-white'
              }`}>
                <Flame className={`w-4 h-4 ${sunlightMode ? 'text-amber-600' : 'text-amber-500'}`} />
                Live Campus Cheer Tug-of-War
                <InfoTooltip
                  title="Campus Cheer Telemetry"
                  align="left"
                  content="Live spectator sentiment meter capturing cheering velocity across campus."
                  features={[
                    "Each tap increments your cohort cheer count by +12",
                    "Spam-throttled to maintain genuine student sentiment",
                    "Resets daily during tournament closing ceremony"
                  ]}
                  sunlightMode={sunlightMode}
                />
              </h3>
              <span className={`text-xs font-mono ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                {totalHype} Total Cheers
              </span>
            </div>

            <div className={`w-full h-4 rounded-full overflow-hidden flex mb-4 border relative ${
              sunlightMode ? 'bg-slate-200 border-slate-300' : 'bg-slate-800/80 border-white/10'
            }`}>
              <div
                style={{ width: `${seniorHypePct}%` }}
                className={`${sunlightMode ? 'bg-[#013B83]' : 'bg-blue-600'} transition-all duration-300 flex items-center justify-start pl-2.5 text-[9px] font-bold text-white font-mono`}
              >
                {seniorHypePct}%
              </div>
              <div
                style={{ width: `${juniorHypePct}%` }}
                className={`${sunlightMode ? 'bg-emerald-600' : 'bg-emerald-600'} transition-all duration-300 flex items-center justify-end pr-2.5 text-[9px] font-bold text-white font-mono`}
              >
                {juniorHypePct}%
              </div>
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/40 -translate-x-1/2" />
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => triggerHype('Senior')}
                className={`flex-1 py-3 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 ${
                  sunlightMode
                    ? 'bg-[#013B83] hover:bg-[#013B83]/90 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                Cheer Seniors (+12)
              </button>

              <button
                onClick={() => triggerHype('Junior')}
                className={`flex-1 py-3 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 ${
                  sunlightMode
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                Cheer Juniors (+12)
              </button>
            </div>
          </div>

          {/* Banter Wall Stream */}
          <div
            className={`p-5 rounded-2xl border flex flex-col gap-4 shadow-xl ${
              sunlightMode
                ? 'bg-white border-slate-200 shadow-sm'
                : 'bg-slate-900/70 border-white/[0.08] backdrop-blur-md'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${
              sunlightMode ? 'border-slate-200' : 'border-white/[0.08]'
            }`}>
              <h3 className={`font-bold text-sm uppercase tracking-wide flex items-center gap-2 ${
                sunlightMode ? 'text-[#013B83]' : 'text-white'
              }`}>
                <MessageSquare className={`w-4 h-4 ${sunlightMode ? 'text-amber-600' : 'text-amber-500'}`} />
                Inter-Batch Banter Wall
                <InfoTooltip
                  title="Campus Banter Wall"
                  align="left"
                  content="Real-time public message wall for friendly inter-cohort sports banter, match predictions, and athlete shoutouts."
                  features={[
                    "Tagged by cohort (Seniors vs Juniors)",
                    "Live emoji reactions update across connected devices",
                    "Subject to XLRI Delhi student code of conduct"
                  ]}
                  sunlightMode={sunlightMode}
                />
              </h3>
              <span className={`text-xs font-mono ${sunlightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Live Campus Stream
              </span>
            </div>

            {/* Post Banter Box */}
            <form onSubmit={handlePostBanter} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className={`font-semibold text-[11px] ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                  Post as:
                </span>
                <button
                  type="button"
                  onClick={() => setBanterBatch('Senior')}
                  className={`px-3 py-1 rounded-lg font-semibold text-xs transition-colors ${
                    banterBatch === 'Senior'
                      ? sunlightMode
                        ? 'bg-[#013B83] text-white shadow-sm'
                        : 'bg-blue-600 text-white shadow-sm'
                      : sunlightMode
                      ? 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Seniors
                </button>
                <button
                  type="button"
                  onClick={() => setBanterBatch('Junior')}
                  className={`px-3 py-1 rounded-lg font-semibold text-xs transition-colors ${
                    banterBatch === 'Junior'
                      ? sunlightMode
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-emerald-600 text-white shadow-sm'
                      : sunlightMode
                      ? 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Juniors
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={banterInput}
                  onChange={(e) => setBanterInput(e.target.value)}
                  placeholder="Drop campus banter or support your cohort athletes..."
                  className={`flex-1 px-4 py-2.5 rounded-xl border text-xs outline-none transition-all ${
                    sunlightMode
                      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#013B83] focus:ring-1 focus:ring-[#013B83]/30 placeholder:text-slate-400'
                      : 'bg-slate-950/80 border-white/10 text-white focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/50 placeholder:text-slate-500'
                  }`}
                />
                <button
                  type="submit"
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all ${
                    sunlightMode
                      ? 'bg-[#013B83] hover:bg-[#013B83]/90 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Post
                </button>
              </div>
            </form>

            {/* Feed List */}
            <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
              {banterFeed.length === 0 ? (
                <div className="py-10 px-4 text-center rounded-xl bg-white/[0.02] border border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
                  <MessageSquare className="w-8 h-8 text-slate-600 mb-1" />
                  <p className="text-xs font-semibold text-slate-300">No campus banter posted yet</p>
                  <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                    Be the first to drop hype or cheer your batch athletes in the chat above!
                  </p>
                </div>
              ) : (
                banterFeed.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`font-bold text-xs ${
                          item.batch === 'Senior' ? 'text-blue-400' : 'text-emerald-400'
                        }`}
                      >
                        {item.author}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed">{item.text}</p>

                    <div className="flex items-center gap-2 pt-1 border-t border-white/5 text-[11px] font-mono flex-wrap">
                      <button
                        onClick={() => handleReaction(item.id, 'cooked')}
                        className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition-colors flex items-center gap-1 border border-white/5"
                      >
                        <span>💀</span>
                        <span>Cooked</span>
                        <span className="text-slate-400 font-semibold">{item.reactions.cooked}</span>
                      </button>
                      <button
                        onClick={() => handleReaction(item.id, 'savage')}
                        className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition-colors flex items-center gap-1 border border-white/5"
                      >
                        <span>🔥</span>
                        <span>Savage</span>
                        <span className="text-slate-400 font-semibold">{item.reactions.savage}</span>
                      </button>
                      <button
                        onClick={() => handleReaction(item.id, 'w')}
                        className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition-colors flex items-center gap-1 border border-white/5"
                      >
                        <span>🏆</span>
                        <span>W</span>
                        <span className="text-slate-400 font-semibold">{item.reactions.w}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Live Score Share Modal */}
      <ShareMatchModal
        isOpen={!!selectedMatchForShare}
        onClose={() => setSelectedMatchForShare(null)}
        match={selectedMatchForShare}
        sunlightMode={sunlightMode}
      />

      {/* Meme / Viral Brag Card Modal */}
      <ViralCardModal
        isOpen={!!selectedMatchForViral}
        onClose={() => setSelectedMatchForViral(null)}
        match={selectedMatchForViral}
        sunlightMode={sunlightMode}
      />

      {/* Match Analytics & Quality Insights Modal */}
      <MatchAnalyticsModal
        isOpen={!!selectedMatchForAnalytics}
        onClose={() => setSelectedMatchForAnalytics(null)}
        match={selectedMatchForAnalytics}
        sunlightMode={sunlightMode}
      />
    </div>
  );
};
