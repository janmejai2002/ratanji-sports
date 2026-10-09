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
  Info
} from 'lucide-react';
import { sounds } from '../utils/audio';
import { mobileHaptics } from '../utils/haptics';
import { api } from '../utils/api';
import { ViralCardModal } from './ViralCardModal';
import { ShareMatchModal } from './ShareMatchModal';
import { InfoTooltip } from './InfoTooltip';

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
    const author = banterBatch === 'Senior' ? 'Senior Fan (BM 26)' : 'Junior Fan (HRM 27)';
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

  // Reusable Match Card Renderer
  // Reusable Match Card Renderer with Mario Kart Arcade Telemetry
  const renderMatchCard = (m: any, isPinnedCard = false) => {
    const isLive = String(m.status).toUpperCase() === 'DRAFT' || String(m.status).toUpperCase() === 'LIVE';
    const isCompleted = String(m.status).toUpperCase() === 'PUBLISHED' || String(m.status).toUpperCase() === 'VERIFIED';
    const isPinned = pinnedIds.includes(m.id);
    const sportName = m.sport_name || m.sport_id?.replace('sport-', '').toUpperCase();

    return (
      <div
        key={m.id}
        className={`p-4 md:p-5 rounded-2xl border-2 transition relative overflow-hidden group flex flex-col justify-between ${
          isPinnedCard
            ? 'border-amber-400 bg-amber-500/10 shadow-nb-gold'
            : sunlightMode
            ? 'bg-white border-slate-950 shadow-nb hover:shadow-nb-lg'
            : 'bg-slate-900/90 border-slate-800 hover:border-amber-400/50 shadow-nb-sm'
        }`}
      >
        {/* Mario Kart Checkered Racing Micro-Ribbon */}
        <div
          className={`h-1.5 w-full -mt-4 md:-mt-5 -mx-4 md:-mx-5 mb-3.5 opacity-90 ${
            isLive ? 'racing-checkers-gold' : isCompleted ? 'racing-checkers-senior' : 'racing-checkers'
          }`}
        />

        <div>
          {/* Card Header: Sport, Velocity Skew Status Pill & Pin Action */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded transform -skew-x-12 flex items-center gap-1 shadow-nb-sm ${
                  isLive
                    ? 'bg-red-600 text-white animate-pulse'
                    : isCompleted
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                <span className="inline-block skew-x-12 flex items-center gap-1">
                  {isLive ? <Activity className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {isLive ? 'LIVE 200cc' : m.status} &bull; {m.current_period || 'Fixture'}
                </span>
              </span>

              <InfoTooltip
                title={`${sportName} Status`}
                content={
                  isLive
                    ? 'Active tournament match. Scores update in real time via field referee console.'
                    : isCompleted
                    ? 'Official result finalized, verified by Sports Committee, and committed to championship points.'
                    : 'Scheduled upcoming match fixture.'
                }
                sunlightMode={sunlightMode}
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs font-black text-amber-400 font-mono tracking-wider uppercase">
                {sportName}
              </span>

              {/* Pin Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  mobileHaptics.tap();
                  togglePin(m.id);
                }}
                className={`p-1.5 rounded-lg transition arcade-btn active:scale-90 ${
                  isPinned
                    ? 'bg-amber-500 text-black shadow-nb-sm'
                    : 'text-slate-500 hover:text-amber-400 hover:bg-white/5'
                }`}
                title={isPinned ? 'Unpin match from top' : 'Pin match to top for live tracking'}
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* Scoreboard Block (Arcade Extruded 3D Numerals) */}
          <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-4 mb-3 shadow-inner">
            {/* Home (Seniors) */}
            <div className="flex-1 text-center">
              <span className="text-[10px] font-black text-blue-400 block uppercase tracking-wider truncate">
                {m.home_cohort_name || "Seniors '26"}
              </span>
              <span className="arcade-score-text text-4xl sm:text-5xl font-black italic tracking-tighter text-blue-400 tabular-nums">
                {m.score_home ?? 0}
              </span>
            </div>

            <div className="text-xs font-mono font-black text-slate-500 px-2 py-1 rounded bg-black/40 border border-white/5">
              VS
            </div>

            {/* Away (Juniors) */}
            <div className="flex-1 text-center">
              <span className="text-[10px] font-black text-emerald-400 block uppercase tracking-wider truncate">
                {m.away_cohort_name || "Juniors '27"}
              </span>
              <span className="arcade-score-text text-4xl sm:text-5xl font-black italic tracking-tighter text-emerald-400 tabular-nums">
                {m.score_away ?? 0}
              </span>
            </div>
          </div>

          {/* Venue & Time / Referee */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-3">
            <div className="flex items-center gap-1 truncate max-w-[210px]">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{m.venue || 'XLRI Grounds'}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {m.current_time_seconds ? `${Math.floor(m.current_time_seconds / 60)}' min` : 'Scheduled'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: WhatsApp Share & Brag Card */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              mobileHaptics.tap();
              setSelectedMatchForShare(m);
            }}
            className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-nb-sm arcade-btn border border-black/40"
            title="Share live scorecard to WhatsApp groups"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Share Score
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              mobileHaptics.tap();
              setSelectedMatchForViral(m);
            }}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-black font-black text-xs text-slate-200 flex items-center justify-center gap-1.5 shadow-nb-sm arcade-btn border border-black/40"
            title="Generate viral campus brag card"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Brag Card
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in">
      {/* 1. Sleek Tournament Summary Header */}
      <div
        className={`p-4 md:p-5 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 transition-colors ${
          sunlightMode
            ? 'bg-white border-slate-900 shadow-sm'
            : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2.5 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                XLRI DELHI ANNUAL SPORTS FESTIVAL 2026
                <InfoTooltip
                  title="Ratanjee Memorial Trophy 2026"
                  content="Annual inter-batch tournament between Batch of 2026 (Seniors) and Batch of 2027 (Juniors) across 15+ sporting events."
                  sunlightMode={sunlightMode}
                />
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                LIVE FESTIVAL
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <span>Championship Leaderboard:</span>
              <span className="text-blue-400 font-bold">
                Seniors {Array.isArray(standings) ? (standings.find((s: any) => s.cohort_id === 'cohort-seniors' || s.cohort_name === 'Seniors')?.total_points ?? 0) : 0} Pts
              </span> &bull;{' '}
              <span className="text-red-400 font-bold">
                Juniors {Array.isArray(standings) ? (standings.find((s: any) => s.cohort_id === 'cohort-juniors' || s.cohort_name === 'Juniors')?.total_points ?? 0) : 0} Pts
              </span>
              <InfoTooltip
                title="Points System"
                content="Win = 3 points, Draw = 1 point, Loss = 0 points. Head-to-head points differential is the primary tiebreaker."
                sunlightMode={sunlightMode}
              />
            </p>
          </div>
        </div>

        {/* Clean Sub-View Tabs Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10 gap-1 w-full md:w-auto">
          <button
            onClick={() => {
              sounds.playClick();
              setSubTab('matches');
            }}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
              subTab === 'matches'
                ? 'bg-amber-500 text-black font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Live &amp; Fixtures ({liveMatches.length + pinnedMatches.length})
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setSubTab('standings');
            }}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
              subTab === 'standings'
                ? 'bg-amber-500 text-black font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Standings
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setSubTab('banter');
            }}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
              subTab === 'banter'
                ? 'bg-amber-500 text-black font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
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
              <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2 text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                Live Now On Court &amp; Field
                <InfoTooltip
                  title="Live Match Synchronization"
                  content="Field referees log goals, fouls, runs, and points with sub-250ms WebSocket real-time synchronization to this board."
                  sunlightMode={sunlightMode}
                />
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {liveMatches.length} Live Matches
              </span>
            </div>

            {liveMatches.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
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
              <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2 text-white">
                <Calendar className="w-4 h-4 text-amber-400" />
                Up Next &bull; Scheduled Fixtures
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {upcomingMatches.length} Scheduled
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {upcomingMatches.slice(0, 6).map((m) => {
                const sportName = m.sport_name || m.sport_id?.replace('sport-', '');
                const isPinned = pinnedIds.includes(m.id);

                return (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between transition hover:border-slate-600 ${
                      sunlightMode
                        ? 'bg-white border-slate-300'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase text-amber-400 font-mono">
                          {sportName}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => togglePin(m.id)}
                            className={`p-1 rounded transition ${isPinned ? 'text-amber-400' : 'text-slate-600 hover:text-white'}`}
                            title="Pin fixture"
                          >
                            <Pin className={`w-3 h-3 ${isPinned ? 'fill-current' : ''}`} />
                          </button>
                          <span className="text-[10px] text-slate-500 font-mono">Upcoming</span>
                        </div>
                      </div>

                      <div className="text-xs font-bold text-white mb-2">
                        {m.home_cohort_name || "Seniors '26"} <span className="text-slate-500 font-normal">vs</span> {m.away_cohort_name || "Juniors '27"}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono border-t border-white/5 pt-2">
                      <span className="truncate max-w-[130px]">{m.venue || 'Sports Complex'}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMatchForShare(m)}
                        className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Share
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: Recently Concluded & Verified Results */}
          {completedMatches.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2 text-white">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Recent Concluded Results &bull; Verified
                </h3>
                <span className="text-xs text-slate-400 font-mono">
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
          className={`p-5 rounded-2xl border shadow-lg ${
            sunlightMode ? 'bg-white border-slate-900' : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide text-white flex items-center gap-1.5">
                Official Championship Leaderboard
                <InfoTooltip
                  title="Points Tally"
                  content="Standings automatically update upon Sports Committee verification and publishing. Points: Win=3, Draw=1, Loss=0."
                  sunlightMode={sunlightMode}
                />
              </h3>
              <p className="text-xs text-slate-400">
                Points rule: Win = 3 pts &bull; Draw = 1 pt &bull; Loss = 0 pts. Head-to-head tie breaker active.
              </p>
            </div>
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                  <th className="py-2.5 px-3">Rank &bull; Cohort</th>
                  <th className="py-2.5 px-3 text-center">Played</th>
                  <th className="py-2.5 px-3 text-center">W</th>
                  <th className="py-2.5 px-3 text-center">D</th>
                  <th className="py-2.5 px-3 text-center">L</th>
                  <th className="py-2.5 px-3 text-center">PF</th>
                  <th className="py-2.5 px-3 text-center">PA</th>
                  <th className="py-2.5 px-3 text-center">Diff</th>
                  <th className="py-2.5 px-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {(Array.isArray(standings) && standings.length > 0 ? standings : [
                  { cohort_name: 'Seniors (Batch 2026)', played: 0, won: 0, drawn: 0, lost: 0, points_for: 0, points_against: 0, points_diff: 0, total_points: 0, cohort_id: 'cohort-seniors' },
                  { cohort_name: 'Juniors (Batch 2027)', played: 0, won: 0, drawn: 0, lost: 0, points_for: 0, points_against: 0, points_diff: 0, total_points: 0, cohort_id: 'cohort-juniors' },
                ]).map((s: any, idx: number) => {
                  const isSenior = s.cohort_id === 'cohort-seniors' || String(s.cohort_name || s.cohort).includes('Senior');
                  return (
                    <tr key={s.cohort_id || idx} className={isSenior ? 'bg-blue-950/20' : 'bg-red-950/20'}>
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full ${idx === 0 ? 'bg-amber-500 text-black' : 'bg-slate-700 text-white'} text-[10px] font-black flex items-center justify-center`}>
                          {idx + 1}
                        </span>
                        <span className={`font-sans font-black ${isSenior ? 'text-blue-400' : 'text-red-400'}`}>
                          {s.cohort_name || s.name || (isSenior ? 'Seniors (Batch 2026)' : 'Juniors (Batch 2027)')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">{s.played ?? 0}</td>
                      <td className="py-3 px-3 text-center text-emerald-400 font-bold">{s.won ?? 0}</td>
                      <td className="py-3 px-3 text-center text-slate-400">{s.drawn ?? 0}</td>
                      <td className="py-3 px-3 text-center text-red-400">{s.lost ?? 0}</td>
                      <td className="py-3 px-3 text-center">{s.points_for ?? 0}</td>
                      <td className="py-3 px-3 text-center">{s.points_against ?? 0}</td>
                      <td className="py-3 px-3 text-center text-slate-400">{s.points_diff ?? 0}</td>
                      <td className={`py-3 px-3 text-right font-black ${idx === 0 ? 'text-amber-400' : 'text-slate-300'} text-base`}>
                        {s.total_points ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: Campus Hype & Banter Stream */}
      {subTab === 'banter' && (
        <div className="flex flex-col gap-6">
          {/* Tug of War Cheer Meter */}
          <div
            className={`p-5 rounded-2xl border shadow-lg ${
              sunlightMode ? 'bg-white border-slate-900' : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-sm uppercase tracking-wide text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                Live Campus Cheer Tug-of-War
              </h3>
              <span className="text-xs font-mono text-slate-400">{totalHype} Total Cheers</span>
            </div>

            <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-800 mb-4 border border-white/5">
              <div
                style={{ width: `${seniorHypePct}%` }}
                className="bg-blue-600 transition-all duration-300 flex items-center justify-start pl-2 text-[9px] font-black text-white"
              >
                {seniorHypePct}%
              </div>
              <div
                style={{ width: `${juniorHypePct}%` }}
                className="bg-emerald-600 transition-all duration-300 flex items-center justify-end pr-2 text-[9px] font-black text-white"
              >
                {juniorHypePct}%
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => triggerHype('Senior')}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                Cheer Seniors '26 (+12)
              </button>

              <button
                onClick={() => triggerHype('Junior')}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                Cheer Juniors '27 (+12)
              </button>
            </div>
          </div>

          {/* Banter Wall Stream */}
          <div
            className={`p-5 rounded-2xl border flex flex-col gap-4 shadow-lg ${
              sunlightMode ? 'bg-white border-slate-900' : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm uppercase tracking-wide text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                Inter-Batch Banter Wall
              </h3>
              <span className="text-xs font-mono text-slate-400">Live Campus Stream</span>
            </div>

            {/* Post Banter Box */}
            <form onSubmit={handlePostBanter} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold text-[11px]">Post as:</span>
                <button
                  type="button"
                  onClick={() => setBanterBatch('Senior')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    banterBatch === 'Senior'
                      ? 'bg-blue-600 text-white'
                      : 'bg-black/30 text-slate-400'
                  }`}
                >
                  Senior (BM 26)
                </button>
                <button
                  type="button"
                  onClick={() => setBanterBatch('Junior')}
                  className={`px-3 py-1 rounded-lg font-bold transition ${
                    banterBatch === 'Junior'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-black/30 text-slate-400'
                  }`}
                >
                  Junior (HRM 27)
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={banterInput}
                  onChange={(e) => setBanterInput(e.target.value)}
                  placeholder="Drop spicy campus banter or support your batch athletes..."
                  className="flex-1 px-4 py-2.5 rounded-xl border bg-black/40 border-slate-700 text-white text-xs outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-1.5 shadow active:scale-95 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Post
                </button>
              </div>
            </form>

            {/* Feed List */}
            <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
              {banterFeed.length === 0 ? (
                <div className="py-10 px-4 text-center rounded-xl bg-black/30 border border-dashed border-slate-800 flex flex-col items-center justify-center gap-2">
                  <MessageSquare className="w-8 h-8 text-slate-600 mb-1" />
                  <p className="text-xs font-bold text-slate-300">No campus banter posted yet</p>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Be the first to drop spicy hype or support your batch athletes in the chat above!
                  </p>
                </div>
              ) : (
                banterFeed.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`font-black ${
                          item.batch === 'Senior' ? 'text-blue-400' : 'text-emerald-400'
                        }`}
                      >
                        {item.author}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed">{item.text}</p>

                    <div className="flex items-center gap-2 pt-1 border-t border-white/5 text-[11px] font-mono">
                      <button
                        onClick={() => handleReaction(item.id, 'cooked')}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition"
                      >
                        💀 Cooked ({item.reactions.cooked})
                      </button>
                      <button
                        onClick={() => handleReaction(item.id, 'savage')}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition"
                      >
                        🔥 Savage ({item.reactions.savage})
                      </button>
                      <button
                        onClick={() => handleReaction(item.id, 'w')}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 transition"
                      >
                        🏆 W ({item.reactions.w})
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
    </div>
  );
};
