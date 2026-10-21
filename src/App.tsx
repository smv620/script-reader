import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { TranscriptUploader } from './components/TranscriptUploader';
import { TranscriptValidationModal } from './components/TranscriptValidationModal';
import { PersonaLibraryModal } from './components/PersonaLibraryModal';
import { SpeakerManager } from './components/SpeakerManager';
import { EnhancerControls } from './components/EnhancerControls';
import { AmbientControls } from './components/AmbientControls';
import { ScriptEditor } from './components/ScriptEditor';
import { MultiTrackTimeline } from './components/MultiTrackTimeline';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import {
  SpeakerProfile,
  DialogueLine,
  DialogueProject,
  FillerIntensity,
  AmbientConfig,
  RenderedAudioStem,
  ReactionHook,
  SavedVoicePersona,
  TranscriptValidationResult,
} from './types/dialogue';
import { savePersona } from './services/personaDatabase';
import { AlertCircle, CheckCircle2, Sparkles, Layers, Download, Database, FileCheck } from 'lucide-react';

const INITIAL_SPEAKERS: SpeakerProfile[] = [
  {
    id: 's1',
    name: 'Hero',
    voiceName: 'Puck',
    stylePrompt: 'Enthusiastic, battle-ready hero declaring attacks with sharp breath and urgent energy',
    color: '#f59e0b', // Amber
  },
  {
    id: 's2',
    name: 'Goblin',
    voiceName: 'Fenrir',
    stylePrompt: 'Raspy, menacing goblin sneer, mocking with guttural texture and quick sneering cadence',
    color: '#10b981', // Emerald
  },
];

const INITIAL_LINES: DialogueLine[] = [
  {
    id: 'l1',
    speakerId: 's1',
    rawText: 'I take out my sword and attack the goblin.',
    enhancedText: 'I I take-take out my sword, and, uh, I attack the goblin!',
    isEnhanced: true,
    pauseAfterMs: 400,
    reactionHook: {
      id: 'react_init_1',
      triggerSpeakerId: 's2',
      reactionType: 'chuckle',
      offsetMs: 150,
      intensity: 0.8,
      reason: 'Goblin chuckles at the hero\'s dramatic shout',
    },
  },
  {
    id: 'l2',
    speakerId: 's2',
    rawText: 'Not before I slice your fancy shiny boots, little hero!',
    enhancedText: 'Not... not before I slice your, uh, fancy shiny boots, little hero!',
    isEnhanced: true,
    pauseAfterMs: 450,
  },
  {
    id: 'l3',
    speakerId: 's1',
    rawText: 'You talk big for a creature shorter than my shield!',
    enhancedText: 'You talk big, hah, for a creature shorter than my shield!',
    isEnhanced: true,
    pauseAfterMs: 400,
  },
  {
    id: 'l4',
    speakerId: 's2',
    rawText: "Big shield, slow reflexes! Let's see you dodge this venom blade!",
    enhancedText: "Big shield, slow reflexes! Let's... let's see you dodge this venom blade!",
    isEnhanced: true,
    pauseAfterMs: 400,
  },
];

export default function App() {
  const [speakers, setSpeakers] = useState<SpeakerProfile[]>(INITIAL_SPEAKERS);
  const [lines, setLines] = useState<DialogueLine[]>(INITIAL_LINES);
  const [fillerIntensity, setFillerIntensity] = useState<FillerIntensity>('dramatic');
  const [interSpeakerGapSec, setInterSpeakerGapSec] = useState<number>(0.4);
  const [ambientConfig, setAmbientConfig] = useState<AmbientConfig>({
    density: 'medium',
    enabledSounds: {
      paperShuffle: true,
      sniff: true,
      cough: true,
      chuckle: true,
      giggle: true,
      sigh: true,
    },
    volumeGain: 0.16,
  });

  const [stems, setStems] = useState<RenderedAudioStem[]>([]);
  const [masterAudioBase64, setMasterAudioBase64] = useState<string | null>(null);
  const [totalDurationSec, setTotalDurationSec] = useState<number>(0);

  // Status & Loaders
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [isDetectingReactions, setIsDetectingReactions] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Validation & Persona Library Modals
  const [validationResult, setValidationResult] = useState<TranscriptValidationResult | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState<boolean>(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState<boolean>(false);
  const [activePersonaTargetSpeaker, setActivePersonaTargetSpeaker] = useState<SpeakerProfile | undefined>(undefined);

  // Audio Playback Engine
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [masterVolume, setMasterVolume] = useState<number>(0.9);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [stemMuteState, setStemMuteState] = useState<Record<string, boolean>>({});
  const [stemSoloState, setStemSoloState] = useState<Record<string, boolean>>({});
  const [stemVolumeState, setStemVolumeState] = useState<Record<string, number>>({});

  // Audio elements map
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const masterAudioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioElementsRef.current.forEach((a) => a.pause());
      if (masterAudioRef.current) masterAudioRef.current.pause();
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Synchronize playback timeline
  useEffect(() => {
    if (isPlaying) {
      const updateLoop = () => {
        if (masterAudioRef.current) {
          const t = masterAudioRef.current.currentTime;
          setCurrentTimeSec(t);

          if (masterAudioRef.current.ended || (totalDurationSec > 0 && t >= totalDurationSec)) {
            setIsPlaying(false);
            setCurrentTimeSec(0);
            return;
          }
        }
        animationFrameRef.current = requestAnimationFrame(updateLoop);
      };
      animationFrameRef.current = requestAnimationFrame(updateLoop);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isPlaying, totalDurationSec]);

  // Apply volume, mute, solo states to stem audio elements
  useEffect(() => {
    const hasAnySolo = Object.values(stemSoloState).some(Boolean);

    audioElementsRef.current.forEach((audio, spkId) => {
      const isMuted = stemMuteState[spkId] || false;
      const isSolo = stemSoloState[spkId] || false;
      const vol = stemVolumeState[spkId] ?? 1.0;

      if (hasAnySolo) {
        audio.volume = isSolo ? Math.min(1, vol * masterVolume) : 0;
      } else {
        audio.volume = isMuted ? 0 : Math.min(1, vol * masterVolume);
      }
      audio.playbackRate = playbackRate;
    });

    if (masterAudioRef.current) {
      masterAudioRef.current.volume = masterVolume;
      masterAudioRef.current.playbackRate = playbackRate;
    }
  }, [stemMuteState, stemSoloState, stemVolumeState, masterVolume, playbackRate]);

  // Play / Pause toggle
  const handlePlayToggle = () => {
    if (!masterAudioRef.current && stems.length === 0) return;

    if (isPlaying) {
      if (masterAudioRef.current) masterAudioRef.current.pause();
      audioElementsRef.current.forEach((a) => a.pause());
      setIsPlaying(false);
    } else {
      if (masterAudioRef.current) {
        masterAudioRef.current.play().catch(console.error);
      }
      audioElementsRef.current.forEach((a) => {
        a.currentTime = currentTimeSec;
        a.play().catch(console.error);
      });
      setIsPlaying(true);
    }
  };

  // Seek handler
  const handleSeek = (timeSec: number) => {
    setCurrentTimeSec(timeSec);
    if (masterAudioRef.current) {
      masterAudioRef.current.currentTime = timeSec;
    }
    audioElementsRef.current.forEach((a) => {
      a.currentTime = timeSec;
    });
  };

  // Reset to 0
  const handleResetPlayback = () => {
    handleSeek(0);
  };

  // Transcript Validation Hook
  const handleTranscriptValidated = (result: TranscriptValidationResult) => {
    setValidationResult(result);
    setIsValidationModalOpen(true);
  };

  // Confirm and populate speakers from validated transcript
  const handleConfirmPopulateTranscript = (
    newSpeakers: SpeakerProfile[],
    newLines: DialogueLine[]
  ) => {
    setSpeakers(newSpeakers);
    setLines(newLines);
    setStems([]); // Reset previously rendered stems for new script
    setMasterAudioBase64(null);
    setCurrentTimeSec(0);
    setIsPlaying(false);

    showToast(
      `Populated ${newSpeakers.length} speaker profiles and ${newLines.length} lines from transcript!`,
      'success'
    );
  };

  // Open Persona Library
  const handleOpenPersonaLibrary = (targetSpeaker?: SpeakerProfile) => {
    setActivePersonaTargetSpeaker(targetSpeaker || speakers[0]);
    setIsPersonaModalOpen(true);
  };

  // Apply Persona from Library
  const handleSelectPersonaFromLibrary = (savedPersona: SavedVoicePersona) => {
    if (!activePersonaTargetSpeaker) return;

    const updated: SpeakerProfile = {
      ...activePersonaTargetSpeaker,
      voiceName: savedPersona.voiceName,
      stylePrompt: savedPersona.stylePrompt,
      color: savedPersona.color || activePersonaTargetSpeaker.color,
      savedPersonaId: savedPersona.id,
    };

    setSpeakers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    showToast(`Applied saved persona "${savedPersona.name}" (${savedPersona.voiceName})!`, 'success');
  };

  // Save Persona to Library (with automatic -2 -3 -4 duplicate naming)
  const handleSavePersonaToLibrary = (speaker: SpeakerProfile) => {
    const saved = savePersona({
      name: speaker.name || 'Voice Persona',
      voiceName: speaker.voiceName,
      stylePrompt: speaker.stylePrompt,
      color: speaker.color,
    });
    showToast(`Saved to Voice Database as "${saved.name}"!`, 'success');
  };

  // Core Synthesize Action
  const handleSynthesize = async () => {
    if (lines.length === 0) {
      showToast('Please add at least one line of dialogue to synthesize.', 'error');
      return;
    }

    setIsSynthesizing(true);
    try {
      const res = await fetch('/api/dialogue/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speakers,
          lines,
          interSpeakerGapSec,
          ambientConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to synthesize dialogue tracks');
      }

      setTotalDurationSec(data.totalDurationSec);
      setMasterAudioBase64(data.masterAudioBase64);

      // Create audio objects for each stem
      const newStems: RenderedAudioStem[] = [];
      const newAudioMap = new Map<string, HTMLAudioElement>();

      data.stems.forEach((st: any) => {
        const blob = b64ToBlob(st.audioBase64, 'audio/mp3');
        const url = URL.createObjectURL(blob);
        newStems.push({
          ...st,
          audioUrl: url,
        });

        const audio = new Audio(url);
        newAudioMap.set(st.speakerId, audio);
      });

      // Master mix audio
      if (data.masterAudioBase64) {
        const masterBlob = b64ToBlob(data.masterAudioBase64, 'audio/mp3');
        const masterUrl = URL.createObjectURL(masterBlob);
        masterAudioRef.current = new Audio(masterUrl);
      }

      audioElementsRef.current = newAudioMap;
      setStems(newStems);
      setCurrentTimeSec(0);
      setIsPlaying(false);

      showToast(
        `Synthesized ${newStems.length} synchronized stems (${data.totalDurationSec.toFixed(1)}s total). Ready for Audacity!`,
        'success'
      );
    } catch (err: any) {
      console.error('Synthesis error:', err);
      showToast(err.message || 'Error generating synchronized tracks', 'error');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Conversational Enhancer Action
  const handleEnhanceAll = async () => {
    if (lines.length === 0) return;
    setIsEnhancing(true);

    try {
      const payloadLines = lines.map((l) => {
        const spk = speakers.find((s) => s.id === l.speakerId);
        return {
          id: l.id,
          speakerName: spk?.name || 'Speaker',
          stylePrompt: spk?.stylePrompt || '',
          rawText: l.rawText,
        };
      });

      const res = await fetch('/api/dialogue/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: payloadLines,
          intensity: fillerIntensity,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to naturalize script');
      }

      const enhancedMap = new Map<string, string>();
      (data.enhancedLines || []).forEach((el: any) => {
        enhancedMap.set(el.id, el.enhancedText);
      });

      setLines((prev) =>
        prev.map((l) => {
          const enhanced = enhancedMap.get(l.id);
          return enhanced
            ? {
                ...l,
                enhancedText: enhanced,
                isEnhanced: true,
              }
            : l;
        })
      );

      showToast(`Naturalized all ${lines.length} lines with authentic fillers & stutters!`, 'success');
    } catch (err: any) {
      console.error('Enhance error:', err);
      showToast(err.message || 'Failed to enhance script', 'error');
    } finally {
      setIsEnhancing(false);
    }
  };

  // Auto-Detect Reaction Hooks
  const handleDetectReactions = async () => {
    if (lines.length < 2) {
      showToast('Add at least two lines of dialogue to detect banter reactions.', 'error');
      return;
    }
    setIsDetectingReactions(true);

    try {
      const res = await fetch('/api/dialogue/detect-reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines,
          speakers,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to detect reaction hooks');
      }

      const hooks = data.reactionHooks || [];
      if (hooks.length === 0) {
        showToast('No high-confidence reaction moments detected.', 'error');
        return;
      }

      setLines((prev) =>
        prev.map((l) => {
          const foundHook = hooks.find((h: any) => h.targetLineId === l.id);
          if (foundHook) {
            return {
              ...l,
              reactionHook: {
                id: `react_${Date.now()}_${l.id}`,
                triggerSpeakerId: foundHook.triggerSpeakerId,
                reactionType: foundHook.reactionType,
                offsetMs: foundHook.offsetMs || 200,
                intensity: 0.8,
                reason: foundHook.reason,
                autoDetected: true,
              },
            };
          }
          return l;
        })
      );

      showToast(`Placed ${hooks.length} non-verbal reaction hooks during pauses!`, 'success');
    } catch (err: any) {
      console.error('Detect reactions error:', err);
      showToast(err.message || 'Reaction detection failed', 'error');
    } finally {
      setIsDetectingReactions(false);
    }
  };

  // Download Individual Stem MP3
  const handleDownloadStem = (stem: RenderedAudioStem) => {
    const cleanSpeakerName = stem.speakerName.replace(/\s+/g, '_');
    const filename = `${cleanSpeakerName}_synced_track.mp3`;
    const blob = b64ToBlob(stem.audioBase64, 'audio/mp3');
    downloadBlob(blob, filename);
    showToast(`Downloaded ${filename} (padded with exact silence for Audacity)`, 'success');
  };

  // Download Master Combined Mix MP3
  const handleDownloadMaster = () => {
    if (!masterAudioBase64) return;
    const filename = `Dialogue_Master_Mix.mp3`;
    const blob = b64ToBlob(masterAudioBase64, 'audio/mp3');
    downloadBlob(blob, filename);
    showToast(`Downloaded combined audition mix (${filename})`, 'success');
  };

  // Speaker CRUD
  const handleAddSpeaker = () => {
    const newIdx = speakers.length + 1;
    const colors = ['#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const voices: any[] = ['Kore', 'Aoede', 'Zephyr', 'Charon', 'Puck', 'Fenrir'];

    const newSpeaker: SpeakerProfile = {
      id: `s_${Date.now()}`,
      name: `Character ${newIdx}`,
      voiceName: voices[(newIdx - 1) % voices.length],
      stylePrompt: 'Clear, engaging conversational delivery',
      color: colors[(newIdx - 1) % colors.length],
    };

    setSpeakers([...speakers, newSpeaker]);
    showToast(`Added ${newSpeaker.name} profile`, 'success');
  };

  const handleUpdateSpeaker = (updated: SpeakerProfile) => {
    setSpeakers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleRemoveSpeaker = (speakerId: string) => {
    if (speakers.length <= 2) {
      showToast('At least two speakers are required for dialogue sync.', 'error');
      return;
    }
    const remaining = speakers.filter((s) => s.id !== speakerId);
    setSpeakers(remaining);

    // Reassign orphan lines to first remaining speaker
    setLines((prev) =>
      prev.map((l) => (l.speakerId === speakerId ? { ...l, speakerId: remaining[0].id } : l))
    );
    showToast('Speaker removed and dialogue lines reassigned', 'success');
  };

  // Line CRUD
  const handleAddLine = (afterIndex?: number) => {
    const defaultSpeaker = speakers[lines.length % speakers.length] || speakers[0];
    const newLine: DialogueLine = {
      id: `line_${Date.now()}`,
      speakerId: defaultSpeaker.id,
      rawText: 'New dialogue utterance.',
      enhancedText: 'New dialogue utterance.',
      isEnhanced: false,
      pauseAfterMs: Math.round(interSpeakerGapSec * 1000),
    };

    if (afterIndex === undefined || afterIndex === -1) {
      setLines([...lines, newLine]);
    } else {
      const next = [...lines];
      next.splice(afterIndex + 1, 0, newLine);
      setLines(next);
    }
  };

  const handleUpdateLine = (updated: DialogueLine) => {
    setLines((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  const handleRemoveLine = (lineId: string) => {
    if (lines.length <= 1) {
      showToast('Keep at least one dialogue line in your script.', 'error');
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const handleMoveLine = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= lines.length) return;

    const copy = [...lines];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    setLines(copy);
  };

  // Presets
  const handleLoadPreset = (presetName: string) => {
    if (presetName === 'goblin_battle') {
      setSpeakers(INITIAL_SPEAKERS);
      setLines(INITIAL_LINES);
      setFillerIntensity('dramatic');
      showToast('Loaded Goblin Battle preset with battle-ready stutters & fillers!', 'success');
    } else if (presetName === 'detective_noir') {
      const noirSpeakers: SpeakerProfile[] = [
        {
          id: 's_det',
          name: 'Detective Cole',
          voiceName: 'Charon',
          stylePrompt: 'Weary, gravelly film-noir detective, speaking slowly between cigarette drags',
          color: '#64748b',
        },
        {
          id: 's_fem',
          name: 'Vera Vance',
          voiceName: 'Kore',
          stylePrompt: 'Velvety, enigmatic femme fatale, calm and mocking',
          color: '#ec4899',
        },
      ];
      const noirLines: DialogueLine[] = [
        {
          id: 'nl1',
          speakerId: 's_det',
          rawText: 'The rain has been hitting this window for three hours, Vance.',
          enhancedText: 'The rain... the rain has been hitting this window for, uh, three straight hours, Vance.',
          isEnhanced: true,
          pauseAfterMs: 450,
          reactionHook: {
            id: 'nr1',
            triggerSpeakerId: 's_fem',
            reactionType: 'sigh',
            offsetMs: 200,
            intensity: 0.8,
            reason: 'Vera sighs at the detective\'s melancholy',
          },
        },
        {
          id: 'nl2',
          speakerId: 's_fem',
          rawText: "And you've been nursing that same bitter bourbon just as long.",
          enhancedText: "And... and you've been nursing that same bitter bourbon, hah, just as long.",
          isEnhanced: true,
          pauseAfterMs: 400,
        },
        {
          id: 'nl3',
          speakerId: 's_det',
          rawText: 'Where were you when the clock struck midnight at the docks?',
          enhancedText: 'Where were you... tell me, where were you when the clock struck midnight at the docks?',
          isEnhanced: true,
          pauseAfterMs: 500,
        },
        {
          id: 'nl4',
          speakerId: 's_fem',
          rawText: 'Making sure your partner stayed alive. You should be thanking me.',
          enhancedText: 'Making sure... well, making sure your partner stayed alive. You... you should be thanking me.',
          isEnhanced: true,
          pauseAfterMs: 400,
        },
      ];
      setSpeakers(noirSpeakers);
      setLines(noirLines);
      setFillerIntensity('moderate');
      showToast('Loaded Detective Noir preset with weary pacing and quiet sighs!', 'success');
    } else if (presetName === 'podcast_debate') {
      const podSpeakers: SpeakerProfile[] = [
        {
          id: 's_host',
          name: 'Leo',
          voiceName: 'Puck',
          stylePrompt: 'Energetic, fast-talking podcast host, passionate and smiling',
          color: '#3b82f6',
        },
        {
          id: 's_guest',
          name: 'Dr. Sarah',
          voiceName: 'Aoede',
          stylePrompt: 'Thoughtful, articulate AI researcher, amused by bold claims',
          color: '#8b5cf6',
        },
      ];
      const podLines: DialogueLine[] = [
        {
          id: 'pl1',
          speakerId: 's_host',
          rawText: 'Sarah, people are claiming we will reach full human-level AGI by Tuesday!',
          enhancedText: 'Sarah, I mean, people are claiming we will... we will reach full human-level AGI by, uh, Tuesday!',
          isEnhanced: true,
          pauseAfterMs: 400,
          reactionHook: {
            id: 'pr1',
            triggerSpeakerId: 's_guest',
            reactionType: 'giggle',
            offsetMs: 150,
            intensity: 0.9,
            reason: 'Sarah giggles at the absurdity of the Tuesday timeline',
          },
        },
        {
          id: 'pl2',
          speakerId: 's_guest',
          rawText: 'By Tuesday? I think Tuesday is when they schedule the server maintenance.',
          enhancedText: 'By Tuesday? <laugh> I... I think Tuesday is when they schedule the server maintenance.',
          isEnhanced: true,
          pauseAfterMs: 400,
        },
        {
          id: 'pl3',
          speakerId: 's_host',
          rawText: "So you're saying the robots won't be doing my laundry next week?",
          enhancedText: "So you're... you're saying the robots won't be doing my laundry next week?",
          isEnhanced: true,
          pauseAfterMs: 400,
        },
      ];
      setSpeakers(podSpeakers);
      setLines(podLines);
      setFillerIntensity('moderate');
      showToast('Loaded Tech Podcast preset with conversational giggles and banter!', 'success');
    }
  };

  const project: DialogueProject = {
    id: 'active_project',
    title: 'Dialogue Project',
    interSpeakerGapSec,
    fillerIntensity,
    ambientConfig,
    speakers,
    lines,
    masterAudioBase64: masterAudioBase64 || undefined,
    totalDurationSec,
    stems,
    isGenerating: isSynthesizing,
  };

  const reactionCount = lines.filter((l) => Boolean(l.reactionHook)).length;
  const enhancedCount = lines.filter((l) => l.isEnhanced && l.enhancedText !== l.rawText).length;

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col pb-24">
      {/* Top Bar with Top Bar Contract */}
      <TopBar
        onSynthesize={handleSynthesize}
        isSynthesizing={isSynthesizing}
        hasAudio={stems.length > 0}
        onPlayToggle={handlePlayToggle}
        isPlaying={isPlaying}
      />

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-6 py-6 w-full grow">
        {/* Toast Notification */}
        {notification && (
          <div
            className={`mb-6 p-3 rounded-lg border flex items-center justify-between text-xs font-medium animate-fade-in ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hero Banner / Instructions summary */}
        <div className="bg-gradient-to-r from-[#111726] to-[#151c2e] border border-[#1e293b] rounded-xl p-5 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 mb-1">
                <span>Synchronized Multi-Stem Audio Production</span>
                <span>·</span>
                <span>Audacity Ready</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Multi-Track Synchronized Dialogue Engine
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Upload any transcript to automatically discover speakers, calculate speaking vs. ignored lines, and look up remembered voice personas. Synthesize sample-accurate isolated MP3 stems with organic filler naturalization and ambient gap distractions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => handleOpenPersonaLibrary()}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>Voice Database</span>
              </button>

              <button
                onClick={handleSynthesize}
                disabled={isSynthesizing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-lg shadow-indigo-950/50 transition-all whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Synthesize Synced Stems</span>
              </button>
            </div>
          </div>
        </div>

        {/* 1. Transcript Upload & Validation Section */}
        <div id="upload-section">
          <TranscriptUploader onValidated={handleTranscriptValidated} />
        </div>

        {/* 2. Speaker Profiles Section */}
        <SpeakerManager
          speakers={speakers}
          onUpdateSpeaker={handleUpdateSpeaker}
          onAddSpeaker={handleAddSpeaker}
          onRemoveSpeaker={handleRemoveSpeaker}
          onOpenPersonaLibrary={handleOpenPersonaLibrary}
          onSavePersonaToLibrary={handleSavePersonaToLibrary}
        />

        {/* 3. Conversational Enhancer & Fillers Section */}
        <EnhancerControls
          intensity={fillerIntensity}
          onChangeIntensity={setFillerIntensity}
          onEnhanceAll={handleEnhanceAll}
          isEnhancing={isEnhancing}
          totalLines={lines.length}
          enhancedCount={enhancedCount}
        />

        {/* 4. Ambient Distraction & Reaction Hooks Section */}
        <AmbientControls
          config={ambientConfig}
          onChangeConfig={setAmbientConfig}
          onDetectReactions={handleDetectReactions}
          isDetectingReactions={isDetectingReactions}
          reactionCount={reactionCount}
        />

        {/* 5. Script Editor Section */}
        <ScriptEditor
          lines={lines}
          speakers={speakers}
          onUpdateLine={handleUpdateLine}
          onAddLine={handleAddLine}
          onRemoveLine={handleRemoveLine}
          onMoveLine={handleMoveLine}
          onLoadPreset={handleLoadPreset}
          interSpeakerGapSec={interSpeakerGapSec}
          onChangeInterSpeakerGap={setInterSpeakerGapSec}
        />

        {/* 6. Synchronized Multi-Track Timeline & Stems Section */}
        <MultiTrackTimeline
          project={project}
          currentTimeSec={currentTimeSec}
          onSeek={handleSeek}
          isPlaying={isPlaying}
          onPlayToggle={handlePlayToggle}
          onDownloadStem={handleDownloadStem}
          onDownloadMaster={handleDownloadMaster}
          stemMuteState={stemMuteState}
          onToggleStemMute={(id) => setStemMuteState((prev) => ({ ...prev, [id]: !prev[id] }))}
          stemSoloState={stemSoloState}
          onToggleStemSolo={(id) => setStemSoloState((prev) => ({ ...prev, [id]: !prev[id] }))}
          stemVolumeState={stemVolumeState}
          onChangeStemVolume={(id, vol) => setStemVolumeState((prev) => ({ ...prev, [id]: vol }))}
        />
      </main>

      {/* Transcript Validation & Verification Modal */}
      <TranscriptValidationModal
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        validationResult={validationResult}
        onConfirmPopulate={handleConfirmPopulateTranscript}
      />

      {/* Persistent Voice Persona Library Modal */}
      <PersonaLibraryModal
        isOpen={isPersonaModalOpen}
        onClose={() => setIsPersonaModalOpen(false)}
        onSelectPersona={handleSelectPersonaFromLibrary}
        activeSpeakerProfile={activePersonaTargetSpeaker}
      />

      {/* Sticky Bottom Audio Audition Player */}
      {stems.length > 0 && (
        <AudioPlayerBar
          isPlaying={isPlaying}
          onPlayToggle={handlePlayToggle}
          onReset={handleResetPlayback}
          currentTimeSec={currentTimeSec}
          totalDurationSec={totalDurationSec}
          onSeek={handleSeek}
          masterVolume={masterVolume}
          onChangeMasterVolume={setMasterVolume}
          playbackRate={playbackRate}
          onChangePlaybackRate={setPlaybackRate}
          onDownloadMaster={handleDownloadMaster}
        />
      )}
    </div>
  );
}

// ==========================================
// CLIENT UTILS: BASE64 TO BLOB & DOWNLOAD
// ==========================================

function b64ToBlob(b64Data: string, contentType = 'audio/mp3', sliceSize = 512): Blob {
  const byteCharacters = atob(b64Data);
  const byteArrays: Uint8Array[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays as any, { type: contentType });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
