import {
  TranscriptValidationResult,
  SpeakerLineCount,
  IgnoredLineDetail,
  SpeakerValidationFlag,
} from '../types/dialogue';
import { findPersonaByName } from './personaDatabase';

/**
 * Checks if a line or speaker candidate matches common timestamps or narrative section headings
 */
export function isHeadingOrTimestamp(line: string): {
  isHeading: boolean;
  reason: 'scene_header' | 'timestamp';
  description: string;
} {
  const trimmed = line.trim();

  // 1. Bracketed or unbracketed time slices / timestamps: e.g. "[00 - 08:00] Scene Setting", "[08:00]", "08:00 - 12:00"
  if (
    /^\[?\s*\d{1,2}\s*[-–:]\s*\d{1,2}(:\d{2})?\s*\]?/i.test(trimmed) ||
    /^\[\s*\d{1,2}:\d{2}(:\d{2})?\s*\]/i.test(trimmed) ||
    /^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?\b/i.test(trimmed)
  ) {
    return { isHeading: true, reason: 'timestamp', description: 'Timestamp / time-slice heading' };
  }

  // 2. Common narrative, calendar, or chapter headings (e.g. "Day 5: The Dawn of Trouble", "Scene 2 - Cave", "Chapter 1:")
  if (
    /^(Day\s+\d+|Chapter\s+\d+|Scene\s+\d+|Act\s+\d+|Part\s+\d+|Episode\s+\d+|Track\s+\d+|Session\s+\d+|Encounter\s+\d+|Round\s+\d+|Turn\s+\d+)\b/i.test(
      trimmed
    )
  ) {
    return { isHeading: true, reason: 'scene_header', description: 'Narrative or chapter heading' };
  }

  // 3. Metadata tags with colons (e.g. "Location: The Crypt", "Setting: Cold night", "Time: Midnight", "Note: Remember key")
  if (
    /^(Location|Setting|Time|Date|Note|Warning|Summary|Overview|Background|Status|Quest|Objective|Reward)\s*[:–-]/i.test(
      trimmed
    )
  ) {
    return { isHeading: true, reason: 'scene_header', description: 'Metadata note or section label' };
  }

  return { isHeading: false, reason: 'scene_header', description: '' };
}

/**
 * Checks if a candidate speaker name is an obvious heading/timestamp
 */
export function isInvalidSpeakerCandidate(candidateName: string): { isInvalid: boolean; reason: string } {
  const name = candidateName.trim();

  if (/^(Day\s+\d+|Chapter\s+\d+|Scene\s+\d+|Act\s+\d+|Part\s+\d+|Episode\s+\d+|Session\s+\d+|Track\s+\d+)$/i.test(name)) {
    return { isInvalid: true, reason: `"${name}" is a chapter/calendar marker, not a speaking character.` };
  }

  if (/^(Location|Setting|Time|Date|Note|Warning|Summary|Overview|Background|Status)$/i.test(name)) {
    return { isInvalid: true, reason: `"${name}" is a script metadata label, not a speaking character.` };
  }

  if (/^\d{1,2}[:\-]\d{1,2}/.test(name) || /\[\d+/.test(name)) {
    return { isInvalid: true, reason: `"${name}" contains a timestamp or duration slice.` };
  }

  return { isInvalid: false, reason: '' };
}

/**
 * Validates, parses, and reformats any incoming dialogue transcript
 */
export function validateAndParseTranscript(
  rawText: string,
  fileName?: string
): TranscriptValidationResult {
  const rawLines = rawText.split(/\r?\n/);
  const totalRawLines = rawLines.length;

  const parsedLines: { speakerName: string; text: string; lineNum: number }[] = [];
  const ignoredLines: IgnoredLineDetail[] = [];
  const warnings: string[] = [];

  let currentPendingSpeaker: string | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const line = rawLines[i].trim();

    // 1. Blank line
    if (!line) {
      ignoredLines.push({
        lineNum,
        content: '(empty line)',
        reason: 'blank',
        description: 'Empty spacing line',
      });
      continue;
    }

    // 2. Comments
    if (
      line.startsWith('//') ||
      line.startsWith('#') ||
      line.startsWith('/*') ||
      line.startsWith('*') ||
      line.startsWith(';') ||
      line.startsWith('<!--')
    ) {
      ignoredLines.push({
        lineNum,
        content: line,
        reason: 'comment',
        description: 'Developer or script comment',
      });
      continue;
    }

    // 3. Narrative headings & Timestamps (e.g. "[00 - 08:00] Scene Setting", "Day 5: The Dawn of Trouble")
    const headingCheck = isHeadingOrTimestamp(line);
    if (headingCheck.isHeading) {
      ignoredLines.push({
        lineNum,
        content: line,
        reason: headingCheck.reason,
        description: headingCheck.description,
      });
      continue;
    }

    // 4. Standard Scene headings & dividers
    if (
      /^(INT\.|EXT\.|SCENE\b|ACT\b|CHAPTER\b|PROLOGUE\b|EPILOGUE\b|---|\*\*\*|===)/i.test(line)
    ) {
      ignoredLines.push({
        lineNum,
        content: line,
        reason: 'scene_header',
        description: 'Scene heading or section divider',
      });
      continue;
    }

    // 5. Subtitle timestamps & numbers
    if (
      /^\d+$/.test(line) ||
      /\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}/.test(line) ||
      /^WEBVTT/i.test(line)
    ) {
      ignoredLines.push({
        lineNum,
        content: line,
        reason: 'timestamp',
        description: 'Subtitle index or timecode',
      });
      continue;
    }

    // 6. Stage direction / sound effects enclosed entirely in brackets
    if (
      (line.startsWith('[') && line.endsWith(']')) ||
      (line.startsWith('{') && line.endsWith('}')) ||
      (line.startsWith('(') && line.endsWith(')'))
    ) {
      ignoredLines.push({
        lineNum,
        content: line,
        reason: 'stage_direction',
        description: 'Stage direction, SFX cue, or bracketed note',
      });
      continue;
    }

    // 7. Check for inline speaker tag: "Speaker: dialogue" or "[Speaker] dialogue"
    const colonMatch = line.match(/^\[?([A-Za-z0-9_\s]{1,30})\]?\s*:\s*(.+)$/);
    const dashMatch = !colonMatch ? line.match(/^\[?([A-Za-z0-9_\s]{1,30})\]?\s+-\s+(.+)$/) : null;

    if (colonMatch) {
      const rawCandidate = cleanSpeakerName(colonMatch[1]);
      const invalidCandidate = isInvalidSpeakerCandidate(rawCandidate);

      if (invalidCandidate.isInvalid) {
        // Obvious heading or timestamp mistakenly formatted with colon
        ignoredLines.push({
          lineNum,
          content: line,
          reason: 'scene_header',
          description: invalidCandidate.reason,
        });
        continue;
      }

      const speech = cleanSpeechText(colonMatch[2]);
      if (speech) {
        parsedLines.push({ speakerName: rawCandidate, text: speech, lineNum });
        currentPendingSpeaker = null;
        continue;
      }
    } else if (dashMatch) {
      const rawCandidate = cleanSpeakerName(dashMatch[1]);
      const invalidCandidate = isInvalidSpeakerCandidate(rawCandidate);

      if (invalidCandidate.isInvalid) {
        ignoredLines.push({
          lineNum,
          content: line,
          reason: 'scene_header',
          description: invalidCandidate.reason,
        });
        continue;
      }

      const speech = cleanSpeechText(dashMatch[2]);
      if (speech) {
        parsedLines.push({ speakerName: rawCandidate, text: speech, lineNum });
        currentPendingSpeaker = null;
        continue;
      }
    }

    // 8. Screenplay format: Speaker Name alone on an uppercase line
    if (/^[A-Z0-9_\s]{2,25}$/.test(line) && !line.includes('.')) {
      const candidate = cleanSpeakerName(line);
      const invalidCandidate = isInvalidSpeakerCandidate(candidate);

      if (!invalidCandidate.isInvalid) {
        currentPendingSpeaker = candidate;
        ignoredLines.push({
          lineNum,
          content: line,
          reason: 'non_speaking',
          description: `Screenplay character cue for "${currentPendingSpeaker}"`,
        });
        continue;
      }
    }

    // 9. If we have a pending screenplay speaker cue and this is the speech
    if (currentPendingSpeaker) {
      const speech = cleanSpeechText(line);
      if (speech) {
        parsedLines.push({ speakerName: currentPendingSpeaker, text: speech, lineNum });
        currentPendingSpeaker = null;
        continue;
      }
    }

    // 10. Unattributed text
    ignoredLines.push({
      lineNum,
      content: line,
      reason: 'non_speaking',
      description: 'Unattributed text (no valid speaker found)',
    });
  }

  // Tally unique speakers
  const speakerMap = new Map<string, { count: number; sample: string }>();

  parsedLines.forEach((pl) => {
    const existing = speakerMap.get(pl.speakerName);
    if (existing) {
      existing.count += 1;
    } else {
      speakerMap.set(pl.speakerName, { count: 1, sample: pl.text });
    }
  });

  const speakersSummary: SpeakerLineCount[] = Array.from(speakerMap.entries()).map(
    ([speakerName, data], idx) => {
      const matched = findPersonaByName(speakerName);
      const invalidCheck = isInvalidSpeakerCandidate(speakerName);

      return {
        speakerName,
        speakerId: `spk_${idx + 1}`,
        lineCount: data.count,
        sampleUtterance: data.sample,
        matchedPersona: matched,
        llmValidation: invalidCheck.isInvalid
          ? {
              speakerName,
              isValidSpeaker: false,
              confidence: 0.95,
              reason: invalidCheck.reason,
              suggestedAction: 'omit',
            }
          : undefined,
        isExcluded: invalidCheck.isInvalid,
        excludeAction: invalidCheck.isInvalid ? 'omit' : undefined,
      };
    }
  );

  const initialSummary = generateSummarySentence(speakersSummary, ignoredLines.length);

  return {
    fileName,
    totalRawLines,
    speakingLinesCount: parsedLines.length,
    ignoredLinesCount: ignoredLines.length,
    uniqueSpeakersCount: speakersSummary.filter((s) => !s.isExcluded).length,
    speakersSummary,
    ignoredLines,
    parsedLines,
    summarySentence: initialSummary,
    warnings,
  };
}

/**
 * Recalculates validation counts, speaking lines, and summary sentence
 * after user manually excludes speakers or reassigns lines in the review modal
 */
export function recalculateValidationResult(
  original: TranscriptValidationResult,
  updatedSpeakers: SpeakerLineCount[]
): TranscriptValidationResult {
  const activeSpeakers = updatedSpeakers.filter((s) => !s.isExcluded);
  const excludedSpeakers = updatedSpeakers.filter((s) => s.isExcluded);

  // Map of reassignments: oldSpeakerName -> targetSpeakerName
  const reassignmentMap = new Map<string, string>();
  excludedSpeakers.forEach((es) => {
    if (es.excludeAction === 'reassign' && es.reassignedToSpeakerName) {
      reassignmentMap.set(es.speakerName.toLowerCase(), es.reassignedToSpeakerName);
    }
  });

  // Calculate new line counts per active speaker
  const lineCounts = new Map<string, number>();
  activeSpeakers.forEach((as) => lineCounts.set(as.speakerName.toLowerCase(), as.lineCount));

  let omittedLinesTotal = 0;

  excludedSpeakers.forEach((es) => {
    if (es.excludeAction === 'omit') {
      omittedLinesTotal += es.lineCount;
    } else if (es.excludeAction === 'reassign' && es.reassignedToSpeakerName) {
      const targetLower = es.reassignedToSpeakerName.toLowerCase();
      const current = lineCounts.get(targetLower) || 0;
      lineCounts.set(targetLower, current + es.lineCount);
    }
  });

  // Update speakers summary with adjusted line counts
  const newSpeakersSummary = updatedSpeakers.map((s) => {
    if (s.isExcluded) return s;
    const updatedCount = lineCounts.get(s.speakerName.toLowerCase()) || s.lineCount;
    return {
      ...s,
      lineCount: updatedCount,
    };
  });

  const newActiveSpeakers = newSpeakersSummary.filter((s) => !s.isExcluded);
  const newIgnoredCount = original.ignoredLinesCount + omittedLinesTotal;
  const newSpeakingCount = original.speakingLinesCount - omittedLinesTotal;

  const newSummary = generateSummarySentence(newActiveSpeakers, newIgnoredCount);

  return {
    ...original,
    speakingLinesCount: newSpeakingCount,
    ignoredLinesCount: newIgnoredCount,
    uniqueSpeakersCount: newActiveSpeakers.length,
    speakersSummary: newSpeakersSummary,
    summarySentence: newSummary,
  };
}

/**
 * Calls small LLM (/api/dialogue/validate-speakers) to examine candidate speakers
 * and automatically omit obvious headings/timestamps
 */
export async function runLlmSpeakerValidation(
  initialResult: TranscriptValidationResult
): Promise<TranscriptValidationResult> {
  try {
    const res = await fetch('/api/dialogue/validate-speakers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidates: initialResult.speakersSummary.map((s) => ({
          speakerName: s.speakerName,
          lineCount: s.lineCount,
          sampleUtterance: s.sampleUtterance,
        })),
      }),
    });

    if (!res.ok) return initialResult;
    const data = await res.json();
    const flags: SpeakerValidationFlag[] = data.validatedCandidates || [];

    const flagMap = new Map<string, SpeakerValidationFlag>();
    flags.forEach((f) => flagMap.set(f.speakerName.toLowerCase(), f));

    // Update speaker summary with LLM findings and auto-omit mistakes
    const updated: SpeakerLineCount[] = initialResult.speakersSummary.map((spk) => {
      const flag = flagMap.get(spk.speakerName.toLowerCase());
      if (flag) {
        const isExcluded = !flag.isValidSpeaker;
        const mappedAction: 'omit' | 'reassign' = flag.suggestedAction === 'reassign' ? 'reassign' : 'omit';
        return {
          ...spk,
          llmValidation: flag,
          isExcluded: isExcluded || spk.isExcluded,
          excludeAction: isExcluded ? mappedAction : spk.excludeAction,
        };
      }
      return spk;
    });

    return recalculateValidationResult(
      {
        ...initialResult,
        hasLlmValidated: true,
      },
      updated
    );
  } catch (err) {
    console.warn('LLM speaker validation call failed, using heuristic results:', err);
    return initialResult;
  }
}

/**
 * Formats the exact summary sentence requested by the user:
 * "The transcript has 3 unique speakers: DM (42 lines), Maiah (37), and Anton (15). 30 lines are ignored because they are comments or other non-speaking lines."
 */
function generateSummarySentence(activeSpeakers: SpeakerLineCount[], ignoredCount: number): string {
  const uniqueCount = activeSpeakers.length;
  let formattedSpeakersList = '';

  if (uniqueCount === 0) {
    formattedSpeakersList = 'no recognized speakers';
  } else if (uniqueCount === 1) {
    formattedSpeakersList = `${activeSpeakers[0].speakerName} (${activeSpeakers[0].lineCount} lines)`;
  } else if (uniqueCount === 2) {
    formattedSpeakersList = `${activeSpeakers[0].speakerName} (${activeSpeakers[0].lineCount} lines) and ${activeSpeakers[1].speakerName} (${activeSpeakers[1].lineCount})`;
  } else {
    const allExceptLast = activeSpeakers
      .slice(0, -1)
      .map((s) => `${s.speakerName} (${s.lineCount}${s.lineCount === 1 ? ' line' : ' lines'})`)
      .join(', ');
    const last = activeSpeakers[activeSpeakers.length - 1];
    formattedSpeakersList = `${allExceptLast}, and ${last.speakerName} (${last.lineCount})`;
  }

  return `The transcript has ${uniqueCount} unique speaker${
    uniqueCount === 1 ? '' : 's'
  }: ${formattedSpeakersList}. ${ignoredCount} line${
    ignoredCount === 1 ? ' is' : 's are'
  } ignored because they are comments or other non-speaking lines.`;
}

function cleanSpeakerName(raw: string): string {
  return raw
    .trim()
    .replace(/^\[|\/|\(|\)|\]$/g, '')
    .trim();
}

function cleanSpeechText(raw: string): string {
  return raw
    .replace(/\([^\)]+\)/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim();
}
