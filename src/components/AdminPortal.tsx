import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
  FileCheck,
  Send,
  Calendar,
  X,
  Volume2,
  Share2,
  MessageSquare,
  Copy,
  Check,
  Trophy,
  ExternalLink,
  Edit3,
  Filter,
  Sparkles,
  RefreshCw,
  Activity,
  Lock,
  RotateCcw,
  UserCheck
} from 'lucide-react';
import { sounds } from '../utils/audio';
import { api } from '../utils/api';
import { AddSportModal } from './AddSportModal';
import { ShareMatchModal } from './ShareMatchModal';
import { InfoTooltip } from './InfoTooltip';

interface AdminPortalProps {
  sunlightMode: boolean;
  matches: any[];
  standings: any;
  onRefresh: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  sunlightMode,
  matches,
  standings,
  onRefresh,
}) => {
  // Navigation Sub-Tabs
  const [activeTab, setActiveTab] = useState<'schedule' | 'referees' | 'verification' | 'standings'>('schedule');

  // Dynamic Sports & Referees Catalogs
  const [sports, setSports] = useState<any[]>([]);
  const [referees, setReferees] = useState<any[]>([]);
  const [isLoadingReferees, setIsLoadingReferees] = useState(false);

  // Modals state
  const [isNewMatchOpen, setIsNewMatchOpen] = useState(false);
  const [isAddSportOpen, setIsAddSportOpen] = useState(false);
  const [isAddRefereeOpen, setIsAddRefereeOpen] = useState(false);
  const [selectedMatchForShare, setSelectedMatchForShare] = useState<any | null>(null);
  const [selectedMatchForReassign, setSelectedMatchForReassign] = useState<any | null>(null);

  // Filter state for schedule
  const [filterSport, setFilterSport] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // New Match Form State
  const [newSport, setNewSport] = useState('');
  const [newHomeCohort, setNewHomeCohort] = useState('cohort-seniors');
  const [newAwayCohort, setNewAwayCohort] = useState('cohort-juniors');
  const [newVenue, setNewVenue] = useState('Main Sports Complex');
  const [newReferee, setNewReferee] = useState('');
  const [newScheduledTime, setNewScheduledTime] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // New Referee Form State
  const [newRefName, setNewRefName] = useState('');
  const [newRefEmail, setNewRefEmail] = useState('');
  const [newRefSpecialty, setNewRefSpecialty] = useState('Football & Futsal');
  const [isSubmittingReferee, setIsSubmittingReferee] = useState(false);

  // Reassign Referee State
  const [reassignRefId, setReassignRefId] = useState('');

  // Notifications & Feedback
  const [notification, setNotification] = useState<string>('');
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);

  // Clean Slate Tournament Reset State
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetTournament = async () => {
    setIsResetting(true);
    try {
      await api.post('/api/admin/verifications/reset-tournament', {}, 'admin');
      sounds.playWhistle();
      onRefresh();
      setIsResetConfirmOpen(false);
      setNotification('Tournament successfully reset to pristine Day 0 state (0 matches, 0-0 standings).');
    } catch (err: any) {
      alert('Failed to reset tournament: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // Load dynamic sports catalog
  const loadSports = async () => {
    try {
      const data = await api.get('/api/sports');
      if (Array.isArray(data) && data.length > 0) {
        setSports(data);
        if (!newSport) {
          setNewSport(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load sports catalog:', err);
    }
  };

  // Load certified tournament referees
  const loadReferees = async () => {
    setIsLoadingReferees(true);
    try {
      const data = await api.get('/api/referees');
      if (Array.isArray(data) && data.length > 0) {
        setReferees(data);
        if (!newReferee) {
          setNewReferee(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load referees:', err);
    } finally {
      setIsLoadingReferees(false);
    }
  };

  useEffect(() => {
    loadSports();
    loadReferees();
  }, []);

  // Set default initial sport and referee if empty
  useEffect(() => {
    if (sports.length > 0 && !newSport) {
      setNewSport(sports[0].id);
    }
    if (referees.length > 0 && !newReferee) {
      setNewReferee(referees[0].id);
    }
  }, [sports, referees]);

  // Derive counts from live matches array
  const liveMatches = matches.filter(
    (m) => m.status === 'Live' || m.status === 'LIVE' || m.status === 'In_Progress' || m.status === 'IN_PROGRESS'
  );
  const scheduledMatches = matches.filter(
    (m) => m.status === 'Scheduled' || m.status === 'SCHEDULED' || m.status === 'Draft' || m.status === 'DRAFT'
  );
  const pendingVerificationMatches = matches.filter(
    (m) => m.status === 'Submitted' || m.status === 'SUBMITTED' || m.status === 'Verified' || m.status === 'VERIFIED'
  );
  const publishedMatches = matches.filter(
    (m) => m.status === 'Published' || m.status === 'PUBLISHED' || m.status === 'Completed' || m.status === 'COMPLETED'
  );

  // Helper to resolve referee display info
  const getRefereeInfo = (refId?: string) => {
    if (!refId) return { name: 'Unassigned', code: 'None' };
    const cleanId = String(refId).replace(/^usr-/, '');
    const found = referees.find(
      (r) =>
        r.id === refId ||
        r.id === `usr-${cleanId}` ||
        r.id === cleanId ||
        r.code?.toLowerCase() === String(refId).toLowerCase()
    );
    if (found) {
      return { name: found.name, code: found.code };
    }
    return { name: refId, code: 'REF' };
  };

  // Helper to format date / time nicely
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return 'TBD';
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  // Handle Verify Action (Submitted -> Verified)
  const handleVerify = async (matchId: string) => {
    sounds.playClick(1000);
    try {
      await api.post(`/api/matches/${matchId}/verify`, {}, 'admin');
      setNotification(`Match scorecard verified by Sports Committee.`);
      sounds.playWhistle();
      onRefresh();
    } catch (err: any) {
      setNotification(`Verification failed: ${err.message || 'Server error'}`);
    }
  };

  // Handle Publish Action (Verified/Submitted -> Published)
  const handlePublish = async (matchId: string) => {
    sounds.playGoalHorn();
    try {
      await api.post(`/api/matches/${matchId}/publish`, {}, 'admin');
      setNotification(`Match officially published! Overall cohort standings updated.`);
      onRefresh();
    } catch (err: any) {
      setNotification(`Publishing failed: ${err.message || 'Server error'}`);
    }
  };

  // Handle Reject Action (Submitted -> Draft)
  const handleReject = async (matchId: string) => {
    sounds.playClick(300);
    try {
      await api.post(
        `/api/matches/${matchId}/reject`,
        { notes: 'Returned to Draft for scoring review by Sports Committee' },
        'admin'
      );
      setNotification(`Match returned to referee in Draft status.`);
      onRefresh();
    } catch (err: any) {
      setNotification(`Rejection failed: ${err.message || 'Server error'}`);
    }
  };

  // Handle Create Match
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    try {
      await api.post(
        '/api/matches',
        {
          sport_id: newSport,
          home_cohort_id: newHomeCohort,
          away_cohort_id: newAwayCohort,
          venue: newVenue,
          referee_id: newReferee || undefined,
          scheduled_at: newScheduledTime || new Date().toISOString(),
          notes: newNotes,
        },
        'admin'
      );
      setIsNewMatchOpen(false);
      setNotification('New match fixture scheduled and referee assigned successfully!');
      sounds.playGoalHorn();
      onRefresh();
      loadReferees();
    } catch (err: any) {
      setNotification(`Failed to schedule match: ${err.message || 'Server error'}`);
    }
  };

  // Handle Register New Referee
  const handleCreateReferee = async (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playClick();
    if (!newRefName.trim()) {
      setNotification('Referee name is required.');
      return;
    }

    setIsSubmittingReferee(true);
    try {
      const res: any = await api.post(
        '/api/referees',
        {
          name: newRefName.trim(),
          email: newRefEmail.trim() || undefined,
          sport_specialty: newRefSpecialty.trim() || undefined,
        },
        'admin'
      );
      sounds.playWhistle();
      const code = res?.referee?.code || 'REF-NEW';
      setNotification(`Certified referee registered successfully! Official ID Pass: ${code}`);
      setNewRefName('');
      setNewRefEmail('');
      setNewRefSpecialty('Football & Futsal');
      setIsAddRefereeOpen(false);
      loadReferees();
    } catch (err: any) {
      setNotification(`Failed to register referee: ${err.message || 'Server error'}`);
    } finally {
      setIsSubmittingReferee(false);
    }
  };

  // Handle Reassign Referee
  const handleReassignReferee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchForReassign) return;
    try {
      await api.put(
        `/api/matches/${selectedMatchForReassign.id}`,
        {
          referee_id: reassignRefId || null,
        },
        'admin'
      );
      sounds.playClick();
      setNotification(`Referee updated for match ${selectedMatchForReassign.id}.`);
      setSelectedMatchForReassign(null);
      onRefresh();
      loadReferees();
    } catch (err: any) {
      setNotification(`Failed to update referee: ${err.message || 'Server error'}`);
    }
  };

  // 1-Click WhatsApp Share of Referee ID Pass
  const handleShareRefereeWhatsApp = (ref: any) => {
    sounds.playClick();
    const portalUrl = window.location.origin || 'http://10.1.57.20:5173';
    const text =
      `🏆 *XLRI Ratanjee 2026 Memorial Trophy - Referee Access Pass*\n\n` +
      `👤 *Official:* ${ref.name}\n` +
      `🔑 *Referee ID Pass:* \`${ref.code}\`\n` +
      `🏅 *Specialty:* ${ref.sport_specialty || 'General Sports'}\n` +
      `📋 *Assigned Fixtures:* ${ref.assigned_matches_count || 0}\n\n` +
      `👉 *Live Scoring Instructions:*\n` +
      `1. Open Ratanjee Portal: ${portalUrl}\n` +
      `2. Click *"Referee Access"* on the top navigation bar\n` +
      `3. Enter your ID: *${ref.code}* to unlock live scoring controls!\n\n` +
      `_Issued by XLRI Delhi Sports Committee_`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // 1-Click Copy Referee ID Pass
  const handleCopyRefereeCode = (ref: any) => {
    navigator.clipboard.writeText(ref.code);
    setCopiedRefId(ref.id);
    sounds.playClick(1200);
    setTimeout(() => setCopiedRefId(null), 2500);
  };

  // Filtered schedule list
  const filteredMatches = matches.filter((m) => {
    if (filterSport !== 'ALL') {
      const sportClean = m.sport_id?.replace(/^sport-/, '');
      if (m.sport_id !== filterSport && sportClean !== filterSport) return false;
    }
    if (filterStatus !== 'ALL') {
      if (m.status?.toUpperCase() !== filterStatus.toUpperCase()) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Sports Committee Header & Action Suite */}
      <div
        className={`p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
          sunlightMode ? 'bg-white border-slate-900 shadow-sm' : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black uppercase tracking-tight">
                Sports Committee Central Command
              </h1>
              <InfoTooltip
                title="Sports Committee Administration"
                content="Governs the Ratanjee 2026 Memorial Trophy. Committee members have full administrative authority to schedule fixtures, assign certified referees, register new sports events, approve rosters, and verify submitted scorecards before official publication to campus standings."
                sunlightMode={sunlightMode}
              />
            </div>
            <p className="text-xs text-slate-400">
              Ratanjee 2026 Memorial Trophy &bull; XLRI Delhi Tournament Operations
            </p>
          </div>
        </div>

        {/* Global Committee Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Add Sport Button */}
          <button
            onClick={() => {
              sounds.playClick();
              setIsAddSportOpen(true);
            }}
            className="flex-1 md:flex-none py-2 px-3 rounded-xl border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            title="Add a new sport event to the tournament catalog"
          >
            <Trophy className="w-3.5 h-3.5 text-blue-400" />
            + Add Sport
          </button>

          {/* Register Referee Button */}
          <button
            onClick={() => {
              sounds.playClick();
              setIsAddRefereeOpen(true);
            }}
            className="flex-1 md:flex-none py-2 px-3 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            title="Register a certified referee and generate unique ID pass"
          >
            <UserCheck className="w-3.5 h-3.5 text-purple-400" />
            + Register Referee
          </button>

          {/* Schedule New Match Button */}
          <button
            onClick={() => {
              sounds.playClick();
              setIsNewMatchOpen(true);
            }}
            className="flex-1 md:flex-none py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            + New Match
          </button>

          {/* Reset Tournament (Clean Slate) Button */}
          <button
            onClick={() => {
              sounds.playClick();
              setIsResetConfirmOpen(true);
            }}
            className="flex-1 md:flex-none py-2 px-3 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            title="Wipe demo data and reset tournament to pristine Day 0 (0 matches, 0-0 standings)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-400" />
            Reset to Day 0
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 p-4 rounded-2xl border ${
          sunlightMode ? 'bg-white border-slate-900 shadow-sm' : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 block">Senior Squad</span>
          <span className="text-2xl font-black font-mono text-blue-400">186</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 block">Junior Squad</span>
          <span className="text-2xl font-black font-mono text-emerald-400">204</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-bold text-red-400 block flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Live Matches
          </span>
          <span className="text-2xl font-black font-mono text-red-400">{liveMatches.length}</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-bold text-amber-400 block">Upcoming</span>
          <span className="text-2xl font-black font-mono text-amber-400">{scheduledMatches.length}</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-[11px] font-bold text-emerald-400 block">Published</span>
          <span className="text-2xl font-black font-mono text-emerald-400">{publishedMatches.length}</span>
        </div>

        <div
          onClick={() => setActiveTab('verification')}
          className={`p-3 rounded-xl cursor-pointer transition active:scale-95 border ${
            pendingVerificationMatches.length > 0
              ? 'bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30'
              : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <span className="text-[11px] font-black text-amber-400 block uppercase flex items-center justify-between">
            To Verify
            {pendingVerificationMatches.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </span>
          <span className="text-2xl font-black font-mono text-amber-300">
            {pendingVerificationMatches.length}
          </span>
        </div>
      </div>

      {/* Real-time Notification Banner */}
      {notification && (
        <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold font-mono flex items-center justify-between animate-in fade-in">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            {notification}
          </span>
          <button
            onClick={() => setNotification('')}
            className="p-1 hover:bg-amber-500/20 rounded text-amber-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1 text-xs font-bold">
        <button
          onClick={() => {
            sounds.playClick();
            setActiveTab('schedule');
          }}
          className={`pb-3 px-4 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'schedule'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Tournament Schedule &amp; Fixtures ({matches.length})
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            setActiveTab('referees');
          }}
          className={`pb-3 px-4 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'referees'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Referee Registry &amp; Passes ({referees.length})
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            setActiveTab('verification');
          }}
          className={`pb-3 px-4 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'verification'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Scorecard Verification Queue
          {pendingVerificationMatches.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black">
              {pendingVerificationMatches.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            sounds.playClick();
            setActiveTab('standings');
          }}
          className={`pb-3 px-4 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'standings'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Cohort Standings &amp; Points
        </button>
      </div>

      {/* TAB 1: Tournament Schedule & Fixtures */}
      {activeTab === 'schedule' && (
        <div className="flex flex-col gap-4">
          {/* Schedule Controls & Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Sport filter */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterSport}
                  onChange={(e) => setFilterSport(e.target.value)}
                  className="bg-transparent text-slate-200 font-semibold focus:outline-none"
                >
                  <option value="ALL" className="bg-slate-900">All Sports ▾</option>
                  {sports.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border bg-slate-900 border-slate-800 text-slate-300 font-semibold focus:outline-none"
              >
                <option value="ALL">All Statuses ▾</option>
                <option value="LIVE">Live Matches</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="VERIFIED">Verified</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
              <span>Showing {filteredMatches.length} of {matches.length} fixtures</span>
              <button
                onClick={() => {
                  sounds.playClick();
                  onRefresh();
                }}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
                title="Refresh schedule"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Schedule Table */}
          <div
            className={`rounded-2xl border overflow-hidden ${
              sunlightMode ? 'bg-white border-slate-900' : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b text-[11px] font-black uppercase tracking-wider ${
                    sunlightMode ? 'bg-slate-100 text-slate-700' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <tr>
                    <th className="p-3 pl-4">Sport</th>
                    <th className="p-3">Teams &amp; Score</th>
                    <th className="p-3">Venue</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Assigned Referee</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {filteredMatches.length > 0 ? (
                    filteredMatches.map((m) => {
                      const refInfo = getRefereeInfo(m.referee_id);
                      const isLive = m.status === 'Live' || m.status === 'LIVE' || m.status === 'In_Progress' || m.status === 'IN_PROGRESS';
                      const isPublished = m.status === 'Published' || m.status === 'PUBLISHED' || m.status === 'Completed' || m.status === 'COMPLETED';
                      const isSubmitted = m.status === 'Submitted' || m.status === 'SUBMITTED';
                      const isVerified = m.status === 'Verified' || m.status === 'VERIFIED';

                      return (
                        <tr
                          key={m.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-3 pl-4 font-bold text-white whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              <span>{m.sport_name || m.sport_id?.replace(/^sport-/, '')}</span>
                            </div>
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200">
                                {m.home_cohort_name || 'Seniors'}
                              </span>
                              <span className="font-mono font-bold text-amber-400">
                                {m.score_home ?? 0} - {m.score_away ?? 0}
                              </span>
                              <span className="font-semibold text-slate-200">
                                {m.away_cohort_name || 'Juniors'}
                              </span>
                            </div>
                          </td>

                          <td className="p-3 text-slate-400 whitespace-nowrap">{m.venue || 'Sports Complex'}</td>

                          <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                            {formatTime(m.scheduled_at)}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            {m.referee_id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-amber-400">{refInfo.name}</span>
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30">
                                  {refInfo.code}
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedMatchForReassign(m);
                                  setReassignRefId('');
                                }}
                                className="text-[11px] text-amber-400/80 hover:text-amber-300 font-semibold underline decoration-dashed"
                              >
                                + Assign Referee
                              </button>
                            )}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                isLive
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : isPublished
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : isVerified
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : isSubmitted
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isLive
                                    ? 'bg-red-400 animate-pulse'
                                    : isPublished
                                    ? 'bg-emerald-400'
                                    : 'bg-slate-400'
                                }`}
                              />
                              {m.status}
                            </span>
                          </td>

                          <td className="p-3 pr-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* 1-Click WhatsApp Match Score Broadcast */}
                              <button
                                onClick={() => {
                                  sounds.playClick();
                                  setSelectedMatchForShare(m);
                                }}
                                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold transition"
                                title="Share live scorecard on WhatsApp"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Reassign referee */}
                              <button
                                onClick={() => {
                                  sounds.playClick();
                                  setSelectedMatchForReassign(m);
                                  setReassignRefId(m.referee_id || '');
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                title="Assign or reassign referee"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No matches match the selected sport or status filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-950/40 border-t border-slate-800 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                All fixtures sync live via Server-Sent Events to student scoreboards and WhatsApp broadcasts.
              </span>
              <span className="font-mono text-slate-400">Total: {matches.length} Fixtures</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Referee Registry & Passes */}
      {activeTab === 'referees' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  Official Referee Registry &amp; Pass Codes
                </h2>
                <InfoTooltip
                  title="Referee Pass IDs"
                  content="Referees are issued an official Referee ID Pass (e.g. REF-023). Anyone on campus can click 'Referee Access' on the base screen navbar, enter their unique Referee ID Pass, and immediately unlock scoring controls for their assigned fixtures without remembering a password."
                  sunlightMode={sunlightMode}
                />
              </div>
              <p className="text-xs text-slate-400">
                Official tournament umpires and certified match arbiters for Ratanjee 2026.
              </p>
            </div>

            <button
              onClick={() => {
                sounds.playClick();
                setIsAddRefereeOpen(true);
              }}
              className="py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center gap-1.5 shadow active:scale-95 transition"
            >
              <UserCheck className="w-4 h-4" />
              + Register New Referee
            </button>
          </div>

          {/* Grid of Referee Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {referees.map((ref) => (
              <div
                key={ref.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
                  sunlightMode ? 'bg-white border-slate-900 shadow-sm' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-black text-base text-white">{ref.name}</h3>
                      <p className="text-xs text-slate-400 font-mono">{ref.email}</p>
                    </div>

                    {/* Official ID Pass Badge */}
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        Pass Code
                      </span>
                      <span className="text-sm font-black font-mono px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm">
                        {ref.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {ref.sport_specialty || 'General Official'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {ref.assigned_matches_count || 0} fixtures assigned
                    </span>
                  </div>

                  {/* List of assigned fixtures */}
                  {ref.assigned_matches && ref.assigned_matches.length > 0 && (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] flex flex-col gap-1.5">
                      <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">
                        Assigned Matches:
                      </span>
                      {ref.assigned_matches.slice(0, 3).map((am: any) => (
                        <div key={am.id} className="flex items-center justify-between text-slate-300">
                          <span className="font-semibold truncate max-w-[150px]">
                            {am.sport_id?.replace(/^sport-/, '')} &bull; {am.venue}
                          </span>
                          <span className="font-mono text-[10px] text-amber-400 font-bold">
                            {am.status}
                          </span>
                        </div>
                      ))}
                      {ref.assigned_matches.length > 3 && (
                        <span className="text-[10px] text-slate-500 font-italic">
                          +{ref.assigned_matches.length - 3} more fixtures
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 1-Click Fast Sharing Suite */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleCopyRefereeCode(ref)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                  >
                    {copiedRefId === ref.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy Pass</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleShareRefereeWhatsApp(ref)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition"
                    title="Send referee login pass directly via WhatsApp"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp Pass</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Scorecard Verification Queue */}
      {activeTab === 'verification' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-amber-400" />
                Scorecard Verification &amp; Publishing Queue
              </h2>
              <InfoTooltip
                title="Two-Phase Scorecard Verification"
                content="To ensure 100% data integrity and prevent referee discrepancies, scorecards completed by referees are held in 'Submitted' or 'Verified' status until the Sports Committee officially audits the score and clicks 'Publish' to commit points to the overall campus standings."
                sunlightMode={sunlightMode}
              />
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
              {pendingVerificationMatches.length} Pending Committee Action
            </span>
          </div>

          {pendingVerificationMatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingVerificationMatches.map((m) => {
                const isVerified = m.status === 'Verified' || m.status === 'VERIFIED';
                const refInfo = getRefereeInfo(m.referee_id);

                return (
                  <div
                    key={m.id}
                    className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
                      sunlightMode ? 'bg-white border-slate-900 shadow-sm' : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm uppercase text-amber-400">
                          {m.sport_name || m.sport_id?.replace(/^sport-/, '')} &bull; {m.venue}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded ${
                            isVerified
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-400">{m.home_cohort_name || 'Seniors'}</div>
                          <div className="text-2xl font-black font-mono text-white">
                            {m.score_home ?? 0}
                          </div>
                        </div>

                        <div className="text-center">
                          <span className="text-xs font-bold text-slate-500">FINAL SCORE</span>
                          <div className="text-xs font-mono text-amber-400 font-bold">vs</div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-slate-400">{m.away_cohort_name || 'Juniors'}</div>
                          <div className="text-2xl font-black font-mono text-white">
                            {m.score_away ?? 0}
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Referee: <strong className="text-slate-200">{refInfo.name}</strong> ({refInfo.code})</span>
                        <span className="font-mono">{formatTime(m.scheduled_at)}</span>
                      </div>
                    </div>

                    {/* Committee Decision Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      {!isVerified ? (
                        <>
                          <button
                            onClick={() => handleReject(m.id)}
                            className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs active:scale-95 transition"
                          >
                            Reject to Draft
                          </button>
                          <button
                            onClick={() => handleVerify(m.id)}
                            className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow active:scale-95 transition"
                          >
                            Verify Scorecard
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handlePublish(m.id)}
                          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow flex items-center justify-center gap-2 active:scale-95 transition"
                        >
                          <Trophy className="w-4 h-4" />
                          Publish to Official Campus Standings
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 rounded-2xl border border-dashed border-slate-800 text-center flex flex-col items-center justify-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Verification Queue Clear</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                All submitted referee scorecards have been verified and published to the campus standings!
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Cohort Standings & Points */}
      {activeTab === 'standings' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Ratanjee 2026 Memorial Trophy &bull; Cohort Championship Standings
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Senior Cohort Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-950/60 to-slate-900 border border-blue-800/40 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-blue-400 tracking-wider">
                    Defending Champions
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-xs font-bold">
                    Batch 2026
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white">Seniors (BM &amp; HRM 26)</h3>
                <p className="text-xs text-slate-400 mt-1">14 Wins &bull; 8 Losses</p>
              </div>

              <div className="flex items-baseline justify-between pt-4 border-t border-blue-900/40">
                <span className="text-xs text-slate-400">Total Trophy Points</span>
                <span className="text-4xl font-black font-mono text-blue-400">42 pts</span>
              </div>
            </div>

            {/* Junior Cohort Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-800/40 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                    Challengers
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold">
                    Batch 2027
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white">Juniors (BM &amp; HRM 27)</h3>
                <p className="text-xs text-slate-400 mt-1">11 Wins &bull; 10 Losses</p>
              </div>

              <div className="flex items-baseline justify-between pt-4 border-t border-emerald-900/40">
                <span className="text-xs text-slate-400">Total Trophy Points</span>
                <span className="text-4xl font-black font-mono text-emerald-400">33 pts</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Schedule New Match Modal Dialog */}
      {isNewMatchOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-t-3xl sm:rounded-2xl border-t sm:border p-5 sm:p-6 relative shadow-2xl pb-safe max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${
              sunlightMode ? 'bg-white border-slate-900 text-slate-950' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            {/* Mobile Sheet Grab Bar */}
            <div className="w-12 h-1.5 rounded-full bg-slate-600/60 mx-auto mb-3 sm:hidden" />
            <button
              onClick={() => setIsNewMatchOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              Schedule Tournament Fixture
            </h3>

            <form onSubmit={handleCreateMatch} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Sport Event</label>
                <select
                  value={newSport}
                  onChange={(e) => setNewSport(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-white font-medium"
                >
                  {sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Home Team</label>
                  <select
                    value={newHomeCohort}
                    onChange={(e) => setNewHomeCohort(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-white font-medium"
                  >
                    <option value="cohort-seniors">Seniors (Batch 2026)</option>
                    <option value="cohort-juniors">Juniors (Batch 2027)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">Away Team</label>
                  <select
                    value={newAwayCohort}
                    onChange={(e) => setNewAwayCohort(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-white font-medium"
                  >
                    <option value="cohort-juniors">Juniors (Batch 2027)</option>
                    <option value="cohort-seniors">Seniors (Batch 2026)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Venue</label>
                <input
                  type="text"
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                  placeholder="e.g. Main Ground, Court 1, Indoor Arena"
                  className="w-full p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-white font-medium"
                  required
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Assign Certified Referee</label>
                <select
                  value={newReferee}
                  onChange={(e) => setNewReferee(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-white font-medium"
                >
                  <option value="">-- No Referee Assigned (Draft) --</option>
                  {referees.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code} - {r.sport_specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">Scheduled Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={newScheduledTime}
                  onChange={(e) => setNewScheduledTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-white font-medium"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Committee Notes (Optional)</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Quarterfinal fixture, 2x20 mins"
                  className="w-full p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-white font-medium"
                />
              </div>

              <button
                type="submit"
                className="mt-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm shadow active:scale-95 transition"
              >
                Schedule &amp; Assign Referee
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Register New Referee Modal Dialog */}
      {isAddRefereeOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-t-3xl sm:rounded-2xl border-t sm:border p-5 sm:p-6 relative shadow-2xl pb-safe max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${
              sunlightMode ? 'bg-white border-slate-900 text-slate-950' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            {/* Mobile Sheet Grab Bar */}
            <div className="w-12 h-1.5 rounded-full bg-slate-600/60 mx-auto mb-3 sm:hidden" />
            <button
              onClick={() => setIsAddRefereeOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black uppercase tracking-tight mb-2 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-purple-400" />
              Register Certified Referee
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Auto-generates a unique Referee ID Pass (e.g. REF-023) allowing direct referee fast login on the base screen.
            </p>

            <form onSubmit={handleCreateReferee} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Official Full Name</label>
                <input
                  type="text"
                  value={newRefName}
                  onChange={(e) => setNewRefName(e.target.value)}
                  placeholder="e.g. Vikram Malhotra"
                  className="w-full p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-white font-medium"
                  required
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={newRefEmail}
                  onChange={(e) => setNewRefEmail(e.target.value)}
                  placeholder="e.g. vikram.ref@xlridelhi.ac.in (auto-generated if empty)"
                  className="w-full p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-white font-medium"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Primary Sport Specialty</label>
                <input
                  type="text"
                  value={newRefSpecialty}
                  onChange={(e) => setNewRefSpecialty(e.target.value)}
                  placeholder="e.g. Football & Futsal, Basketball, Cricket"
                  className="w-full p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-white font-medium"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] leading-relaxed">
                💡 Upon registration, a certified pass code (e.g. <strong>REF-024</strong>) is created. You can immediately share the login pass via WhatsApp to the referee.
              </div>

              <button
                type="submit"
                disabled={isSubmittingReferee}
                className="mt-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm shadow active:scale-95 transition disabled:opacity-50"
              >
                {isSubmittingReferee ? 'Generating ID Pass...' : 'Generate Official Referee ID Pass'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reassign Referee Modal Dialog */}
      {selectedMatchForReassign && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-sm rounded-t-3xl sm:rounded-2xl border-t sm:border p-5 sm:p-6 relative shadow-2xl pb-safe max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${
              sunlightMode ? 'bg-white border-slate-900 text-slate-950' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            {/* Mobile Sheet Grab Bar */}
            <div className="w-12 h-1.5 rounded-full bg-slate-600/60 mx-auto mb-3 sm:hidden" />
            <button
              onClick={() => setSelectedMatchForReassign(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black uppercase tracking-tight mb-2 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-amber-400" />
              Assign Official Referee
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Match: {selectedMatchForReassign.sport_name || selectedMatchForReassign.sport_id?.replace(/^sport-/, '')} &bull; {selectedMatchForReassign.venue}
            </p>

            <form onSubmit={handleReassignReferee} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Select Certified Referee</label>
                <select
                  value={reassignRefId}
                  onChange={(e) => setReassignRefId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-950 border-slate-800 text-white font-medium"
                >
                  <option value="">-- Remove Referee (Unassigned) --</option>
                  {referees.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code} - {r.sport_specialty})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="mt-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow active:scale-95 transition"
              >
                Update Referee Assignment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Sport Modal */}
      <AddSportModal
        isOpen={isAddSportOpen}
        onClose={() => setIsAddSportOpen(false)}
        sunlightMode={sunlightMode}
        onSportAdded={() => {
          loadSports();
          onRefresh();
          setNotification('New sport event added to tournament catalog!');
        }}
      />

      {/* MODAL 5: WhatsApp Scorecard Sharing Modal */}
      <ShareMatchModal
        isOpen={!!selectedMatchForShare}
        onClose={() => setSelectedMatchForShare(null)}
        match={selectedMatchForShare}
        sunlightMode={sunlightMode}
      />

      {/* MODAL 6: Reset Tournament Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 relative shadow-2xl ${
              sunlightMode ? 'bg-white border-slate-900 text-slate-950' : 'bg-slate-900 border-red-500/40 text-slate-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-3 text-red-400 font-bold text-xs uppercase tracking-wider">
              <RotateCcw className="w-4 h-4" />
              Tournament Reset
            </div>
            <h3 className="text-lg font-black tracking-tight mb-2">
              Reset Tournament to Clean Day 0 State?
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              This will permanently delete all mock matches, live scorecards, match events, and audit logs, and reset the Senior vs Junior standings to 0-0.
              <br /><br />
              <strong className="text-emerald-400">Preserved:</strong> All 15 official sports, certified referee accounts, and contingent player rosters will remain intact so you can immediately begin scheduling real fixtures.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetTournament}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-lg shadow-red-600/30 transition active:scale-95 flex items-center gap-1.5"
              >
                {isResetting ? 'Resetting...' : 'Yes, Reset to Clean Slate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
