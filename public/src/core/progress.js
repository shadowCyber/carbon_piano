// Progress + settings model and its (de)serialization.
//
// Security posture: anything read back from storage is treated as untrusted input
// (another script on the origin, a browser extension, or a user with devtools can
// modify it). We never merge the parsed object into app state. Instead we build a
// fresh object from a fixed allowlist of fields, with type checks and clamping.
// This defeats prototype pollution ("__proto__" keys), type confusion, and
// oversized payloads.

export const STORAGE_KEY = 'carbonPiano.v1';
export const SCHEMA_VERSION = 1;
export const MAX_STORED_CHARS = 16 * 1024;
const MAX_SCORE = 9999;

export function defaultProgress() {
  return {
    version: SCHEMA_VERSION,
    settings: {
      showNames: true,
      colorKeys: true,
      showShortcuts: false,
      volume: 0.7,
    },
    songs: {},
    quiz: { name: 0, staff: 0 },
    echo: { best: 0 },
  };
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function own(obj, key) {
  return isPlainObject(obj) && Object.hasOwn(obj, key) ? obj[key] : undefined;
}

function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function int(value, min, max, fallback) {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function unit(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

/** Build a clean progress object from arbitrary (untrusted) input. */
export function sanitizeProgress(raw, knownSongIds) {
  const out = defaultProgress();
  if (!isPlainObject(raw) || raw.version !== SCHEMA_VERSION) return out;

  const settings = own(raw, 'settings');
  out.settings.showNames = bool(own(settings, 'showNames'), out.settings.showNames);
  out.settings.colorKeys = bool(own(settings, 'colorKeys'), out.settings.colorKeys);
  out.settings.showShortcuts = bool(own(settings, 'showShortcuts'), out.settings.showShortcuts);
  out.settings.volume = unit(own(settings, 'volume'), out.settings.volume);

  // Only song ids that exist in the compiled library are accepted.
  const songs = own(raw, 'songs');
  for (const id of knownSongIds) {
    const entry = own(songs, id);
    const stars = int(own(entry, 'stars'), 0, 3, 0);
    const plays = int(own(entry, 'plays'), 0, MAX_SCORE, 0);
    if (stars > 0 || plays > 0) out.songs[id] = { stars, plays };
  }

  const quiz = own(raw, 'quiz');
  out.quiz.name = int(own(quiz, 'name'), 0, MAX_SCORE, 0);
  out.quiz.staff = int(own(quiz, 'staff'), 0, MAX_SCORE, 0);

  out.echo.best = int(own(own(raw, 'echo'), 'best'), 0, MAX_SCORE, 0);
  return out;
}

export function parseProgress(text, knownSongIds) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_STORED_CHARS) {
    return defaultProgress();
  }
  try {
    return sanitizeProgress(JSON.parse(text), knownSongIds);
  } catch {
    return defaultProgress();
  }
}

export function serializeProgress(progress, knownSongIds) {
  return JSON.stringify(sanitizeProgress(progress, knownSongIds));
}

export function withSongResult(progress, songId, stars) {
  const prev = progress.songs[songId] ?? { stars: 0, plays: 0 };
  return {
    ...progress,
    songs: {
      ...progress.songs,
      [songId]: {
        stars: Math.max(prev.stars, int(stars, 0, 3, 0)),
        plays: Math.min(MAX_SCORE, prev.plays + 1),
      },
    },
  };
}

export function withQuizBest(progress, mode, streak) {
  if (mode !== 'name' && mode !== 'staff') return progress;
  return {
    ...progress,
    quiz: { ...progress.quiz, [mode]: Math.max(progress.quiz[mode], int(streak, 0, MAX_SCORE, 0)) },
  };
}

export function withEchoBest(progress, level) {
  return {
    ...progress,
    echo: { best: Math.max(progress.echo.best, int(level, 0, MAX_SCORE, 0)) },
  };
}

export function withSettings(progress, patch) {
  return sanitizeProgressSettings({ ...progress, settings: { ...progress.settings, ...patch } });
}

function sanitizeProgressSettings(progress) {
  const d = defaultProgress().settings;
  const s = progress.settings;
  return {
    ...progress,
    settings: {
      showNames: bool(s.showNames, d.showNames),
      colorKeys: bool(s.colorKeys, d.colorKeys),
      showShortcuts: bool(s.showShortcuts, d.showShortcuts),
      volume: unit(s.volume, d.volume),
    },
  };
}
