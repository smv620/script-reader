import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Smile,
  Clock,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DialogueLine, SpeakerProfile, ReactionType, ReactionHook } from '../types/dialogue';

interface ScriptEditorProps {
  lines: DialogueLine[];
  speakers: SpeakerProfile[];
  onUpdateLine: (line: DialogueLine) => void;
  onAddLine: (afterIndex?: number) => void;
  onRemoveLine: (lineId: string) => void;
  onMoveLine: (index: number, direction: 'up' | 'down') => void;
  onLoadPreset: (presetName: string) => void;
  interSpeakerGapSec: number;
  onChangeInterSpeakerGap: (gapSec: number) => void;
}

const REACTION_OPTIONS: { type: ReactionType; label: string; icon: string }[] = [
  { type: 'chuckle', label: 'Soft Chuckle', icon: '😄' },
  { type: 'giggle', label: 'Quick Giggle', icon: '🤭' },
  { type: 'sniff', label: 'Quiet Sniff', icon: '🤧' },
  { type: 'cough', label: 'Throat Clear / Cough', icon: '😷' },
  { type: 'sigh', label: 'Gentle Sigh / Breath', icon: '😮‍💨' },
  { type: 'paper_shuffle', label: 'Paper Shuffle', icon: '📄' },
];

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  lines,
  speakers,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
  onMoveLine,
  onLoadPreset,
  interSpeakerGapSec,
  onChangeInterSpeakerGap,
}) => {
  const [showRawPaste, setShowRawPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const handleParsePastedText = () => {
    if (!pasteText.trim()) return;
    const rawLines = pasteText.split('\n').filter((l) => l.trim().length > 0);
    const newLines: DialogueLine[] = [];

    rawLines.forEach((raw, i) => {
      let speakerId = speakers[i % speakers.length]?.id || 's1';
      let content = raw.trim();

      // Check for "Speaker: line" pattern
      const colonIdx = raw.indexOf(':');
      if (colonIdx > 0 && colonIdx < 30) {
        const potentialName = raw.slice(0, colonIdx).trim().toLowerCase();
        content = raw.slice(colonIdx + 1).trim();

        const match = speakers.find(
          (s) => s.name.toLowerCase().includes(potentialName) || potentialName.includes(s.name.toLowerCase())
        );
        if (match) {
          speakerId = match.id;
        }
      }

      newLines.push({
        id: `line_${Date.now()}_${i}`,
        speakerId,
        rawText: content,
        enhancedText: content,
        isEnhanced: false,
        pauseAfterMs: Math.round(interSpeakerGapSec * 1000),
      });
    });

    if (newLines.length > 0) {
      // Replace or append
      newLines.forEach((nl) => onAddLine(-1)); // We will trigger batch add via parent or reset
    }
    setShowRawPaste(false);
    setPasteText('');
  };

  const getSpeaker = (speakerId: string) => {
    return speakers.find((s) => s.id === speakerId) || speakers[0];
  };

  return (
    <div id="script-section" className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e293b]">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Dialogue Script Editor</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Organize lines, inspect naturalized spoken diffs, and assign non-verbal reactions for pauses.
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 bg-[#0b0f17] border border-slate-800 rounded-lg p-1 text-xs">
            <span className="text-[11px] text-slate-400 px-1.5">Presets:</span>
            <button
              onClick={() => onLoadPreset('goblin_battle')}
              className="px-2 py-0.5 rounded text-amber-300 hover:bg-slate-800 transition-colors font-medium text-[11px]"
            >
              Goblin Battle
            </button>
            <button
              onClick={() => onLoadPreset('detective_noir')}
              className="px-2 py-0.5 rounded text-indigo-300 hover:bg-slate-800 transition-colors font-medium text-[11px]"
            >
              Detective Noir
            </button>
            <button
              onClick={() => onLoadPreset('podcast_debate')}
              className="px-2 py-0.5 rounded text-emerald-300 hover:bg-slate-800 transition-colors font-medium text-[11px]"
            >
              Tech Podcast
            </button>
          </div>

          <button
            onClick={() => onAddLine()}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Line</span>
          </button>
        </div>
      </div>

      {/* Global Pacing Settings */}
      <div className="py-3 px-4 my-4 bg-[#0b0f17] border border-[#1e293b] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>Inter-Speaker Natural Pause:</span>
          <span className="font-mono text-slate-100 font-semibold">{interSpeakerGapSec.toFixed(2)}s</span>
          <span className="text-slate-400">({Math.round(interSpeakerGapSec * 1000)}ms realistic brief gap)</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.15"
            max="1.2"
            step="0.05"
            value={interSpeakerGapSec}
            onChange={(e) => onChangeInterSpeakerGap(parseFloat(e.target.value))}
            className="w-36 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-[11px] text-slate-400">Tight &lt;—&gt; Relaxed</span>
        </div>
      </div>

      {/* Lines Table */}
      <div className="space-y-3">
        {lines.map((line, idx) => {
          const spk = getSpeaker(line.speakerId);
          const isLast = idx === lines.length - 1;

          return (
            <div
              key={line.id}
              className="bg-[#0b0f17] border border-[#1e293b] rounded-lg p-3.5 transition-all hover:border-slate-700"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-2">
                {/* Speaker Selector & Line Index */}
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono text-slate-400 font-medium">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>

                  <select
                    value={line.speakerId}
                    onChange={(e) => onUpdateLine({ ...line, speakerId: e.target.value })}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-700 focus:outline-none focus:border-indigo-500"
                    style={{
                      backgroundColor: `${spk.color}18`,
                      color: spk.color,
                      borderColor: `${spk.color}40`,
                    }}
                  >
                    {speakers.map((s) => (
                      <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                        {s.name} ({s.voiceName})
                      </option>
                    ))}
                  </select>

                  {/* Toggle Enhanced vs Raw */}
                  {line.enhancedText && line.enhancedText !== line.rawText && (
                    <button
                      type="button"
                      onClick={() => onUpdateLine({ ...line, isEnhanced: !line.isEnhanced })}
                      className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                        line.isEnhanced
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>{line.isEnhanced ? 'Natural Fillers Active' : 'Show Raw Line'}</span>
                    </button>
                  )}
                </div>

                {/* Reorder and Delete controls */}
                <div className="flex items-center gap-1 self-end md:self-auto">
                  <button
                    disabled={idx === 0}
                    onClick={() => onMoveLine(idx, 'up')}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-20 transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={isLast}
                    onClick={() => onMoveLine(idx, 'down')}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-20 transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRemoveLine(line.id)}
                    className="p-1 text-rose-500/80 hover:text-rose-400 transition-colors ml-1"
                    title="Delete line"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Text Edit Area */}
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={line.isEnhanced ? line.enhancedText : line.rawText}
                  onChange={(e) => {
                    if (line.isEnhanced) {
                      onUpdateLine({ ...line, enhancedText: e.target.value });
                    } else {
                      onUpdateLine({ ...line, rawText: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-[#131926] border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-indigo-500 font-sans"
                  placeholder="Enter dialogue line..."
                />

                {/* Diff note if naturalized */}
                {line.isEnhanced && line.enhancedText !== line.rawText && (
                  <div className="flex items-start gap-2 p-2 rounded bg-[#0f1420] border border-slate-800 text-[11px] text-slate-400">
                    <span className="text-amber-400 shrink-0 font-medium">Original:</span>
                    <span className="italic line-through text-slate-500">{line.rawText}</span>
                  </div>
                )}
              </div>

              {/* Inter-Line Pause and Reaction Hook (for all but last line) */}
              {!isLast && (
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Reaction Hook during pause */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Smile className="w-3 h-3 text-emerald-400" />
                      <span>Pause Reaction:</span>
                    </span>

                    {line.reactionHook ? (
                      <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded text-[11px]">
                        <span>
                          {REACTION_OPTIONS.find((r) => r.type === line.reactionHook?.reactionType)?.icon || '😄'}{' '}
                          {getSpeaker(line.reactionHook.triggerSpeakerId)?.name} reacts ({line.reactionHook.reactionType})
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateLine({ ...line, reactionHook: undefined })}
                          className="text-emerald-400 hover:text-emerald-200 ml-1 text-xs"
                          title="Remove reaction"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <select
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            // silent speaker who will react
                            const silentSpeaker = speakers.find((s) => s.id !== line.speakerId) || speakers[0];
                            const newHook: ReactionHook = {
                              id: `react_${Date.now()}`,
                              triggerSpeakerId: silentSpeaker.id,
                              reactionType: e.target.value as ReactionType,
                              offsetMs: 150,
                              intensity: 0.8,
                            };
                            onUpdateLine({ ...line, reactionHook: newHook });
                          }}
                          className="px-2 py-0.5 text-[11px] bg-slate-800 text-slate-300 border border-slate-700 rounded focus:outline-none"
                        >
                          <option value="">+ Add Gap Reaction...</option>
                          {REACTION_OPTIONS.map((opt) => (
                            <option key={opt.type} value={opt.type}>
                              {opt.icon} {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Pause duration indicator */}
                  <div className="text-[11px] font-mono text-slate-500">
                    Pause: {line.pauseAfterMs ? (line.pauseAfterMs / 1000).toFixed(2) : interSpeakerGapSec.toFixed(2)}s
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
