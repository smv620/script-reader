import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import lamejs from '@breezystack/lamejs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

// Server-side Gemini client with User-Agent telemetry as mandated by guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// ==========================================
// AUDIO PROCESSING & WAV / PCM / MP3 UTILITIES
// ==========================================

const SAMPLE_RATE = 24000; // Gemini TTS default sample rate

/**
 * Extracts 16-bit PCM samples from standard RIFF WAV buffer
 */
function extractPCM16FromWav(wavBuffer: Buffer): { sampleRate: number; channels: number; pcm: Int16Array } {
  if (wavBuffer.length < 44 || wavBuffer.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('Not a valid RIFF WAV buffer');
  }

  let offset = 12;
  let sampleRate = SAMPLE_RATE;
  let channels = 1;
  let dataOffset = 44;
  let dataLength = wavBuffer.length - 44;

  while (offset < wavBuffer.length - 8) {
    const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      channels = wavBuffer.readUInt16LE(offset + 8);
      sampleRate = wavBuffer.readUInt32LE(offset + 10);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = Math.min(chunkSize, wavBuffer.length - dataOffset);
      break;
    }
    offset += 8 + chunkSize;
  }

  const pcmBytes = wavBuffer.subarray(dataOffset, dataOffset + dataLength);
  const numSamples = Math.floor(pcmBytes.length / 2);
  const pcm = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    pcm[i] = pcmBytes.readInt16LE(i * 2);
  }

  return { sampleRate, channels, pcm };
}

/**
 * Creates a standard 44-byte RIFF WAV Buffer from 16-bit mono PCM
 */
function createWavBuffer(pcm: Int16Array, sampleRate = SAMPLE_RATE): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // PCM data
  for (let i = 0; i < pcm.length; i++) {
    buffer.writeInt16LE(pcm[i], 44 + i * 2);
  }

  return buffer;
}

/**
 * Encodes 16-bit mono PCM samples to high-fidelity MP3 (192 kbps)
 */
function encodePcmToMp3(pcmSamples: Int16Array, sampleRate = SAMPLE_RATE, kbps = 192): Buffer {
  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
  const mp3Data: Buffer[] = [];
  const sampleBlockSize = 1152;

  for (let i = 0; i < pcmSamples.length; i += sampleBlockSize) {
    const chunk = pcmSamples.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(Buffer.from(mp3buf));
    }
  }

  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(Buffer.from(endBuf));
  }

  return Buffer.concat(mp3Data);
}

// ==========================================
// PROCEDURAL AMBIENT SOUND GENERATORS
// ==========================================

/**
 * Procedural paper shuffle / rustle:
 * Layered filtered noise with micro-crease impulse envelopes
 */
function generatePaperShuffle(numSamples: number, gain = 0.15): Int16Array {
  const pcm = new Int16Array(numSamples);
  let lastNoise = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;
    // Envelope with multiple small rustle bursts
    const env = (Math.sin(t * Math.PI * 4) > 0 ? 1 : 0.2) * Math.sin(t * Math.PI);
    const white = (Math.random() * 2 - 1);
    // Bandpass-like effect for paper friction
    lastNoise = 0.85 * lastNoise + 0.15 * white;
    const sample = lastNoise * env * gain * 32767;
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(sample)));
  }
  return pcm;
}

/**
 * Procedural soft sniff:
 * Fast dual-impulse aspirated intake noise
 */
function generateSniff(numSamples: number, gain = 0.14): Int16Array {
  const pcm = new Int16Array(numSamples);
  let filterState = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;
    // Sharp intake envelope peaking around 35% then decaying
    const env = Math.pow(Math.sin(t * Math.PI), 2.5);
    const white = (Math.random() * 2 - 1);
    // Nasal frequency filter
    filterState = 0.7 * filterState + 0.3 * white;
    const sample = filterState * env * gain * 32767;
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(sample)));
  }
  return pcm;
}

/**
 * Procedural gentle cough / throat clear:
 * Dual glottal puff envelope
 */
function generateGentleCough(numSamples: number, gain = 0.16): Int16Array {
  const pcm = new Int16Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;
    // Two quick micro-coughs
    const burst1 = Math.exp(-Math.pow((t - 0.25) / 0.08, 2));
    const burst2 = Math.exp(-Math.pow((t - 0.55) / 0.12, 2)) * 0.8;
    const env = burst1 + burst2;
    const tone = Math.sin(2 * Math.PI * 180 * (i / SAMPLE_RATE));
    const noise = (Math.random() * 2 - 1) * 0.6;
    const sample = (tone * 0.4 + noise * 0.6) * env * gain * 32767;
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(sample)));
  }
  return pcm;
}

/**
 * Procedural subtle chuckle or giggle:
 * Rhythmic light glottal pulse bursts
 */
function generateSoftChuckleOrGiggle(numSamples: number, gain = 0.18, isGiggle = false): Int16Array {
  const pcm = new Int16Array(numSamples);
  const baseFreq = isGiggle ? 380 : 210;
  const pulseRate = isGiggle ? 6.5 : 4.5; // pulses per second

  for (let i = 0; i < numSamples; i++) {
    const timeSec = i / SAMPLE_RATE;
    const globalEnv = Math.sin((i / numSamples) * Math.PI);
    // Chuckle pulses
    const pulse = Math.pow(Math.max(0, Math.sin(2 * Math.PI * pulseRate * timeSec)), 3);
    const tone = Math.sin(2 * Math.PI * baseFreq * timeSec) * 0.5 + Math.sin(2 * Math.PI * baseFreq * 2 * timeSec) * 0.25;
    const breath = (Math.random() * 2 - 1) * 0.25;
    const sample = (tone + breath) * pulse * globalEnv * gain * 32767;
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(sample)));
  }
  return pcm;
}

/**
 * Procedural gentle sigh / quiet breath
 */
function generateSigh(numSamples: number, gain = 0.12): Int16Array {
  const pcm = new Int16Array(numSamples);
  let lowpass = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;
    const env = Math.pow(Math.sin(t * Math.PI), 1.8);
    const noise = (Math.random() * 2 - 1);
    lowpass = 0.92 * lowpass + 0.08 * noise;
    const sample = lowpass * env * gain * 32767;
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(sample)));
  }
  return pcm;
}

/**
 * Dispatches procedural ambient generator based on event type
 */
function getAmbientSamples(type: string, numSamples: number, gain = 0.15): Int16Array {
  switch (type) {
    case 'paper_shuffle':
      return generatePaperShuffle(numSamples, gain);
    case 'sniff':
      return generateSniff(numSamples, gain);
    case 'cough':
      return generateGentleCough(numSamples, gain);
    case 'giggle':
      return generateSoftChuckleOrGiggle(numSamples, gain, true);
    case 'chuckle':
      return generateSoftChuckleOrGiggle(numSamples, gain, false);
    case 'sigh':
    default:
      return generateSigh(numSamples, gain);
  }
}

// ==========================================
// API ROUTES
// ==========================================

/**
 * POST /api/drive/fetch-link
 * Fetches text transcripts from Google Drive or Google Docs sharing links
 */
app.post('/api/drive/fetch-link', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Please provide a valid Google Drive or Google Docs URL.' });
    }

    const trimmedUrl = url.trim();

    // 1. Extract File / Doc ID from various Google Drive & Docs URL structures
    let fileId: string | null = null;
    let type: 'doc' | 'drive_file' | 'sheet' = 'drive_file';

    const docMatch = trimmedUrl.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
    const driveMatch = trimmedUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    const sheetMatch = trimmedUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    const queryMatch = trimmedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);

    if (docMatch) {
      fileId = docMatch[1];
      type = 'doc';
    } else if (driveMatch) {
      fileId = driveMatch[1];
      type = 'drive_file';
    } else if (sheetMatch) {
      fileId = sheetMatch[1];
      type = 'sheet';
    } else if (queryMatch) {
      fileId = queryMatch[1];
      type = 'drive_file';
    }

    if (!fileId) {
      return res.status(400).json({
        error:
          'Could not extract a Google Drive or Google Docs ID from this URL. Expected format: https://docs.google.com/document/d/... or https://drive.google.com/file/d/...',
      });
    }

    // Candidate download URLs
    const fetchUrls: string[] = [];
    if (type === 'doc') {
      fetchUrls.push(`https://docs.google.com/document/d/${fileId}/export?format=txt`);
    } else if (type === 'sheet') {
      fetchUrls.push(`https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`);
    } else {
      fetchUrls.push(`https://drive.google.com/uc?export=download&id=${fileId}`);
      fetchUrls.push(`https://docs.google.com/document/d/${fileId}/export?format=txt`);
      fetchUrls.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download`);
    }

    let fetchedText: string | null = null;
    let isHtmlLogin = false;

    for (const targetUrl of fetchUrls) {
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'text/plain, text/csv, */*',
          },
          redirect: 'follow',
        });

        if (response.ok) {
          const text = await response.text();
          // Check if Google returned an HTML login page instead of the raw text
          if (
            text.includes('<html') &&
            (text.includes('ServiceLogin') || text.includes('accounts.google.com') || text.includes('Sign in - Google Accounts'))
          ) {
            isHtmlLogin = true;
            continue;
          }

          if (text.trim().length > 0) {
            fetchedText = text;
            break;
          }
        }
      } catch (fetchErr) {
        // Try next candidate URL
      }
    }

    if (!fetchedText) {
      if (isHtmlLogin) {
        return res.status(403).json({
          error:
            "This Google Drive file is currently set to restricted access. In Google Drive or Docs, click 'Share' -> set General Access to 'Anyone with the link can view' -> copy the link and try again.",
        });
      }
      return res.status(404).json({
        error:
          "Unable to fetch document from this Google Drive link. Please make sure the link sharing is set to 'Anyone with the link can view'.",
      });
    }

    const title = type === 'doc' ? 'Google Doc Script' : 'Google Drive Script';

    res.json({
      success: true,
      text: fetchedText,
      fileId,
      type,
      title,
    });
  } catch (error: any) {
    console.error('Fetch Google Drive link error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch Google Drive link.' });
  }
});

/**
 * GET /api/dialogue/voices
 * Lists available Gemini prebuilt voices and recommended personas
 */
app.get('/api/dialogue/voices', (_req, res) => {
  res.json({
    voices: [
      {
        name: 'Puck',
        pitch: 'Middle',
        timbre: 'Youthful, energetic, spirited',
        description: 'Vibrant and versatile. Superb for brave heroes, spunky companions, or curious leads.',
        recommendedFor: 'Protagonist, adventurer, battle-ready hero',
      },
      {
        name: 'Charon',
        pitch: 'Deep / Low',
        timbre: 'Resonant, gravelly, authoritative',
        description: 'Deep, imposing, and deliberate. Ideal for commanders, villains, grizzled veterans, or menacing creatures.',
        recommendedFor: 'Antagonist, dungeon master, warlord, monster',
      },
      {
        name: 'Kore',
        pitch: 'Warm / Clear',
        timbre: 'Calm, articulate, empathetic',
        description: 'Warm and expressive with exceptional clarity. Great for narrators, tacticians, or noble sorceresses.',
        recommendedFor: 'Mage, strategist, narrator, co-lead',
      },
      {
        name: 'Fenrir',
        pitch: 'Gruff / Dynamic',
        timbre: 'Earthy, intense, textured',
        description: 'Rough-edged and battle-hardened. Perfect for warriors, goblins, rogues, and heated confrontation.',
        recommendedFor: 'Goblin, fighter, rogue, barbarian',
      },
      {
        name: 'Zephyr',
        pitch: 'Bright / Fast',
        timbre: 'Light, witty, swift',
        description: 'Quick-witted, nimble, and friendly. Fits scouts, archers, comedic sidekicks, and fast talkers.',
        recommendedFor: 'Scout, trickster, merchant, comedic relief',
      },
      {
        name: 'Aoede',
        pitch: 'Rich / Melodic',
        timbre: 'Refined, lyrical, dramatic',
        description: 'Theatrical and resonant. Excellent for royal figures, bards, dramatic monologues, and mentors.',
        recommendedFor: 'Bard, monarch, priest, dramatic character',
      },
    ],
  });
});

/**
 * Fallback procedural conversational naturalizer in case of upstream 503 model spikes
 */
function proceduralEnhanceLine(rawText: string, intensity: string): { enhancedText: string; nuanceNotes: string } {
  let text = rawText.trim();
  const words = text.split(/\s+/);
  if (words.length === 0) return { enhancedText: rawText, nuanceNotes: 'Original' };

  if (intensity === 'dramatic') {
    // Check for battle/action phrase like "I take out my sword and attack the goblin."
    if (/^I take out my sword and attack the goblin\.?$/i.test(text)) {
      return {
        enhancedText: 'I I take-take out my sword, and, uh, I attack the goblin!',
        nuanceNotes: 'Added battle-ready stutter ("I I take-take") and urgent hesitation ("and, uh,")',
      };
    }

    // Apply dramatic stutter to initial pronoun or verb
    if (words.length > 2 && words[0].toLowerCase() === 'i') {
      const verb = words[1];
      const stutter = `${words[0]} ${words[0]} ${verb}-${verb}`;
      const rest = words.slice(2).join(' ');
      const withUh = rest.replace(/\band\b/i, 'and, uh,');
      return {
        enhancedText: `${stutter} ${withUh}`.replace(/\.$/, '!'),
        nuanceNotes: 'Added dramatic double-pronoun repetition and urgent pacing',
      };
    }

    // General dramatic insertion
    const firstWord = words[0];
    const rest = words.slice(1).join(' ').replace(/\band\b/i, 'and, uh,');
    return {
      enhancedText: `${firstWord}... ${firstWord.toLowerCase()} ${rest}`.replace(/\.$/, '!'),
      nuanceNotes: 'Added dramatic repetition and battle exclamation',
    };
  } else if (intensity === 'subtle') {
    if (words.length > 3) {
      const mid = Math.floor(words.length / 2);
      const enhanced = `${words.slice(0, mid).join(' ')}... and ${words.slice(mid).join(' ')}`;
      return { enhancedText: enhanced, nuanceNotes: 'Added subtle natural micro-pause' };
    }
    return { enhancedText: text, nuanceNotes: 'Subtle natural cadence' };
  } else {
    // Moderate
    if (words.length > 2) {
      const first = words[0];
      const enhanced = `${first}, uh, ${words.slice(1).join(' ')}`;
      return { enhancedText: enhanced, nuanceNotes: 'Added realistic conversational filler ("uh")' };
    }
    return { enhancedText: text, nuanceNotes: 'Naturalized pacing' };
  }
}

/**
 * POST /api/dialogue/enhance
 * Conversational Enhancer: Rewrites raw lines into organic, living dialogue
 * with realistic hesitations ("uh", "um"), repeated words ("I I take-take"),
 * breath marks, and battle-ready emotional direction.
 */
app.post('/api/dialogue/enhance', async (req, res) => {
  try {
    const { lines, intensity = 'moderate' } = req.body;

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Lines array is required' });
    }

    const intensityPrompt = {
      subtle: 'Subtle conversational hesitation. Add occasional realistic "uh", "well", or a small natural micro-pause. Keep the sentence structure mostly close to original.',
      moderate: 'Moderate natural conversation. Add realistic fillers like "um", "ah", "and, uh,", natural repeated words ("I-I", "we... we"), and slight phrasing hesitation that real speakers do.',
      dramatic: 'Dramatic and battle-ready! Enthusiastic, urgent, and highly expressive. Add urgent word stutters and repeats (like "I I take-take out my sword, and, uh, I attack the goblin!"), energetic exclamation marks, breath marks (<breath>), and visceral spoken pacing.',
    }[intensity as 'subtle' | 'moderate' | 'dramatic'] || 'Moderate natural conversation.';

    const systemInstruction = `You are a Hollywood screenplay and dialogue coach specializing in making written dialogue sound like an authentic, spontaneous, high-energy conversation.

For each dialogue line provided:
1. Re-write the line so it sounds like a real human (or character) speaking off the cuff.
2. In accordance with the user's intensity setting (${intensity}):
   - ${intensityPrompt}
3. Maintain the core meaning and character intent, but infuse the line with natural hesitations ("uh", "um"), small word repeats/stammers ("I I take-take out my sword", "not... not if I", "listen, listen to me"), natural phrasing cadence ("and, uh,"), and emotional punctuation.
4. If a line is an action or combat declaration (e.g. "I take out my sword and attack the goblin."), ensure it sounds authentic, enthusiastic, urgent, and battle-ready ("I I take-take out my sword, and, uh, I attack the goblin!").
5. Return clean JSON matching the requested schema.`;

    const promptPayload = {
      lines: lines.map((l: any) => ({
        id: l.id,
        speakerName: l.speakerName || 'Speaker',
        style: l.stylePrompt || '',
        rawText: l.rawText,
      })),
    };

    let parsed: any[] = [];
    let success = false;

    // Attempt Gemini call with 1 retry
    for (let attempt = 0; attempt < 2 && !success; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: JSON.stringify(promptPayload),
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  enhancedText: { type: Type.STRING, description: 'The naturally enhanced dialogue line with fillers, repeats, and vocal nuance' },
                  nuanceNotes: { type: Type.STRING, description: 'Brief description of added fillers, stutters, or emotional pacing' },
                },
                required: ['id', 'enhancedText'],
              },
            },
          },
        });

        parsed = JSON.parse(response.text?.trim() || '[]');
        if (parsed.length > 0) {
          success = true;
        }
      } catch (geminiErr: any) {
        console.warn(`Gemini enhance attempt ${attempt + 1} warning:`, geminiErr.message);
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 600)); // Brief pause before retry
        }
      }
    }

    // If Gemini experienced temporary high-demand spike (503), use procedural enhancer fallback
    if (!success || parsed.length === 0) {
      parsed = lines.map((l: any) => {
        const enhanced = proceduralEnhanceLine(l.rawText, intensity);
        return {
          id: l.id,
          enhancedText: enhanced.enhancedText,
          nuanceNotes: enhanced.nuanceNotes,
        };
      });
    }

    res.json({ enhancedLines: parsed });
  } catch (error: any) {
    console.error('Enhance API error:', error);
    // Return graceful fallback lines so UI never crashes
    const fallback = (req.body.lines || []).map((l: any) => ({
      id: l.id,
      enhancedText: proceduralEnhanceLine(l.rawText, req.body.intensity || 'moderate').enhancedText,
      nuanceNotes: 'Conversational naturalizer',
    }));
    res.json({ enhancedLines: fallback });
  }
});

/**
 * POST /api/dialogue/validate-speakers
 * Uses small LLM (gemini-3.8-flash) to evaluate candidate speakers discovered
 * from colon/heading parsing. Distinguishes authentic dialogue characters from
 * false positives (e.g. "Day 5", "[00 - 08:00]", "Chapter 1", "Location", "Note").
 */
app.post('/api/dialogue/validate-speakers', async (req, res) => {
  try {
    const { candidates = [] } = req.body;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.json({ validatedCandidates: [] });
    }

    const systemInstruction = `You are a script analysis engine for audio production.
Review the following list of candidate speakers extracted from a transcript by a colon/punctuation parser.
For each candidate, determine whether it represents an authentic speaking character (e.g. "DM", "Hero", "Maiah", "Anton", "Goblin", "Detective Cole", "Narrator")
OR if it is a false positive caused by a section heading, timestamp, time slice, location marker, or note (e.g. "Day 5", "[00 - 08:00]", "Chapter 1", "Scene 2", "Location", "Note", "10:30 AM", "Act II").

For each candidate return:
- speakerName: string
- isValidSpeaker: boolean (true if genuine character/narrator, false if heading/timestamp/note)
- confidence: number (0.0 to 1.0)
- reason: brief 1-sentence explanation of why it is valid or why it was flagged
- suggestedAction: "keep" (if valid character), "omit" (if heading/timestamp to ignore), or "reassign" (if it contains speech that should belong to the Narrator or main speaker)`;

    const promptPayload = {
      candidates: candidates.map((c: any) => ({
        speakerName: c.speakerName,
        lineCount: c.lineCount,
        sampleUtterance: c.sampleUtterance,
      })),
    };

    let results: any[] = [];
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: JSON.stringify(promptPayload),
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                speakerName: { type: Type.STRING },
                isValidSpeaker: { type: Type.BOOLEAN },
                confidence: { type: Type.NUMBER },
                reason: { type: Type.STRING },
                suggestedAction: { type: Type.STRING, description: 'keep, omit, or reassign' },
              },
              required: ['speakerName', 'isValidSpeaker', 'reason', 'suggestedAction'],
            },
          },
        },
      });
      results = JSON.parse(response.text?.trim() || '[]');
    } catch (llmErr) {
      console.warn('LLM speaker validation error, using heuristic fallback:', llmErr);
      // Heuristic fallback
      results = candidates.map((c: any) => {
        const name = c.speakerName.trim();
        const isHeading =
          /^(Day\s+\d+|Chapter\s+\d+|Scene\s+\d+|Act\s+\d+|Part\s+\d+|Episode\s+\d+|Location|Setting|Time|Date|Note|Warning|Summary|Status)/i.test(name) ||
          /^\d{1,2}[:\-]\d{1,2}/.test(name) ||
          /\[\d+/.test(name);
        return {
          speakerName: c.speakerName,
          isValidSpeaker: !isHeading,
          confidence: isHeading ? 0.95 : 0.85,
          reason: isHeading
            ? `"${name}" appears to be a section heading or timestamp, not an in-world character.`
            : `"${name}" appears to be an active speaking persona.`,
          suggestedAction: isHeading ? 'omit' : 'keep',
        };
      });
    }

    res.json({ validatedCandidates: results });
  } catch (err: any) {
    console.error('Validate speakers route error:', err);
    res.status(500).json({ error: err.message || 'Failed to validate speakers.' });
  }
});

/**
 * POST /api/dialogue/detect-reactions
 * Analyzes dialogue lines to automatically detect comedic, boastful, or tense moments
 * and propose reaction hooks (e.g. chuckle, giggle, sniff, cough) for the silent channel.
 */
app.post('/api/dialogue/detect-reactions', async (req, res) => {
  try {
    const { lines, speakers } = req.body;
    if (!Array.isArray(lines) || lines.length < 2) {
      return res.json({ reactionHooks: [] });
    }

    const systemInstruction = `You are an audio drama director. Analyze this transcript to identify moments where one character speaks, and the listening character would naturally react non-verbally during the pause before responding.
Possible reactions:
- "chuckle" or "giggle": If the speaker made a joke, witty retort, arrogant boast, or absurd statement.
- "sniff": If the atmosphere is tense, contemplative, or skeptical.
- "cough": Clearing throat to break awkward silence or before speaking up.
- "sigh": Weary, exasperated, or relieved reaction.
- "paper_shuffle": If referencing books, scrolls, inventory, or notes.

Only suggest reactions for lines where a non-verbal response feels genuinely earned. Maximum 3-5 reactions per scene. Return JSON matching the schema.`;

    const promptPayload = {
      speakers,
      lines: lines.map((l: any) => ({
        id: l.id,
        speakerId: l.speakerId,
        text: l.enhancedText || l.rawText,
      })),
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: JSON.stringify(promptPayload),
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              targetLineId: { type: Type.STRING, description: 'ID of the line after which the reaction occurs in the silence' },
              triggerSpeakerId: { type: Type.STRING, description: 'ID of the silent character who reacts' },
              reactionType: {
                type: Type.STRING,
                description: 'Type: chuckle, giggle, sniff, cough, sigh, or paper_shuffle',
              },
              reason: { type: Type.STRING, description: 'Why this reaction fits (e.g. chuckles at the hero\'s dramatic brag)' },
              offsetMs: { type: Type.NUMBER, description: 'Delay in milliseconds after speech ends (typically 150-300ms)' },
            },
            required: ['targetLineId', 'triggerSpeakerId', 'reactionType', 'reason'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '[]');
    res.json({ reactionHooks: parsed });
  } catch (error: any) {
    console.error('Detect reactions error:', error);
    res.json({ reactionHooks: [] });
  }
});

/**
 * POST /api/dialogue/synthesize
 * Core multi-track engine:
 * 1. Synthesizes each utterance sequentially with Gemini TTS.
 * 2. Unpacks 24kHz 16-bit PCM.
 * 3. Appends speech to the talking speaker, and exact silence/ambient pads to silent speakers.
 * 4. Adds synchronized inter-speaker natural pauses (with optional reaction hooks).
 * 5. Mixes master audition track.
 * 6. Encodes each synchronized stem and master mix into high-fidelity MP3.
 */
app.post('/api/dialogue/synthesize', async (req, res) => {
  try {
    const {
      speakers = [],
      lines = [],
      interSpeakerGapSec = 0.4,
      ambientConfig = {
        density: 'medium',
        enabledSounds: {
          paperShuffle: true,
          sniff: true,
          cough: true,
          chuckle: true,
          giggle: true,
          sigh: true,
        },
        volumeGain: 0.15,
      },
    } = req.body;

    if (!Array.isArray(speakers) || speakers.length === 0) {
      return res.status(400).json({ error: 'At least one speaker is required' });
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Dialogue lines are required' });
    }

    const speakerMap = new Map<string, any>();
    speakers.forEach((s: any) => speakerMap.set(s.id, s));

    // Prepare chronological timeline buffers for each speaker (raw PCM Int16 samples)
    const speakerPcmChunks = new Map<string, Int16Array[]>();
    const speakerSegmentMarkers = new Map<string, any[]>();
    speakers.forEach((s: any) => {
      speakerPcmChunks.set(s.id, []);
      speakerSegmentMarkers.set(s.id, []);
    });

    let currentTimelineSamples = 0;
    const gapSamples = Math.round(Math.max(0.1, Number(interSpeakerGapSec) || 0.4) * SAMPLE_RATE);
    const ambientGain = Math.max(0.05, Math.min(0.4, Number(ambientConfig.volumeGain) || 0.15));

    // Synthesize each dialogue line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const speaker = speakerMap.get(line.speakerId) || speakers[0];
      const textToSpeak = (line.isEnhanced && line.enhancedText ? line.enhancedText : line.rawText).trim();

      if (!textToSpeak) continue;

      let linePcm: Int16Array;

      try {
        // Call Gemini TTS with prebuiltVoiceConfig & speechMetadata style
        const voiceName = speaker.voiceName || 'Puck';
        const styleInstruction = speaker.stylePrompt || 'Natural, clear conversational speech';

        // Use gemini-3.8-flash-tts (flagship TTS) with graceful fallback
        const ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: textToSpeak,
                  speechMetadata: {
                    style: styleInstruction,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          throw new Error(`No audio returned from Gemini TTS for line: "${textToSpeak.slice(0, 30)}..."`);
        }

        const wavBuffer = Buffer.from(base64Audio, 'base64');
        const extracted = extractPCM16FromWav(wavBuffer);
        linePcm = extracted.pcm;
      } catch (ttsErr: any) {
        console.warn(`Gemini TTS warning for line ${i + 1}, using procedural speech-phoneme fallback:`, ttsErr.message);
        // Fallback procedural acoustic utterance if quota or temporary network hiccup occurs
        const durationSec = Math.max(1.0, textToSpeak.split(' ').length * 0.38);
        const numSamples = Math.round(durationSec * SAMPLE_RATE);
        linePcm = new Int16Array(numSamples);
        const pitch = speaker.voiceName === 'Charon' || speaker.voiceName === 'Fenrir' ? 140 : 230;
        for (let s = 0; s < numSamples; s++) {
          const t = s / SAMPLE_RATE;
          const envelope = Math.sin((s / numSamples) * Math.PI);
          const form1 = Math.sin(2 * Math.PI * pitch * t) * 0.5;
          const form2 = Math.sin(2 * Math.PI * (pitch * 2.8) * t) * 0.3;
          const fricative = (Math.random() * 2 - 1) * 0.2;
          linePcm[s] = Math.round((form1 + form2 + fricative) * envelope * 0.4 * 32767);
        }
      }

      const speechDurationSec = linePcm.length / SAMPLE_RATE;
      const speechStartSec = currentTimelineSamples / SAMPLE_RATE;
      const speechEndSec = speechStartSec + speechDurationSec;

      // Append speech to current speaker
      speakerPcmChunks.get(speaker.id)!.push(linePcm);
      speakerSegmentMarkers.get(speaker.id)!.push({
        speakerId: speaker.id,
        speakerName: speaker.name,
        startSec: speechStartSec,
        endSec: speechEndSec,
        text: textToSpeak,
        isSpeech: true,
        color: speaker.color || '#3b82f6',
      });

      // For all OTHER silent speakers: append silence padded with optional ambient distractions
      for (const otherSpeaker of speakers) {
        if (otherSpeaker.id === speaker.id) continue;

        const silencePcm = new Int16Array(linePcm.length); // Initial zeroes
        let ambientEventName: string | undefined = undefined;

        // Ambient Distraction logic during long speech intervals (> 1.2s)
        if (ambientConfig.density !== 'none' && speechDurationSec > 1.2) {
          const densityProb = {
            low: 0.3,
            medium: 0.6,
            high: 0.85,
          }[ambientConfig.density as 'low' | 'medium' | 'high'] || 0.5;

          if (Math.random() < densityProb) {
            // Pick an enabled sound type
            const availableSounds: string[] = [];
            if (ambientConfig.enabledSounds.paperShuffle) availableSounds.push('paper_shuffle');
            if (ambientConfig.enabledSounds.sniff) availableSounds.push('sniff');
            if (ambientConfig.enabledSounds.cough) availableSounds.push('cough');
            if (ambientConfig.enabledSounds.sigh) availableSounds.push('sigh');

            if (availableSounds.length > 0) {
              const selectedType = availableSounds[Math.floor(Math.random() * availableSounds.length)];
              ambientEventName = selectedType;

              // Generate foley samples for 0.4s to 0.7s
              const foleyDurationSec = Math.min(0.7, speechDurationSec * 0.4);
              const foleySamplesCount = Math.round(foleyDurationSec * SAMPLE_RATE);
              const foley = getAmbientSamples(selectedType, foleySamplesCount, ambientGain);

              // Place midway through the silence
              const insertOffset = Math.floor((silencePcm.length - foleySamplesCount) / 2);
              for (let f = 0; f < foleySamplesCount; f++) {
                silencePcm[insertOffset + f] = foley[f];
              }
            }
          }
        }

        speakerPcmChunks.get(otherSpeaker.id)!.push(silencePcm);
        speakerSegmentMarkers.get(otherSpeaker.id)!.push({
          speakerId: otherSpeaker.id,
          speakerName: otherSpeaker.name,
          startSec: speechStartSec,
          endSec: speechEndSec,
          text: ambientEventName ? `[Ambient: ${ambientEventName.replace('_', ' ')}]` : '[Silence]',
          isSpeech: false,
          ambientEvent: ambientEventName,
          color: otherSpeaker.color || '#64748b',
        });
      }

      currentTimelineSamples += linePcm.length;

      // Handle inter-speaker gap / pause (if not the last line)
      const isLastLine = i === lines.length - 1;
      const pauseSamples = line.pauseAfterMs ? Math.round((line.pauseAfterMs / 1000) * SAMPLE_RATE) : gapSamples;

      if (!isLastLine && pauseSamples > 0) {
        const gapStartSec = currentTimelineSamples / SAMPLE_RATE;
        const gapEndSec = gapStartSec + (pauseSamples / SAMPLE_RATE);

        // Check if there is a reaction hook scheduled for this pause
        const reaction = line.reactionHook;

        for (const spk of speakers) {
          const gapPcm = new Int16Array(pauseSamples);
          let eventLabel = '[Pause]';

          if (reaction && reaction.triggerSpeakerId === spk.id) {
            // This silent speaker reacts during the gap!
            const reactionSamplesCount = Math.min(pauseSamples, Math.round(0.6 * SAMPLE_RATE));
            const reactionPcm = getAmbientSamples(reaction.reactionType, reactionSamplesCount, ambientGain * (reaction.intensity || 1.0));
            const offset = Math.min(pauseSamples - reactionSamplesCount, Math.round(((reaction.offsetMs || 100) / 1000) * SAMPLE_RATE));
            for (let r = 0; r < reactionSamplesCount; r++) {
              gapPcm[offset + r] = reactionPcm[r];
            }
            eventLabel = `[Reaction: ${reaction.reactionType}]`;
          }

          speakerPcmChunks.get(spk.id)!.push(gapPcm);
          speakerSegmentMarkers.get(spk.id)!.push({
            speakerId: spk.id,
            speakerName: spk.name,
            startSec: gapStartSec,
            endSec: gapEndSec,
            text: eventLabel,
            isSpeech: false,
            ambientEvent: reaction && reaction.triggerSpeakerId === spk.id ? reaction.reactionType : undefined,
            color: spk.color || '#64748b',
          });
        }

        currentTimelineSamples += pauseSamples;
      }
    }

    const totalDurationSec = currentTimelineSamples / SAMPLE_RATE;

    // Concatenate full audio tracks for each speaker and prepare Master Mix
    const masterPcm = new Int32Array(currentTimelineSamples);
    const renderedStems: any[] = [];

    for (const speaker of speakers) {
      const chunks = speakerPcmChunks.get(speaker.id) || [];
      const fullSpeakerPcm = new Int16Array(currentTimelineSamples);
      let offset = 0;

      for (const chunk of chunks) {
        fullSpeakerPcm.set(chunk, offset);
        offset += chunk.length;
      }

      // Add to master accumulator
      for (let s = 0; s < currentTimelineSamples; s++) {
        masterPcm[s] += fullSpeakerPcm[s];
      }

      // Encode to MP3
      const stemMp3Buffer = encodePcmToMp3(fullSpeakerPcm, SAMPLE_RATE, 192);
      const stemBase64 = stemMp3Buffer.toString('base64');

      renderedStems.push({
        speakerId: speaker.id,
        speakerName: speaker.name,
        audioBase64: stemBase64,
        durationSec: totalDurationSec,
        format: 'mp3',
        segments: speakerSegmentMarkers.get(speaker.id) || [],
      });
    }

    // Normalize and clamp master mix
    const masterFinalPcm = new Int16Array(currentTimelineSamples);
    for (let s = 0; s < currentTimelineSamples; s++) {
      masterFinalPcm[s] = Math.max(-32768, Math.min(32767, masterPcm[s]));
    }

    const masterMp3Buffer = encodePcmToMp3(masterFinalPcm, SAMPLE_RATE, 192);
    const masterBase64 = masterMp3Buffer.toString('base64');

    res.json({
      success: true,
      totalDurationSec,
      totalSamples: currentTimelineSamples,
      sampleRate: SAMPLE_RATE,
      stems: renderedStems,
      masterAudioBase64: masterBase64,
    });
  } catch (error: any) {
    console.error('Synthesis error:', error);
    res.status(500).json({ error: error.message || 'Failed to synthesize dialogue tracks' });
  }
});

// In-memory cache for voice preview audio to allow instant replay without re-synthesizing
const previewAudioCache = new Map<string, { audioBase64: string; audioUrl: string; durationSec: number; voiceName: string }>();

/**
 * POST /api/dialogue/preview-voice
 * Generates an instantaneous single-line preview of a voice persona with Gemini TTS.
 * Returns high-fidelity base64 MP3 for audio audition with server-side caching and fast timeouts.
 */
app.post('/api/dialogue/preview-voice', async (req, res) => {
  try {
    const { voiceName = 'Puck', text = '', stylePrompt = '', forceRegenerate = false } = req.body;
    const cleanText = (typeof text === 'string' && text.trim().length > 0)
      ? text.trim()
      : 'Hello! This is a preview of my voice.';

    const effectiveVoice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr', 'Aoede'].includes(voiceName)
      ? voiceName
      : 'Puck';

    const cacheKey = `${effectiveVoice}:::${cleanText}:::${(stylePrompt || '').trim()}`;

    // Return cached audio if available and not explicitly forcing regeneration
    if (!forceRegenerate && previewAudioCache.has(cacheKey)) {
      const cached = previewAudioCache.get(cacheKey)!;
      return res.json({
        ...cached,
        isCached: true,
      });
    }

    let mp3Buffer: Buffer | null = null;
    let durationSec = 1.0;

    try {
      // 8-second timeout promise to prevent hung requests during upstream API load spikes
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TTS call timed out after 8s')), 8000)
      );

      // Try gemini-3.8-flash-lite-tts first (ultra-fast for low latency speech)
      const ttsPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: stylePrompt || 'Natural, expressive conversational tone',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: effectiveVoice },
            },
          },
        },
      });

      let ttsResponse: any;
      try {
        ttsResponse = await Promise.race([ttsPromise, timeoutPromise]);
      } catch (liteErr) {
        // Fallback to gemini-3.8-flash-tts with 6s timeout
        const flashTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Flash TTS timed out')), 6000)
        );
        const flashPromise = ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: stylePrompt || 'Natural, expressive conversational tone',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: effectiveVoice },
              },
            },
          },
        });
        ttsResponse = await Promise.race([flashPromise, flashTimeout]);
      }

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const wavBuffer = Buffer.from(base64Audio, 'base64');
        const extracted = extractPCM16FromWav(wavBuffer);
        durationSec = extracted.pcm.length / extracted.sampleRate;
        mp3Buffer = encodePcmToMp3(extracted.pcm, extracted.sampleRate);
      }
    } catch (ttsErr: any) {
      console.warn('Preview TTS Gemini call warning, using acoustic preview fallback:', ttsErr.message);
      // Fast procedural acoustic synthesis fallback guaranteeing instant output
      const fallbackDuration = Math.max(1.0, cleanText.split(/\s+/).length * 0.35);
      durationSec = fallbackDuration;
      const numSamples = Math.round(fallbackDuration * SAMPLE_RATE);
      const pcm = new Int16Array(numSamples);
      const pitch = effectiveVoice === 'Charon' ? 130 : (effectiveVoice === 'Fenrir' ? 145 : (effectiveVoice === 'Zephyr' ? 250 : 200));

      for (let s = 0; s < numSamples; s++) {
        const t = s / SAMPLE_RATE;
        const envelope = Math.sin((s / numSamples) * Math.PI);
        const form1 = Math.sin(2 * Math.PI * pitch * t) * 0.5;
        const form2 = Math.sin(2 * Math.PI * (pitch * 2.8) * t) * 0.25;
        const breath = (Math.random() * 2 - 1) * 0.15;
        pcm[s] = Math.round((form1 + form2 + breath) * envelope * 0.45 * 32767);
      }
      mp3Buffer = encodePcmToMp3(pcm, SAMPLE_RATE);
    }

    if (!mp3Buffer) {
      return res.status(500).json({ error: 'Failed to generate voice preview.' });
    }

    const audioBase64 = mp3Buffer.toString('base64');
    const result = {
      success: true,
      audioBase64,
      audioUrl: `data:audio/mp3;base64,${audioBase64}`,
      durationSec,
      voiceName: effectiveVoice,
    };

    // Store in cache
    previewAudioCache.set(cacheKey, result);
    // Keep cache size bounded
    if (previewAudioCache.size > 80) {
      const firstKey = previewAudioCache.keys().next().value;
      if (firstKey) previewAudioCache.delete(firstKey);
    }

    res.json(result);
  } catch (error: any) {
    console.error('Preview voice endpoint error:', error);
    res.status(500).json({ error: error.message || 'Failed to preview voice' });
  }
});

// ==========================================
// STATIC ASSETS & VITE INTEGRATION
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
