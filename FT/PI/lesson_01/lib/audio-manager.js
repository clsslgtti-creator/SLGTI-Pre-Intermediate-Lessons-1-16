const DEFAULT_MODE_TIMINGS = Object.freeze({
  listen: {
    minimumGapMs: 1000,
    multiplierMs: 0,
    betweenItemsMs: 0,
  },
  'listen-repeat': {
    minimumGapMs: 1500,
    multiplierMs: 1500,
    betweenItemsMs: 0,
  },
  read: {
    minimumGapMs: 1000,
    multiplierMs: 0,
    betweenItemsMs: 2000,
  },
});

const resolveTimingConfig = (mode) => {
  if (typeof mode !== 'string') {
    return DEFAULT_MODE_TIMINGS.listen;
  }

  const normalized = mode.toLowerCase();
  return DEFAULT_MODE_TIMINGS[normalized] ?? DEFAULT_MODE_TIMINGS.listen;
};

const createAudioManager = () => {
  const cache = new Map();
  const active = new Set();

  const ensureEntry = (url) => {
    if (typeof url !== 'string' || !url.trim()) {
      return null;
    }

    const normalized = url.trim();

    if (!cache.has(normalized)) {
      const audioEl = new Audio(normalized);
      audioEl.preload = 'auto';

      const metaPromise = new Promise((resolve) => {
        const resolveWithDuration = () => {
          cleanup();
          resolve(Number.isFinite(audioEl.duration) ? audioEl.duration : 0);
        };

        const resolveWithZero = () => {
          cleanup();
          resolve(0);
        };

        const cleanup = () => {
          audioEl.removeEventListener('loadedmetadata', resolveWithDuration);
          audioEl.removeEventListener('error', resolveWithZero);
        };

        audioEl.addEventListener('loadedmetadata', resolveWithDuration);
        audioEl.addEventListener('error', resolveWithZero);
      });

      cache.set(normalized, { audio: audioEl, metaPromise });
      audioEl.load();
    }

    return cache.get(normalized);
  };

  const play = (url, { signal } = {}) => {
    const entry = ensureEntry(url);
    if (!entry) {
      return Promise.resolve();
    }

    const { audio, metaPromise } = entry;
    audio.currentTime = 0;

    return new Promise((resolve, reject) => {
      const handleEnded = () => {
        cleanup();
        resolve();
      };

      const handleError = () => {
        cleanup();
        reject(new Error(`Unable to play audio: ${url}`));
      };

      const handleAbort = () => {
        cleanup();
        audio.pause();
        audio.currentTime = 0;
        resolve();
      };

      const cleanup = () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        if (signal) {
          signal.removeEventListener('abort', handleAbort);
        }
        active.delete(audio);
      };

      if (signal) {
        if (signal.aborted) {
          handleAbort();
          return;
        }
        signal.addEventListener('abort', handleAbort, { once: true });
      }

      active.add(audio);

      audio.addEventListener('ended', handleEnded, { once: true });
      audio.addEventListener('error', handleError, { once: true });

      metaPromise
        .then(() => audio.play())
        .catch(() => audio.play())
        .catch((err) => {
          cleanup();
          reject(err);
        });
    });
  };

  const stopAll = () => {
    active.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    active.clear();
  };

  const getDuration = async (url) => {
    const entry = ensureEntry(url);
    if (!entry) {
      return 0;
    }

    try {
      const duration = await entry.metaPromise;
      return Number.isFinite(duration) ? duration : 0;
    } catch {
      return 0;
    }
  };

  return {
    play,
    stopAll,
    getDuration,
  };
};

export const audioManager = createAudioManager();

export const computeSegmentGapMs = (mode, durationSeconds, options = {}) => {
  const config = resolveTimingConfig(mode);
  const {
    minimumGapMs = config.minimumGapMs,
    multiplierMs = config.multiplierMs,
    repeatPauseMs = null,
  } = options;

  const baseMinGap =
    mode === 'listen-repeat' && Number.isFinite(repeatPauseMs)
      ? Math.max(minimumGapMs, Math.max(0, repeatPauseMs))
      : minimumGapMs;

  const effectiveMultiplier = Number.isFinite(multiplierMs) ? multiplierMs : config.multiplierMs;
  const durationMs = Number.isFinite(durationSeconds)
    ? Math.max(0, durationSeconds * effectiveMultiplier)
    : 0;

  return Math.max(baseMinGap, Math.round(durationMs));
};

export const getBetweenItemGapMs = (mode, overrides = {}) => {
  const config = resolveTimingConfig(mode);
  const betweenItemsMs = Number.isFinite(overrides.betweenItemsMs)
    ? overrides.betweenItemsMs
    : config.betweenItemsMs;
  return Math.max(0, betweenItemsMs);
};

export const audioTimingPresets = DEFAULT_MODE_TIMINGS;
