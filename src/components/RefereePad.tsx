import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Play,
  Pause,
  Send,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  User,
  Plus,
  Volume2,
  Trash2,
  Check,
  ChevronRight,
  Flame,
  Zap,
  Activity,
  Layers,
  Radio,
  Lock,
  MessageSquare,
  Filter,
  Share2
} from 'lucide-react';
import { sounds } from '../utils/audio';
import { mobileHaptics } from '../utils/haptics';
import { api } from '../utils/api';
import { ShareMatchModal } from './ShareMatchModal';
import { InfoTooltip } from './InfoTooltip';

interface RefereePadProps {
  sunlightMode: boolean;
  onRefresh: () => void;
  currentUser?: any;
}

export const RefereePad: React.FC<RefereePadProps> = ({
  sunlightMode,
  onRefresh,
  currentUser,
}) => {
  // Official Profile
  const officialName = currentUser?.name || 'Certified Official';
  const officialId =
    currentUser?.code ||
    currentUser?.badge?.match(/\((REF-[^)]+)\)/)?.[1] ||
    currentUser?.id ||
    'REF-OFFICIAL';

  // Matches list from API
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [filterAssignedOnly, setFilterAssignedOnly] = useState<boolean>(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Local Running Clock
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [currentPeriod, setCurrentPeriod] = useState<string>('1st Half');

  // Cricket specific state
  const [cricketBattingTeam, setCricketBattingTeam] = useState<'home' | 'away'>('home');

  // Load matches
  const loadMatches = useCallback(() => {
    setIsLoading(true);
    const userId = currentUser?.id || 'usr-ref-1';
    api.get<any[]>('/api/matches', 'referee', userId)
      .then((data) => {
        if (Array.isArray(data)) {
          setMatches(data);
          // Auto select first match if none selected
          if (!selectedMatch && data.length > 0) {
            const cleanRef = userId.replace('usr-', '');
            const assignedDraft = data.find(
              (m) =>
                (m.status === 'Draft' || m.status === 'Live') &&
                (m.referee_id === userId || m.referee_id === cleanRef || m.referee_id?.includes(cleanRef))
            );
            const draft = assignedDraft || data.find((m) => m.status === 'Draft' || m.status === 'Live') || data[0];
            selectMatch(draft);
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [selectedMatch, currentUser]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  // Select a match and load detail & events
  const selectMatch = (m: any) => {
    sounds.playClick();
    setSelectedMatch(m);
    setTimerSeconds(m.current_time_seconds ?? 0);
    setCurrentPeriod(m.current_period || '1st Half');
    setIsTimerRunning(m.status === 'Draft' || m.status === 'Live');

    const userId = currentUser?.id || 'usr-ref-1';
    api.get<any>(`/api/matches/${m.id}`, 'referee', userId)
      .then((data) => {
        if (data && data.events) {
          setEvents(data.events);
        }
      })
      .catch(() => {});
  };

  // Running clock interval
  useEffect(() => {
    let interval: any = null;
    if (
      isTimerRunning &&
      selectedMatch &&
      (selectedMatch.status === 'Draft' || selectedMatch.status === 'Live')
    ) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, selectedMatch]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Toggle Clock
  const toggleClock = () => {
    sounds.playClick();
    setIsTimerRunning(!isTimerRunning);
    if (!isTimerRunning) {
      sounds.playWhistle();
    }
  };

  // Reset Clock
  const resetClock = () => {
    sounds.playClick();
    setIsTimerRunning(false);
    setTimerSeconds(0);
  };

  // Update Period via API
  const handleUpdatePeriod = async (newPeriod: string) => {
    if (!selectedMatch) return;
    try {
      sounds.playClick();
      setCurrentPeriod(newPeriod);
      const userId = currentUser?.id || 'usr-ref-1';
      await api.post(`/api/matches/${selectedMatch.id}/timer`, {
        action: 'start',
        period: newPeriod,
        seconds: timerSeconds,
      }, 'referee', userId);
      setStatusMessage(`Period updated to: ${newPeriod}`);
      onRefresh();
    } catch {}
  };

  // Log Scoring Event via API
  const handleLogEvent = async (
    eventType: string,
    team: 'home' | 'away',
    label: string,
    customPoints?: number,
    extraPayload?: any
  ) => {
    if (!selectedMatch) return;

    if (selectedMatch.status !== 'Draft' && selectedMatch.status !== 'Live') {
      alert(`Scorecard is locked. Match status is ${selectedMatch.status}`);
      return;
    }

    try {
      const min = Math.floor(timerSeconds / 60);
      const sec = timerSeconds % 60;
      const userId = currentUser?.id || 'usr-ref-1';

      const payload: any = {
        label,
        points: customPoints !== undefined ? customPoints : 1,
        ...(extraPayload || {}),
      };

      if (eventType.includes('CARD') || eventType === 'FAULT' || eventType === 'FOUL') {
        sounds.playWhistle();
        mobileHaptics.warning();
      } else if (eventType === 'GOAL' || eventType === 'SIX' || eventType === 'POINTS_3' || eventType === 'SMASH' || eventType === 'WICKET') {
        sounds.playGoalHorn();
        sounds.playArcadeCoin();
        mobileHaptics.highImpact();
      } else {
        sounds.playClick(1050);
        mobileHaptics.scoreTick();
      }

      await api.post(
        `/api/matches/${selectedMatch.id}/events`,
        {
          event_type: eventType,
          team,
          minute: min,
          second: sec,
          payload_json: payload,
        },
        'referee',
        userId
      );

      setStatusMessage(`Event logged: ${label} (${team.toUpperCase()})`);

      // Refresh match state & events
      const updated = await api.get<any>(`/api/matches/${selectedMatch.id}`, 'referee', userId);
      if (updated) {
        setSelectedMatch(updated);
        setEvents(updated.events || []);
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to record scoring event');
    }
  };

  // Undo / Delete Event
  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedMatch) return;
    if (!confirm('Undo and delete this logged match event?')) return;

    try {
      sounds.playClick();
      const userId = currentUser?.id || 'usr-ref-1';
      await api.delete(`/api/matches/${selectedMatch.id}/events/${eventId}`, 'referee', userId);

      const updated = await api.get<any>(`/api/matches/${selectedMatch.id}`, 'referee', userId);
      if (updated) {
        setSelectedMatch(updated);
        setEvents(updated.events || []);
      }
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete event');
    }
  };

  // Submit Scorecard (Draft -> Submitted)
  const handleSubmitScorecard = async () => {
    if (!selectedMatch) return;
    if (!confirm('Submit official scorecard to Sports Committee for verification & publishing?')) return;

    try {
      sounds.playWhistle();
      mobileHaptics.matchEnd();
      setIsTimerRunning(false);
      const userId = currentUser?.id || 'usr-ref-1';

      await api.post(`/api/matches/${selectedMatch.id}/submit`, {}, 'referee', userId);
      setStatusMessage('Official scorecard submitted! Awaiting Sports Committee audit & publication.');

      const updated = await api.get<any>(`/api/matches/${selectedMatch.id}`, 'referee', userId);
      if (updated) {
        setSelectedMatch(updated);
      }
      loadMatches();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to submit scorecard');
    }
  };

  // Filter assigned matches
  const userRefId = (currentUser?.id || '').toLowerCase();
  const cleanRefId = userRefId.replace('usr-', '');
  const refCode = officialId.toLowerCase();

  const assignedMatches = matches.filter((m) => {
    const mRef = (m.referee_id || '').toLowerCase();
    const mRefName = (m.referee_name || '').toLowerCase();
    return (
      mRef === userRefId ||
      mRef === cleanRefId ||
      mRef.includes(cleanRefId) ||
      mRefName.includes(officialName.toLowerCase()) ||
      mRef.includes(refCode)
    );
  });

  const displayedMatches =
    filterAssignedOnly && assignedMatches.length > 0 ? assignedMatches : matches;

  const isLocked = selectedMatch?.status !== 'Draft' && selectedMatch?.status !== 'Live';
  const sportId = (selectedMatch?.sport_id || '').toLowerCase().replace('sport-', '');

  return (
    <div className="flex flex-col gap-5 animate-in fade-in">
      {/* 1. Official Referee Identity & Whistle Strip */}
      <div
        className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
          sunlightMode ? 'bg-white border-slate-900 shadow-sm' : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black shadow-inner">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm uppercase tracking-wider text-white flex items-center gap-1.5">
                {officialName} &bull; {officialId}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Check className="w-3 h-3" /> OFFICIAL REFEREE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Assigned Field Official Console &bull; Real-time scoring, clock management, and whistle controls
            </p>
          </div>
        </div>

        {/* Tactile Whistle Synthesizers & WhatsApp Share */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {selectedMatch && (
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
              title="Share live scorecard to WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Share Score
            </button>
          )}

          <button
            onClick={() => sounds.playWhistle()}
            className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
            title="Blow referee whistle blast"
          >
            <Volume2 className="w-4 h-4" />
            Whistle Blast
          </button>

          <button
            onClick={() => sounds.playGoalHorn()}
            className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 active:scale-95 transition"
            title="Sound stadium horn"
          >
            <Volume2 className="w-4 h-4" />
            Stadium Horn
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold font-mono text-center animate-in fade-in">
          &bull; {statusMessage}
        </div>
      )}

      {/* 2. Main Referee Console Layout: Assigned Matches Sidebar (Left) + Tactile Scoring Console (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Matches List (Below Scoring Pad on Mobile) */}
        <div className="order-2 lg:order-1 flex flex-col gap-4">
          <div
            className={`p-4 rounded-2xl border flex flex-col gap-3 ${
              sunlightMode ? 'bg-white border-slate-900 shadow-sm' : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            {/* Filter Toggle */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Fixtures
              </span>

              <div className="flex items-center gap-1 text-[10px] font-mono">
                <button
                  onClick={() => setFilterAssignedOnly(true)}
                  className={`px-2 py-0.5 rounded transition ${
                    filterAssignedOnly
                      ? 'bg-amber-500 text-black font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  My Assigned ({assignedMatches.length})
                </button>
                <button
                  onClick={() => setFilterAssignedOnly(false)}
                  className={`px-2 py-0.5 rounded transition ${
                    !filterAssignedOnly
                      ? 'bg-amber-500 text-black font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({matches.length})
                </button>
              </div>
            </div>

            {/* Matches List */}
            <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
              {displayedMatches.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No matches found for this filter. Switch to 'All' to browse all tournament fixtures.
                </div>
              ) : (
                displayedMatches.map((m) => {
                  const isSelected = selectedMatch?.id === m.id;
                  const isLive = m.status === 'Draft' || m.status === 'Live';
                  const isSubmitted = m.status === 'Submitted';
                  const sportLabel = m.sport_name || m.sport_id?.replace('sport-', '').toUpperCase();

                  return (
                    <button
                      key={m.id}
                      onClick={() => selectMatch(m)}
                      className={`text-left p-3 rounded-xl border transition flex flex-col gap-1.5 active:scale-95 ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/10 shadow-sm ring-1 ring-amber-400'
                          : sunlightMode
                          ? 'bg-white border-slate-300 hover:border-slate-500 text-slate-900'
                          : 'bg-black/30 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-400 uppercase font-mono">
                          {sportLabel}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full uppercase ${
                            isLive
                              ? 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                              : isSubmitted
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-white flex justify-between">
                        <span>{m.home_cohort_name || 'Seniors'} vs {m.away_cohort_name || 'Juniors'}</span>
                        <span className="font-mono text-amber-300 font-black">
                          {m.score_home} - {m.score_away}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                        <span className="truncate max-w-[140px]">{m.venue}</span>
                        <span>{m.current_period || 'Scheduled'}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Live Scoring Pad (Top on Mobile) */}
        <div className="order-1 lg:order-2 lg:col-span-2 flex flex-col gap-5">
          {selectedMatch ? (
            <>
              {/* Scorecard Header with Match Clock & Period */}
              <div
                className={`p-5 rounded-2xl border shadow-xl flex flex-col gap-4 ${
                  sunlightMode ? 'bg-white border-slate-900' : 'bg-slate-900 border-slate-800'
                }`}
              >
                {/* Match Details & Stage Pipeline */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase font-black text-amber-400 block">
                      {selectedMatch.sport_name || selectedMatch.sport_id?.replace('sport-', '').toUpperCase()} &bull; {selectedMatch.venue}
                    </span>
                    <h3 className="text-base font-black text-white">
                      {selectedMatch.home_cohort_name || 'Seniors (Batch 2026)'} <span className="text-slate-500 font-normal">vs</span> {selectedMatch.away_cohort_name || 'Juniors (Batch 2027)'}
                    </h3>
                  </div>

                  {/* 4-Stage Status Pipeline */}
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold bg-black/60 px-3 py-1 rounded-xl border border-white/10">
                    <span className={selectedMatch.status === 'Draft' ? 'text-amber-400 font-black' : 'text-slate-600'}>
                      Draft
                    </span>
                    <span className="text-slate-700">&rarr;</span>
                    <span className={selectedMatch.status === 'Submitted' ? 'text-blue-400 font-black' : 'text-slate-600'}>
                      Submitted
                    </span>
                    <span className="text-slate-700">&rarr;</span>
                    <span className={selectedMatch.status === 'Verified' ? 'text-purple-400 font-black' : 'text-slate-600'}>
                      Verified
                    </span>
                    <span className="text-slate-700">&rarr;</span>
                    <span className={selectedMatch.status === 'Published' ? 'text-emerald-400 font-black' : 'text-slate-600'}>
                      Published
                    </span>
                  </div>
                </div>

                {/* Scoreboard Display & Match Clock */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  {/* Seniors Score */}
                  <div className="p-4 rounded-xl bg-black/50 border border-blue-500/30 text-center">
                    <span className="text-[10px] font-mono font-bold text-blue-400 uppercase block">
                      Seniors (Home)
                    </span>
                    <span className="text-4xl font-mono font-black text-white">
                      {selectedMatch.score_home ?? 0}
                    </span>
                  </div>

                  {/* Digital Clock & Period */}
                  <div className="p-3 rounded-xl bg-black/80 border border-white/10 text-center flex flex-col items-center justify-center">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${isTimerRunning ? 'bg-red-500 animate-ping' : 'bg-slate-600'}`} />
                      <span className="text-2xl font-black font-mono tracking-wider text-amber-400">
                        {formatTimer(timerSeconds)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <button
                        onClick={toggleClock}
                        disabled={isLocked}
                        className={`p-1.5 px-3 rounded-lg font-black text-xs flex items-center gap-1 transition active:scale-95 ${
                          isTimerRunning
                            ? 'bg-amber-500 text-black'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {isTimerRunning ? 'Pause Clock' : 'Start Clock'}
                      </button>

                      <button
                        onClick={resetClock}
                        disabled={isLocked}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                        title="Reset Timer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Period Switcher */}
                    {!isLocked && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/10 text-[10px]">
                        <span className="text-slate-400 uppercase font-mono">Period:</span>
                        <select
                          value={currentPeriod}
                          onChange={(e) => handleUpdatePeriod(e.target.value)}
                          className="bg-black border border-slate-700 rounded px-1.5 py-0.5 text-amber-300 font-bold font-mono outline-none"
                        >
                          <option value="1st Half">1st Half</option>
                          <option value="Half-Time">Half-Time</option>
                          <option value="2nd Half">2nd Half</option>
                          <option value="Extra Time">Extra Time</option>
                          <option value="Q1">Quarter 1</option>
                          <option value="Q2">Quarter 2</option>
                          <option value="Q3">Quarter 3</option>
                          <option value="Q4">Quarter 4</option>
                          <option value="Overtime">Overtime</option>
                          <option value="Set 1">Set 1</option>
                          <option value="Set 2">Set 2</option>
                          <option value="Set 3">Set 3 (Decider)</option>
                          <option value="1st Innings">1st Innings</option>
                          <option value="2nd Innings">2nd Innings</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Juniors Score */}
                  <div className="p-4 rounded-xl bg-black/50 border border-emerald-500/30 text-center">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase block">
                      Juniors (Away)
                    </span>
                    <span className="text-4xl font-mono font-black text-white">
                      {selectedMatch.score_away ?? 0}
                    </span>
                  </div>
                </div>

                {/* Scorecard Locked Alert */}
                {isLocked && (
                  <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>
                      Scorecard is committed in <strong>{selectedMatch.status}</strong> status. Modifications are locked awaiting Sports Committee publication.
                    </span>
                  </div>
                )}
              </div>

              {/* DEDICATED INDIVIDUAL SPORT SCORING PAD */}
              {!isLocked && (
                <div
                  className={`p-5 rounded-2xl border flex flex-col gap-4 shadow-lg ${
                    sunlightMode ? 'bg-white border-slate-900' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="font-black text-sm uppercase tracking-wide text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Individual Sport Scoring Matrix ({selectedMatch.sport_name || sportId.toUpperCase()})
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      Sub-250ms Realtime Broadcaster Active
                    </span>
                  </div>

                  {/* SPORT SCORING CONTROLS */}

                  {/* 1. CRICKET SCORING PAD */}
                  {sportId.includes('cricket') ? (
                    <div className="flex flex-col gap-4">
                      {/* Innings & Batting Indicator */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 uppercase font-mono text-[10px]">Active Batting:</span>
                          <button
                            onClick={() => setCricketBattingTeam('home')}
                            className={`px-3 py-1 rounded-lg font-black transition ${
                              cricketBattingTeam === 'home'
                                ? 'bg-blue-600 text-white'
                                : 'bg-black/30 text-slate-400'
                            }`}
                          >
                            Seniors (Batting)
                          </button>
                          <button
                            onClick={() => setCricketBattingTeam('away')}
                            className={`px-3 py-1 rounded-lg font-black transition ${
                              cricketBattingTeam === 'away'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-black/30 text-slate-400'
                            }`}
                          >
                            Juniors (Batting)
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            const nextBat = cricketBattingTeam === 'home' ? 'away' : 'home';
                            setCricketBattingTeam(nextBat);
                            handleLogEvent('INNINGS_SWITCH', nextBat, 'Innings Switched');
                          }}
                          className="px-3 py-1 rounded-lg bg-amber-500 text-black font-black text-xs active:scale-95 transition"
                        >
                          Switch Innings &rarr;
                        </button>
                      </div>

                      {/* Cricket Batting Runs Matrix */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Runs Scoring Grid */}
                        <div className="flex flex-col gap-2 p-3 rounded-xl bg-black/40 border border-slate-800">
                          <span className="text-[11px] font-bold text-amber-400 uppercase block">
                            Ball-by-Ball Runs ({cricketBattingTeam === 'home' ? 'Seniors' : 'Juniors'})
                          </span>

                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => handleLogEvent('BALL', cricketBattingTeam, 'Dot Ball', 0, { runs: 0 })}
                              className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs active:scale-95 transition"
                            >
                              0 Dot
                            </button>
                            <button
                              onClick={() => handleLogEvent('BALL', cricketBattingTeam, '+1 Single', 1, { runs: 1 })}
                              className="py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs active:scale-95 transition"
                            >
                              +1 Run
                            </button>
                            <button
                              onClick={() => handleLogEvent('BALL', cricketBattingTeam, '+2 Runs', 2, { runs: 2 })}
                              className="py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs active:scale-95 transition"
                            >
                              +2 Runs
                            </button>
                            <button
                              onClick={() => handleLogEvent('BALL', cricketBattingTeam, '+3 Runs', 3, { runs: 3 })}
                              className="py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs active:scale-95 transition"
                            >
                              +3 Runs
                            </button>
                            <button
                              onClick={() => handleLogEvent('FOUR', cricketBattingTeam, '+4 Boundary Four', 4, { runs: 4 })}
                              className="py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs active:scale-95 transition shadow"
                            >
                              +4 Four!
                            </button>
                            <button
                              onClick={() => handleLogEvent('SIX', cricketBattingTeam, '+6 Maximum Six', 6, { runs: 6 })}
                              className="py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs active:scale-95 transition shadow"
                            >
                              +6 Six!
                            </button>
                          </div>
                        </div>

                        {/* Wickets & Extras Grid */}
                        <div className="flex flex-col gap-2 p-3 rounded-xl bg-black/40 border border-slate-800">
                          <span className="text-[11px] font-bold text-red-400 uppercase block">
                            Wickets &amp; Extras Delivery
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleLogEvent('WICKET', cricketBattingTeam === 'home' ? 'away' : 'home', 'Wicket (Bowled)', 0, { dismissal: 'Bowled' })}
                              className="py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-xs active:scale-95 transition shadow"
                            >
                              Wicket (Bowled)
                            </button>
                            <button
                              onClick={() => handleLogEvent('WICKET', cricketBattingTeam === 'home' ? 'away' : 'home', 'Wicket (Caught)', 0, { dismissal: 'Caught' })}
                              className="py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-xs active:scale-95 transition shadow"
                            >
                              Wicket (Caught)
                            </button>
                            <button
                              onClick={() => handleLogEvent('WICKET', cricketBattingTeam === 'home' ? 'away' : 'home', 'Wicket (Run Out)', 0, { dismissal: 'Run Out' })}
                              className="py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-black text-xs active:scale-95 transition shadow"
                            >
                              Wicket (Run Out)
                            </button>
                            <button
                              onClick={() => handleLogEvent('EXTRA', cricketBattingTeam, 'Wide Delivery (+1)', 1, { extra_type: 'wide', runs: 1 })}
                              className="py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-xs active:scale-95 transition"
                            >
                              Wide (+1)
                            </button>
                            <button
                              onClick={() => handleLogEvent('EXTRA', cricketBattingTeam, 'No Ball (+1)', 1, { extra_type: 'no_ball', runs: 1 })}
                              className="py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-xs active:scale-95 transition"
                            >
                              No Ball (+1)
                            </button>
                            <button
                              onClick={() => handleLogEvent('EXTRA', cricketBattingTeam, 'Leg-Bye (+1)', 1, { extra_type: 'leg_bye', runs: 1 })}
                              className="py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-black text-xs active:scale-95 transition"
                            >
                              Leg-Bye (+1)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : sportId.includes('basket') ? (
                    /* 2. BASKETBALL SCORING PAD */
                    <div className="grid grid-cols-2 gap-4">
                      {/* Seniors Basketball Controls */}
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-blue-950/20 border border-blue-500/20">
                        <span className="text-[11px] font-bold text-blue-400 uppercase text-center block">
                          Seniors Scoring Pad
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            onClick={() => handleLogEvent('SCORE_1PT', 'home', '+1 Free Throw', 1)}
                            className="py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            +1 FT
                          </button>
                          <button
                            onClick={() => handleLogEvent('SCORE_2PT', 'home', '+2 Field Goal', 2)}
                            className="py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            +2 FG
                          </button>
                          <button
                            onClick={() => handleLogEvent('SCORE_3PT', 'home', '+3 Three-Pointer', 3)}
                            className="py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            +3 3PT
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          <button
                            onClick={() => handleLogEvent('FOUL', 'home', 'Team Foul Committed')}
                            className="py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            Personal Foul
                          </button>
                          <button
                            onClick={() => handleLogEvent('TIMEOUT', 'home', 'Timeout Called')}
                            className="py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs active:scale-95 transition"
                          >
                            Timeout
                          </button>
                        </div>
                      </div>

                      {/* Juniors Basketball Controls */}
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                        <span className="text-[11px] font-bold text-emerald-400 uppercase text-center block">
                          Juniors Scoring Pad
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            onClick={() => handleLogEvent('SCORE_1PT', 'away', '+1 Free Throw', 1)}
                            className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            +1 FT
                          </button>
                          <button
                            onClick={() => handleLogEvent('SCORE_2PT', 'away', '+2 Field Goal', 2)}
                            className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            +2 FG
                          </button>
                          <button
                            onClick={() => handleLogEvent('SCORE_3PT', 'away', '+3 Three-Pointer', 3)}
                            className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            +3 3PT
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          <button
                            onClick={() => handleLogEvent('FOUL', 'away', 'Team Foul Committed')}
                            className="py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            Personal Foul
                          </button>
                          <button
                            onClick={() => handleLogEvent('TIMEOUT', 'away', 'Timeout Called')}
                            className="py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs active:scale-95 transition"
                          >
                            Timeout
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : sportId.includes('badminton') || sportId.includes('tennis') || sportId.includes('table-tennis') ? (
                    /* 3. RACQUET SPORTS (BADMINTON / TT / TENNIS) */
                    <div className="grid grid-cols-2 gap-4">
                      {/* Seniors Racquet Controls */}
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-blue-950/20 border border-blue-500/20">
                        <span className="text-[11px] font-bold text-blue-400 uppercase text-center block">
                          Seniors Racquet Controls
                        </span>
                        <button
                          onClick={() => handleLogEvent('POINT', 'home', '+1 Rally Point', 1)}
                          className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow active:scale-95 transition flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          +1 Rally Point Won
                        </button>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => handleLogEvent('ACE', 'home', '+1 Service Ace', 1)}
                            className="py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs active:scale-95 transition"
                          >
                            Service Ace ⚡
                          </button>
                          <button
                            onClick={() => handleLogEvent('SET_WON', 'home', 'Set Won by Seniors', 1)}
                            className="py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            Set Won 🏆
                          </button>
                        </div>
                      </div>

                      {/* Juniors Racquet Controls */}
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                        <span className="text-[11px] font-bold text-emerald-400 uppercase text-center block">
                          Juniors Racquet Controls
                        </span>
                        <button
                          onClick={() => handleLogEvent('POINT', 'away', '+1 Rally Point', 1)}
                          className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow active:scale-95 transition flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          +1 Rally Point Won
                        </button>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => handleLogEvent('ACE', 'away', '+1 Service Ace', 1)}
                            className="py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs active:scale-95 transition"
                          >
                            Service Ace ⚡
                          </button>
                          <button
                            onClick={() => handleLogEvent('SET_WON', 'away', 'Set Won by Juniors', 1)}
                            className="py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            Set Won 🏆
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : sportId.includes('volleyball') || sportId.includes('throwball') ? (
                    /* 4. VOLLEYBALL / THROWBALL */
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-blue-950/20 border border-blue-500/20">
                        <span className="text-[11px] font-bold text-blue-400 uppercase text-center block">
                          Seniors Volleyball Actions
                        </span>
                        <button
                          onClick={() => handleLogEvent('POINT', 'home', '+1 Spike / Kill Point', 1)}
                          className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow active:scale-95 transition"
                        >
                          +1 Point (Spike / Kill)
                        </button>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => handleLogEvent('POINT', 'home', '+1 Service Ace', 1)}
                            className="py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs active:scale-95 transition"
                          >
                            Service Ace
                          </button>
                          <button
                            onClick={() => handleLogEvent('SET_WON', 'home', 'Set Won', 1)}
                            className="py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            Set Won
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                        <span className="text-[11px] font-bold text-emerald-400 uppercase text-center block">
                          Juniors Volleyball Actions
                        </span>
                        <button
                          onClick={() => handleLogEvent('POINT', 'away', '+1 Spike / Kill Point', 1)}
                          className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow active:scale-95 transition"
                        >
                          +1 Point (Spike / Kill)
                        </button>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => handleLogEvent('POINT', 'away', '+1 Service Ace', 1)}
                            className="py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs active:scale-95 transition"
                          >
                            Service Ace
                          </button>
                          <button
                            onClick={() => handleLogEvent('SET_WON', 'away', 'Set Won', 1)}
                            className="py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            Set Won
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : sportId.includes('chess') ? (
                    /* 5. CHESS SCORING PAD */
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-blue-950/20 border border-blue-500/20">
                        <span className="text-[11px] font-bold text-blue-400 uppercase text-center block">
                          Seniors Board Actions
                        </span>
                        <button
                          onClick={() => handleLogEvent('POINT', 'home', 'Checkmate Victory (+1)', 1)}
                          className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow active:scale-95 transition"
                        >
                          Checkmate (+1 Point) ♟️
                        </button>
                        <button
                          onClick={() => handleLogEvent('POINT', 'home', 'Opponent Resigned (+1)', 1)}
                          className="py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs active:scale-95 transition"
                        >
                          Opponent Resigned
                        </button>
                      </div>

                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                        <span className="text-[11px] font-bold text-emerald-400 uppercase text-center block">
                          Juniors Board Actions
                        </span>
                        <button
                          onClick={() => handleLogEvent('POINT', 'away', 'Checkmate Victory (+1)', 1)}
                          className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow active:scale-95 transition"
                        >
                          Checkmate (+1 Point) ♟️
                        </button>
                        <button
                          onClick={() => handleLogEvent('POINT', 'away', 'Opponent Resigned (+1)', 1)}
                          className="py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs active:scale-95 transition"
                        >
                          Opponent Resigned
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 6. FOOTBALL / FUTSAL / STANDARD / GENERIC */
                    <div className="grid grid-cols-2 gap-4">
                      {/* Home Actions (Seniors) */}
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-blue-950/20 border border-blue-500/20">
                        <span className="text-[11px] font-bold text-blue-400 uppercase text-center block">
                          Seniors Scoring Actions
                        </span>

                        <button
                          onClick={() => handleLogEvent('GOAL', 'home', 'Goal Scored', 1)}
                          className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow active:scale-95 transition flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          +1 Goal / Score Point
                        </button>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => handleLogEvent('YELLOW_CARD', 'home', 'Yellow Card')}
                            className="py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs active:scale-95 transition"
                          >
                            🟨 Yellow
                          </button>
                          <button
                            onClick={() => handleLogEvent('RED_CARD', 'home', 'Red Card')}
                            className="py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            🟥 Red
                          </button>
                        </div>
                      </div>

                      {/* Away Actions (Juniors) */}
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                        <span className="text-[11px] font-bold text-emerald-400 uppercase text-center block">
                          Juniors Scoring Actions
                        </span>

                        <button
                          onClick={() => handleLogEvent('GOAL', 'away', 'Goal Scored', 1)}
                          className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow active:scale-95 transition flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          +1 Goal / Score Point
                        </button>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => handleLogEvent('YELLOW_CARD', 'away', 'Yellow Card')}
                            className="py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs active:scale-95 transition"
                          >
                            🟨 Yellow
                          </button>
                          <button
                            onClick={() => handleLogEvent('RED_CARD', 'away', 'Red Card')}
                            className="py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-xs active:scale-95 transition"
                          >
                            🟥 Red
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submit Final Scorecard Action */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={handleSubmitScorecard}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
                    >
                      <Send className="w-4 h-4" />
                      Submit Official Scorecard (Draft &rarr; Submitted)
                    </button>
                  </div>
                </div>
              )}

              {/* Match Event History & Audit Log */}
              <div
                className={`p-5 rounded-2xl border shadow-md flex flex-col gap-3 ${
                  sunlightMode ? 'bg-white border-slate-900' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[11px] font-mono font-bold uppercase text-slate-400">
                    Official Match Event Timeline &bull; Undo Log
                  </span>
                  <span className="text-xs font-mono text-amber-400 font-bold">
                    {events.length} Events Logged
                  </span>
                </div>

                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {events.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No game events recorded yet. Tap scoring buttons above to log match events.
                    </div>
                  ) : (
                    events.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold">
                            {ev.minute ? `${ev.minute}'` : '00'}:
                            {ev.second !== undefined ? String(ev.second).padStart(2, '0') : '00'}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold uppercase text-[10px] ${
                              ev.team === 'home'
                                ? 'bg-blue-900/40 text-blue-300'
                                : 'bg-emerald-900/40 text-emerald-300'
                            }`}
                          >
                            {ev.team || 'OFFICIAL'}
                          </span>
                          <span className="text-slate-200">{ev.event_type}</span>
                        </div>

                        {!isLocked && (
                          <button
                            onClick={() => handleDeleteEvent(ev.id)}
                            className="p-1 hover:text-red-400 text-slate-500 transition"
                            title="Undo Event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 rounded-2xl border border-dashed border-slate-800 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <Clock className="w-8 h-8 text-amber-500/50 mb-1" />
              <p className="text-sm font-bold text-slate-300">
                {matches.length === 0 ? 'No Matches Scheduled Yet' : 'No Fixture Selected'}
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                {matches.length === 0
                  ? 'The tournament is currently in pristine Day 0 state. Matches will appear here once the Sports Committee schedules fixtures in the Admin Portal.'
                  : 'Select an assigned fixture from the list to start live scoring, period control, and official logging.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Score Share Modal */}
      {selectedMatch && (
        <ShareMatchModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          match={selectedMatch}
          sunlightMode={sunlightMode}
        />
      )}
    </div>
  );
};
