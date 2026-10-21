import { SavedVoicePersona, GeminiVoiceName } from '../types/dialogue';

const STORAGE_KEY = 'multitrack_dialogue_voice_personas_v1';

const DEFAULT_SEEDED_PERSONAS: SavedVoicePersona[] = [
  {
    id: 'persona_dm_seed',
    name: 'DM',
    voiceName: 'Charon',
    stylePrompt: 'Deliberate, authoritative tabletop Dungeon Master describing dramatic environments with deep resonant timbre',
    color: '#8b5cf6', // Violet
    tags: ['dungeon-master', 'tabletop', 'narrator'],
    createdAt: Date.now() - 86400000 * 5,
    lastUsedAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'persona_maiah_seed',
    name: 'Maiah',
    voiceName: 'Kore',
    stylePrompt: 'Clever, tactical elven rogue with crisp witty diction and quick sharp breaths',
    color: '#ec4899', // Pink
    tags: ['player-character', 'rogue', 'tabletop'],
    createdAt: Date.now() - 86400000 * 4,
    lastUsedAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'persona_anton_seed',
    name: 'Anton',
    voiceName: 'Fenrir',
    stylePrompt: 'Grizzled dwarven barbarian, hearty, boisterous, laughing through battle declarations',
    color: '#f97316', // Orange
    tags: ['player-character', 'barbarian', 'tabletop'],
    createdAt: Date.now() - 86400000 * 3,
    lastUsedAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'persona_hero_seed',
    name: 'Hero',
    voiceName: 'Puck',
    stylePrompt: 'Enthusiastic, brave adventurer declaring attacks with sharp breath and urgent combat energy',
    color: '#f59e0b', // Amber
    tags: ['fantasy', 'protagonist'],
    createdAt: Date.now() - 86400000 * 2,
    lastUsedAt: Date.now(),
  },
  {
    id: 'persona_goblin_seed',
    name: 'Goblin',
    voiceName: 'Fenrir',
    stylePrompt: 'Raspy, menacing goblin sneer, mocking with guttural texture and quick sneering cadence',
    color: '#10b981', // Emerald
    tags: ['creature', 'antagonist'],
    createdAt: Date.now() - 86400000 * 2,
    lastUsedAt: Date.now(),
  },
  {
    id: 'persona_scout_seed',
    name: 'Zephyr Scout',
    voiceName: 'Zephyr',
    stylePrompt: 'Swift, breathless scout relaying urgent observations at high tempo',
    color: '#06b6d4', // Cyan
    tags: ['scout', 'rapid'],
    createdAt: Date.now() - 86400000,
    lastUsedAt: Date.now(),
  },
];

/**
 * Loads all saved personas from local database
 */
export function getSavedPersonas(): SavedVoicePersona[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_SEEDED_PERSONAS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SEEDED_PERSONAS));
      return DEFAULT_SEEDED_PERSONAS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed reading persona database:', err);
  }
  return DEFAULT_SEEDED_PERSONAS;
}

/**
 * Generates an auto-incremented name if a persona already exists with this name.
 * Rule from prompt: "make a new speaker profile with the same name but it will append -2 -3 -4 to the name. (starting with -2)."
 */
export function generateDeduplicatedName(desiredName: string, existingPersonas: SavedVoicePersona[]): string {
  const cleanBase = desiredName.trim().replace(/-\d+$/, '').trim();
  const existingNames = new Set(existingPersonas.map((p) => p.name.trim().toLowerCase()));

  if (!existingNames.has(cleanBase.toLowerCase())) {
    return cleanBase;
  }

  // Name already exists, find next suffix starting with -2
  let suffix = 2;
  while (existingNames.has(`${cleanBase.toLowerCase()}-${suffix}`)) {
    suffix++;
  }
  return `${cleanBase}-${suffix}`;
}

/**
 * Saves a persona into the database, respecting the -2, -3, -4 deduplication rule
 */
export function savePersona(persona: {
  name: string;
  voiceName: GeminiVoiceName;
  stylePrompt: string;
  color: string;
  tags?: string[];
}): SavedVoicePersona {
  const all = getSavedPersonas();
  const finalName = generateDeduplicatedName(persona.name, all);

  const newRecord: SavedVoicePersona = {
    id: `persona_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: finalName,
    voiceName: persona.voiceName,
    stylePrompt: persona.stylePrompt,
    color: persona.color,
    tags: persona.tags || [],
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  };

  const updated = [newRecord, ...all];
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  return newRecord;
}

/**
 * Looks up a previous voice persona by speaker name (case-insensitive fuzzy match)
 */
export function findPersonaByName(name: string): SavedVoicePersona | undefined {
  const all = getSavedPersonas();
  const clean = name.trim().toLowerCase();
  // Exact match first
  const exact = all.find((p) => p.name.toLowerCase() === clean);
  if (exact) return exact;

  // Prefix match (e.g. "DM" matches "DM-2" or base)
  const baseMatch = all.find((p) => p.name.toLowerCase().replace(/-\d+$/, '').trim() === clean);
  if (baseMatch) return baseMatch;

  return undefined;
}

/**
 * Updates lastUsedAt on a persona
 */
export function touchPersona(id: string): void {
  const all = getSavedPersonas();
  const updated = all.map((p) => (p.id === id ? { ...p, lastUsedAt: Date.now() } : p));
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
}

/**
 * Deletes a persona by id
 */
export function deletePersona(id: string): void {
  const all = getSavedPersonas();
  const updated = all.filter((p) => p.id !== id);
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
}
