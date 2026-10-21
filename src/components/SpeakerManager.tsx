import React, { useState } from 'react';
import {
  User,
  Plus,
  Trash2,
  Sliders,
  Volume2,
  Shield,
  Sparkles,
  Database,
  BookmarkCheck,
  BookmarkPlus,
} from 'lucide-react';
import { SpeakerProfile, GeminiVoiceName } from '../types/dialogue';

interface SpeakerManagerProps {
  speakers: SpeakerProfile[];
  onUpdateSpeaker: (speaker: SpeakerProfile) => void;
  onAddSpeaker: () => void;
  onRemoveSpeaker: (speakerId: string) => void;
  onOpenPersonaLibrary: (activeSpeaker?: SpeakerProfile) => void;
  onSavePersonaToLibrary: (speaker: SpeakerProfile) => void;
}

const VOICE_OPTIONS: { name: GeminiVoiceName; pitch: string; timbre: string; description: string }[] = [
  { name: 'Puck', pitch: 'Middle', timbre: 'Youthful & Energetic', description: 'Vibrant, clear hero or adventurous companion' },
  { name: 'Charon', pitch: 'Deep / Low', timbre: 'Resonant & Gravelly', description: 'Imposing commander, dungeon boss, or monster' },
  { name: 'Kore', pitch: 'Warm / Clear', timbre: 'Calm & Articulate', description: 'Expressive clarity for narrator, mage, or strategist' },
  { name: 'Fenrir', pitch: 'Gruff / Dynamic', timbre: 'Earthy & Textured', description: 'Rough warrior, rogue, goblin, or heated fighter' },
  { name: 'Zephyr', pitch: 'Bright / Fast', timbre: 'Light & Witty', description: 'Quick-talking scout, comedic sidekick, or merchant' },
  { name: 'Aoede', pitch: 'Rich / Melodic', timbre: 'Lyrical & Theatrical', description: 'Noble monarch, bard, or dramatic performer' },
];

const PRESET_STYLES = [
  { label: 'Battle-Ready Hero', prompt: 'Enthusiastic, urgent, battle-ready hero declaring attacks with sharp breath' },
  { label: 'Sneering Goblin', prompt: 'Raspy, menacing goblin rogue, cackling with guttural energy' },
  { label: 'Tabletop DM', prompt: 'Deliberate, authoritative tabletop Dungeon Master describing dramatic environments' },
  { label: 'Tactical Rogue', prompt: 'Clever, tactical rogue with crisp witty diction and quick sharp breaths' },
  { label: 'Hearty Barbarian', prompt: 'Grizzled barbarian, hearty, boisterous, laughing through battle declarations' },
];

export const SpeakerManager: React.FC<SpeakerManagerProps> = ({
  speakers,
  onUpdateSpeaker,
  onAddSpeaker,
  onRemoveSpeaker,
  onOpenPersonaLibrary,
  onSavePersonaToLibrary,
}) => {
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>(speakers[0]?.id || '');

  const activeSpeaker = speakers.find((s) => s.id === selectedSpeakerId) || speakers[0];

  return (
    <div id="speakers-section" className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e293b]">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" />
            <span>Speaker Profiles & Voice Personas ({speakers.length} Active)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Populated from your transcript. Assign distinct Gemini voices, look up saved personas from the database, or save custom voices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Persona Database Lookup Button */}
          <button
            onClick={() => onOpenPersonaLibrary(activeSpeaker)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors whitespace-nowrap"
            title="Browse remembered voice personas in the database"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Persona Database</span>
          </button>

          <button
            onClick={onAddSpeaker}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Speaker</span>
          </button>
        </div>
      </div>

      {/* Speaker Tab Selector */}
      <div className="flex flex-wrap items-center gap-2 pt-4 pb-4">
        {speakers.map((spk, idx) => (
          <button
            key={spk.id}
            onClick={() => setSelectedSpeakerId(spk.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              activeSpeaker?.id === spk.id
                ? 'bg-[#1b253b] text-white border-indigo-500 shadow-sm'
                : 'bg-[#0f1422] text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: spk.color }}
            />
            <span className="truncate max-w-[120px]">{spk.name || `Speaker ${idx + 1}`}</span>
            <span className="text-[10px] text-slate-500 font-mono">({spk.voiceName})</span>
          </button>
        ))}
      </div>

      {/* Active Speaker Configuration Box */}
      {activeSpeaker && (
        <div className="bg-[#0b0f17] border border-[#1e293b] rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Speaker Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Speaker Name
              </label>
              <input
                type="text"
                value={activeSpeaker.name}
                onChange={(e) => onUpdateSpeaker({ ...activeSpeaker, name: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-[#151c2c] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                placeholder="e.g. DM, Maiah, Anton, Hero"
              />
            </div>

            {/* Gemini Voice Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Gemini TTS Voice
              </label>
              <select
                value={activeSpeaker.voiceName}
                onChange={(e) =>
                  onUpdateSpeaker({
                    ...activeSpeaker,
                    voiceName: e.target.value as GeminiVoiceName,
                  })
                }
                className="w-full px-3 py-1.5 text-xs bg-[#151c2c] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} — {v.pitch} ({v.timbre})
                  </option>
                ))}
              </select>
            </div>

            {/* Track Color Tag */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Timeline Accent Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={activeSpeaker.color}
                  onChange={(e) => onUpdateSpeaker({ ...activeSpeaker, color: e.target.value })}
                  className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-400">{activeSpeaker.color}</span>

                {/* Save active speaker to database button */}
                <button
                  type="button"
                  onClick={() => onSavePersonaToLibrary(activeSpeaker)}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-300 hover:text-white bg-indigo-950/40 border border-indigo-500/30 rounded transition-colors"
                  title="Saves this profile to the database. Duplicate names append -2, -3, etc."
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>Save to DB</span>
                </button>

                {speakers.length > 2 && (
                  <button
                    onClick={() => onRemoveSpeaker(activeSpeaker.id)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
                    title="Remove this speaker"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Voice Description & Style Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Voice Persona & Performance Prompt</span>
              </label>
              <span className="text-[11px] text-slate-400">Passed directly to Gemini TTS speech metadata</span>
            </div>

            <textarea
              rows={2}
              value={activeSpeaker.stylePrompt}
              onChange={(e) => onUpdateSpeaker({ ...activeSpeaker, stylePrompt: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-[#151c2c] border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              placeholder="e.g. Enthusiastic, battle-ready hero declaring attacks with sharp breath and urgent combat energy"
            />

            {/* Quick Preset Buttons & Database Re-apply */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 mr-1">Style Presets:</span>
                {PRESET_STYLES.map((ps) => (
                  <button
                    key={ps.label}
                    type="button"
                    onClick={() => onUpdateSpeaker({ ...activeSpeaker, stylePrompt: ps.prompt })}
                    className="px-2 py-0.5 text-[11px] rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    {ps.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onOpenPersonaLibrary(activeSpeaker)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium"
              >
                Look up past voices for "{activeSpeaker.name}" →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
