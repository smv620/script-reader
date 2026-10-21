import React, { useState, useEffect, useRef } from 'react';
import {
  FileCheck,
  AlertCircle,
  Users,
  EyeOff,
  CheckCircle2,
  Database,
  ArrowRight,
  Sparkles,
  UserX,
  RotateCcw,
  Loader2,
  ShieldAlert,
  Volume2,
  Square,
  Sliders,
  ChevronDown,
  Check,
  Save,
  BookmarkCheck,
  Play,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  TranscriptValidationResult,
  SpeakerProfile,
  DialogueLine,
  SpeakerLineCount,
  GeminiVoiceName,
  SavedVoicePersona,
} from '../types/dialogue';
import {
  getSavedPersonas,
  savePersona,
} from '../services/personaDatabase';
import {
  recalculateValidationResult,
  runLlmSpeakerValidation,
} from '../services/transcriptParser';

interface TranscriptValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  validationResult: TranscriptValidationResult | null;
  onConfirmPopulate: (
    newSpeakers: SpeakerProfile[],
    newLines: DialogueLine[]
  ) => void;
}

interface CustomSpeakerVoiceConfig {
  voiceName: GeminiVoiceName;
  stylePrompt: string;
  color: string;
  personaId?: string;
  personaName?: string;
}

interface CachedVoicePreview {
  audioUrl: string;
  durationSec: number;
  voiceName: string;
  text: string;
  synthesizedAt: number;
}

const GEMINI_VOICES: {
  name: GeminiVoiceName;
  pitch: string;
  timbre: string;
  role: string;
}[] = [
  { name: 'Puck', pitch: 'Middle', timbre: 'Youthful, energetic', role: 'Hero, adventurer, spirited lead' },
  { name: 'Charon', pitch: 'Deep', timbre: 'Resonant, authoritative', role: 'Dungeon Master, commander, villain' },
  { name: 'Kore', pitch: 'Warm', timbre: 'Articulate, calm', role: 'Narrator, tactician, mage' },
  { name: 'Fenrir', pitch: 'Gruff', timbre: 'Intense, battle-hardened', role: 'Warrior, barbarian, goblin' },
  { name: 'Zephyr', pitch: 'Bright', timbre: 'Quick-witted, nimble', role: 'Scout, rogue, comedic companion' },
  { name: 'Aoede', pitch: 'Rich', timbre: 'Melodic, dramatic', role: 'Bard, monarch, dramatic persona' },
];

export const TranscriptValidationModal: React.FC<TranscriptValidationModalProps> = ({
  isOpen,
  onClose,
  validationResult: initialResult,
  onConfirmPopulate,
}) => {
  const [activeTab, setActiveTab] = useState<'speakers' | 'ignored'>('speakers');
  const [currentResult, setCurrentResult] = useState<TranscriptValidationResult | null>(initialResult);
  const [isValidatingLlm, setIsValidatingLlm] = useState(false);

  // Line selection state per speaker (speakerName -> selected sample text)
  const [selectedSampleLines, setSelectedSampleLines] = useState<Record<string, string>>({});
  const [openLineDropdownForSpeaker, setOpenLineDropdownForSpeaker] = useState<string | null>(null);

  // Custom voice configs overriding or changing the matched voice (speakerName -> config)
  const [customVoiceConfigs, setCustomVoiceConfigs] = useState<Record<string, CustomSpeakerVoiceConfig>>({});
  const [editingVoiceForSpeaker, setEditingVoiceForSpeaker] = useState<string | null>(null);

  // Saved personas list from database
  const [savedPersonas, setSavedPersonas] = useState<SavedVoicePersona[]>([]);
  const [savedToastSpeaker, setSavedToastSpeaker] = useState<string | null>(null);

  // Client-side cache of synthesized audio samples (persists across playback for instant replay)
  const [cachedPreviews, setCachedPreviews] = useState<Record<string, CachedVoicePreview>>({});
  const [previewLoadingSpeaker, setPreviewLoadingSpeaker] = useState<string | null>(null);
  const [previewPlayingSpeaker, setPreviewPlayingSpeaker] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [autoplayNotice, setAutoplayNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const colors = ['#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#3b82f6'];

  // Load saved personas on mount/open
  useEffect(() => {
    if (isOpen) {
      setSavedPersonas(getSavedPersonas());
    }
  }, [isOpen]);

  // Clean up audio on unmount or close
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewPlayingSpeaker(null);
    setPreviewLoadingSpeaker(null);
  };

  // Sync state when initial result changes
  useEffect(() => {
    if (initialResult) {
      setCurrentResult(initialResult);
      stopAudio();
      setOpenLineDropdownForSpeaker(null);
      setEditingVoiceForSpeaker(null);

      // Run LLM validation automatically on first open if not already run
      if (!initialResult.hasLlmValidated) {
        setIsValidatingLlm(true);
        runLlmSpeakerValidation(initialResult)
          .then((validated) => {
            setCurrentResult(validated);
          })
          .finally(() => setIsValidatingLlm(false));
      }
    }
  }, [initialResult]);

  if (!isOpen || !currentResult) return null;

  // Manual Exclude as Omitted
  const handleOmitSpeaker = (speakerName: string) => {
    stopAudio();
    const updated = currentResult.speakersSummary.map((s) => {
      if (s.speakerName.toLowerCase() === speakerName.toLowerCase()) {
        return {
          ...s,
          isExcluded: true,
          excludeAction: 'omit' as const,
          reassignedToSpeakerName: undefined,
        };
      }
      return s;
    });
    setCurrentResult(recalculateValidationResult(currentResult, updated));
  };

  // Reassign lines to another speaker
  const handleReassignSpeaker = (sourceSpeakerName: string, targetSpeakerName: string) => {
    stopAudio();
    const updated = currentResult.speakersSummary.map((s) => {
      if (s.speakerName.toLowerCase() === sourceSpeakerName.toLowerCase()) {
        return {
          ...s,
          isExcluded: true,
          excludeAction: 'reassign' as const,
          reassignedToSpeakerName: targetSpeakerName,
        };
      }
      return s;
    });
    setCurrentResult(recalculateValidationResult(currentResult, updated));
  };

  // Restore an excluded speaker
  const handleRestoreSpeaker = (speakerName: string) => {
    const updated = currentResult.speakersSummary.map((s) => {
      if (s.speakerName.toLowerCase() === speakerName.toLowerCase()) {
        return {
          ...s,
          isExcluded: false,
          excludeAction: undefined,
          reassignedToSpeakerName: undefined,
        };
      }
      return s;
    });
    setCurrentResult(recalculateValidationResult(currentResult, updated));
  };

  // Helper to get active voice configuration for a speaker
  const getSpeakerVoiceConfig = (sum: SpeakerLineCount, idx: number): CustomSpeakerVoiceConfig => {
    const key = sum.speakerName.toLowerCase();
    if (customVoiceConfigs[key]) {
      return customVoiceConfigs[key];
    }
    if (sum.matchedPersona) {
      return {
        voiceName: sum.matchedPersona.voiceName,
        stylePrompt: sum.matchedPersona.stylePrompt,
        color: sum.matchedPersona.color || colors[idx % colors.length],
        personaId: sum.matchedPersona.id,
        personaName: sum.matchedPersona.name,
      };
    }
    const fallbackVoice = GEMINI_VOICES[idx % GEMINI_VOICES.length].name;
    return {
      voiceName: fallbackVoice,
      stylePrompt: `Natural, clear conversational speech for ${sum.speakerName}`,
      color: colors[idx % colors.length],
    };
  };

  // Updates custom voice configuration for a speaker
  const handleUpdateSpeakerConfig = (speakerName: string, updates: Partial<CustomSpeakerVoiceConfig>) => {
    const key = speakerName.toLowerCase();
    const spkIdx = currentResult.speakersSummary.findIndex((s) => s.speakerName.toLowerCase() === key);
    const existing = getSpeakerVoiceConfig(
      currentResult.speakersSummary[spkIdx] || { speakerName, speakerId: '', lineCount: 0, sampleUtterance: '' },
      spkIdx >= 0 ? spkIdx : 0
    );

    setCustomVoiceConfigs((prev) => ({
      ...prev,
      [key]: {
        ...existing,
        ...updates,
      },
    }));
  };

  // Assign a saved persona from database to this speaker
  const handleApplyPersona = (speakerName: string, persona: SavedVoicePersona) => {
    handleUpdateSpeakerConfig(speakerName, {
      voiceName: persona.voiceName,
      stylePrompt: persona.stylePrompt,
      color: persona.color,
      personaId: persona.id,
      personaName: persona.name,
    });
  };

  // Save current speaker settings as a new persona to the database
  const handleSaveToDatabase = (speakerName: string, config: CustomSpeakerVoiceConfig) => {
    const saved = savePersona({
      name: config.personaName || speakerName,
      voiceName: config.voiceName,
      stylePrompt: config.stylePrompt,
      color: config.color,
      tags: ['transcript-custom'],
    });

    const updatedList = getSavedPersonas();
    setSavedPersonas(updatedList);
    handleUpdateSpeakerConfig(speakerName, {
      personaId: saved.id,
      personaName: saved.name,
    });

    setSavedToastSpeaker(speakerName);
    setTimeout(() => {
      setSavedToastSpeaker(null);
    }, 2800);
  };

  // Dedicated audio player dispatcher
  const playAudioUrl = (url: string, speakerName: string) => {
    stopAudio();
    try {
      const audio = new Audio(url);
      audio.volume = 1.0;
      audioRef.current = audio;

      audio.onplay = () => {
        setPreviewLoadingSpeaker(null);
        setPreviewPlayingSpeaker(speakerName);
        setAutoplayNotice(null);
      };

      audio.onended = () => {
        setPreviewPlayingSpeaker(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setPreviewLoadingSpeaker(null);
        setPreviewPlayingSpeaker(null);
        setPreviewError('Unable to play audio in browser.');
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn('Autoplay blocked by browser policy:', e);
          setPreviewPlayingSpeaker(null);
          setPreviewLoadingSpeaker(null);
          setAutoplayNotice(`Audio ready! Click "Replay" on ${speakerName} to listen.`);
        });
      }
    } catch (err: any) {
      console.error('Audio play error:', err);
      setPreviewError('Could not initialize audio playback.');
    }
  };

  // Audio preview playback: Synthesize or Replay cached
  const handlePlayVoicePreview = async (
    speakerName: string,
    voiceName: GeminiVoiceName,
    sampleText: string,
    stylePrompt: string,
    forceRegenerate = false
  ) => {
    const cacheKey = `${speakerName.toLowerCase()}:::${sampleText.trim()}:::${voiceName}`;
    const existing = cachedPreviews[cacheKey];

    // If already playing this speaker, toggle stop
    if (previewPlayingSpeaker === speakerName) {
      stopAudio();
      return;
    }

    // Instant replay from cache without re-synthesizing
    if (existing && !forceRegenerate) {
      playAudioUrl(existing.audioUrl, speakerName);
      return;
    }

    stopAudio();
    setPreviewLoadingSpeaker(speakerName);
    setPreviewError(null);
    setAutoplayNotice(null);

    try {
      const response = await fetch('/api/dialogue/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceName,
          text: sampleText || 'Hello, this is a sample preview of my voice.',
          stylePrompt,
          forceRegenerate,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate voice preview audio');
      }

      const data = await response.json();
      if (!data.audioUrl) {
        throw new Error('No audio returned from preview generator');
      }

      const newRecord: CachedVoicePreview = {
        audioUrl: data.audioUrl,
        durationSec: data.durationSec || 1.5,
        voiceName,
        text: sampleText,
        synthesizedAt: Date.now(),
      };

      // Cache by unique key and by speaker name for immediate replay
      setCachedPreviews((prev) => ({
        ...prev,
        [cacheKey]: newRecord,
        [speakerName.toLowerCase()]: newRecord,
      }));

      setPreviewLoadingSpeaker(null);
      playAudioUrl(data.audioUrl, speakerName);
    } catch (err: any) {
      console.error('Preview error:', err);
      setPreviewLoadingSpeaker(null);
      setPreviewPlayingSpeaker(null);
      setPreviewError(err.message || 'Error auditioning voice preview.');
    }
  };

  // Handle final confirmation
  const handleConfirm = () => {
    stopAudio();
    const activeSpeakersSummary = currentResult.speakersSummary.filter((s) => !s.isExcluded);

    // 1. Build Speaker Profiles using customized or matched configs
    const newSpeakers: SpeakerProfile[] = activeSpeakersSummary.map((sum, idx) => {
      const config = getSpeakerVoiceConfig(sum, idx);
      return {
        id: sum.speakerId,
        name: sum.speakerName,
        voiceName: config.voiceName,
        stylePrompt: config.stylePrompt,
        color: config.color,
        savedPersonaId: config.personaId,
      };
    });

    // 2. Build Speaker Name to ID resolution map (including reassignments)
    const speakerNameToId = new Map<string, string>();
    newSpeakers.forEach((s) => speakerNameToId.set(s.name.toLowerCase(), s.id));

    // Excluded speakers that were reassigned
    currentResult.speakersSummary.forEach((s) => {
      if (s.isExcluded && s.excludeAction === 'reassign' && s.reassignedToSpeakerName) {
        const targetId = speakerNameToId.get(s.reassignedToSpeakerName.toLowerCase());
        if (targetId) {
          speakerNameToId.set(s.speakerName.toLowerCase(), targetId);
        }
      }
    });

    // Set of speakers completely omitted
    const omittedSpeakerNames = new Set(
      currentResult.speakersSummary
        .filter((s) => s.isExcluded && s.excludeAction === 'omit')
        .map((s) => s.speakerName.toLowerCase())
    );

    // 3. Build Dialogue Lines (filtering out omitted speakers, rebinding reassigned lines)
    const newLines: DialogueLine[] = [];
    currentResult.parsedLines.forEach((pl, i) => {
      const lower = pl.speakerName.toLowerCase();
      if (omittedSpeakerNames.has(lower)) {
        return; // Omit line
      }

      const assignedId = speakerNameToId.get(lower) || newSpeakers[0]?.id || 's1';
      newLines.push({
        id: `line_${Date.now()}_${i}`,
        speakerId: assignedId,
        rawText: pl.text,
        enhancedText: pl.text,
        isEnhanced: false,
        pauseAfterMs: 400,
      });
    });

    onConfirmPopulate(newSpeakers, newLines);
    onClose();
  };

  const activeCandidates = currentResult.speakersSummary.filter((s) => !s.isExcluded);
  const excludedCandidates = currentResult.speakersSummary.filter((s) => s.isExcluded);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#111726] border border-[#1e293b] rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#1e293b] bg-[#0d121c] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Transcript Verification & Speaker Review</h3>
              <p className="text-xs text-slate-400">
                Audition sample lines with instant voice preview, replay anytime, update matched personas, or omit scene headings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isValidatingLlm && (
              <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium bg-indigo-950/60 px-2.5 py-1 rounded-md border border-indigo-800/40 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>AI Checking Headings...</span>
              </span>
            )}
            <button
              onClick={() => {
                stopAudio();
                onClose();
              }}
              className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Verification Headline Banner (Exact format requested) */}
        <div className="p-4 bg-gradient-to-r from-indigo-950/40 via-[#131a29] to-indigo-950/40 border-b border-[#1e293b]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="grow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
                  Verification Summary Notice
                </span>
                {currentResult.hasLlmValidated && (
                  <span className="text-[10px] bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700/50 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>AI Validated</span>
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-100 mt-1 leading-relaxed font-sans">
                "{currentResult.summarySentence}"
              </p>
            </div>
          </div>
        </div>

        {autoplayNotice && (
          <div className="mx-4 mt-3 p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-lg text-xs text-amber-200 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{autoplayNotice}</span>
            </div>
            <button onClick={() => setAutoplayNotice(null)} className="text-amber-400 hover:text-white font-bold text-xs ml-2">
              ✕
            </button>
          </div>
        )}

        {previewError && (
          <div className="mx-4 mt-3 p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300 flex items-center justify-between">
            <span>{previewError}</span>
            <button onClick={() => setPreviewError(null)} className="text-rose-400 hover:text-white font-bold text-xs">
              ✕
            </button>
          </div>
        )}

        {/* Tabs: Speakers vs Ignored Lines */}
        <div className="px-5 pt-3 pb-2 border-b border-[#1e293b] bg-[#0f1422] flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('speakers')}
              className={`pb-2 border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'speakers'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>
                Discovered Speakers ({currentResult.uniqueSpeakersCount})
                {excludedCandidates.length > 0 && ` · ${excludedCandidates.length} Excluded`}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ignored')}
              className={`pb-2 border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'ignored'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Ignored Lines ({currentResult.ignoredLinesCount})</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            Pick sample lines · Instant audition & Replay button
          </span>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 grow">
          {activeTab === 'speakers' ? (
            <div className="space-y-4">
              {/* Active Discovered Speakers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Active Speakers ({activeCandidates.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Use "Replay" to listen repeatedly with zero re-synthesis delay
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeCandidates.map((sum, idx) => {
                    const voiceConfig = getSpeakerVoiceConfig(sum, idx);
                    const isFlaggedByLlm = sum.llmValidation && !sum.llmValidation.isValidSpeaker;
                    const isEditingThisVoice = editingVoiceForSpeaker === sum.speakerName;
                    const isLineDropdownOpen = openLineDropdownForSpeaker === sum.speakerName;

                    // All lines spoken by this character
                    const speakerLines = currentResult.parsedLines.filter(
                      (pl) => pl.speakerName.toLowerCase() === sum.speakerName.toLowerCase()
                    );

                    // Current chosen sample for audition
                    const chosenSample =
                      selectedSampleLines[sum.speakerName.toLowerCase()] ||
                      sum.sampleUtterance ||
                      speakerLines[0]?.text ||
                      '';

                    // Cache lookup for this speaker & line
                    const cacheKey = `${sum.speakerName.toLowerCase()}:::${chosenSample.trim()}:::${voiceConfig.voiceName}`;
                    const cachedAudio =
                      cachedPreviews[cacheKey] ||
                      (cachedPreviews[sum.speakerName.toLowerCase()]?.text === chosenSample
                        ? cachedPreviews[sum.speakerName.toLowerCase()]
                        : undefined);

                    const isAuditioning = previewPlayingSpeaker === sum.speakerName;
                    const isLoadingAudition = previewLoadingSpeaker === sum.speakerName;

                    return (
                      <div
                        key={sum.speakerName}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                          isFlaggedByLlm
                            ? 'bg-amber-950/20 border-amber-500/50'
                            : 'bg-[#0b0f17] border-[#1e293b] shadow-lg'
                        }`}
                      >
                        <div>
                          {/* Card Top Row: Name, Lines, Color */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: voiceConfig.color }}
                              />
                              <span className="text-sm font-bold text-white">{sum.speakerName}</span>
                            </div>
                            <span className="text-xs font-mono font-semibold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40 tabular-nums">
                              {sum.lineCount} {sum.lineCount === 1 ? 'line' : 'lines'}
                            </span>
                          </div>

                          {/* AI Flag warning if heading or timestamp was detected */}
                          {isFlaggedByLlm && (
                            <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200 mb-2 flex items-start gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span>{sum.llmValidation?.reason || 'Flagged as likely heading or timestamp.'}</span>
                            </div>
                          )}

                          {/* Matched Voice Banner & Update Voice Action */}
                          <div className="p-2 rounded-lg bg-[#0e1422] border border-slate-700/60 mb-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[11px] text-slate-300 truncate">
                                  Voice: <strong className="text-white">{voiceConfig.voiceName}</strong>
                                  {voiceConfig.personaName && (
                                    <span className="text-indigo-400 ml-1">
                                      (Persona: {voiceConfig.personaName})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingVoiceForSpeaker(isEditingThisVoice ? null : sum.speakerName);
                                setOpenLineDropdownForSpeaker(null);
                              }}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors ${
                                isEditingThisVoice
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                              }`}
                            >
                              <Sliders className="w-3 h-3" />
                              <span>{isEditingThisVoice ? 'Close Editor' : 'Update Voice'}</span>
                            </button>
                          </div>

                          {/* Voice Persona Editor Drawer */}
                          {isEditingThisVoice && (
                            <div className="mb-3 p-3 rounded-lg bg-[#080d16] border border-indigo-500/30 space-y-3 animate-fade-in">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1">
                                  <Sliders className="w-3 h-3" />
                                  <span>Update Voice & Persona</span>
                                </span>
                                {savedToastSpeaker === sum.speakerName && (
                                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                    <BookmarkCheck className="w-3 h-3" /> Saved to DB!
                                  </span>
                                )}
                              </div>

                              {/* 1. Pick from Saved Personas Database */}
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                  Or Choose from Saved Personas ({savedPersonas.length}):
                                </label>
                                <select
                                  value={voiceConfig.personaId || ''}
                                  onChange={(e) => {
                                    const found = savedPersonas.find((p) => p.id === e.target.value);
                                    if (found) {
                                      handleApplyPersona(sum.speakerName, found);
                                    }
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-[#0e1422] text-slate-200 border border-slate-700 rounded text-xs focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="">-- Select a saved voice persona --</option>
                                  {savedPersonas.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({p.voiceName}) · {p.stylePrompt.slice(0, 32)}...
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* 2. Choose Gemini Voice Model */}
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                  Gemini Voice Model:
                                </label>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {GEMINI_VOICES.map((v) => (
                                    <button
                                      key={v.name}
                                      type="button"
                                      onClick={() => handleUpdateSpeakerConfig(sum.speakerName, { voiceName: v.name })}
                                      className={`p-1.5 rounded text-left border transition-all ${
                                        voiceConfig.voiceName === v.name
                                          ? 'bg-indigo-600/30 border-indigo-400 text-white font-bold'
                                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                      }`}
                                    >
                                      <div className="text-[11px]">{v.name}</div>
                                      <div className="text-[9px] text-slate-500 truncate">{v.pitch}</div>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* 3. Style Instruction Prompt */}
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                  Voice Style & Tone Guidance:
                                </label>
                                <textarea
                                  value={voiceConfig.stylePrompt}
                                  onChange={(e) =>
                                    handleUpdateSpeakerConfig(sum.speakerName, { stylePrompt: e.target.value })
                                  }
                                  rows={2}
                                  placeholder="e.g. Battle-ready warrior declaring attacks with urgent breath..."
                                  className="w-full px-2.5 py-1.5 bg-[#0e1422] text-slate-200 border border-slate-700 rounded text-xs focus:outline-none focus:border-indigo-500 font-sans"
                                />
                              </div>

                              {/* Action Row inside Editor */}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                                <button
                                  type="button"
                                  onClick={() => handleSaveToDatabase(sum.speakerName, voiceConfig)}
                                  className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold rounded transition-colors"
                                  title="Saves this profile to database. Appends -2, -3 if name already exists."
                                >
                                  <Save className="w-3 h-3 text-indigo-400" />
                                  <span>Save as Persona</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setEditingVoiceForSpeaker(null)}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded transition-colors"
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Line Selection Dropdown & Scrollable Window (User Request) */}
                          <div className="relative mb-2.5">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-semibold text-slate-300">Audition Sample Line:</span>
                              <span className="text-[10px] text-indigo-400 font-mono">
                                ({speakerLines.length} {speakerLines.length === 1 ? 'line' : 'lines'} in transcript)
                              </span>
                            </div>

                            {/* Dropdown Toggle Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenLineDropdownForSpeaker(isLineDropdownOpen ? null : sum.speakerName);
                                setEditingVoiceForSpeaker(null);
                              }}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-[#080d16] hover:bg-[#0c121e] border border-slate-700 hover:border-slate-600 rounded-lg text-left text-xs text-slate-200 transition-colors shadow-inner"
                            >
                              <span className="truncate italic">"{chosenSample}"</span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
                                  isLineDropdownOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>

                            {/* Scrollable Window to choose from all transcript lines */}
                            {isLineDropdownOpen && (
                              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-[#0e1526] border border-indigo-500/40 rounded-xl shadow-2xl p-2 max-h-56 overflow-y-auto space-y-1">
                                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
                                  <span>Choose line to audition:</span>
                                  <span className="text-[10px] text-indigo-400 font-mono">{speakerLines.length} lines</span>
                                </div>

                                {speakerLines.map((line, lIdx) => {
                                  const isSelected = chosenSample === line.text;
                                  return (
                                    <button
                                      key={lIdx}
                                      type="button"
                                      onClick={() => {
                                        setSelectedSampleLines((prev) => ({
                                          ...prev,
                                          [sum.speakerName.toLowerCase()]: line.text,
                                        }));
                                        setOpenLineDropdownForSpeaker(null);
                                      }}
                                      className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-start gap-2.5 ${
                                        isSelected
                                          ? 'bg-indigo-600/30 border border-indigo-500/50 text-white font-medium'
                                          : 'text-slate-300 hover:bg-slate-800/80 border border-transparent'
                                      }`}
                                    >
                                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                                        Line {line.lineNum}
                                      </span>
                                      <span className="line-clamp-2 leading-relaxed italic grow">
                                        "{line.text}"
                                      </span>
                                      {isSelected && (
                                        <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Preview Voice & Replay Controls (User Request) */}
                          <div className="mb-3 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {cachedAudio ? (
                                <>
                                  {/* Replay Button (Zero network call, Instant Play) */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isAuditioning) {
                                        stopAudio();
                                      } else {
                                        playAudioUrl(cachedAudio.audioUrl, sum.speakerName);
                                      }
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all ${
                                      isAuditioning
                                        ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 ring-1 ring-emerald-400/50'
                                    }`}
                                    title="Replay this synthesized sample instantly without waiting or re-synthesizing"
                                  >
                                    {isAuditioning ? (
                                      <>
                                        <Square className="w-3.5 h-3.5 fill-current text-white" />
                                        <span>Stop Audio</span>
                                      </>
                                    ) : (
                                      <>
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Replay Sample ({cachedAudio.durationSec.toFixed(1)}s)</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Re-synthesize Button */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handlePlayVoicePreview(
                                        sum.speakerName,
                                        voiceConfig.voiceName,
                                        chosenSample,
                                        voiceConfig.stylePrompt,
                                        true
                                      )
                                    }
                                    disabled={isLoadingAudition}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
                                    title="Synthesize a new take with Gemini TTS"
                                  >
                                    {isLoadingAudition ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                    ) : (
                                      <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                                    )}
                                    <span>Re-synthesize</span>
                                  </button>
                                </>
                              ) : (
                                /* First-time Synthesize & Preview Button */
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePlayVoicePreview(
                                      sum.speakerName,
                                      voiceConfig.voiceName,
                                      chosenSample,
                                      voiceConfig.stylePrompt
                                    )
                                  }
                                  disabled={isLoadingAudition}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all ${
                                    isAuditioning
                                      ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/40'
                                  } disabled:opacity-50`}
                                >
                                  {isLoadingAudition ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Synthesizing Voice...</span>
                                    </>
                                  ) : isAuditioning ? (
                                    <>
                                      <Square className="w-3.5 h-3.5 fill-current text-white" />
                                      <span>Stop Audition</span>
                                    </>
                                  ) : (
                                    <>
                                      <Volume2 className="w-3.5 h-3.5" />
                                      <span>Preview Voice on Sample</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {isAuditioning && (
                                <span className="text-[11px] text-amber-300 font-mono flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-amber-400" />
                                  <span>Playing {voiceConfig.voiceName}...</span>
                                </span>
                              )}
                            </div>

                            {/* Fallback standard HTML5 audio element for direct user clicking and browser autoplay resilience */}
                            {cachedAudio && (
                              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-[#070b12] border border-slate-800/80">
                                <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <audio
                                  src={cachedAudio.audioUrl}
                                  controls
                                  className="h-6 w-full opacity-90 text-xs"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Exclusion & Reassignment Controls */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleOmitSpeaker(sum.speakerName)}
                            className="flex items-center gap-1 px-2 py-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
                            title="Exclude this candidate and ignore its lines as non-speaking headers"
                          >
                            <UserX className="w-3 h-3" />
                            <span>Omit Header</span>
                          </button>

                          {/* Reassign lines to another speaker dropdown */}
                          {activeCandidates.length > 1 && (
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500">Reassign to:</span>
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleReassignSpeaker(sum.speakerName, e.target.value);
                                  }
                                }}
                                defaultValue=""
                                className="px-2 py-0.5 bg-slate-800 text-slate-200 border border-slate-700 rounded text-[11px] focus:outline-none"
                              >
                                <option value="" disabled>
                                  Select speaker...
                                </option>
                                {activeCandidates
                                  .filter((o) => o.speakerName !== sum.speakerName)
                                  .map((target) => (
                                    <option key={target.speakerName} value={target.speakerName}>
                                      {target.speakerName}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Excluded Candidates Section */}
              {excludedCandidates.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <UserX className="w-3.5 h-3.5 text-rose-400" />
                    <span>Excluded Candidates & Headings ({excludedCandidates.length})</span>
                  </h4>

                  <div className="space-y-2">
                    {excludedCandidates.map((sum) => (
                      <div
                        key={sum.speakerName}
                        className="p-2.5 rounded-lg bg-[#090d15] border border-dashed border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="line-through text-slate-500 font-bold">{sum.speakerName}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            ({sum.lineCount} lines)
                          </span>
                          <span className="text-[11px] text-amber-400/80">
                            {sum.excludeAction === 'reassign'
                              ? `→ Reassigned to "${sum.reassignedToSpeakerName}"`
                              : '→ Omitted from script (treated as heading/comment)'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRestoreSpeaker(sum.speakerName)}
                          className="flex items-center gap-1 px-2 py-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded text-[11px] transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Ignored Lines tab */
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                These lines are not synthesized into spoken audio stems (including headings, timestamps, stage directions, and comments):
              </p>

              <div className="border border-[#1e293b] rounded-lg overflow-hidden max-h-[340px] overflow-y-auto bg-[#0b0f17]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f1422] text-slate-400 text-[11px] border-b border-[#1e293b]">
                    <tr>
                      <th className="p-2.5 font-mono w-16">Line #</th>
                      <th className="p-2.5">Content</th>
                      <th className="p-2.5 w-44">Reason Omitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e293b]/50">
                    {currentResult.ignoredLines.map((ign, i) => (
                      <tr key={i} className="hover:bg-slate-900/30">
                        <td className="p-2.5 font-mono text-slate-500">{ign.lineNum}</td>
                        <td className="p-2.5 font-mono text-slate-300 truncate max-w-xs">{ign.content}</td>
                        <td className="p-2.5 text-[11px] text-amber-400/90">{ign.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e293b] bg-[#0d121c] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Active speaking lines: <span className="font-semibold text-white">{currentResult.speakingLinesCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                stopAudio();
                onClose();
              }}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/40 transition-colors"
            >
              <span>Accept & Populate {currentResult.uniqueSpeakersCount} Speakers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
