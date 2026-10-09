import React, { useState } from 'react';
import { Info, X, ChevronRight } from 'lucide-react';
import { sounds } from '../utils/audio';

interface InfoTooltipProps {
  title?: string;
  content: string;
  features?: string[];
  align?: 'left' | 'center' | 'right';
  className?: string;
  sunlightMode?: boolean;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  content,
  features,
  align = 'center',
  className = '',
  sunlightMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playClick(1400);
    setIsOpen(!isOpen);
  };

  const getAlignmentClasses = () => {
    if (align === 'left') return 'left-0';
    if (align === 'right') return 'right-0';
    return 'left-1/2 -translate-x-1/2';
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className="p-1 rounded-full text-slate-400 hover:text-amber-400 hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400/50"
        title={title || 'Information'}
        aria-label={title || 'Information'}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop for click outside */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />

          <div
            className={`absolute z-50 bottom-full ${getAlignmentClasses()} mb-2 w-72 sm:w-80 p-4 rounded-xl border shadow-2xl text-left animate-in fade-in zoom-in-95 ${
              sunlightMode
                ? 'bg-white border-slate-300 text-slate-900 shadow-slate-300/60'
                : 'bg-slate-950/95 border-white/10 text-slate-200 shadow-2xl shadow-black/90 backdrop-blur-xl'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 tracking-tight">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {title || 'Official Specification'}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close information dialog"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-300 font-normal mb-2.5">
              {content}
            </p>

            {features && features.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Key Rules &amp; Details:
                </span>
                <ul className="space-y-1">
                  {features.map((feat, idx) => (
                    <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5 leading-snug">
                      <ChevronRight className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

