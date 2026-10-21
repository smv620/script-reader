import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Gauge,
  Layers,
} from 'lucide-react';

interface AudioPlayerBarProps {
  isPlaying: boolean;
  onPlayToggle: () => void;
  onReset: () => void;
  currentTimeSec: number;
  totalDurationSec: number;
  onSeek: (timeSec: number) => void;
  masterVolume: number;
  onChangeMasterVolume: (volume: number) => void;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  onDownloadMaster: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  isPlaying,
  onPlayToggle,
  onReset,
  currentTimeSec,
  totalDurationSec,
  onSeek,
  masterVolume,
  onChangeMasterVolume,
  playbackRate,
  onChangePlaybackRate,
  onDownloadMaster,
}) => {
  const progressPercent = totalDurationSec > 0 ? (currentTimeSec / totalDurationSec) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d121c]/95 backdrop-blur-md border-t border-[#1e293b] px-6 py-3 shadow-2xl">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Playback Controls & Timers */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={onReset}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Reset to beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onPlayToggle}
            className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-900/40 transition-transform active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Time Display */}
          <div className="font-mono text-xs tabular-nums text-slate-300">
            <span className="text-white font-semibold">{formatTime(currentTimeSec)}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span>{formatTime(totalDurationSec)}</span>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-[#131926] border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-400">
            <Gauge className="w-3 h-3 text-slate-400" />
            {[0.8, 1.0, 1.2].map((rate) => (
              <button
                key={rate}
                onClick={() => onChangePlaybackRate(rate)}
                className={`px-1 rounded ${
                  playbackRate === rate ? 'text-indigo-400 font-bold' : 'hover:text-slate-200'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        {/* Global Progress Scrubber */}
        <div className="grow max-w-xl mx-4 w-full">
          <input
            type="range"
            min="0"
            max={totalDurationSec || 1}
            step="0.05"
            value={currentTimeSec}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Volume & Master Download */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
          {/* Master Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChangeMasterVolume(masterVolume > 0 ? 0 : 1)}
              className="text-slate-400 hover:text-slate-200"
            >
              {masterVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-slate-400" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={masterVolume}
              onChange={(e) => onChangeMasterVolume(parseFloat(e.target.value))}
              className="w-20 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
              title={`Master Volume: ${Math.round(masterVolume * 100)}%`}
            />
          </div>

          {/* Master Download */}
          <button
            onClick={onDownloadMaster}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap"
            title="Download full combined multi-track audition mix MP3"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Master Mix</span>
          </button>
        </div>
      </div>
    </div>
  );
};
