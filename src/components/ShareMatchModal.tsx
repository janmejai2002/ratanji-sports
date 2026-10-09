import React, { useState } from 'react';
import { X, Share2, Copy, Check, MessageSquare, ExternalLink, Activity, MapPin, Clock } from 'lucide-react';
import { sounds } from '../utils/audio';

interface ShareMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: any | null;
  sunlightMode: boolean;
}

export const ShareMatchModal: React.FC<ShareMatchModalProps> = ({
  isOpen,
  onClose,
  match,
  sunlightMode,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen || !match) return null;

  const sportName = match.sport_name || match.sport_id?.replace('sport-', '').toUpperCase() || 'Tournament Sport';
  const homeScore = match.score_home ?? 0;
  const awayScore = match.score_away ?? 0;
  const period = match.current_period || (match.status === 'Draft' || match.status === 'Live' ? 'In Progress' : match.status);
  const timeMin = match.current_time_seconds ? `${Math.floor(match.current_time_seconds / 60)}' min` : '';
  const venue = match.venue || 'XLRI Sports Arena';

  // Format sharable URL (uses window.location.origin or local LAN ip)
  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://10.1.57.20:5173';
  const trackingLink = `${currentHost}/?match=${match.id}`;

  // WhatsApp formatted message with emojis and clear status
  const whatsappMessage = 
`🏆 *XLRI DELHI RATANJI 2026 • LIVE MATCH UPDATE*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *${sportName.toUpperCase()}*
⚔️ *Seniors '26* [ ${homeScore} - ${awayScore} ] *Juniors '27*
⏱️ *Status:* ${match.status === 'Draft' || match.status === 'Live' ? '🔴 LIVE' : match.status} (${period}${timeMin ? ` • ${timeMin}` : ''})
📍 *Venue:* ${venue}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📲 *Track live ball-by-ball / point-by-point updates:*
${trackingLink}

#Ratanji2026 #XLRI #SeniorsVsJuniors #SportsCommittee`;

  const handleShareWhatsApp = () => {
    sounds.playGoalHorn();
    const encoded = encodeURIComponent(whatsappMessage);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleCopyMessage = () => {
    sounds.playClick(1000);
    navigator.clipboard.writeText(whatsappMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyLinkOnly = () => {
    sounds.playClick(800);
    navigator.clipboard.writeText(trackingLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-t-3xl sm:rounded-2xl border-t sm:border p-5 sm:p-6 shadow-2xl relative transition-all pb-safe max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${
          sunlightMode
            ? 'bg-white border-slate-900 text-slate-950'
            : 'bg-slate-900 border-amber-500/40 text-slate-100 shadow-amber-500/10'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Grab Bar */}
        <div className="w-12 h-1.5 rounded-full bg-slate-600/60 mx-auto mb-3 sm:hidden" />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1 text-xs font-bold text-amber-400 uppercase tracking-wide">
          <Share2 className="w-4 h-4" />
          Live Score Tracking &amp; WhatsApp Broadcast
        </div>

        <h3 className="text-lg font-black tracking-tight mb-3">
          Share {sportName} Score Update
        </h3>

        {/* Live Match Card Preview */}
        <div className="p-4 rounded-xl bg-black/60 border border-slate-800 mb-4">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="font-bold text-amber-400 uppercase">{sportName}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {match.status}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 text-center">
            <div className="flex-1">
              <span className="text-[11px] font-bold text-blue-400 block uppercase">Seniors (Batch '26)</span>
              <span className="text-3xl font-black font-mono text-white">{homeScore}</span>
            </div>
            <div className="text-xs font-mono font-bold text-slate-600 px-3">VS</div>
            <div className="flex-1">
              <span className="text-[11px] font-bold text-emerald-400 block uppercase">Juniors (Batch '27)</span>
              <span className="text-3xl font-black font-mono text-white">{awayScore}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-white/5">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              {venue}
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              {period}
            </span>
          </div>
        </div>

        {/* Formatted Message Preview */}
        <div className="mb-4">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Prefixed WhatsApp Message Preview:
          </label>
          <pre className="p-3 rounded-xl bg-black/40 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
            {whatsappMessage}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            onClick={handleShareWhatsApp}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
          >
            <MessageSquare className="w-4 h-4" />
            Share to WhatsApp Groups
          </button>

          <button
            onClick={handleCopyMessage}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition"
          >
            {copied ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied Message!' : 'Copy Formatted Text'}
          </button>
        </div>

        <button
          onClick={handleCopyLinkOnly}
          className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-bold text-[11px] font-mono flex items-center justify-center gap-1.5 transition"
        >
          <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
          {copiedLink ? 'Tracking Link Copied!' : `Copy Link: ${trackingLink}`}
        </button>
      </div>
    </div>
  );
};
