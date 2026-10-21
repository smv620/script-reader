import React, { useState } from 'react';
import {
  Database,
  Search,
  Check,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Volume2,
  Tag,
  Copy,
} from 'lucide-react';
import { SavedVoicePersona, GeminiVoiceName } from '../types/dialogue';
import {
  getSavedPersonas,
  savePersona,
  deletePersona,
  generateDeduplicatedName,
} from '../services/personaDatabase';

interface PersonaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPersona: (persona: SavedVoicePersona) => void;
  currentSpeakerName?: string;
  onSaveCurrentSpeaker?: (personaData: {
    name: string;
    voiceName: GeminiVoiceName;
    stylePrompt: string;
    color: string;
  }) => void;
  activeSpeakerProfile?: {
    name: string;
    voiceName: GeminiVoiceName;
    stylePrompt: string;
    color: string;
  };
}

export const PersonaLibraryModal: React.FC<PersonaLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectPersona,
  activeSpeakerProfile,
}) => {
  const [personas, setPersonas] = useState<SavedVoicePersona[]>(getSavedPersonas());
  const [searchQuery, setSearchQuery] = useState('');
  const [createdToast, setCreatedToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const refreshList = () => {
    setPersonas(getSavedPersonas());
  };

  const filtered = personas.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.voiceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.stylePrompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSaveActiveAsNew = () => {
    if (!activeSpeakerProfile) return;
    const saved = savePersona({
      name: activeSpeakerProfile.name || 'Voice Persona',
      voiceName: activeSpeakerProfile.voiceName,
      stylePrompt: activeSpeakerProfile.stylePrompt,
      color: activeSpeakerProfile.color,
    });
    refreshList();
    setCreatedToast(`Saved persona "${saved.name}" to database!`);
    setTimeout(() => setCreatedToast(null), 3000);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deletePersona(id);
    refreshList();
  };

  // Preview what name will be generated if saving active speaker
  const anticipatedName = activeSpeakerProfile
    ? generateDeduplicatedName(activeSpeakerProfile.name, personas)
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#111726] border border-[#1e293b] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#1e293b] flex items-center justify-between gap-4 bg-[#0d121c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Voice Persona Database</h3>
              <p className="text-xs text-slate-400">
                Look up previously configured voices or save current settings. Duplicate names append -2, -3, -4.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 text-sm font-semibold"
          >
            ✕
          </button>
        </div>

        {/* Action & Search Bar */}
        <div className="p-4 border-b border-[#1e293b] bg-[#0f1422] space-y-3">
          {createdToast && (
            <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs rounded-lg flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              <span>{createdToast}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative grow">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved voice personas (e.g. DM, Maiah, Goblin)..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#151c2c] border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Save Current Speaker as New Persona */}
            {activeSpeakerProfile && (
              <button
                type="button"
                onClick={handleSaveActiveAsNew}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors whitespace-nowrap shadow-sm"
                title={`Saves active speaker settings. If name exists, appends next available index: "${anticipatedName}"`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save "{anticipatedName}"</span>
              </button>
            )}
          </div>
        </div>

        {/* Personas List */}
        <div className="p-4 overflow-y-auto space-y-2.5 grow">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No saved voice personas matching "{searchQuery}".
            </div>
          ) : (
            filtered.map((persona) => (
              <div
                key={persona.id}
                onClick={() => {
                  onSelectPersona(persona);
                  onClose();
                }}
                className="p-3.5 rounded-lg bg-[#0b0f17] border border-[#1e293b] hover:border-indigo-500/80 hover:bg-[#131a29] cursor-pointer transition-all flex flex-col justify-between group"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: persona.color }}
                    />
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {persona.name}
                    </span>
                    <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                      {persona.voiceName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(persona.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(persona.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                      title="Delete saved persona"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 font-mono line-clamp-2 bg-[#090d15] p-2 rounded border border-slate-800/80 mb-2">
                  "{persona.stylePrompt}"
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {persona.tags?.map((tag) => (
                      <span key={tag} className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-indigo-400 font-semibold group-hover:underline">
                    Click to Apply Voice →
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#1e293b] bg-[#0d121c] flex items-center justify-between text-xs text-slate-400">
          <span>{personas.length} voice personas in persistent database</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
