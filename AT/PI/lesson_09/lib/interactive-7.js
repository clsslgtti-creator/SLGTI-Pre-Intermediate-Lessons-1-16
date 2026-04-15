import {
  createGameScene,
  DEFAULT_FEEDBACK_ASSETS,
  sanitizeOptions,
  normalizeExamples,
  normalizeQuestions,
} from "./games/game-1.js";
import {
  audioManager,
  computeSegmentGapMs,
  getBetweenItemGapMs,
} from "./audio-manager.js";
import { showCompletionModal } from "./completion-modal.js";

const GAME_INSTRUCTION_TEXT =
  "Press Start to play. Listen to each sentence and choose the correct answer before time runs out.";

const trimText = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeInstructionKey = (value) =>
  typeof value === "string" || typeof value === "number"
    ? value.toString().toLowerCase().replace(/[^a-z0-9]+/g, "")
    : "";

const extractInstructionText = (value) => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = extractInstructionText(entry);
      if (text) {
        return text;
      }
    }
    return "";
  }
  if (value && typeof value === "object") {
    if (typeof value.text === "string" && value.text.trim()) {
      return value.text.trim();
    }
    for (const entry of Object.values(value)) {
      const text = extractInstructionText(entry);
      if (text) {
        return text;
      }
    }
  }
  return "";
};

const createInstructionLookup = (instructions) => {
  if (!instructions || typeof instructions !== "object") {
    return {
      get: () => "",
    };
  }
  const map = new Map();
  Object.entries(instructions).forEach(([key, value]) => {
    const normalizedKey = normalizeInstructionKey(key);
    if (!normalizedKey) {
      return;
    }
    const text = extractInstructionText(value);
    if (text) {
      map.set(normalizedKey, text);
    }
  });
  return {
    get: (key) => {
      const normalizedKey = normalizeInstructionKey(key);
      if (!normalizedKey) {
        return "";
      }
      return map.get(normalizedKey) ?? "";
    },
  };
};

const inferSequencedMode = (instructionText = "") => {
  const normalized = trimText(instructionText).toLowerCase();
  if (!normalized) {
    return "listen-repeat";
  }
  if (normalized.includes("read along") || normalized.includes("read")) {
    return "read";
  }
  if (
    normalized.includes("listen and repeat") ||
    normalized.includes("listen & repeat")
  ) {
    return "listen-repeat";
  }
  if (normalized.includes("listen")) {
    return "listen";
  }
  return "listen-repeat";
};

const smoothScrollIntoView = (element) => {
  if (!element) {
    return;
  }
  element.scrollIntoView({ behavior: "smooth", block: "center" });
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

const shuffleArray = (items = []) => {
  const list = Array.isArray(items) ? [...items] : [];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
  return list;
};

const createPlaybackStatus = () => {
  const status = document.createElement("p");
  status.className = "playback-status";
  status.textContent = "";
  return status;
};

const deriveSubActivityLetter = (key, index = 0) => {
  if (typeof key === "string") {
    const match = /activity[_-]?([a-z])/i.exec(key);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  if (Number.isInteger(index)) {
    const code = 97 + index;
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(code);
    }
  }
  return "";
};

const buildSlideId = (activityNumber, letter = "") => {
  const suffix = letter ? `-${letter}` : "";
  if (activityNumber) {
    return `activity-${activityNumber}${suffix}-game1`;
  }
  return `activity${suffix}-game1`;
};

const formatActivityLabel = (activityNumber, letter = "") => {
  if (activityNumber) {
    return letter
      ? `Activity ${activityNumber}${letter}`
      : `Activity ${activityNumber}`;
  }
  return letter ? `Game ${letter}` : "Game";
};

const insertFocusElement = (titleEl, focusText) => {
  const trimmed = trimText(focusText);
  if (!trimmed || !titleEl) {
    return;
  }
  const focusEl = document.createElement("p");
  focusEl.className = "activity-focus";
  focusEl.innerHTML = `<span class="activity-focus__label">Focus</span>${trimmed}`;
  titleEl.insertAdjacentElement("afterend", focusEl);
};

const clearEntryHighlights = (items = []) => {
  items.forEach(({ card, line }) => {
    card?.classList.remove("is-active");
    line?.classList.remove("is-playing");
  });
};

const normalizeListenRepeatItems = (raw = []) => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry, index) => {
      const id = trimText(entry?.id) || `line_${index + 1}`;
      const text = trimText(entry?.text);
      const audio = trimText(entry?.audio);
      if (!text || !audio) {
        return null;
      }
      return { id, text, audio };
    })
    .filter(Boolean);
};

const normalizeKeywordPairs = (raw = []) => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const idCounts = new Map();
  return raw
    .map((entry, index) => {
      const baseId = trimText(entry?.id) || `match_${index + 1}`;
      const count = idCounts.get(baseId) ?? 0;
      idCounts.set(baseId, count + 1);
      const id = count > 0 ? `${baseId}_${count + 1}` : baseId;

      const sentence =
        trimText(entry?.item_1) ||
        trimText(entry?.item1) ||
        trimText(entry?.item_b) ||
        trimText(entry?.itemB) ||
        trimText(entry?.sentence) ||
        trimText(entry?.text);

      const keyword =
        trimText(entry?.item_2) ||
        trimText(entry?.item2) ||
        trimText(entry?.item_a) ||
        trimText(entry?.itemA) ||
        trimText(entry?.keyword) ||
        trimText(entry?.word) ||
        trimText(entry?.label) ||
        trimText(entry?.answer);

      if (!sentence || !keyword) {
        return null;
      }

      return {
        id,
        sentence,
        keyword,
      };
    })
    .filter(Boolean);
};

const collectListenRepeatActivities = (activityData = {}) => {
  const content = activityData?.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return [];
  }

  return Object.entries(content)
    .map(([key, value]) => {
      if (!Array.isArray(value)) {
        return null;
      }
      const items = normalizeListenRepeatItems(value);
      if (!items.length) {
        return null;
      }
      return {
        key,
        letter: deriveSubActivityLetter(key),
        items,
      };
    })
    .filter(Boolean);
};

const buildSequencedTextSlideId = (
  activityNumber,
  letter = "",
  mode = "listen-repeat"
) => {
  const suffix = letter ? `-${letter}` : "";
  const role =
    mode === "read"
      ? "reading"
      : mode === "listen"
      ? "listening"
      : "listen-repeat";
  if (activityNumber) {
    return `activity-${activityNumber}${suffix}-${role}`;
  }
  return `activity${suffix}-${role}`;
};

const buildMatchingSlideId = (activityNumber, letter = "") => {
  const suffix = letter ? `-${letter}` : "";
  if (activityNumber) {
    return `activity-${activityNumber}${suffix}-pre-listening`;
  }
  return `activity${suffix}-pre-listening`;
};

const getRepeatPauseMs = (activityData, fallback = 1500) => {
  const raw =
    activityData?.listen_repeat_pause_ms ?? activityData?.repeat_pause_ms;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(500, parsed);
};

const cloneFeedbackAssets = () => ({ ...DEFAULT_FEEDBACK_ASSETS });

const findFirstOptionSet = (entries) => {
  if (!Array.isArray(entries)) {
    return null;
  }
  const match = entries.find(
    (entry) => Array.isArray(entry?.options) && entry.options.length
  );
  return match?.options ?? null;
};

const createGameSlide = (gameConfig = {}, context = {}) => {
  const { slideId, activityLabel, focusText, includeFocus } = context;

  const slide = document.createElement("section");
  slide.className = "slide game-slide";
  if (slideId) {
    slide.id = slideId;
  }

  const title = document.createElement("h2");
  title.textContent = trimText(activityLabel) || "Game";
  slide.appendChild(title);

  if (includeFocus && focusText) {
    insertFocusElement(title, focusText);
  }

  const instruction = document.createElement("p");
  instruction.className = "slide__instruction";
  instruction.textContent = GAME_INSTRUCTION_TEXT;
  slide.appendChild(instruction);

  const wrapper = document.createElement("div");
  wrapper.className = "game1-shell";

  const stage = document.createElement("div");
  stage.className = "game1-stage";
  const stageId = `game1-stage-${Math.random().toString(36).slice(2, 8)}`;
  stage.id = stageId;

  const status = document.createElement("p");
  status.className = "game1-status is-visible";
  status.textContent = "Loading game...";

  wrapper.append(stage, status);
  slide.appendChild(wrapper);

  const fallbackOptions =
    findFirstOptionSet(gameConfig?.content) ??
    findFirstOptionSet(gameConfig?.examples);
  const options = sanitizeOptions(gameConfig?.options ?? fallbackOptions);
  const examples = normalizeExamples(gameConfig?.examples, options);
  const questions = normalizeQuestions(gameConfig?.content, options);
  const feedbackAssets = cloneFeedbackAssets();
  const backgroundImage =
    gameConfig?.bg_image ?? gameConfig?.backgroundImage ?? null;

  if (!questions.length) {
    status.textContent = "The game content is not ready yet.";
    return {
      id: slideId,
      element: slide,
      onEnter: () => {},
      onLeave: () => {},
    };
  }

  let gameInstance = null;

  const getPhaser = () => window?.Phaser;

  const startGame = () => {
    const PhaserLib = getPhaser();
    if (!PhaserLib) {
      status.textContent =
        "Phaser library is missing. Please reload the lesson.";
      status.classList.add("is-error");
      return;
    }

    if (gameInstance) {
      gameInstance.destroy(true);
      gameInstance = null;
      stage.innerHTML = "";
    }

    status.textContent = "Loading game...";
    status.classList.remove("is-error");
    status.classList.remove("is-transparent");
    status.classList.add("is-visible");

    const GameScene = createGameScene({
      options,
      examples,
      questions,
      feedbackAssets,
      backgroundImage,
      statusElement: status,
      onRoundUpdate: (info) => {
        if (info.mode === "examples") {
          status.textContent = `Example ${info.exampleIndex + 1} of ${
            info.exampleTotal
          } - Watch and listen`;
          status.classList.remove("is-transparent");
        } else if (info.mode === "questions") {
          status.textContent = `Question ${info.questionIndex + 1} of ${
            info.questionTotal
          } - Score ${info.score}/${info.total}`;
          status.classList.add("is-transparent");
        }
        status.classList.add("is-visible");
      },
    });

    gameInstance = new PhaserLib.Game({
      type: PhaserLib.AUTO,
      parent: stageId,
      backgroundColor: "#f3f6fb",
      scale: {
        mode: PhaserLib.Scale.FIT,
        autoCenter: PhaserLib.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
        fullscreenTarget: stage,
        expandParent: true,
      },
      scene: GameScene,
    });
    if (gameInstance?.scale) {
      gameInstance.scale.fullscreenTarget = stage;
    }
  };

  const destroyGame = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if (gameInstance) {
      gameInstance.destroy(true);
      gameInstance = null;
      stage.innerHTML = "";
    }
    status.textContent = "Game paused. Reopen this slide to play again.";
    status.classList.remove("is-transparent");
    status.classList.remove("is-error");
    status.classList.add("is-visible");
  };

  return {
    id: slideId,
    element: slide,
    onEnter: startGame,
    onLeave: destroyGame,
  };
};

const createListenRepeatSlide = (
  items = [],
  {
    slideId,
    activityLabel = "Activity",
    focusText = "",
    includeFocus = false,
    repeatPauseMs = 1500,
    mode = "listen-repeat",
  } = {}
) => {
  const resolvedSlideId = slideId || "interactive-listen-repeat";
  const autoDelayMs = 5000;
  const resolvedMode =
    mode === "read" ? "read" : mode === "listen" ? "listen" : "listen-repeat";
  const isRepeatMode = resolvedMode === "listen-repeat";
  const isReadMode = resolvedMode === "read";
  const slide = document.createElement("section");
  slide.className = isRepeatMode
    ? "slide slide--listen-repeat listening-slide listening-slide--repeat"
    : isReadMode
    ? "slide slide--listening listening-slide listening-slide--read"
    : "slide slide--listening listening-slide";
  if (resolvedSlideId) {
    slide.id = resolvedSlideId;
  }

  const title = document.createElement("h2");
  title.textContent = trimText(activityLabel) || "Activity";
  slide.appendChild(title);

  if (includeFocus && focusText) {
    insertFocusElement(title, focusText);
  }

  const instruction = document.createElement("p");
  instruction.className = "slide__instruction";
  instruction.textContent = isRepeatMode
    ? "Listen and repeat each sentence."
    : isReadMode
    ? "Read along with the audio."
    : "Listen to each sentence.";
  slide.appendChild(instruction);

  const controls = document.createElement("div");
  controls.className = "slide__controls";
  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "primary-btn";
  startBtn.textContent = "Start";
  const status = createPlaybackStatus();
  controls.append(startBtn, status);
  slide.appendChild(controls);

  const list = document.createElement("div");
  list.className = "dialogue-grid listening-read-grid";
  slide.appendChild(list);

  const entries = items.map((entry, index) => {
    const card = document.createElement("article");
    card.className =
      "dialogue-card dialogue-card--reading listening-read-card";

    const cardTitle = document.createElement("h3");
    cardTitle.className = "dialogue-card__title";
    cardTitle.textContent = `Line ${index + 1}`;
    card.appendChild(cardTitle);

    const wrapper = document.createElement("div");
    wrapper.className = "dialogue-card__texts";

    const line = document.createElement("p");
    line.className = "dialogue-card__line";
    line.textContent = entry.text;
    wrapper.appendChild(line);

    card.appendChild(wrapper);
    list.appendChild(card);

    return {
      entry,
      card,
      line,
    };
  });

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Audio will be added soon.";
    list.appendChild(empty);
  }

  let sequenceAbort = null;
  let autoTriggered = false;
  let pendingAutoStart = null;
  let pauseRequested = false;

  const playbackState = {
    mode: "idle",
    resumeIndex: 0,
  };

  const updateButtonLabel = () => {
    if (playbackState.mode === "playing") {
      startBtn.textContent = "Pause";
      return;
    }
    if (playbackState.mode === "paused") {
      startBtn.textContent = "Resume";
      return;
    }
    startBtn.textContent = "Start";
  };

  const setPlaybackMode = (mode, { resumeIndex } = {}) => {
    playbackState.mode = mode;
    if (Number.isInteger(resumeIndex)) {
      playbackState.resumeIndex = Math.max(0, resumeIndex);
    }
    updateButtonLabel();
  };

  const resetPlaybackState = () => {
    setPlaybackMode("idle", { resumeIndex: 0 });
    autoTriggered = false;
    slide._autoTriggered = false;
    startBtn.disabled = false;
  };

  updateButtonLabel();

  const clearAutoStart = () => {
    if (pendingAutoStart !== null) {
      window.clearTimeout(pendingAutoStart);
      pendingAutoStart = null;
    }
  };

  const resetEntries = () => {
    clearEntryHighlights(entries);
  };

  const runSequence = async (fromIndex = 0) => {
    if (!entries.length) {
      status.textContent = "Audio will be added soon.";
      resetPlaybackState();
      return;
    }

    pauseRequested = false;

    sequenceAbort?.abort();
    sequenceAbort = new AbortController();
    const { signal } = sequenceAbort;

    audioManager.stopAll();
    resetEntries();
    setPlaybackMode("playing", { resumeIndex: fromIndex });
    status.textContent = fromIndex === 0 ? "Starting..." : "Resuming...";

    let completed = false;

    try {
      for (let index = fromIndex; index < entries.length; index += 1) {
        playbackState.resumeIndex = index;
        const item = entries[index];
        item.card?.classList.add("is-active");
        item.line?.classList.add("is-playing");
        status.textContent = "Listening...";
        smoothScrollIntoView(item.card ?? item.line);

        try {
          await audioManager.play(item.entry.audio, { signal });
        } catch (error) {
          if (!signal.aborted) {
            console.error(error);
            status.textContent = "Unable to play audio.";
          }
        }

        if (signal.aborted) {
          break;
        }

        playbackState.resumeIndex = index + 1;

        let gapMs = 0;
        try {
          const duration = await audioManager.getDuration(item.entry.audio);
          const timingOptions = isRepeatMode
            ? { repeatPauseMs }
            : undefined;
          gapMs = computeSegmentGapMs(resolvedMode, duration, timingOptions);
        } catch (error) {
          console.error(error);
        }

        if (signal.aborted) {
          break;
        }

        if (gapMs > 0) {
          if (isRepeatMode) {
            status.textContent = "Your turn...";
            await waitMs(gapMs, { signal });
          } else if (isReadMode) {
            status.textContent = "Read along...";
            await waitMs(gapMs, { signal });
            if (!signal.aborted) {
              status.textContent = "Listening...";
            }
          } else if (index < entries.length - 1) {
            status.textContent = "Next up...";
            await waitMs(gapMs, { signal });
          }
        }

        item.card?.classList.remove("is-active");
        item.line?.classList.remove("is-playing");

        if (signal.aborted) {
          break;
        }

        if (isReadMode && index < entries.length - 1) {
          const betweenItemsGap = getBetweenItemGapMs("read");
          if (betweenItemsGap > 0) {
            await waitMs(betweenItemsGap, { signal });
          }
        }
      }

      if (!signal.aborted) {
        completed = true;
        status.textContent = "Playback complete.";
      }
    } finally {
      const aborted = sequenceAbort?.signal?.aborted ?? false;
      sequenceAbort = null;

      if (aborted && pauseRequested) {
        setPlaybackMode("paused", { resumeIndex: playbackState.resumeIndex });
        status.textContent = "Paused.";
      } else if (completed) {
        resetPlaybackState();
        resetEntries();
      } else if (aborted) {
        status.textContent = "Playback stopped.";
        resetPlaybackState();
        resetEntries();
      } else {
        resetPlaybackState();
      }

      pauseRequested = false;
    }
  };

  const startSequence = (fromIndex = 0) => {
    clearAutoStart();
    autoTriggered = true;
    slide._autoTriggered = true;
    runSequence(fromIndex);
  };

  const triggerAutoPlay = () => {
    if (
      autoTriggered ||
      playbackState.mode === "playing" ||
      playbackState.mode === "paused"
    ) {
      return;
    }
    autoTriggered = true;
    slide._autoTriggered = true;
    clearAutoStart();
    pendingAutoStart = window.setTimeout(() => {
      pendingAutoStart = null;
      runSequence();
    }, Math.max(0, autoDelayMs));
  };

  startBtn.addEventListener("click", () => {
    if (playbackState.mode === "playing") {
      pauseRequested = true;
      sequenceAbort?.abort();
      return;
    }

    if (playbackState.mode === "paused") {
      startSequence(playbackState.resumeIndex);
      return;
    }

    startSequence();
  });

  const onLeave = () => {
    clearAutoStart();
    pauseRequested = false;
    sequenceAbort?.abort();
    sequenceAbort = null;
    audioManager.stopAll();
    resetEntries();
    resetPlaybackState();
    status.textContent = "";
  };

  return {
    id: resolvedSlideId,
    element: slide,
    autoPlay: {
      button: startBtn,
      trigger: triggerAutoPlay,
      status,
    },
    onLeave,
  };
};

const buildKeywordMatchSlide = (pairs = [], context = {}) => {
  const {
    slideId,
    activityLabel = "Activity",
    focusText = "",
    includeFocus = false,
  } = context;

  const resolvedSlideId = slideId || "interactive-keyword-match";
  const slide = document.createElement("section");
  slide.className =
    "slide slide--listening listening-slide listening-slide--matching";
  if (resolvedSlideId) {
    slide.id = resolvedSlideId;
  }

  const title = document.createElement("h2");
  title.textContent = trimText(activityLabel) || "Activity";
  slide.appendChild(title);

  if (includeFocus && focusText) {
    insertFocusElement(title, focusText);
  }

  const instruction = document.createElement("p");
  instruction.className = "slide__instruction";
  instruction.textContent = "Drag each keyword to the matching sentence.";
  slide.appendChild(instruction);

  if (!pairs.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Matching content will be added soon.";
    slide.appendChild(empty);
    return {
      id: resolvedSlideId,
      element: slide,
      onEnter: () => {},
      onLeave: () => {},
    };
  }

  const controls = document.createElement("div");
  controls.className = "slide__controls";
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "secondary-btn";
  resetBtn.textContent = "Reset";
  controls.appendChild(resetBtn);
  slide.appendChild(controls);

  const layout = document.createElement("div");
  layout.className = "listening-word-match";

  const wordsColumn = document.createElement("div");
  wordsColumn.className = "word-match-bank";
  layout.appendChild(wordsColumn);

  const sentencesColumn = document.createElement("div");
  sentencesColumn.className = "word-match-sentences";
  layout.appendChild(sentencesColumn);

  const feedbackEl = document.createElement("p");
  feedbackEl.className =
    "listening-feedback listening-feedback--neutral word-match-feedback";
  layout.appendChild(feedbackEl);

  slide.appendChild(layout);

  const placements = new Map();
  const dropzones = [];

  const sentenceCards = pairs.map((pair, index) => {
    const card = document.createElement("article");
    card.className = "word-match-sentence";

    const heading = document.createElement("h3");
    heading.textContent = `Sentence ${index + 1}`;
    card.appendChild(heading);

    const body = document.createElement("p");
    body.textContent = pair.sentence;
    card.appendChild(body);

    const zone = document.createElement("div");
    zone.className = "word-match-dropzone";
    zone.dataset.expectedId = pair.id;
    zone.dataset.zoneId = pair.id;

    const placeholder = document.createElement("span");
    placeholder.className = "word-match-placeholder";
    placeholder.textContent = "Drop the keyword here";
    zone.appendChild(placeholder);

    card.appendChild(zone);
    sentencesColumn.appendChild(card);
    dropzones.push(zone);

    return card;
  });

  const cards = shuffleArray(
    pairs.map((pair) => {
      const card = document.createElement("div");
      card.className = "word-match-card";
      card.dataset.itemId = pair.id;
      card.dataset.assignedZone = "";
      card.textContent = pair.keyword;
      return card;
    })
  );

  cards.forEach((card) => wordsColumn.appendChild(card));

  const updateFeedback = (text, variant = "neutral") => {
    feedbackEl.textContent = text;
    feedbackEl.classList.remove(
      "listening-feedback--positive",
      "listening-feedback--negative",
      "listening-feedback--neutral"
    );
    feedbackEl.classList.add(`listening-feedback--${variant}`);
  };

  let evaluationShown = false;

  const markZoneState = (zone, cardEl) => {
    if (!zone) {
      return false;
    }
    const expectedId = zone.dataset.expectedId;
    zone.classList.remove("is-correct", "is-incorrect");
    cardEl?.classList.remove("is-correct", "is-incorrect");
    if (!cardEl) {
      return false;
    }
    const isMatch = cardEl.dataset.itemId === expectedId;
    if (isMatch) {
      zone.classList.add("is-correct");
      cardEl.classList.add("is-correct");
    } else {
      zone.classList.add("is-incorrect");
      cardEl.classList.add("is-incorrect");
    }
    return isMatch;
  };

  const detachFromZone = (cardEl) => {
    if (!cardEl) {
      return;
    }
    const assigned = cardEl.dataset.assignedZone;
    if (!assigned) {
      return;
    }
    const zone = dropzones.find((zoneEl) => zoneEl.dataset.zoneId === assigned);
    if (zone) {
      placements.delete(assigned);
      zone.classList.remove("is-filled", "is-correct", "is-incorrect");
      const placeholder = zone.querySelector(".word-match-placeholder");
      placeholder?.classList.remove("is-hidden");
      if (placeholder && !zone.contains(placeholder)) {
        zone.appendChild(placeholder);
      }
      const card = zone.querySelector(".word-match-card");
      if (card) {
        zone.removeChild(card);
      }
    }
    cardEl.dataset.assignedZone = "";
  };

  const resetCardPosition = (cardEl) => {
    if (!cardEl) {
      return;
    }
    cardEl.style.top = "";
    cardEl.style.left = "";
    cardEl.style.position = "relative";
    const $ = window.jQuery;
    if ($ && $(cardEl).data("uiDraggable")) {
      $(cardEl).draggable("option", "revert", "invalid");
    }
  };

  const clearEvaluationState = () => {
    evaluationShown = false;
    updateFeedback("Drag each keyword to the matching sentence.", "neutral");
    dropzones.forEach((zone) =>
      zone.classList.remove("is-correct", "is-incorrect")
    );
    cards.forEach((card) =>
      card.classList.remove("is-correct", "is-incorrect")
    );
  };

  const resetMatching = () => {
    placements.clear();
    clearEvaluationState();
    dropzones.forEach((zone) => {
      zone.classList.remove("is-filled");
      const placeholder = zone.querySelector(".word-match-placeholder");
      placeholder?.classList.remove("is-hidden");
      if (placeholder && !zone.contains(placeholder)) {
        zone.appendChild(placeholder);
      }
      const card = zone.querySelector(".word-match-card");
      if (card) {
        zone.removeChild(card);
      }
    });
    cards.forEach((card) => {
      card.dataset.assignedZone = "";
      card.classList.remove("is-active");
      resetCardPosition(card);
      wordsColumn.appendChild(card);
    });
  };

  const evaluatePlacements = () => {
    let correctCount = 0;
    dropzones.forEach((zone) => {
      const cardEl = placements.get(zone.dataset.zoneId);
      const isMatch = cardEl ? markZoneState(zone, cardEl) : false;
      if (isMatch) {
        correctCount += 1;
      }
    });

    evaluationShown = true;
    if (correctCount === dropzones.length) {
      updateFeedback("Great job! Every sentence is correct.", "positive");
      showCompletionModal({
        title: "Excellent!",
        message: "You matched each keyword correctly.",
      });
    } else {
      updateFeedback(
        `You matched ${correctCount} of ${dropzones.length}. Adjust the red cards to try again.`,
        "negative"
      );
    }
  };

  const checkForCompletion = () => {
    const filled = dropzones.every((zone) =>
      placements.has(zone.dataset.zoneId)
    );
    if (filled) {
      evaluatePlacements();
    }
  };

  resetBtn.addEventListener("click", () => resetMatching());

  let interactionsReady = false;

  const setupInteractions = () => {
    if (interactionsReady) {
      return;
    }
    const $ = window.jQuery;
    if (!$ || !$.fn?.draggable || !$.fn?.droppable) {
      console.warn("jQuery UI is required for the matching activity.");
      return;
    }

    interactionsReady = true;

    $(cards).draggable({
      revert: "invalid",
      containment: slide,
      start() {
        $(this).addClass("is-active");
        if (evaluationShown) {
          clearEvaluationState();
        }
      },
      stop() {
        $(this).removeClass("is-active");
      },
    });

    $(dropzones).droppable({
      accept: ".word-match-card",
      tolerance: "intersect",
      over() {
        $(this).addClass("is-hover");
      },
      out() {
        $(this).removeClass("is-hover");
      },
      drop(_, ui) {
        const cardEl = ui.draggable.get(0);
        const zoneEl = this;
        $(zoneEl).removeClass("is-hover");
        if (!cardEl) {
          return;
        }

        detachFromZone(cardEl);
        const zoneId = zoneEl.dataset.zoneId;
        const existing = placements.get(zoneId);
        if (existing && existing !== cardEl) {
          detachFromZone(existing);
          resetCardPosition(existing);
          wordsColumn.appendChild(existing);
        }

        const placeholder = zoneEl.querySelector(".word-match-placeholder");
        placeholder?.classList.add("is-hidden");
        zoneEl.appendChild(cardEl);
        resetCardPosition(cardEl);
        cardEl.dataset.assignedZone = zoneId;
        zoneEl.classList.add("is-filled");
        placements.set(zoneId, cardEl);
        markZoneState(zoneEl, cardEl);
        checkForCompletion();
      },
    });

    $(wordsColumn).droppable({
      accept: ".word-match-card",
      tolerance: "intersect",
      drop(_, ui) {
        const cardEl = ui.draggable.get(0);
        if (!cardEl) {
          return;
        }
        detachFromZone(cardEl);
        resetCardPosition(cardEl);
        wordsColumn.appendChild(cardEl);
      },
    });
  };

  resetMatching();

  return {
    id: resolvedSlideId,
    element: slide,
    onEnter: () => {
      setupInteractions();
    },
    onLeave: () => {
      resetMatching();
    },
  };
};

const collectGameActivities = (activityData = {}) => {
  const content = activityData?.content;
  const baseOptions = activityData?.options;
  const baseExamples = activityData?.examples;
  const legacyQuestions = Array.isArray(content) ? content : [];
  const defaultBackground =
    activityData?.bg_image ?? activityData?.backgroundImage ?? null;

  if (content && typeof content === "object" && !Array.isArray(content)) {
    return Object.entries(content)
      .map(([key, value], index) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return null;
        }
        const letter = deriveSubActivityLetter(key, index);
        return {
          key,
          letter,
          data: {
            options: value.options ?? baseOptions,
            examples: value.examples ?? baseExamples,
            content: Array.isArray(value.content)
              ? value.content
              : Array.isArray(value.questions)
              ? value.questions
              : legacyQuestions,
            bg_image: value.bg_image ?? value.backgroundImage ?? defaultBackground,
          },
        };
      })
      .filter(Boolean);
  }

  if (legacyQuestions.length) {
    return [
      {
        key: "activity_a",
        letter: "a",
        data: {
          options: baseOptions,
          examples: baseExamples,
          content: legacyQuestions,
          bg_image: defaultBackground,
        },
      },
    ];
  }

  return [];
};

export const buildInteractive7Slides = (activityData = {}, context = {}) => {
  const { activityNumber, focus, instructions } = context;
  const focusText = trimText(focus);
  const repeatPauseMs = getRepeatPauseMs(activityData);
  const instructionLookup = createInstructionLookup(instructions);

  const slides = [];
  let focusAssigned = false;

  const shouldIncludeFocus = () => {
    if (!focusText || focusAssigned) {
      return false;
    }
    focusAssigned = true;
    return true;
  };

  const content = activityData?.content;
  const baseOptions = activityData?.options;
  const baseExamples = activityData?.examples;
  const defaultBackground =
    activityData?.bg_image ?? activityData?.backgroundImage ?? null;

  if (content && typeof content === "object" && !Array.isArray(content)) {
    Object.entries(content).forEach(([key, value], index) => {
      const letter = deriveSubActivityLetter(key, index);
      const activityLabel = formatActivityLabel(activityNumber, letter);

      if (value && typeof value === "object" && !Array.isArray(value)) {
        const gameData = {
          options: value.options ?? baseOptions,
          examples: value.examples ?? baseExamples,
          content: Array.isArray(value.content)
            ? value.content
            : Array.isArray(value.questions)
            ? value.questions
            : [],
          bg_image: value.bg_image ?? value.backgroundImage ?? defaultBackground,
        };
        slides.push(
          createGameSlide(gameData, {
            slideId: buildSlideId(activityNumber, letter),
            activityLabel,
            focusText,
            includeFocus: shouldIncludeFocus(),
          })
        );
        return;
      }

      if (Array.isArray(value)) {
        const matchingPairs = normalizeKeywordPairs(value);
        if (matchingPairs.length) {
          slides.push(
            buildKeywordMatchSlide(matchingPairs, {
              slideId: buildMatchingSlideId(activityNumber, letter),
              activityLabel,
              focusText,
              includeFocus: shouldIncludeFocus(),
            })
          );
          return;
        }

        const items = normalizeListenRepeatItems(value);
        if (items.length) {
          const instructionText = instructionLookup.get(key);
          const mode = inferSequencedMode(instructionText);
          slides.push(
            createListenRepeatSlide(items, {
              slideId: buildSequencedTextSlideId(
                activityNumber,
                letter,
                mode
              ),
              activityLabel,
              focusText,
              includeFocus: shouldIncludeFocus(),
              repeatPauseMs,
              mode,
            })
          );
        }
      }
    });
  } else if (Array.isArray(content)) {
    slides.push(
      createGameSlide(
        {
          options: baseOptions,
          examples: baseExamples,
          content,
          bg_image: defaultBackground,
        },
        {
          slideId: buildSlideId(activityNumber, ""),
          activityLabel: formatActivityLabel(activityNumber, ""),
          focusText,
          includeFocus: shouldIncludeFocus(),
        }
      )
    );
  }

  if (!slides.length) {
    return [
      createGameSlide(
        { content: [] },
        {
          slideId: buildSlideId(activityNumber, ""),
          activityLabel: formatActivityLabel(activityNumber, ""),
          focusText,
          includeFocus: Boolean(focusText),
        }
      ),
    ];
  }

  return slides;
};
