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

const normalizeValue = (value) => {
  const trimmed = trimString(value);
  return trimmed ? trimmed.toLowerCase() : "";
};

const shuffleArray = (items = []) => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
};

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

const createSubActivityContext = (base, letter, includeFocus = false) => ({
  activityLabel: base.activityLabel,
  activityNumber: base.activityNumber,
  activityFocus: base.activityFocus,
  includeFocus,
  subActivitySuffix: letter ? `${letter}` : "",
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

const normalizeMatchingPairs = (raw = []) => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const idCounts = new Map();
  return raw
    .map((entry, index) => {
      const baseId = trimString(entry?.id) || `match_${index + 1}`;
      const count = idCounts.get(baseId) ?? 0;
      idCounts.set(baseId, count + 1);
      const id = count > 0 ? `${baseId}_${count + 1}` : baseId;
      const itemA = trimString(entry?.item_a) || trimString(entry?.itemA);
      const itemB = trimString(entry?.item_b) || trimString(entry?.itemB);
      if (!itemA || !itemB) {
        return null;
      }
      return {
        id,
        itemA,
        itemB,
      };
    })
    .filter(Boolean);
};

const normalizeOptionSets = (raw = []) => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const idCounts = new Map();
  return raw
    .map((entry, index) => {
      const baseId = trimString(entry?.id) || `set_${index + 1}`;
      const count = idCounts.get(baseId) ?? 0;
      idCounts.set(baseId, count + 1);
      const id = count > 0 ? `${baseId}_${count + 1}` : baseId;
      const answer = trimString(entry?.answer);
      const options = Array.isArray(entry?.options)
        ? entry.options.map((option) => trimString(option)).filter(Boolean)
        : [];
      if (!options.length || !answer) {
        return null;
      }
      const answerNormalized = normalizeValue(answer);
      if (!answerNormalized) {
        return null;
      }
      return {
        id,
        answer,
        answerNormalized,
        options,
      };
    })
    .filter(Boolean);
};

const buildAudioMatchingSlide = (data = {}, context = {}) => {
  const {
    activityLabel = "Activity",
    activityNumber = null,
    subActivitySuffix = "",
    activityFocus = "",
    includeFocus = false,
    subActivityLetter = "",
  } = context;

  const slide = document.createElement("section");
  slide.className =
    "slide slide--listening listening-slide listening-slide--matching";

  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);
  maybeInsertFocus(slide, activityFocus, includeFocus);

  const items = normalizeMatchingPairs(data?.content);

  if (!items.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Matching content will be added soon.";
    slide.appendChild(emptyState);
    return {
      id: activityNumber
        ? `activity-${activityNumber}${
            subActivityLetter ? `-${subActivityLetter}` : ""
          }-listening5-matching`
        : "listening5-matching",
      element: slide,
      onLeave: () => {},
    };
  }

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

  const createSentenceCard = (entry, index) => {
    const card = document.createElement("article");
    card.className = "word-match-sentence";

    const title = document.createElement("h3");
    title.textContent = `Pair ${index + 1}`;
    card.appendChild(title);

    const body = document.createElement("p");
    body.textContent = entry.itemB;
    card.appendChild(body);

    const zone = document.createElement("div");
    zone.className = "word-match-dropzone";
    zone.dataset.expectedId = entry.id;
    zone.dataset.zoneId = entry.id;

    const placeholder = document.createElement("span");
    placeholder.className = "word-match-placeholder";
    placeholder.textContent = "Drop the matching verb here";
    zone.appendChild(placeholder);

    card.appendChild(zone);
    dropzones.push(zone);
    return card;
  };

  items.forEach((entry, index) => {
    sentencesColumn.appendChild(createSentenceCard(entry, index));
  });

  const createCard = (entry) => {
    const card = document.createElement("div");
    card.className = "word-match-card";
    card.dataset.itemId = entry.id;
    card.dataset.assignedZone = "";
    card.textContent = entry.itemA;
    return card;
  };

  const cards = items.map((entry) => createCard(entry));
  shuffleArray(cards);
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
      if (!zone.contains(placeholder)) {
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
    updateFeedback("Drag each verb to the matching noun.", "neutral");
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
      updateFeedback("Great job! Every pair matches.", "positive");
      showCompletionModal({
        title: "Excellent!",
        message: "You matched each verb with the correct noun.",
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

  const onEnter = () => {
    setupInteractions();
  };

  const audioUrl = trimString(data?.audio);
  let playbackCount = 0;
  let playbackController = null;
  let secondPlaybackTimer = null;
  let secondPlaybackCountdownInterval = null;
  let secondPlaybackRemaining = 0;
  let isPlaying = false;
  let autoTriggered = false;

  const updatePlayButton = () => {
    if (!audioUrl) {
      playBtn.disabled = true;
      playBtn.textContent = "Audio unavailable";
      return;
    }
    if (playbackCount >= 2) {
      playBtn.disabled = true;
      playBtn.textContent = "Playback finished";
      return;
    }
    if (isPlaying) {
      playBtn.disabled = true;
      playBtn.textContent =
        playbackCount > 0 ? "Replaying audio..." : "Playing...";
      return;
    }
    playBtn.disabled = false;
    playBtn.textContent = "Play Audio";
  };

  updatePlayButton();

  const clearPlaybackTimers = () => {
    if (secondPlaybackTimer !== null) {
      window.clearTimeout(secondPlaybackTimer);
      secondPlaybackTimer = null;
    }
    if (secondPlaybackCountdownInterval !== null) {
      window.clearInterval(secondPlaybackCountdownInterval);
      secondPlaybackCountdownInterval = null;
    }
    secondPlaybackRemaining = 0;
  };

  const scheduleSecondPlayback = () => {
    if (playbackCount < 1 || playbackCount >= 2) {
      return;
    }
    clearPlaybackTimers();

    secondPlaybackRemaining = 20;
    const updateStatus = () => {
      status.textContent = `Second playback starts in ${secondPlaybackRemaining}s. Click play to listen sooner.`;
    };

    updateStatus();
    playBtn.disabled = false;

    secondPlaybackTimer = window.setTimeout(() => {
      clearPlaybackTimers();
      beginPlayback();
    }, secondPlaybackRemaining * 1000);

    secondPlaybackCountdownInterval = window.setInterval(() => {
      secondPlaybackRemaining -= 1;
      if (secondPlaybackRemaining <= 0) {
        clearPlaybackTimers();
        return;
      }
      updateStatus();
    }, 1000);
  };

  const stopPlayback = () => {
    if (!playbackController) {
      return;
    }
    playbackController.abort();
    playbackController = null;
  };

  const beginPlayback = async () => {
    if (!audioUrl) {
      status.textContent = "Audio will be added soon.";
      updatePlayButton();
      return;
    }
    if (playbackCount >= 2) {
      status.textContent = "You have already listened twice.";
      updatePlayButton();
      return;
    }

    clearPlaybackTimers();
    playbackController?.abort();
    playbackController = new AbortController();
    const { signal } = playbackController;

    const passIndex = playbackCount + 1;
    isPlaying = true;
    slide._autoTriggered = true;
    status.textContent = passIndex === 1 ? "Playing..." : "Replaying audio...";
    updatePlayButton();

    audioManager.stopAll();

    try {
      await audioManager.play(audioUrl, { signal });
      if (signal.aborted) {
        status.textContent = "Playback stopped.";
        return;
      }
      playbackCount += 1;
      if (playbackCount >= 2) {
        status.textContent = "You have listened twice.";
      } else {
        scheduleSecondPlayback();
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error(error);
        status.textContent = "Unable to play audio.";
      }
    } finally {
      playbackController = null;
      isPlaying = false;
      updatePlayButton();
    }
  };

  playBtn.addEventListener("click", () => {
    if (isPlaying || playbackCount >= 2) {
      return;
    }
    autoTriggered = true;
    beginPlayback();
  });

  const triggerAutoPlay = () => {
    if (autoTriggered || isPlaying || playbackCount >= 2) {
      return;
    }
    autoTriggered = true;
    beginPlayback();
  };

  const onLeave = () => {
    clearPlaybackTimers();
    stopPlayback();
    audioManager.stopAll();
    isPlaying = false;
    autoTriggered = false;
    playbackCount = 0;
    slide._autoTriggered = false;
    status.textContent = "";
    updatePlayButton();
    resetMatching();
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  resetMatching();

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-listening5-matching`
      : "listening5-matching",
    element: slide,
    autoPlay: {
      button: playBtn,
      trigger: triggerAutoPlay,
      status,
    },
    onEnter,
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
          gapMs = computeSegmentGapMs(timingMode, duration, timingOptions);
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
          isRepeatMode ? "listen-repeat" : isReadMode ? "reading" : "listening"
        }`
      : `listening5-${
          isRepeatMode ? "listen-repeat" : isReadMode ? "read" : "listen"
        }`,
    element: slide,
    autoPlay: {
      button: startBtn,
      trigger: triggerAutoPlay,
      status,
    },
    onLeave,
  };
};

const buildAudioOptionSlide = (data = {}, context = {}) => {
  const {
    activityLabel = "Activity",
    activityNumber = null,
    subActivitySuffix = "",
    activityFocus = "",
    includeFocus = false,
    subActivityLetter = "",
  } = context;

  const slide = document.createElement("section");
  slide.className =
    "slide slide--listening listening-slide listening-slide--mcq";
  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);
  maybeInsertFocus(slide, activityFocus, includeFocus);
  const instructionEl = slide.querySelector(".slide__instruction");
  if (instructionEl) {
    instructionEl.textContent =
      "Listen to the audio twice, choose your answers, then check them.";
  }

  const controls = document.createElement("div");
  controls.className = "slide__controls";
  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "primary-btn";
  playBtn.textContent = "Start";
  const status = createStatus();
  controls.append(playBtn, status);
  slide.appendChild(controls);

  const list = document.createElement("div");
  list.className = "listening-mcq-grid";
  slide.appendChild(list);

  const optionSets = normalizeOptionSets(data?.content);

  const entries = optionSets.map((optionSet, index) => {
    const card = document.createElement("article");
    card.className = "dialogue-card dialogue-card--listening";

    const title = document.createElement("h3");
    title.className = "dialogue-card__title";
    title.textContent = `Selection ${index + 1}`;
    card.appendChild(title);

    const optionGroup = document.createElement("div");
    optionGroup.className = "listening-option-group";

    const buttons = optionSet.options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "listening-option";
      button.textContent = option;
      button.dataset.optionValue = option;
      button.dataset.optionNormalized = normalizeValue(option);
      optionGroup.appendChild(button);
      return button;
    });

    card.appendChild(optionGroup);

    const feedback = document.createElement("p");
    feedback.className = "listening-feedback";
    feedback.textContent = "";
    card.appendChild(feedback);

    list.appendChild(card);

    return {
      optionSet,
      card,
      buttons,
      feedback,
      selectedNormalized: "",
    };
  });

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Options will be added soon.";
    list.appendChild(empty);
  }

  const actions = document.createElement("div");
  actions.className = "listening-mcq-actions";
  const checkBtn = document.createElement("button");
  checkBtn.type = "button";
  checkBtn.className = "primary-btn listening-check-btn";
  checkBtn.textContent = "Submit";
  checkBtn.disabled = true;
  const checkHint = document.createElement("span");
  checkHint.className = "listening-check-hint";
  checkHint.textContent =
    "Please listen to the recording twice to submit the answers.";
  const scoreEl = document.createElement("p");
  scoreEl.className = "listening-score";
  scoreEl.textContent = "";
  actions.append(checkBtn, checkHint, scoreEl);
  slide.appendChild(actions);

  const MAX_PLAYBACKS = 2;
  let playbackCount = 0;
  let playbackController = null;
  let secondPlaybackTimer = null;
  let secondPlaybackCountdownInterval = null;
  let secondPlaybackRemaining = 0;
  let autoTriggered = false;
  let isPlaying = false;
  let answersChecked = false;

  const updateButtonState = () => {
    if (!data?.audio) {
      playBtn.disabled = true;
      playBtn.textContent = "Audio unavailable";
    } else if (isPlaying) {
      playBtn.disabled = true;
      playBtn.textContent =
        playbackCount > 0 ? "Replaying audio..." : "Playing...";
    } else if (playbackCount >= MAX_PLAYBACKS) {
      playBtn.disabled = true;
      playBtn.textContent = "Playback finished";
    } else {
      playBtn.disabled = false;
      playBtn.textContent = "Start";
    }

    checkBtn.disabled =
      answersChecked ||
      isPlaying ||
      playbackCount < MAX_PLAYBACKS ||
      !entries.length;
  };

  updateButtonState();

  const clearPlaybackTimers = () => {
    if (secondPlaybackTimer !== null) {
      window.clearTimeout(secondPlaybackTimer);
      secondPlaybackTimer = null;
    }
    if (secondPlaybackCountdownInterval !== null) {
      window.clearInterval(secondPlaybackCountdownInterval);
      secondPlaybackCountdownInterval = null;
    }
    secondPlaybackRemaining = 0;
  };

  const scheduleSecondPlayback = () => {
    if (playbackCount < 1 || playbackCount >= MAX_PLAYBACKS) {
      return;
    }
    clearPlaybackTimers();

    secondPlaybackRemaining = 20;
    const updateStatus = () => {
      status.textContent = `Second playback starts in ${secondPlaybackRemaining}s. Click play to listen sooner.`;
    };

    updateStatus();
    playBtn.disabled = false;

    secondPlaybackTimer = window.setTimeout(() => {
      clearPlaybackTimers();
      beginPlayback();
    }, secondPlaybackRemaining * 1000);

    secondPlaybackCountdownInterval = window.setInterval(() => {
      secondPlaybackRemaining -= 1;
      if (secondPlaybackRemaining <= 0) {
        clearPlaybackTimers();
        return;
      }
      updateStatus();
    }, 1000);
  };

  const beginPlayback = async () => {
    const audioUrl = trimString(data?.audio);
    if (!audioUrl) {
      status.textContent = "Audio not available.";
      updateButtonState();
      return;
    }

    if (playbackCount >= MAX_PLAYBACKS) {
      status.textContent = "You have already listened twice.";
      updateButtonState();
      return;
    }

    clearPlaybackTimers();
    playbackController?.abort();
    playbackController = new AbortController();
    const { signal } = playbackController;

    const passIndex = playbackCount + 1;
    isPlaying = true;
    status.textContent = passIndex === 1 ? "Playing..." : "Replaying audio...";
    updateButtonState();

    audioManager.stopAll();

    try {
      await audioManager.play(audioUrl, { signal });
      if (signal.aborted) {
        status.textContent = "Playback stopped.";
        return;
      }
      playbackCount += 1;
      if (playbackCount >= MAX_PLAYBACKS) {
        status.textContent = "You have listened twice. Check your answers.";
      } else {
        scheduleSecondPlayback();
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error(error);
        status.textContent = "Unable to play audio.";
      }
    } finally {
      playbackController = null;
      isPlaying = false;
      updateButtonState();
    }
  };

  const checkAnswers = () => {
    if (answersChecked || playbackCount < MAX_PLAYBACKS || isPlaying) {
      return;
    }
    answersChecked = true;
    let correctCount = 0;

    entries.forEach((entry) => {
      const selectedNormalized = entry.selectedNormalized;
      const isCorrect =
        selectedNormalized &&
        selectedNormalized === entry.optionSet.answerNormalized;
      if (isCorrect) {
        correctCount += 1;
      }

      entry.buttons.forEach((button) => {
        button.disabled = true;
      });

      const selectedButton = entry.buttons.find(
        (button) => button.dataset.optionNormalized === selectedNormalized
      );
      const correctButton = entry.buttons.find(
        (button) =>
          button.dataset.optionNormalized === entry.optionSet.answerNormalized
      );

      if (selectedButton) {
        selectedButton.classList.add("is-selected");
        selectedButton.classList.add(isCorrect ? "is-correct" : "is-incorrect");
      }

      correctButton?.classList.add("is-correct");
      entry.card.classList.add(isCorrect ? "is-correct" : "is-incorrect");

      entry.feedback.classList.remove(
        "listening-feedback--positive",
        "listening-feedback--negative",
        "listening-feedback--neutral"
      );

      if (!selectedNormalized) {
        entry.feedback.textContent = `No answer selected. Correct answer: ${entry.optionSet.answer}`;
        entry.feedback.classList.add("listening-feedback--neutral");
      } else if (isCorrect) {
        entry.feedback.textContent = "Correct!";
        entry.feedback.classList.add("listening-feedback--positive");
      } else {
        entry.feedback.textContent = `Incorrect. Correct answer: ${entry.optionSet.answer}`;
        entry.feedback.classList.add("listening-feedback--negative");
      }
    });

    if (entries.length) {
      scoreEl.textContent = `Score: ${correctCount} / ${entries.length}`;
      status.textContent = `You answered ${correctCount} of ${entries.length} correctly.`;
      showCompletionModal({
        title: "Results",
        message: `You answered ${correctCount} out of ${entries.length} correctly.`,
      });
    }

    updateButtonState();
  };

  entries.forEach((entry) => {
    entry.buttons.forEach((button) => {
      button.addEventListener("click", () => {
        if (answersChecked) {
          return;
        }
        const normalized = button.dataset.optionNormalized || "";
        entry.selectedNormalized = normalized;
        entry.buttons.forEach((btn) =>
          btn.classList.remove("is-selected", "is-correct", "is-incorrect")
        );
        button.classList.add("is-selected");
        entry.card.classList.remove("is-correct", "is-incorrect");
        entry.feedback.textContent = "";
        entry.feedback.className = "listening-feedback";
      });
    });
  });

  playBtn.addEventListener("click", () => {
    beginPlayback();
  });

  checkBtn.addEventListener("click", () => {
    checkAnswers();
  });

  const triggerAutoPlay = () => {
    if (autoTriggered || playbackCount >= MAX_PLAYBACKS) {
      return;
    }
    autoTriggered = true;
    slide._autoTriggered = true;
    beginPlayback();
  };

  const onLeave = () => {
    clearPlaybackTimers();
    playbackController?.abort();
    playbackController = null;
    audioManager.stopAll();
    playbackCount = 0;
    autoTriggered = false;
    slide._autoTriggered = false;
    status.textContent = "";
    isPlaying = false;
    answersChecked = false;
    scoreEl.textContent = "";
    entries.forEach((entry) => {
      entry.selectedNormalized = "";
      entry.feedback.textContent = "";
      entry.feedback.className = "listening-feedback";
      entry.buttons.forEach((button) => {
        button.disabled = false;
        button.classList.remove("is-selected", "is-correct", "is-incorrect");
      });
      entry.card.classList.remove("is-correct", "is-incorrect");
    });
    updateButtonState();
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-listening5-options`
      : "listening5-options",
    element: slide,
    autoPlay: {
      button: playBtn,
      trigger: triggerAutoPlay,
      status,
    },
    onLeave,
  };
};

export const buildListeningFiveSlides = (activityData = {}, context = {}) => {
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

  const matchingSlide = buildAudioMatchingSlide(
    activityData?.content?.activity_a,
    createSubActivityContext(baseContext, "a", Boolean(activityFocus))
  );

  const optionSlide = buildAudioOptionSlide(
    activityData?.content?.activity_b,
    createSubActivityContext(baseContext, "b")
  );

  const listenItems = normalizeLineItems(activityData?.content?.activity_c);
  const repeatItems = normalizeLineItems(activityData?.content?.activity_d);
  const readItems = normalizeLineItems(activityData?.content?.activity_e);

  const repeatPauseMs = getRepeatPauseMs(activityData);

  const slides = [
    matchingSlide,
    optionSlide,
    createSequencedTextSlide(
      listenItems,
      createSubActivityContext(baseContext, "c"),
      {
        mode: "listen",
        autoDelayMs: 5000,
        repeatPauseMs,
        layout: "single-column",
        showLineNumbers: false,
        presentation: "paragraph",
      }
    ),
    createSequencedTextSlide(
      repeatItems,
      createSubActivityContext(baseContext, "d"),
      {
        mode: "listen-repeat",
        autoDelayMs: 5000,
        repeatPauseMs,
      }
    ),
    createSequencedTextSlide(
      readItems,
      createSubActivityContext(baseContext, "e"),
      {
        mode: "read",
        autoDelayMs: 5000,
        repeatPauseMs,
      }
    ),
  ];

  return slides;
};
