import { audioManager, computeSegmentGapMs } from "./audio-manager.js";

const smoothScrollIntoView = (element) => {
  if (!element) {
    return;
  }
  element.scrollIntoView({ behavior: "smooth", block: "center" });
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const DEFAULT_REPEAT_PAUSE_MS = 2000;

const maybeInsertFocus = (slide, focusText, includeFocus) => {
  if (!includeFocus) {
    return;
  }

  const trimmed = typeof focusText === "string" ? focusText.trim() : "";
  if (!trimmed) {
    return;
  }

  const focusEl = document.createElement("p");
  focusEl.className = "activity-focus";
  focusEl.innerHTML = trimmed;

  const heading = slide.querySelector("h2");
  if (heading) {
    heading.insertAdjacentElement("afterend", focusEl);
  } else {
    slide.prepend(focusEl);
  }
};

const createStatus = () => {
  const status = document.createElement("p");
  status.className = "playback-status";
  status.textContent = "";
  return status;
};

const waitMs = (duration, { signal } = {}) =>
  new Promise((resolve) => {
    if (!Number.isFinite(duration) || duration <= 0) {
      resolve();
      return;
    }

    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      resolve();
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });
    timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, duration);
  });

const escapeHtml = (text) => {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/[&<>"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
};

const formatPronunciationText = (text) => {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /'([^']+)'/g,
    (_, focus) => `<span class="pronunciation-focus">${focus}</span>`
  );
};

const getRepeatPauseMs = (activityData) => {
  const raw =
    activityData?.repeat_pause_ms ?? activityData?.listen_repeat_pause_ms;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REPEAT_PAUSE_MS;
  }
  return clamp(parsed, 800, 4000);
};

const createPronunciationSlide = ({
  entries,
  activityLabel,
  activityNumber,
  activityFocus,
  includeFocus,
  role,
  letter,
  type,
  mode,
  repeatPauseMs,
} = {}) => {
  const slideRoleClass =
    mode === "listen"
      ? "slide--listening"
      : mode === "listen-repeat"
      ? "slide--listen-repeat"
      : "slide--reading";

  const cardRoleClass =
    mode === "listen"
      ? "dialogue-card--listening"
      : mode === "listen-repeat"
      ? "dialogue-card--listen-repeat"
      : "dialogue-card--reading";

  const slide = document.createElement("section");
  slide.className = `slide slide--pronunciation ${slideRoleClass}`;
  const headingLabel = letter ? `${activityLabel}${letter}` : activityLabel;
  slide.innerHTML = `<h2>${headingLabel}</h2>`;

  if (mode === "read") {
    slide.classList.add("is-animated");
  }

  maybeInsertFocus(slide, activityFocus, includeFocus);

  const description = document.createElement("p");
  description.className = "slide__instruction";
  const subjectLabel = type === "sentence" ? "the sentences" : "the words";
  description.textContent =
    mode === "listen"
      ? `Press Start to listen to ${subjectLabel}.`
      : mode === "listen-repeat"
      ? `Press Start to listen, then use the pause to repeat ${subjectLabel}.`
      : `Press Start and read along with ${subjectLabel}.`;
  slide.appendChild(description);

  const controls = document.createElement("div");
  controls.className = "slide__controls";
  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "primary-btn";
  playBtn.textContent = "Start";
  controls.appendChild(playBtn);

  const status = createStatus();
  controls.appendChild(status);
  slide.appendChild(controls);

  const content = document.createElement("div");
  content.className = "pronunciation-content";
  slide.appendChild(content);

  const list = document.createElement("div");
  list.className = "dialogue-grid dialogue-grid--pronunciation";
  content.appendChild(list);

  const items = [];
  const textKey = type === "sentence" ? "sentence_text" : "word_text";
  const audioKey = type === "sentence" ? "sentence_audio" : "word_audio";

  (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
    const rawText =
      typeof entry?.[textKey] === "string" ? entry[textKey].trim() : "";
    const audioUrl =
      typeof entry?.[audioKey] === "string" ? entry[audioKey].trim() : "";

    if (!rawText || !audioUrl) {
      return;
    }

    const card = document.createElement("article");
    card.className = `dialogue-card ${cardRoleClass} dialogue-card--pronunciation`;
    card.dataset.entryIndex = String(index);

    const imageUrl =
      typeof entry?.image === "string" ? entry.image.trim() : "";
    if (imageUrl) {
      const img = document.createElement("img");
      img.className = "dialogue-card__image";
      img.loading = "lazy";
      img.src = imageUrl;
      img.alt =
        type === "sentence"
          ? `Illustration for sentence ${index + 1}`
          : `Illustration for word ${rawText.replace(/<[^>]*>/g, "")}`;
      card.appendChild(img);
    }

    const textsWrapper = document.createElement("div");
    textsWrapper.className = "dialogue-card__texts";

    const line = document.createElement("p");
    line.className = "dialogue-card__line dialogue-card__line--answer";
    line.innerHTML = formatPronunciationText(rawText);

    textsWrapper.appendChild(line);
    card.appendChild(textsWrapper);
    list.appendChild(card);

    items.push({
      card,
      line,
      audioUrl,
    });
  });

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Audio will be added soon.";
    content.appendChild(empty);
  }

  let abortController = null;
  let activeItem = null;
  let pauseRequested = false;

  const playbackState = {
    mode: "idle",
    index: 0,
  };

  const updateButtonLabel = () => {
    if (playbackState.mode === "playing") {
      playBtn.textContent = "Pause";
      return;
    }
    if (playbackState.mode === "paused") {
      playBtn.textContent = "Resume";
      return;
    }
    playBtn.textContent = "Start";
  };

  const setPlaybackMode = (mode, { index } = {}) => {
    playbackState.mode = mode;
    if (Number.isInteger(index)) {
      playbackState.index = Math.max(0, index);
    }
    updateButtonLabel();
  };

  updateButtonLabel();

  const resetActiveItem = () => {
    if (!activeItem) {
      return;
    }
    activeItem.card.classList.remove("is-active");
    activeItem.line.classList.remove("is-playing");
    activeItem = null;
  };

  const playEntry = async (item, { signal }) => {
    if (!item) {
      return;
    }

    resetActiveItem();
    activeItem = item;

    item.card.classList.add("is-active");
    item.line.classList.add("is-playing");
    smoothScrollIntoView(item.card);
    status.textContent = "Playing...";

    try {
      await audioManager.play(item.audioUrl, { signal });
      if (signal?.aborted) {
        return;
      }

      const durationSeconds = await audioManager.getDuration(item.audioUrl);
      const gapMs = computeSegmentGapMs(mode, durationSeconds, {
        repeatPauseMs: mode === "listen-repeat" ? repeatPauseMs : null,
      });

      if (mode === "listen-repeat") {
        status.textContent = "Your turn...";
      } else if (gapMs > 0) {
        status.textContent = "Next up...";
      }

      if (gapMs > 0) {
        await waitMs(gapMs, { signal });
      }
    } catch (error) {
      console.error(error);
      status.textContent = "Unable to play audio.";
    } finally {
      if (!signal?.aborted) {
        item.card.classList.remove("is-active");
        item.line.classList.remove("is-playing");
        if (activeItem === item) {
          activeItem = null;
        }
      }
    }
  };

  const resetState = ({ clearStatus = true } = {}) => {
    slide._autoTriggered = false;
    pauseRequested = false;
    setPlaybackMode("idle", { index: 0 });
    resetActiveItem();
    if (clearStatus) {
      status.textContent = "";
    }
  };

  const runSequence = async (fromIndex = 0) => {
    if (!items.length) {
      status.textContent = "No audio available.";
      resetState({ clearStatus: false });
      return;
    }

    pauseRequested = false;
    abortController?.abort();
    abortController = new AbortController();
    const { signal } = abortController;

    setPlaybackMode("playing", { index: fromIndex });
    status.textContent = fromIndex === 0 ? "Starting..." : "Resuming...";

    let completed = false;

    try {
      for (let index = fromIndex; index < items.length; index += 1) {
        playbackState.index = index;
        await playEntry(items[index], { signal });
        if (signal.aborted) {
          break;
        }
      }

      if (!signal.aborted) {
        completed = true;
      }
    } finally {
      const aborted = abortController?.signal?.aborted ?? false;
      abortController = null;
      resetActiveItem();

      if (aborted && pauseRequested) {
        slide._autoTriggered = false;
        setPlaybackMode("paused", { index: playbackState.index });
        status.textContent = "Paused.";
      } else {
        const finalStatus = completed
          ? "Playback complete."
          : "Playback stopped.";
        resetState({ clearStatus: false });
        status.textContent = finalStatus;
      }

      pauseRequested = false;
    }
  };

  playBtn.addEventListener("click", () => {
    if (playbackState.mode === "playing") {
      pauseRequested = true;
      abortController?.abort();
      return;
    }

    if (playbackState.mode === "paused") {
      slide._autoTriggered = true;
      runSequence(playbackState.index);
      return;
    }

    slide._autoTriggered = true;
    runSequence(0);
  });

  const autoPlay = {
    button: playBtn,
    trigger: () => {
      if (
        slide._autoTriggered ||
        playbackState.mode === "playing" ||
        playbackState.mode === "paused"
      ) {
        return;
      }
      slide._autoTriggered = true;
      runSequence(0);
    },
    status,
  };

  const id =
    activityNumber && letter
      ? `activity-${activityNumber}-${letter}-${role}`
      : activityNumber
      ? `activity-${activityNumber}-${role}`
      : `activity-${role}`;

  const onLeave = () => {
    abortController?.abort();
    abortController = null;
    audioManager.stopAll();
    resetState();
    slide._instructionComplete = false;
  };

  return {
    id,
    element: slide,
    autoPlay,
    onLeave,
  };
};

export const buildPronunciationSlides = (activityData = {}, context = {}) => {
  const { activityNumber, focus: rawFocus } = context;
  const activityLabel = activityNumber
    ? `Activity ${activityNumber}`
    : "Activity";
  const activityFocus = typeof rawFocus === "string" ? rawFocus.trim() : "";
  const includeFocus = Boolean(activityFocus);
  const entries = Array.isArray(activityData?.content)
    ? activityData.content
    : [];
  const repeatPauseMs = getRepeatPauseMs(activityData);

  const slides = [
    {
      role: "words-listen",
      letter: "a",
      type: "word",
      mode: "listen",
    },
    {
      role: "words-repeat",
      letter: "b",
      type: "word",
      mode: "listen-repeat",
    },
    {
      role: "sentences-listen",
      letter: "c",
      type: "sentence",
      mode: "listen",
    },
    {
      role: "sentences-repeat",
      letter: "d",
      type: "sentence",
      mode: "listen-repeat",
    },
    {
      role: "sentences-read",
      letter: "e",
      type: "sentence",
      mode: "read",
    },
  ];

  return slides.map((config) =>
    createPronunciationSlide({
      entries,
      activityLabel,
      activityNumber,
      activityFocus,
      includeFocus,
      repeatPauseMs,
      ...config,
    })
  );
};
