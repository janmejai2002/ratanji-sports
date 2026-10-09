import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { sounds } from '../utils/audio';

interface InfoTooltipProps {
  title?: string;
  content: string;
  className?: string;
  sunlightMode?: boolean;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  content,
  className = '',
  sunlightMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playClick(1400);
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className="p-1 rounded-full text-slate-400 hover:text-amber-400 hover:bg-white/5 transition focus:outline-none"
        title={title || 'Information'}
        aria-label={title || 'Information'}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop for click outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />

          <div
            className={`absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl border shadow-xl text-left animate-in fade-in zoom-in-95 ${
              sunlightMode
                ? 'bg-white border-slate-900 text-slate-900 shadow-slate-300'
                : 'bg-slate-900 border-amber-500/40 text-slate-200 shadow-black/80'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                {title || 'Quick Info'}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">{content}</p>
          </div>
        </>
      )}
    </div>
  );
};
