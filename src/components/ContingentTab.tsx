import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  User,
  Trophy,
  AlertCircle,
  CheckCircle,
  Plus,
  Edit2,
  Trash2,
  Shield,
  X,
  Save,
  Users,
  Lock
} from 'lucide-react';
import { sounds } from '../utils/audio';
import { api } from '../utils/api';
import { AddSportModal } from './AddSportModal';
import { InfoTooltip } from './InfoTooltip';

interface ContingentTabProps {
  sunlightMode: boolean;
  currentUser?: any;
}

const DEFAULT_SPORTS = [
  { id: 'football', name: 'Football' },
  { id: 'cricket', name: 'Cricket' },
  { id: 'basketball-m', name: 'Basketball M' },
  { id: 'basketball-f', name: 'Basketball F' },
  { id: 'volleyball', name: 'Volleyball' },
  { id: 'table-tennis', name: 'Table Tennis' },
  { id: 'track-field-m', name: 'Track & Field M' },
  { id: 'track-field-f', name: 'Track & Field F' },
  { id: 'tennis', name: 'Tennis' },
  { id: 'chess', name: 'Chess' },
  { id: 'badminton-m', name: 'Badminton M' },
  { id: 'badminton-f', name: 'Badminton F' },
  { id: 'pool', name: 'Pool' },
  { id: 'throwball', name: 'Throwball' },
  { id: 'futsal', name: 'Futsal' },
];

export const ContingentTab: React.FC<ContingentTabProps> = ({ sunlightMode, currentUser }) => {
  const isSportsCom = currentUser?.role === 'admin';
  const [sports, setSports] = useState<any[]>(DEFAULT_SPORTS);
  const [isAddSportOpen, setIsAddSportOpen] = useState(false);
  const [selectedCohort, setSelectedCohort] = useState<'seniors' | 'juniors'>('seniors');
  const [selectedSport, setSelectedSport] = useState<string>('football');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modals for Roster & Team Management
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);

  // Form states for Add/Edit Player
  const [formName, setFormName] = useState('');
  const [formStudentId, setFormStudentId] = useState('');
  const [formJersey, setFormJersey] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formStatus, setFormStatus] = useState<'Active' | 'Injured'>('Active');
  const [formSport, setFormSport] = useState('football');
  const [formCohort, setFormCohort] = useState<'seniors' | 'juniors'>('seniors');

  // Form states for Team/Cohort Edit
  const [teamName, setTeamName] = useState('Seniors');
  const [teamBatch, setTeamBatch] = useState('Batch of 2026');
  const [teamColor, setTeamColor] = useState('#1E40AF');

  // Load players from database
  const loadRoster = () => {
    setIsLoading(true);
    fetch(`/api/contingent?cohort=${selectedCohort}&sport=${selectedSport}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.players || [];
        setPlayers(list);
        if (list.length > 0) {
          setSelectedPlayer(list[0]);
        } else {
          setSelectedPlayer(null);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  const loadSports = () => {
    fetch('/api/sports')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((s: any) => ({
            id: s.id.replace('sport-', ''),
            fullId: s.id,
            name: s.name,
            category: s.category,
            scoring_type: s.scoring_type,
          }));
          setSports(mapped);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadSports();
  }, []);

  useEffect(() => {
    loadRoster();
  }, [selectedCohort, selectedSport]);

  const openAddPlayer = () => {
    sounds.playClick();
    setFormName('');
    setFormStudentId('');
    setFormJersey('');
    setFormPosition('');
    setFormStatus('Active');
    setFormSport(selectedSport);
    setFormCohort(selectedCohort);
    setIsAddPlayerOpen(true);
  };

  const openEditPlayer = (p: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    sounds.playClick();
    setEditingPlayer(p);
    setFormName(p.name || '');
    setFormStudentId(p.student_id || '');
    setFormJersey(p.jersey_number !== undefined ? String(p.jersey_number) : '');
    setFormPosition(p.position || '');
    setFormStatus(p.status === 'Injured' ? 'Injured' : 'Active');
    setFormSport(p.primary_sport_id ? p.primary_sport_id.replace('sport-', '') : selectedSport);
    setFormCohort(p.cohort_id?.includes('junior') ? 'juniors' : 'seniors');
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPlayer) {
        // PUT update
        await api.put(`/api/contingent/players/${editingPlayer.id}`, {
          name: formName,
          student_id: formStudentId,
          jersey_number: formJersey ? Number(formJersey) : null,
          position: formPosition,
          status: formStatus.toUpperCase(),
          primary_sport_id: formSport.startsWith('sport-') ? formSport : `sport-${formSport}`,
          cohort_id: formCohort === 'juniors' ? 'cohort-juniors' : 'cohort-seniors',
        }, 'admin');
        sounds.playWhistle();
        setEditingPlayer(null);
      } else {
        // POST create
        await api.post('/api/contingent/players', {
          name: formName,
          student_id: formStudentId,
          jersey_number: formJersey ? Number(formJersey) : null,
          position: formPosition,
          status: formStatus.toUpperCase(),
          primary_sport_id: formSport.startsWith('sport-') ? formSport : `sport-${formSport}`,
          cohort_id: formCohort === 'juniors' ? 'cohort-juniors' : 'cohort-seniors',
        }, 'admin');
        sounds.playWhistle();
        setIsAddPlayerOpen(false);
      }
      loadRoster();
    } catch (err: any) {
      alert(err.message || 'Failed to save player');
    }
  };

  const handleDeletePlayer = async (playerId: string, playerName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`Are you sure you want to remove ${playerName} from the squad?`)) return;

    try {
      await api.delete(`/api/contingent/players/${playerId}`, 'admin');
      sounds.playClick();
      loadRoster();
    } catch (err: any) {
      alert(err.message || 'Failed to delete player');
    }
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cohortId = selectedCohort === 'seniors' ? 'cohort-seniors' : 'cohort-juniors';
      await api.put(`/api/contingent/cohorts/${cohortId}`, {
        name: teamName,
        batch: teamBatch,
        color: teamColor,
      }, 'admin');
      sounds.playWhistle();
      setIsEditTeamOpen(false);
      loadRoster();
    } catch (err: any) {
      alert(err.message || 'Failed to update team details');
    }
  };

  const filteredPlayers = players.filter((p) => {
    const matchesSearch =
      searchQuery === '' ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.student_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.position?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || p.status?.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  const activeCount = players.filter((p) => p.status === 'Active' || p.status === 'ACTIVE').length;
  const injuredCount = players.filter((p) => p.status === 'Injured' || p.status === 'INJURED').length;
  const currentSportName = sports.find((s) => s.id === selectedSport || s.fullId === selectedSport)?.name || 'Football';

  return (
    <div className="flex flex-col gap-5 animate-in fade-in">
      {/* Top Controls: Team Selector + Management Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border bg-slate-900/60 border-slate-800">
        {/* Cohort Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sounds.playClick();
              setSelectedCohort('seniors');
              setTeamName('Seniors');
              setTeamBatch('Batch of 2026');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider uppercase transition active:scale-95 ${
              selectedCohort === 'seniors'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400'
                : 'bg-black/40 text-slate-400 hover:text-white'
            }`}
          >
            Seniors (Batch of 2026)
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              setSelectedCohort('juniors');
              setTeamName('Juniors');
              setTeamBatch('Batch of 2027');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black tracking-wider uppercase transition active:scale-95 ${
              selectedCohort === 'juniors'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400'
                : 'bg-black/40 text-slate-400 hover:text-white'
            }`}
          >
            Juniors (Batch of 2027)
          </button>
        </div>

        {/* Team & Player Action Buttons (Guarded: Sports Committee Only) */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSportsCom ? (
            <>
              <button
                onClick={() => {
                  sounds.playClick();
                  setIsEditTeamOpen(true);
                }}
                className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                title="Edit Cohort / Team Details"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Edit Team
              </button>

              <button
                onClick={openAddPlayer}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
                title="Add a new player to this sport contingent"
              >
                <Plus className="w-3.5 h-3.5" />
                + Add Player
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-slate-800 text-[11px] text-slate-400">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Roster Locked (Spectator Mode)</span>
              <InfoTooltip
                title="Roster Permissions"
                content="Athlete roster modifications and squad management require Sports Committee sign-in."
                sunlightMode={sunlightMode}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main 4-Column Layout: Sports Sidebar (Col 1) + Squad List (Col 2-3) + Profile Pane (Col 4) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Column: Dynamic Sports Categories */}
        <div
          className={`p-3 rounded-2xl border flex flex-col gap-1 max-h-[640px] overflow-y-auto ${
            sunlightMode ? 'bg-white border-slate-900 shadow-sm' : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>Sports Events</span>
              <span className="font-mono text-amber-400">({sports.length})</span>
            </span>

            {isSportsCom && (
              <button
                onClick={() => {
                  sounds.playClick();
                  setIsAddSportOpen(true);
                }}
                className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase flex items-center gap-0.5 transition"
                title="Add new sporting event to catalog"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>

          {sports.map((sport) => {
            const isSelected = selectedSport === sport.id || selectedSport === sport.fullId;
            return (
              <button
                key={sport.id}
                onClick={() => {
                  sounds.playClick();
                  setSelectedSport(sport.id);
                }}
                className={`text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-amber-500 text-black font-black shadow-sm'
                    : sunlightMode
                    ? 'text-slate-800 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span className="truncate">{sport.name}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Center 2 Columns: Squad Roster Grid */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Roster Header & Search */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              sunlightMode ? 'bg-white border-slate-900 shadow-sm' : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm tracking-wide uppercase">
                  {currentSportName} Contingent
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {filteredPlayers.length} ATHLETES
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Active: <span className="text-emerald-400 font-bold">{activeCount}</span> &bull; Injured:{' '}
                <span className="text-red-400 font-bold">{injuredCount}</span>
              </p>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search athlete..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-black/40 border border-slate-700 text-white placeholder-slate-500 focus:border-amber-400 outline-none"
              />
            </div>
          </div>

          {/* Athletes List */}
          <div className="flex flex-col gap-2.5 max-h-[540px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading squad roster...</div>
            ) : filteredPlayers.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-800 text-center">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No athletes found for this sport.</p>
                <button
                  onClick={openAddPlayer}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold"
                >
                  + Add First Athlete
                </button>
              </div>
            ) : (
              filteredPlayers.map((p) => {
                const isSelected = selectedPlayer?.id === p.id;
                const isInjured = p.status?.toUpperCase() === 'INJURED';

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      sounds.playClick();
                      setSelectedPlayer(p);
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between group ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/10 shadow-sm'
                        : sunlightMode
                        ? 'bg-white border-slate-300 hover:border-slate-500'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center font-mono font-black text-xs text-amber-400">
                        {p.jersey_number ? `#${p.jersey_number}` : '•'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white group-hover:text-amber-300 transition">
                            {p.name}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                              isInjured
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {p.position || 'Player'} &bull; {p.student_id}
                        </span>
                      </div>
                    </div>

                    {/* Edit / Delete Quick Actions (Sports Committee Only) */}
                    {isSportsCom && (
                      <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={(e) => openEditPlayer(p, e)}
                          title="Edit Player"
                          className="p-1.5 rounded-lg hover:bg-black/30 text-slate-400 hover:text-amber-400 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeletePlayer(p.id, p.name, e)}
                          title="Remove Player"
                          className="p-1.5 rounded-lg hover:bg-black/30 text-slate-400 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Player Profile Detail Card */}
        <div className="flex flex-col gap-4">
          {selectedPlayer ? (
            <div
              className={`p-5 rounded-2xl border flex flex-col justify-between ${
                sunlightMode ? 'bg-white border-slate-900 shadow-sm' : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                    Athlete Profile Card
                  </span>
                  {isSportsCom && (
                    <button
                      onClick={() => openEditPlayer(selectedPlayer)}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                </div>

                <div className="text-center py-2">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono font-black text-2xl flex items-center justify-center mx-auto mb-2 shadow">
                    {selectedPlayer.jersey_number ? `#${selectedPlayer.jersey_number}` : '•'}
                  </div>
                  <h4 className="font-black text-base text-white">{selectedPlayer.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedPlayer.position || 'Athlete'} &bull; {selectedPlayer.cohort_name || selectedPlayer.cohort}
                  </p>
                </div>

                <div className="space-y-2 p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 uppercase text-[10px]">Student ID:</span>
                    <span className="font-bold text-slate-200">{selectedPlayer.student_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 uppercase text-[10px]">Primary Sport:</span>
                    <span className="font-bold text-amber-300 capitalize">{currentSportName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 uppercase text-[10px]">Status:</span>
                    <span
                      className={`font-bold ${
                        selectedPlayer.status?.toUpperCase() === 'INJURED'
                          ? 'text-red-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {selectedPlayer.status}
                    </span>
                  </div>
                </div>

                {/* Performance Stats */}
                {selectedPlayer.stats && Object.keys(selectedPlayer.stats).length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                      Sport Metrics
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(selectedPlayer.stats).map(([k, v]) => (
                        <div key={k} className="p-2 rounded-lg bg-black/30 border border-white/5 text-center">
                          <span className="text-[9px] font-mono text-slate-500 uppercase block truncate">
                            {k}
                          </span>
                          <span className="font-mono font-bold text-xs text-white">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
                <button
                  onClick={() => openEditPlayer(selectedPlayer)}
                  className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit Athlete
                </button>
                <button
                  onClick={() => handleDeletePlayer(selectedPlayer.id, selectedPlayer.name)}
                  className="p-2 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300"
                  title="Remove Player"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
              Select an athlete to inspect profile &amp; stats
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Add or Edit Player */}
      {(isAddPlayerOpen || editingPlayer) && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => {
            setIsAddPlayerOpen(false);
            setEditingPlayer(null);
          }}
        >
          <div
            className={`w-full max-w-md rounded-t-3xl sm:rounded-2xl border-t sm:border p-5 sm:p-6 shadow-2xl relative pb-safe max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${
              sunlightMode ? 'bg-white border-slate-900 text-slate-950' : 'bg-slate-900 border-slate-700 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Sheet Grab Bar */}
            <div className="w-12 h-1.5 rounded-full bg-slate-600/60 mx-auto mb-3 sm:hidden" />
            <button
              onClick={() => {
                setIsAddPlayerOpen(false);
                setEditingPlayer(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <h3 className="font-black text-base uppercase tracking-tight mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-amber-500" />
              {editingPlayer ? 'Edit Athlete Roster' : 'Add Athlete to Contingent'}
            </h3>

            <form onSubmit={handleSavePlayer} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold uppercase text-[10px] text-slate-400 block mb-1">
                  Full Athlete Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arjun Nair"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-slate-700 text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase text-[10px] text-slate-400 block mb-1">
                    Student ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 26BM002"
                    value={formStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-slate-700 text-white focus:border-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase text-[10px] text-slate-400 block mb-1">
                    Jersey #
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 10"
                    value={formJersey}
                    onChange={(e) => setFormJersey(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-slate-700 text-white focus:border-amber-400 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase text-[10px] text-slate-400 block mb-1">
                    Squad Position
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Forward / Captain"
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-slate-700 text-white focus:border-amber-400 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase text-[10px] text-slate-400 block mb-1">
                    Health Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-slate-700 text-white focus:border-amber-400 outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Injured">Injured</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase text-[10px] text-slate-400 block mb-1">
                    Sport
                  </label>
                  <select
                    value={formSport}
                    onChange={(e) => setFormSport(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-slate-700 text-white focus:border-amber-400 outline-none"
                  >
                    {sports.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold uppercase text-[10px] text-slate-400 block mb-1">
                    Team / Cohort
                  </label>
                  <select
                    value={formCohort}
                    onChange={(e) => setFormCohort(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-slate-700 text-white focus:border-amber-400 outline-none"
                  >
                    <option value="seniors">Seniors (Batch 2026)</option>
                    <option value="juniors">Juniors (Batch 2027)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-md active:scale-95 transition"
                >
                  {editingPlayer ? 'Update Athlete Roster' : 'Save to Squad Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Team / Cohort Metadata */}
      {isEditTeamOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsEditTeamOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-t-3xl sm:rounded-2xl border-t sm:border p-5 sm:p-6 shadow-2xl relative pb-safe max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${
              sunlightMode ? 'bg-white border-slate-900 text-slate-950' : 'bg-slate-900 border-slate-700 text-white'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Sheet Grab Bar */}
            <div className="w-12 h-1.5 rounded-full bg-slate-600/60 mx-auto mb-3 sm:hidden" />
            <button
              onClick={() => setIsEditTeamOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <h3 className="font-black text-base uppercase tracking-tight mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              Edit Cohort / Team
            </h3>

            <form onSubmit={handleSaveTeam} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold uppercase text-[10px] text-slate-400 block mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-slate-700 text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase text-[10px] text-slate-400 block mb-1">
                  Batch Designation
                </label>
                <input
                  type="text"
                  required
                  value={teamBatch}
                  onChange={(e) => setTeamBatch(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-slate-700 text-white focus:border-amber-400 outline-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase text-[10px] text-slate-400 block mb-1">
                  Team Theme Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={teamColor}
                    onChange={(e) => setTeamColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-slate-300 font-bold">{teamColor}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shadow-md active:scale-95 transition"
                >
                  Save Team Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Sport Modal (Sports Committee Only) */}
      <AddSportModal
        isOpen={isAddSportOpen}
        onClose={() => setIsAddSportOpen(false)}
        sunlightMode={sunlightMode}
        onSportAdded={() => {
          loadSports();
          loadRoster();
        }}
      />
    </div>
  );
};
