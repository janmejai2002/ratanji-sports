import React, { useState } from 'react';
import { Trophy, Plus, X, Shield, Activity, Check } from 'lucide-react';
import { sounds } from '../utils/audio';
import { api } from '../utils/api';

interface AddSportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sunlightMode: boolean;
  onSportAdded: () => void;
}

export const AddSportModal: React.FC<AddSportModalProps> = ({
  isOpen,
  onClose,
  sunlightMode,
  onSportAdded,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Court');
  const [scoringType, setScoringType] = useState<'GENERIC' | 'FOOTBALL' | 'CRICKET' | 'BASKETBALL' | 'BADMINTON'>('GENERIC');
  const [playersPerTeam, setPlayersPerTeam] = useState('5');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [pointsToWin, setPointsToWin] = useState('21');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const rules = {
        playersPerTeam: Number(playersPerTeam) || 5,
        durationMinutes: Number(durationMinutes) || 30,
        pointsToWin: Number(pointsToWin) || 21,
      };

      await api.post('/api/sports', {
        name: name.trim(),
        category,
        scoring_type: scoringType,
        rules,
      }, 'admin');

      sounds.playWhistle();
      onSportAdded();
      onClose();
    } catch (err: any) {
      sounds.playClick(300);
      setError(err.message || 'Failed to add sports event.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-t-3xl sm:rounded-2xl border-t sm:border p-5 sm:p-6 shadow-2xl relative transition-all pb-safe max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${
          sunlightMode
            ? 'bg-white border-slate-200 text-slate-900 shadow-xl'
            : 'bg-slate-900 border-amber-500/40 text-slate-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Grab Bar */}
        <div className="w-12 h-1.5 rounded-full bg-slate-600/60 mx-auto mb-3 sm:hidden" />
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg transition ${sunlightMode ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-700' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1 text-xs font-bold text-amber-500 uppercase tracking-wide">
          <Trophy className="w-4 h-4" />
          Tournament Sports Catalog
        </div>

        <h3 className="text-lg font-black tracking-tight mb-2">
          Add New Sports Event
        </h3>

        <p className={`text-xs mb-4 leading-relaxed ${sunlightMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Configure a new sporting event for Ratanjee 2026. It will automatically become available for scheduling, scoring, and contingent rosters.
        </p>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className={`font-bold uppercase text-[10px] block mb-1 ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Sport Event Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Squash, Kabaddi, Powerlifting, Kho Kho"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl outline-none font-medium ${
                sunlightMode
                  ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:border-[#013B83]'
                  : 'bg-black/40 border border-slate-700 text-white focus:border-amber-400'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`font-bold uppercase text-[10px] block mb-1 ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl outline-none font-medium ${
                  sunlightMode
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:border-[#013B83]'
                    : 'bg-black/40 border border-slate-700 text-white focus:border-amber-400'
                }`}
              >
                <option value="Court">Court</option>
                <option value="Outdoor">Outdoor</option>
                <option value="Indoor">Indoor</option>
                <option value="Racquet">Racquet</option>
                <option value="Athletics">Athletics</option>
                <option value="Mind">Mind Sport</option>
                <option value="Esports">Esports</option>
              </select>
            </div>

            <div>
              <label className={`font-bold uppercase text-[10px] block mb-1 ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                Scoring Rule Engine
              </label>
              <select
                value={scoringType}
                onChange={(e) => setScoringType(e.target.value as any)}
                className={`w-full px-3 py-2 rounded-xl outline-none font-medium ${
                  sunlightMode
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:border-[#013B83]'
                    : 'bg-black/40 border border-slate-700 text-white focus:border-amber-400'
                }`}
              >
                <option value="GENERIC">Points &amp; Sets (Standard)</option>
                <option value="FOOTBALL">Football / Futsal (Goals/Cards)</option>
                <option value="CRICKET">Cricket (Runs/Wickets/Overs)</option>
                <option value="BASKETBALL">Basketball (1/2/3PT/Quarters)</option>
                <option value="BADMINTON">Badminton (21-Pt Rally/Sets)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={`font-bold uppercase text-[9px] block mb-1 ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                Players / Team
              </label>
              <input
                type="number"
                min="1"
                value={playersPerTeam}
                onChange={(e) => setPlayersPerTeam(e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg outline-none font-mono text-center font-bold ${
                  sunlightMode
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:border-[#013B83]'
                    : 'bg-black/40 border border-slate-700 text-white focus:border-amber-400'
                }`}
              />
            </div>

            <div>
              <label className={`font-bold uppercase text-[9px] block mb-1 ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                Duration (Min)
              </label>
              <input
                type="number"
                min="5"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg outline-none font-mono text-center font-bold ${
                  sunlightMode
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:border-[#013B83]'
                    : 'bg-black/40 border border-slate-700 text-white focus:border-amber-400'
                }`}
              />
            </div>

            <div>
              <label className={`font-bold uppercase text-[9px] block mb-1 ${sunlightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                Points to Win
              </label>
              <input
                type="number"
                min="1"
                value={pointsToWin}
                onChange={(e) => setPointsToWin(e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg outline-none font-mono text-center font-bold ${
                  sunlightMode
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:border-[#013B83]'
                    : 'bg-black/40 border border-slate-700 text-white focus:border-amber-400'
                }`}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {isLoading ? 'Adding Sport...' : 'Add Sport to Championship'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
