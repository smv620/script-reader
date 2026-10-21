import React from 'react';
import { Play, Sparkles, Volume2, Loader2, Music, Layers } from 'lucide-react';

interface TopBarProps {
  onSynthesize: () => void;
  isSynthesizing: boolean;
  hasAudio: boolean;
  onPlayToggle?: () => void;
  isPlaying?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onSynthesize,
  isSynthesizing,
  hasAudio,
  onPlayToggle,
  isPlaying,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0d121c]/95 backdrop-blur border-b border-[#1e293b] px-6 py-3.5 flex items-center justify-between gap-8">
      {/* Zone 1: Single text element brand mark */}
      <a href="/" className="flex items-center gap-2.5 text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-900/40">
          <Layers className="w-4 h-4" />
        </div>
        <span>Multi-Track Dialogue Studio</span>
      </a>

      {/* Zone 2: 4-5 clean single-line navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
        <a href="#upload-section" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
          Upload & Parse
        </a>
        <a href="#speakers-section" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
          Speaker Profiles
        </a>
        <a href="#enhancer-section" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
          Conversational Enhancer
        </a>
        <a href="#ambient-section" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
          Ambient Gaps
        </a>
        <a href="#timeline-section" className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0">
          Multi-Track Timeline
        </a>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        {hasAudio && onPlayToggle && (
          <button
            onClick={onPlayToggle}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            {isPlaying ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pause Mix</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current text-indigo-400" />
                <span>Audition Mix</span>
              </>
            )}
          </button>
        )}

        <button
          onClick={onSynthesize}
          disabled={isSynthesizing}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm shadow-indigo-900/30 transition-colors whitespace-nowrap shrink-0"
        >
          {isSynthesizing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Synthesizing Tracks...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Synced Tracks</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
