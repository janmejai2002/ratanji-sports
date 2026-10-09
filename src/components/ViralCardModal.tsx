import React, { useState } from 'react';
import { X, Share2, Copy, Check, Flame, Trophy, Sparkles } from 'lucide-react';
import { sounds } from '../utils/audio';

interface ViralCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: {
    sport_name: string;
    home_cohort_name: string;
    away_cohort_name: string;
    score_home: number;
    score_away: number;
    status: string;
    venue?: string;
  } | null;
  sunlightMode: boolean;
}

export const ViralCardModal: React.FC<ViralCardModalProps> = ({
  isOpen,
  onClose,
  match,
  sunlightMode,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !match) return null;

  const isHomeWinner = match.score_home > match.score_away;
  const isDraw = match.score_home === match.score_away;
  const winner = isDraw ? 'DRAW' : isHomeWinner ? match.home_cohort_name : match.away_cohort_name;
  const loser = isDraw ? '' : isHomeWinner ? match.away_cohort_name : match.home_cohort_name;

  const savageHeadline = isDraw
    ? `DEADLOCK AT XLRI! ${match.home_cohort_name} and ${match.away_cohort_name} split the spoils in ${match.sport_name}! ⚔️🔥`
    : `${winner.toUpperCase()} JUST COOKED ${loser.toUpperCase()} ${Math.max(match.score_home, match.score_away)}-${Math.min(match.score_home, match.score_away)} IN ${match.sport_name.toUpperCase()}! 💀🔥`;

  const storyText = `🏆 RATANJI 2026 | XLRI DELHI\n⚡ ${match.sport_name} Championship\n\n${savageHeadline}\n\n📍 Venue: ${match.venue || 'XLRI Grounds'}\n📊 Final Score: ${match.home_cohort_name} ${match.score_home} - ${match.score_away} ${match.away_cohort_name}\n\nLive scores & banter: https://ratanji.xlri.ac.in`;

  const copyToClipboard = () => {
    sounds.playClick(1200);
    navigator.clipboard.writeText(storyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        className={`w-full max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border p-5 sm:p-6 relative shadow-2xl transition-all pb-safe max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${
          sunlightMode
            ? 'bg-white border-slate-900 text-slate-950'
            : 'bg-slate-900 border-amber-500/40 text-slate-100 shadow-amber-500/10'
        }`}
      >
        {/* Mobile Sheet Grab Bar */}
        <div className="w-12 h-1.5 rounded-full bg-slate-600/60 mx-auto mb-3 sm:hidden" />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-800/40 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4 text-xs font-bold tracking-wider text-amber-500 uppercase">
          <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
          Viral Campus Match Card &bull; WhatsApp / Instagram Story
        </div>

        {/* Viral Visual Card */}
        <div
          className={`p-6 rounded-xl border-2 mb-5 relative overflow-hidden ${
            sunlightMode
              ? 'bg-gradient-to-br from-amber-100 via-white to-slate-100 border-slate-900'
              : 'bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 border-amber-500/60'
          }`}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-black tracking-widest uppercase px-2 py-0.5 rounded bg-amber-500 text-black">
              RATANJI 2026 &bull; XLRI DELHI
            </span>
            <span className="text-xs font-mono font-bold text-slate-400">
              {match.sport_name.toUpperCase()}
            </span>
          </div>

          <h3 className="text-xl md:text-2xl font-black leading-tight tracking-tight uppercase mb-4">
            {savageHeadline}
          </h3>

          {/* Big Score Box */}
          <div className="flex items-center justify-around py-4 my-2 rounded-xl bg-black/40 border border-white/10">
            <div className="text-center">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                {match.home_cohort_name}
              </span>
              <div className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white mt-1">
                {match.score_home}
              </div>
            </div>

            <div className="text-xl font-black text-amber-400 px-2 font-mono">VS</div>

            <div className="text-center">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                {match.away_cohort_name}
              </span>
              <div className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white mt-1">
                {match.score_away}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>📍 {match.venue || 'Main Sports Complex'}</span>
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Sparkles className="w-3.5 h-3.5" /> Official Ratanji Verified Result
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={copyToClipboard}
            className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Story Copied to Clipboard!' : 'Copy Instagram Story / Status'}
          </button>

          <button
            onClick={() => {
              sounds.playClick();
              if (navigator.share) {
                navigator.share({
                  title: `Ratanji 2026: ${match.sport_name}`,
                  text: storyText,
                  url: window.location.href,
                }).catch(() => {});
              } else {
                copyToClipboard();
              }
            }}
            className={`py-3 px-4 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition ${
              sunlightMode
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
            }`}
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
};
