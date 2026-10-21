import React from 'react';
import { Sparkles, Wand2, Sliders, Info, Flame, CheckCircle, RefreshCw } from 'lucide-react';
import { FillerIntensity } from '../types/dialogue';

interface EnhancerControlsProps {
  intensity: FillerIntensity;
  onChangeIntensity: (intensity: FillerIntensity) => void;
  onEnhanceAll: () => void;
  isEnhancing: boolean;
  totalLines: number;
  enhancedCount: number;
}

export const EnhancerControls: React.FC<EnhancerControlsProps> = ({
  intensity,
  onChangeIntensity,
  onEnhanceAll,
  isEnhancing,
  totalLines,
  enhancedCount,
}) => {
  return (
    <div id="enhancer-section" className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e293b]">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Conversational Naturalizer & Filler Engine</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Injects organic hesitations, random ums/ahs, word repetitions ("I I take-take"), and battle-ready vocal delivery into raw lines.
          </p>
        </div>

        <button
          onClick={onEnhanceAll}
          disabled={isEnhancing || totalLines === 0}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap self-start sm:self-auto"
        >
          {isEnhancing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Enhancing Dialogue...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5" />
              <span>Naturalize All Script Lines ({totalLines})</span>
            </>
          )}
        </button>
      </div>

      <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Subtle Card */}
        <button
          type="button"
          onClick={() => onChangeIntensity('subtle')}
          className={`text-left p-3.5 rounded-lg border transition-all ${
            intensity === 'subtle'
              ? 'bg-[#192236] border-amber-500/70 shadow-sm'
              : 'bg-[#0c101a] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-200">Subtle Natural Flow</span>
            {intensity === 'subtle' && <CheckCircle className="w-3.5 h-3.5 text-amber-400" />}
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            Occasional gentle hesitation, brief natural micro-pause, keeping sentences clean and readable.
          </p>
          <div className="p-2 bg-[#080b12] rounded border border-slate-800 text-[11px] font-mono text-slate-300">
            "I take out my sword... and I attack the goblin."
          </div>
        </button>

        {/* Moderate Card */}
        <button
          type="button"
          onClick={() => onChangeIntensity('moderate')}
          className={`text-left p-3.5 rounded-lg border transition-all ${
            intensity === 'moderate'
              ? 'bg-[#192236] border-amber-500/70 shadow-sm'
              : 'bg-[#0c101a] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-200">Conversational Reality</span>
            {intensity === 'moderate' && <CheckCircle className="w-3.5 h-3.5 text-amber-400" />}
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            Real spoken fillers ("um", "well", "ah"), occasional word repeats ("I-I"), and organic flow.
          </p>
          <div className="p-2 bg-[#080b12] rounded border border-slate-800 text-[11px] font-mono text-slate-300">
            "I, uh, take out my sword and... and attack the goblin!"
          </div>
        </button>

        {/* Dramatic / Battle-Ready Card */}
        <button
          type="button"
          onClick={() => onChangeIntensity('dramatic')}
          className={`text-left p-3.5 rounded-lg border transition-all ${
            intensity === 'dramatic'
              ? 'bg-[#192236] border-amber-500/70 shadow-sm'
              : 'bg-[#0c101a] border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-amber-400" />
              <span>Battle-Ready & Dramatic</span>
            </span>
            {intensity === 'dramatic' && <CheckCircle className="w-3.5 h-3.5 text-amber-400" />}
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            Urgent stutters, intense repeated words, sharp breath pauses, and adrenaline-charged delivery.
          </p>
          <div className="p-2 bg-[#080b12] rounded border border-slate-800 text-[11px] font-mono text-amber-200/90 font-medium">
            "I I take-take out my sword, and, uh, I attack the goblin!"
          </div>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400 bg-[#0c101a] px-3.5 py-2 rounded-lg border border-slate-800">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Status: <span className="text-slate-200 font-semibold">{enhancedCount} of {totalLines}</span> lines naturalized with filler nuances.
          </span>
        </div>
        <span className="text-[11px] text-slate-500">You can toggle or edit lines individually in the script table below.</span>
      </div>
    </div>
  );
};
