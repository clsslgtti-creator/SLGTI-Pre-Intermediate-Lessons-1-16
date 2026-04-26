import {
  audioManager,
  computeSegmentGapMs,
  getBetweenItemGapMs,
} from "./audio-manager.js";
import { showCompletionModal } from "./completion-modal.js";

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

const trimString = (value) =>
  typeof value === "string" ? value.trim() : "";

const createStatus = () => {
  const status = document.createElement("p");
  status.className = "playback-status";
  status.textContent = "";
  return status;
};

const ensureInstructionAnchor = (slide) => {
  if (slide.querySelector(".slide__instruction")) {
    return;
  }
  const instruction = document.createElement("p");
  instruction.className = "slide__instruction";
  instruction.textContent = "";
  slide.appendChild(instruction);
};

const buildHeading = (slide, headingText) => {
  const heading = document.createElement("h2");
  heading.textContent = headingText;
  slide.appendChild(heading);
};

const maybeInsertFocus = (slide, focusText, includeFocus) => {
  if (!includeFocus) {
    return;
  }
  const trimmed = trimString(focusText);
  if (!trimmed) {
    return;
  }
  const focusEl = document.createElement("p");
  focusEl.className = "activity-focus";
  focusEl.textContent = trimmed;
  const heading = slide.querySelector("h2");
  if (heading) {
    heading.insertAdjacentElement("afterend", focusEl);
  } else {
    slide.prepend(focusEl);
  }
};

const clearEntryHighlights = (items = []) => {
  items.forEach(({ card, line }) => {
    card?.classList.remove("is-active");
    line?.classList.remove("is-playing");
  });
};

const normalizeLineItems = (raw = []) => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry, index) => {
      const id = trimString(entry?.id) || `line_${index + 1}`;
      const text = trimString(entry?.text);
      const audio = trimString(entry?.audio);
      if (!text || !audio) {
        return null;
      }
      return { id, text, audio };
    })
    .filter(Boolean);
};

const createSubActivityContext = (base, letter, includeFocus = false) => ({
  activityLabel: base.activityLabel,
  activityNumber: base.activityNumber,
  activityFocus: base.activityFocus,
  includeFocus,
  subActivitySuffix: letter ? letter : "",
  subActivityLetter: letter || "",
});

const getRepeatPauseMs = (activityData, fallback = 1500) => {
  const raw =
    activityData?.listen_repeat_pause_ms ?? activityData?.repeat_pause_ms;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(500, parsed);
};

const shuffleArray = (input = []) => {
  const list = Array.isArray(input) ? [...input] : [];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
  return list;
};

const normalizeMatchingActivity = (raw = {}) => {
  const audio = trimString(raw?.audio);
  const gridInfo = typeof raw?.grid === "object" ? raw.grid : {};
  const parseDimension = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(1, Math.floor(parsed));
  };

  const configuredRows = parseDimension(gridInfo?.rows);
  const configuredColumns = parseDimension(gridInfo?.columns);

  const items = Array.isArray(raw?.content)
    ? raw.content
        .map((entry, index) => {
          const id = trimString(entry?.id) || `match_${index + 1}`;
          const image = trimString(entry?.image);
          const rowValue =
            entry?.grid && Number.isFinite(Number(entry.grid.row))
              ? Math.floor(Number(entry.grid.row))
              : null;
          const columnValue =
            entry?.grid && Number.isFinite(Number(entry.grid.column))
              ? Math.floor(Number(entry.grid.column))
              : null;

          if (!image || rowValue === null || columnValue === null) {
            return null;
          }

          return {
            id,
            image,
            row: Math.max(0, rowValue),
            column: Math.max(0, columnValue),
          };
        })
        .filter(Boolean)
    : [];

  const derivedRows = items.reduce(
    (max, item) => Math.max(max, item.row + 1),
    0
  );
  const derivedColumns = items.reduce(
    (max, item) => Math.max(max, item.column + 1),
    0
  );

  const selectDimension = (configured, derived) => {
    if (Number.isInteger(configured) && configured > 0) {
      return configured;
    }
    if (Number.isInteger(derived) && derived > 0) {
      return derived;
    }
    return 1;
  };

  const rows = selectDimension(configuredRows, derivedRows);
  const columns = selectDimension(configuredColumns, derivedColumns);

  return {
    audio,
    rows,
    columns,
    items,
  };
};

const buildMatchingGridSlide = (data = {}, context = {}) => {
  const {
    activityLabel = "Activity",
    subActivitySuffix = "",
    activityFocus = "",
    includeFocus = false,
    activityNumber = null,
    subActivityLetter = "",
  } = context;

  const slide = document.createElement("section");
  slide.className =
    "slide slide--listening listening-slide listening-slide--matching";
  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);
  maybeInsertFocus(slide, activityFocus, includeFocus);

  const controls = document.createElement("div");
  controls.className = "slide__controls";

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "primary-btn";
  playBtn.textContent = "Play Audio";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "secondary-btn";
  resetBtn.textContent = "Reset";

  const status = createStatus();
  controls.append(playBtn, resetBtn, status);
  slide.appendChild(controls);

  const normalized = normalizeMatchingActivity(data);
  const hasGrid =
    Number.isInteger(normalized.rows) &&
    normalized.rows > 0 &&
    Number.isInteger(normalized.columns) &&
    normalized.columns > 0 &&
    normalized.items.length > 0;

  const dropzones = [];
  const placements = new Map();
  const dropzoneMap = new Map();
  let gallery = null;
  let feedbackEl = null;
  let interactionsReady = false;
  let evaluationShown = false;

  const clearFeedback = () => {
    if (!feedbackEl) {
      return;
    }
    feedbackEl.textContent = "";
    feedbackEl.classList.remove(
      "listening-feedback--positive",
      "listening-feedback--negative"
    );
    feedbackEl.classList.add("listening-feedback--neutral");
  };

  const updateFeedback = (text, variant) => {
    if (!feedbackEl) {
      return;
    }
    feedbackEl.textContent = text;
    feedbackEl.classList.remove(
      "listening-feedback--positive",
      "listening-feedback--negative",
      "listening-feedback--neutral"
    );
    feedbackEl.classList.add(
      variant ? `listening-feedback--${variant}` : "listening-feedback--neutral"
    );
  };

  let cards = [];
  let requiredZones = [];

  if (hasGrid) {
    const layout = document.createElement("div");
    layout.className = "pre-listening-layout listening-matching-layout";

    const grid = document.createElement("div");
    grid.className = "listening-matching-grid";
    grid.style.setProperty("--matching-grid-rows", normalized.rows);
    grid.style.setProperty("--matching-grid-columns", normalized.columns);
    layout.appendChild(grid);

    gallery = document.createElement("div");
    gallery.className = "pre-listening-gallery listening-matching-gallery";
    layout.appendChild(gallery);

    const targets = new Map(
      normalized.items.map((item) => [
        `${item.row}-${item.column}`,
        item.id,
      ])
    );

    for (let row = 0; row < normalized.rows; row += 1) {
      for (let column = 0; column < normalized.columns; column += 1) {
        const zone = document.createElement("div");
        zone.className = "pre-listening-dropzone listening-matching-dropzone";
        const key = `${row}-${column}`;
        const label = document.createElement("p");

        const body = document.createElement("div");
        body.className = "pre-listening-dropzone__body";

        zone.dataset.zoneKey = key;
        const expectedId = targets.get(key);
        if (expectedId) {
          zone.dataset.expectedId = expectedId;
        }

        zone.append(body);
        dropzones.push(zone);
        dropzoneMap.set(key, zone);
        grid.appendChild(zone);
      }
    }

    requiredZones = dropzones.filter((zone) => zone.dataset.expectedId);
    const createCard = (item, index) => {
      const card = document.createElement("div");
      card.className = "pre-listening-card listening-matching-card";
      card.dataset.itemId = item.id;
      card.dataset.targetKey = `${item.row}-${item.column}`;
      card.dataset.assignedZone = "";

      const media = document.createElement("div");
      media.className = "pre-listening-card__media";
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = `Object ${index + 1}`;
      img.loading = "lazy";
      media.appendChild(img);

      card.appendChild(media);
      return card;
    };

    cards = normalized.items.map((item, index) => createCard(item, index));
    shuffleArray(cards).forEach((card) => gallery.appendChild(card));

    feedbackEl = document.createElement("p");
    feedbackEl.className =
      "listening-feedback listening-feedback--neutral listening-matching-feedback";
    layout.appendChild(feedbackEl);

    slide.appendChild(layout);
  } else {
    resetBtn.disabled = true;
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Matching content will be added soon.";
    slide.appendChild(emptyState);
  }

  const detachFromZone = (card) => {
    const assigned = card?.dataset?.assignedZone;
    if (!assigned) {
      return;
    }
    const zone = dropzoneMap.get(assigned);
    if (zone) {
      placements.delete(assigned);
      zone.classList.remove(
        "is-filled",
        "is-hover",
        "is-correct",
        "is-incorrect"
      );
      const body = zone.querySelector(".pre-listening-dropzone__body");
      if (body?.contains(card)) {
        body.removeChild(card);
      }
    }
    card.dataset.assignedZone = "";
  };

  const resetCardPosition = (card) => {
    if (!card) {
      return;
    }
    card.style.top = "";
    card.style.left = "";
    card.style.position = "relative";
    const $ = window.jQuery;
    if ($ && $(card).data("uiDraggable")) {
      $(card).draggable("option", "revert", "invalid");
    }
  };

  const clearEvaluationState = () => {
    if (!hasGrid) {
      return;
    }
    evaluationShown = false;
    clearFeedback();
    dropzones.forEach((zone) => {
      zone.classList.remove("is-correct", "is-incorrect");
    });
    cards.forEach((card) => {
      card.classList.remove("is-correct", "is-incorrect");
    });
  };

  const resetMatching = () => {
    if (!hasGrid) {
      return;
    }
    placements.clear();
    clearEvaluationState();
    dropzones.forEach((zone) => {
      zone.classList.remove("is-filled", "is-hover");
      const body = zone.querySelector(".pre-listening-dropzone__body");
      body.innerHTML = "";
    });
    cards.forEach((card) => {
      card.dataset.assignedZone = "";
      card.classList.remove("is-active");
      resetCardPosition(card);
    });
    if (gallery) {
      shuffleArray(cards).forEach((card) => gallery.appendChild(card));
    }
  };

  const evaluatePlacements = () => {
    if (!hasGrid || !requiredZones.length) {
      return;
    }
    let correctCount = 0;
    requiredZones.forEach((zone) => {
      const zoneKey = zone.dataset.zoneKey;
      const expectedId = zone.dataset.expectedId;
      const card = placements.get(zoneKey);
      zone.classList.remove("is-correct", "is-incorrect");
      card?.classList.remove("is-correct", "is-incorrect");

      if (card && card.dataset.itemId === expectedId) {
        zone.classList.add("is-correct");
        card?.classList.add("is-correct");
        correctCount += 1;
      } else {
        zone.classList.add("is-incorrect");
        card?.classList.add("is-incorrect");
      }
    });

    evaluationShown = true;
    const total = requiredZones.length;
    if (correctCount === total) {
      updateFeedback("Great job! All images are correctly placed.", "positive");
      showCompletionModal({
        title: "Excellent!",
        message: "You matched every square correctly.",
      });
    } else {
      updateFeedback(
        `You placed ${correctCount} of ${total} correctly. Adjust the red squares to try again.`,
        "negative"
      );
    }
  };

  const checkForCompletion = () => {
    if (!hasGrid || !requiredZones.length) {
      return;
    }
    const isComplete = requiredZones.every((zone) =>
      placements.has(zone.dataset.zoneKey)
    );
    if (isComplete) {
      evaluatePlacements();
    }
  };

  const setupInteractions = () => {
    if (interactionsReady || !hasGrid) {
      return;
    }
    const $ = window.jQuery;
    if (!$ || !$.fn?.draggable || !$.fn?.droppable) {
      console.warn("jQuery UI is required for the matching activity.");
      return;
    }

    const $cards = $(cards);
    const $dropzones = $(dropzones);
    const $gallery = $(gallery);

    $cards.draggable({
      revert: "invalid",
      containment: slide,
      zIndex: 100,
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

    $dropzones.droppable({
      accept: ".listening-matching-card",
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
        const zoneKey = zoneEl.dataset.zoneKey;
        $(this).removeClass("is-hover");
        if (!cardEl || !zoneKey) {
          return;
        }

        detachFromZone(cardEl);
        const existing = placements.get(zoneKey);
        if (existing && existing !== cardEl) {
          detachFromZone(existing);
          resetCardPosition(existing);
          gallery.appendChild(existing);
        }

        const body = zoneEl.querySelector(".pre-listening-dropzone__body");
        body.appendChild(cardEl);
        resetCardPosition(cardEl);
        cardEl.dataset.assignedZone = zoneKey;
        placements.set(zoneKey, cardEl);
        zoneEl.classList.add("is-filled");
        zoneEl.classList.remove("is-correct", "is-incorrect");
        cardEl.classList.remove("is-correct", "is-incorrect");

        checkForCompletion();
      },
    });

    $gallery.droppable({
      accept: ".listening-matching-card",
      tolerance: "intersect",
      drop(_, ui) {
        const cardEl = ui.draggable.get(0);
        if (!cardEl) {
          return;
        }
        detachFromZone(cardEl);
        resetCardPosition(cardEl);
        gallery.appendChild(cardEl);
      },
    });

    interactionsReady = true;
  };

  let playbackController = null;
  let autoTriggered = false;
  const maxLoops = 3;

  const updatePlayLabel = () => {
    playBtn.textContent = playbackController ? "Stop Audio" : "Play Audio";
  };

  const runPlaybackLoop = async () => {
    const audioUrl = normalized.audio;
    if (!audioUrl) {
      status.textContent = "Audio will be added soon.";
      return;
    }

    if (playbackController) {
      playbackController.abort();
      return;
    }

    playbackController = new AbortController();
    updatePlayLabel();
    audioManager.stopAll();

    const { signal } = playbackController;
    let completedLoops = 0;

    try {
      while (completedLoops < maxLoops && !signal.aborted) {
        status.textContent = `Listening... (${completedLoops + 1}/${maxLoops})`;
        try {
          await audioManager.play(audioUrl, { signal });
        } catch (error) {
          if (!signal.aborted) {
            console.error(error);
            status.textContent = "Unable to play audio.";
          }
          break;
        }

        if (signal.aborted) {
          break;
        }

        completedLoops += 1;
        if (completedLoops < maxLoops) {
          status.textContent = "Get ready for the next playback...";
          await waitMs(1000, { signal });
        }
      }

      if (!signal.aborted) {
        status.textContent =
          completedLoops >= maxLoops
            ? "Playback complete."
            : "Playback stopped.";
      }
    } finally {
      playbackController = null;
      updatePlayLabel();
    }
  };

  playBtn.addEventListener("click", () => {
    autoTriggered = true;
    slide._autoTriggered = true;
    runPlaybackLoop();
  });

  resetBtn.addEventListener("click", () => {
    resetMatching();
  });

  const triggerAutoPlay = () => {
    if (autoTriggered || !normalized.audio) {
      return;
    }
    autoTriggered = true;
    slide._autoTriggered = true;
    runPlaybackLoop();
  };

  const onLeave = () => {
    playbackController?.abort();
    playbackController = null;
    updatePlayLabel();
    autoTriggered = false;
    slide._autoTriggered = false;
    status.textContent = "";
    audioManager.stopAll();
    resetMatching();
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-listening3-matching`
      : "listening3-matching",
    element: slide,
    autoPlay: {
      button: playBtn,
      trigger: triggerAutoPlay,
      status,
    },
    onEnter: () => {
      setupInteractions();
    },
    onLeave,
  };
};

const createSequencedTextSlide = (
  items = [],
  context = {},
  {
    mode = "listen",
    repeatPauseMs = 1500,
    autoDelayMs = 5000,
    layout = "grid",
    showLineNumbers = true,
    presentation = "cards",
    illustrationUrl = "",
  } = {}
) => {
  const {
    activityLabel = "Activity",
    activityNumber = null,
    subActivitySuffix = "",
    activityFocus = "",
    includeFocus = false,
    subActivityLetter = "",
  } = context;

  const isRepeatMode = mode === "listen-repeat";
  const isReadMode = mode === "read";
  const slide = document.createElement("section");
  slide.className = isRepeatMode
    ? "slide slide--listen-repeat listening-slide listening-slide--repeat"
    : "slide slide--listening listening-slide listening-slide--read";

  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);
  maybeInsertFocus(slide, activityFocus, includeFocus);

  const trimmedIllustration = trimString(illustrationUrl);
  if (trimmedIllustration) {
    const illustration = document.createElement("div");
    illustration.className = "listening-illustration";
    const img = document.createElement("img");
    img.src = trimmedIllustration;
    img.alt = "Activity reference illustration";
    img.loading = "lazy";
    illustration.appendChild(img);
    slide.appendChild(illustration);
  }

  const instructionEl = slide.querySelector(".slide__instruction");
  if (instructionEl) {
    instructionEl.textContent = isRepeatMode
      ? "Listen and repeat each sentence."
      : isReadMode
      ? "Read along with the audio."
      : "Listen to each sentence.";
  }

  const controls = document.createElement("div");
  controls.className = "slide__controls";
  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "primary-btn";
  startBtn.textContent = "Start";
  const status = createStatus();
  controls.append(startBtn, status);
  slide.appendChild(controls);

  const list = document.createElement("div");
  const isParagraphLayout = presentation === "paragraph";
  if (isParagraphLayout) {
    list.className = "listening-paragraph";
  } else {
    list.className = "dialogue-grid listening-read-grid";
    if (layout === "single-column") {
      list.classList.add("dialogue-grid--single-column");
    }
  }
  slide.appendChild(list);

  const entries = items.map((entry, index) => {
    if (isParagraphLayout) {
      const paragraph = document.createElement("p");
      paragraph.className = "listening-paragraph__line";
      paragraph.textContent = entry.text;
      list.appendChild(paragraph);
      return {
        entry,
        card: null,
        line: paragraph,
      };
    }

    const card = document.createElement("article");
    card.className = "dialogue-card dialogue-card--reading listening-read-card";

    if (showLineNumbers) {
      const title = document.createElement("h3");
      title.className = "dialogue-card__title";
      title.textContent = `Line ${index + 1}`;
      card.appendChild(title);
    }

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
  };

  const resetEntries = () => {
    clearEntryHighlights(entries);
  };

  const clearAutoStart = () => {
    if (pendingAutoStart !== null) {
      window.clearTimeout(pendingAutoStart);
      pendingAutoStart = null;
    }
  };

  const runSequence = async (fromIndex = 0) => {
    if (!entries.length) {
      status.textContent = "Content will be added soon.";
      return;
    }

    sequenceAbort?.abort();
    sequenceAbort = new AbortController();
    const { signal } = sequenceAbort;
    let completed = false;

    pauseRequested = false;
    setPlaybackMode("playing", { resumeIndex: fromIndex });
    status.textContent = fromIndex === 0 ? "Starting..." : "Resuming...";

    try {
      for (let index = fromIndex; index < entries.length; index += 1) {
        playbackState.resumeIndex = index;
        const item = entries[index];
        item.card?.classList.add("is-active");
        item.line.classList.add("is-playing");
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
          const timingMode = isReadMode
            ? "read"
            : isRepeatMode
            ? "listen-repeat"
            : "listen";
          const timingOptions = isRepeatMode ? { repeatPauseMs } : undefined;
          gapMs = computeSegmentGapMs(
            timingMode,
            duration,
            timingOptions
          );
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
        item.line.classList.remove("is-playing");

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
    pendingAutoStart = window.setTimeout(
      () => {
        pendingAutoStart = null;
        runSequence();
      },
      Math.max(0, autoDelayMs)
    );
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

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-${
          isRepeatMode ? "listen-repeat" : "listening"
        }`
      : `listening3-${isRepeatMode ? "listen-repeat" : "listening"}`,
    element: slide,
    autoPlay: {
      button: startBtn,
      trigger: triggerAutoPlay,
      status,
    },
    onLeave,
  };
};

export const buildListeningThreeSlides = (activityData = {}, context = {}) => {
  const { activityNumber, focus: rawFocus } = context;
  const activityLabel = activityNumber
    ? `Activity ${activityNumber}`
    : "Activity";
  const activityFocus = trimString(rawFocus);

  const baseContext = {
    activityLabel,
    activityNumber,
    activityFocus,
  };

  const matchingSlide = buildMatchingGridSlide(
    activityData?.content?.activity_a,
    createSubActivityContext(baseContext, "a", Boolean(activityFocus))
  );

  const listenItems = normalizeLineItems(
    activityData?.content?.activity_b?.content
  );
  const repeatItems = normalizeLineItems(
    activityData?.content?.activity_c?.content
  );
  const readItems = normalizeLineItems(
    activityData?.content?.activity_d?.content
  );

  const listenImage = trimString(activityData?.content?.activity_b?.image);
  const repeatImage = trimString(activityData?.content?.activity_c?.image);
  const readImage = trimString(activityData?.content?.activity_d?.image);

  const repeatPauseMs = getRepeatPauseMs(activityData);

  const slides = [
    matchingSlide,
    createSequencedTextSlide(
      listenItems,
      createSubActivityContext(baseContext, "b"),
      {
        mode: "listen",
        autoDelayMs: 5000,
        repeatPauseMs,
        layout: "single-column",
        showLineNumbers: false,
        presentation: "paragraph",
        illustrationUrl: listenImage,
      }
    ),
    createSequencedTextSlide(
      repeatItems,
      createSubActivityContext(baseContext, "c"),
      {
        mode: "listen-repeat",
        autoDelayMs: 5000,
        repeatPauseMs,
        illustrationUrl: repeatImage,
      }
    ),
    createSequencedTextSlide(
      readItems,
      createSubActivityContext(baseContext, "d"),
      {
        mode: "read",
        autoDelayMs: 5000,
        repeatPauseMs,
        illustrationUrl: readImage,
      }
    ),
  ];

  return slides;
};
