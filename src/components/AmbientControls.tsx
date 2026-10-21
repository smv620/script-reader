import React from 'react';
import { Volume1, FileText, Smile, Wind, Coffee, Sparkles, Sliders, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { AmbientConfig, AmbientDensity } from '../types/dialogue';

interface AmbientControlsProps {
  config: AmbientConfig;
  onChangeConfig: (config: AmbientConfig) => void;
  onDetectReactions: () => void;
  isDetectingReactions: boolean;
  reactionCount: number;
}

export const AmbientControls: React.FC<AmbientControlsProps> = ({
  config,
  onChangeConfig,
  onDetectReactions,
  isDetectingReactions,
  reactionCount,
}) => {
  const toggleSound = (key: keyof AmbientConfig['enabledSounds']) => {
    onChangeConfig({
      ...config,
      enabledSounds: {
        ...config.enabledSounds,
        [key]: !config.enabledSounds[key],
      },
    });
  };

  const handleDensityChange = (density: AmbientDensity) => {
    onChangeConfig({
      ...config,
      density,
    });
  };

  const handleGainChange = (gain: number) => {
    onChangeConfig({
      ...config,
      volumeGain: gain,
    });
  };

  return (
    <div id="ambient-section" className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e293b]">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Volume1 className="w-4 h-4 text-emerald-400" />
            <span>Ambient Silence Distractions & Reaction Hooks</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Fills non-speaking pauses with subtle Foley (paper shuffle, sniff, throat clear) or reactive giggles/chuckles when the other channel speaks.
          </p>
        </div>

        <button
          onClick={onDetectReactions}
          disabled={isDetectingReactions}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors whitespace-nowrap self-start sm:self-auto disabled:opacity-50"
          title="Analyzes the script with Gemini to place chuckles and sniffs during witty or dramatic moments"
        >
          {isDetectingReactions ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Banter...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Detect Reaction Hooks ({reactionCount} active)</span>
            </>
          )}
        </button>
      </div>

      <div className="pt-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Gap Distraction Density */}
        <div className="bg-[#0b0f17] border border-[#1e293b] rounded-lg p-3.5">
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Distraction Frequency in Pauses
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['none', 'low', 'medium', 'high'] as AmbientDensity[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDensityChange(d)}
                className={`py-1.5 text-[11px] font-semibold rounded capitalize transition-all border ${
                  config.density === d
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-[#151c2c] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {d === 'none' ? 'Mute' : d}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {config.density === 'none'
              ? 'Pure digital silence padding (zero noise in non-speaking stems).'
              : `Places occasional subtle sounds during dialogue gaps longer than 1.2s (${config.density} probability).`}
          </p>
        </div>

        {/* Enabled Sound Types */}
        <div className="bg-[#0b0f17] border border-[#1e293b] rounded-lg p-3.5">
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Allowed Ambient Foley & Reactions
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => toggleSound('paperShuffle')}
              className="flex items-center gap-2 text-[11px] text-left text-slate-300 hover:text-white"
            >
              {config.enabledSounds.paperShuffle ? (
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>Paper shuffle / rustle</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSound('sniff')}
              className="flex items-center gap-2 text-[11px] text-left text-slate-300 hover:text-white"
            >
              {config.enabledSounds.sniff ? (
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>Quiet sniff</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSound('cough')}
              className="flex items-center gap-2 text-[11px] text-left text-slate-300 hover:text-white"
            >
              {config.enabledSounds.cough ? (
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>Throat clear / gentle cough</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSound('chuckle')}
              className="flex items-center gap-2 text-[11px] text-left text-slate-300 hover:text-white"
            >
              {config.enabledSounds.chuckle ? (
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>Soft chuckle / giggle</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSound('sigh')}
              className="flex items-center gap-2 text-[11px] text-left text-slate-300 hover:text-white"
            >
              {config.enabledSounds.sigh ? (
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>Subtle breath / sigh</span>
            </button>
          </div>
        </div>

        {/* Ambient Volume Gain Slider */}
        <div className="bg-[#0b0f17] border border-[#1e293b] rounded-lg p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ambient Foley Attenuation</span>
              </label>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {Math.round(config.volumeGain * 100)}% ({Math.round(20 * Math.log10(config.volumeGain))} dB)
              </span>
            </div>

            <input
              type="range"
              min="0.05"
              max="0.35"
              step="0.01"
              value={config.volumeGain}
              onChange={(e) => handleGainChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          <p className="text-[11px] text-slate-400 mt-2">
            Attenuates distractions to sit softly beneath dialogue, ensuring Foley never clashes or drowns out speech in Audacity.
          </p>
        </div>
      </div>
    </div>
  );
};
