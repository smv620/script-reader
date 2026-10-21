# Multi-Track Dialogue Studio: Gemini Synchronized Multi-Voice Engine

A dedicated audio dialogue workstation that parses multi-speaker transcripts, assigns distinct Gemini TTS voice profiles, enriches dialogue with natural conversational nuances (ums, ahs, word stutters, and emotional delivery), and synthesizes sample-accurate audio tracks with configurable ambient non-verbal distractions during pauses for effortless drag-and-drop alignment in Audacity or digital audio workstations (DAWs).

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural parameters have been established based on your preferences:

- **Confirmed Dialogue Timing**: Natural conversational pacing with brief realistic gaps between speaker turns (~0.35s–0.5s pause), maintaining natural rhythmic flow while keeping total track duration identical across all speaker stems.
- **Ambient Gap Distraction Engine & Reaction Hooks**: A dedicated setting controlling the frequency and type of subtle ambient sounds during silence intervals (paper shuffle, soft sniff, quiet throat clearing/cough, subtle breath, or soft chuckle/giggle). Includes an extensible reaction-hook architecture (`humorTrigger`, `tensionTrigger`) ready for future automated context detection while allowing manual toggle per gap.
- **Confirmed Conversational Enhancer**: AI-assisted speech naturalizer equipped with an adjustable filler intensity slider (from Subtle hesitation to Action/Battle-Ready dramatic stutters and vocal bursts), allowing side-by-side inspection and custom editing.
- **Confirmed Audio Export Package**: Dedicated high-fidelity MP3 downloads for each speaker stem (padded with exact silence/ambient stems for Audacity layering), alongside a master preview mix combining all voices for direct in-browser auditioning.
- **Dynamic Speaker Configuration**: Effortless addition, removal, and reconfiguration of speakers with distinct Gemini voices (`Puck`, `Charon`, `Kore`, `Fenrir`, `Zephyr`, `Aoede`), gender/pitch indicators, and personalized emotional delivery prompts.

---

## 1. Overview & Core Concept

### What It Does
The Multi-Track Dialogue Studio turns raw dialogue transcripts into synchronized, multi-channel vocal tracks. Each speaker receives their own distinct Gemini-synthesized voice profile. Rather than delivering a single merged file where individual character volumes or EQ cannot be adjusted, the studio calculates the exact timeline placement of each utterance and inserts silence or organic ambient filler into non-speaking intervals. When the exported MP3s are dragged into Audacity or any DAW at time zero, the dialogue flows naturally with conversational timing, without manual alignment.

### Target Audience / Persona
- **Audio dramatists, tabletop RPG podcasters, and game developers** building dynamic conversations (e.g., fantasy battle banter, dramatic narrations, multi-character audio plays).
- **Video editors and sound designers** who require isolated dialogue tracks for mixing, spatial panning, individual reverb, and mastering.

### Key Value
- **Zero-Manual-Splicing Sync**: Every speaker stem shares the exact same start, finish, and sample length. Non-speaking portions are filled with calibrated silence or subtle ambient life.
- **Ambient Life in Pauses**: Eliminates "dead digital silence" between lines by providing natural Foley and non-verbal reactions (paper shuffle, quiet breath, sniff, soft chuckle).
- **Living Conversational Flow**: Transforms stiff written lines into authentic spoken dialogue with natural repetitions ("I I take-take"), hesitations ("uh", "um"), breath marks, and energetic delivery instructions.
- **Full Creative Control**: Tweak speaker count, reassign lines, adjust voice styles, toggle enhancements per line, and preview the synchronized multi-track playback directly before exporting.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Script Ingestion & Speaker Identification**:
   - The user pastes an existing transcript (e.g., `Hero: I take out my sword... / Goblin: Not if I strike first!`) or selects from curated fantasy, tabletop, and courtroom presets.
   - The engine automatically detects speaker tags, counts unique characters, and assigns initial voice profiles with complementary vocal tones.
2. **Speaker Profile Management**:
   - The user can add, edit, or delete speaker personas in the Speaker Manager drawer.
   - For each speaker, choose a Gemini voice model, set tone instructions (e.g., *"Enthusiastic, battle-ready hero, tense breath"*, *"Raspy, menacing goblin sneer"*), and preview sample phonemes.
3. **Conversational Naturalizer & Ambient Gap Controls**:
   - **Filler Intensity Slider**: Set filler density (`Subtle` -> `Moderate` -> `Dramatic / Battle-Ready`) to insert stutters, repetitions, and pauses.
   - **Ambient Silence Distractions Panel**:
     - *Distraction Density*: `Off (Dead Silence)` / `Low` / `Medium` / `High`.
     - *Distraction Types*: Toggle individual sound types (Paper rustle, quiet sniff, throat clear/soft cough, gentle chuckle/giggle reaction, desk tap, sigh).
     - *Reaction Hook Slots*: Per-gap indicators where users can force or preview a reaction (e.g., "Reaction: Soft chuckle to Goblin's boast").
4. **Synchronized Generation & Multi-Track Synthesis**:
   - Click **"Generate Synchronized Tracks"**.
   - Server synthesizes each utterance using Gemini TTS, measures exact millisecond durations, generates silence/ambient buffers for inactive speakers, and mixes subtle Foley at calibrated low volume (-18dB).
   - The interactive **Multi-Track Timeline** visualizes speech blocks, silence pads, and ambient distraction markers for each speaker.
5. **Playback Audition & Master Export**:
   - Audition playback with a synchronized multi-track audio player featuring solo/mute buttons, waveform seekbars, and a master volume fader.
   - Export individual synced tracks (`Speaker_1_Hero_synced.mp3`, `Speaker_2_Goblin_synced.mp3`) and the combined audition mix (`Dialogue_Master_Mix.mp3`).

### Visual Identity & Theme (SaaS Dashboard & Creator Audio Workstation)
- **Aesthetic Direction**: High-precision creator studio interface inspired by professional digital audio workstations and modern creative tooling. Clean typography, deep charcoal surfaces, and amber/cyan channel indicators.
- **Color Palette**:
  - Background Neutral: Deep obsidian slate (`#0B0F17`) and structural surface graphite (`#151C28`).
  - Card & Divider Lines: Subtle 1px borders (`#222F44`).
  - Speaker Accents:
    - Speaker 1 (Hero/Protagonist): Amber/Gold (`#F59E0B`)
    - Speaker 2 (Goblin/Antagonist): Emerald/Cyan (`#10B981`)
    - Speaker 3+ (Dynamic additions): Violet (`#8B5CF6`) & Coral (`#F43F5E`)
  - Primary Action / CTAs: Vivid Indigo/Electric Blue (`#4F46E5` / `#6366F1`).
- **Typography**:
  - Brand & Navigation: `Plus Jakarta Sans` for clean, professional headers.
  - Controls & Prose: `Public Sans` / `DM Sans` for dense readability.
  - Timestamps, Durations & Sample Counters: `font-mono tabular-nums` (`JetBrains Mono`).
- **Component Styling**:
  - Single-elevation depth with high-contrast waveform tracks.
  - Strict Top Bar Contract: Wordmark on left, 4 navigation jump links (`Script`, `Speakers`, `Enhancer`, `Timeline`), and 1 primary action button (`Generate All Tracks`).
  - Zero-pill metadata: Speaker tags and durations displayed with crisp typographic separators (`Speaker 1 · Fenrir · 4.2s`).

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Utterance-Level Synthesis with Ambient Silence Stitching
- **Chosen Approach**: Synthesize individual speaker turns sequentially via Gemini TTS (`gemini-3.8-flash-tts` / `gemini-3.8-flash-lite-tts`), measure exact duration of each rendered segment, and construct padded multi-channel buffers where non-speaking intervals receive calibrated silence or subtle ambient distraction events.
- **Why**: Monolithic multi-speaker generation outputs a single interleaved audio stream where individual voices cannot be separated into distinct isolated tracks for Audacity. Turn-based synthesis allows sample-accurate stem construction and precise ambient insertion.
- **Alternatives Considered**: Monolithic 2-speaker generation (limited to exactly 2 speakers and cannot produce isolated stem tracks).

### Decision 2: Sample-Accurate Silence Padding & Ambient Foley Timing
- **Chosen Approach**: When Speaker A speaks for duration $T_A$, Speaker B's track receives $T_A$ duration of audio. If the ambient distraction setting is enabled and $T_A > 1.2\text{s}$, a low-volume ambient event (e.g., sniff, chuckle, or paper rustle) is scheduled within Speaker B's gap without shifting the speech alignment.
- **Why**: Keeps all tracks starting at $T=0.000\text{s}$ and ending at the exact same millisecond while adding lively human presence to what would otherwise be sterile digital silence.

### Decision 3: Extensible Reaction Hook Architecture
- **Chosen Approach**: Introduce a `ReactionHook` interface on silence intervals (`type: 'chuckle' | 'sniff' | 'paper_shuffle' | 'cough' | 'giggle' | 'custom'`). Currently triggered via probability density or manual line flags, with clean hook interfaces (`evaluateReactionContext(lineBefore, lineAfter)`) ready for future automated semantic humor/tension analysis.
- **Why**: Satisfies current ambient feature requirements while creating clean architectural extension points for future AI humor detection.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND CLIENT (React)                         │
├────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐  ┌────────────────────────────────────────┐ │
│  │   Transcript Editor   │  │       Speaker Profile Manager          │ │
│  │  - Speaker Line Parser│  │  - Voice Selector (Puck, Kore, etc.)   │ │
│  │  - Script Presets     │  │  - Emotional Prompt / Style Config     │ │
│  └───────────┬───────────┘  └───────────────────┬────────────────────┘ │
│              │                                  │                      │
│  ┌───────────▼──────────────────────────────────▼────────────────────┐ │
│  │               Conversational Speech Enhancer                      │ │
│  │  - Filler Intensity (Subtle / Moderate / Battle-Ready)            │ │
│  │  - Ambient Silence Distraction Controls (Foley, Sniffs, Chuckles) │ │
│  │  - Reaction Hooks (Future Semantic Humor Expansion Ready)         │ │
│  └───────────────────────────┬───────────────────────────────────────┘ │
│                              │                                         │
│  ┌───────────────────────────▼───────────────────────────────────────┐ │
│  │          Synchronized Multi-Track Timeline & Player               │ │
│  │  - Visual Waveforms, Silence Pads & Foley Event Badges            │ │
│  │  - Solo / Mute / Track Volume Controls                            │ │
│  │  - Master Mix Preview & Individual Synced MP3 Download Links      │ │
│  └───────────────────────────▲───────────────────────────────────────┘ │
└──────────────────────────────┼─────────────────────────────────────────┘
                               │ HTTP /api/dialogue/*
┌──────────────────────────────▼─────────────────────────────────────────┐
│                        EXPRESS BACKEND (server.ts)                     │
├────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐  ┌────────────────────────────────────────┐ │
│  │ /api/dialogue/enhance │  │       /api/dialogue/synthesize         │ │
│  │ - Gemini 3.8 Flash    │  │ - Sequential Gemini TTS per Utterance  │ │
│  │ - Adds ums, ahs,      │  │ - Measures segment sample lengths      │ │
│  │   stutters, and style │  │ - Injects ambient foley in silence gaps │ │
│  └───────────────────────┘  │ - Encodes synced stems & master mix    │ │
│                             └────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Models & State Structure

```typescript
export interface AmbientConfig {
  density: 'none' | 'low' | 'medium' | 'high';
  enabledSounds: {
    paperShuffle: boolean;
    sniff: boolean;
    cough: boolean;
    chuckle: boolean;
    giggle: boolean;
    sigh: boolean;
  };
  volumeGain: number; // e.g., 0.15 (-16dB) so ambient never clashes with dialogue
}

export interface ReactionHook {
  id: string;
  targetLineId: string;
  triggerSpeakerId: string; // The speaker reacting during another speaker's turn
  reactionType: 'chuckle' | 'giggle' | 'sniff' | 'cough' | 'paper_shuffle' | 'sigh';
  offsetMs: number;         // When into the silence the reaction occurs
  intensity: number;
  autoDetected?: boolean;   // Hook for future humor-detection algorithms
}

export interface SpeakerProfile {
  id: string;
  name: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' | 'Aoede';
  stylePrompt: string; // e.g. "Excited, battle-ready adventurer with urgent breaths"
  color: string;       // Theme color for timeline track and markers
}

export interface DialogueLine {
  id: string;
  speakerId: string;
  rawText: string;
  enhancedText: string;
  isEnhanced: boolean;
  pauseAfterMs?: number;
  reactionHook?: ReactionHook;
}

export interface RenderedAudioStem {
  speakerId: string;
  speakerName: string;
  audioUrl: string;       // URL for the synced MP3 track (with silence & ambient)
  durationSec: number;    // Exactly matches all other stems
  segments: {
    startSec: number;
    endSec: number;
    text: string;
    isSpeech: boolean;    // true = dialogue, false = silence/ambient
    ambientEvent?: string; // e.g. "paper_shuffle" or "soft_chuckle"
  }[];
}

export interface DialogueProject {
  id: string;
  title: string;
  interSpeakerGapSec: number;
  fillerIntensity: 'subtle' | 'moderate' | 'dramatic';
  ambientConfig: AmbientConfig;
  speakers: SpeakerProfile[];
  lines: DialogueLine[];
  masterAudioUrl?: string;
  stems: RenderedAudioStem[];
}
```

### Verification Plan
1. **Script Parsing & Speaker Assignment**: Test parsing multi-speaker lines, dynamically adding/removing speakers, and re-assigning lines.
2. **Conversational Enhancer Test**: Test enhancing the goblin battle line (*"I take out my sword and attack the goblin."* -> *"I I take-take out my sword, and, uh, I attack the goblin!"*) with diff view.
3. **Ambient Silence Distraction & Reaction Hooks**: Verify that silence gaps ($>1.2\text{s}$) correctly receive subtle ambient sounds (paper shuffle, sniff, chuckle) based on ambient settings without displacing speech synchronization.
4. **Audio Generation & Silence Padding**: Verify that generated tracks for all speakers have identical duration down to the millisecond, with speech in one corresponding to silence/ambient in others.
5. **Playback & Export**: Verify in-browser multi-track synchronized auditioning and individual high-fidelity MP3 downloads.
6. **Compilation & Linting**: Run `compile_applet` and `lint_applet` to guarantee zero build errors.
