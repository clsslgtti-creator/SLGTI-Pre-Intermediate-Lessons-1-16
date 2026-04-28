import {
  audioManager,
  computeSegmentGapMs,
  getBetweenItemGapMs,
} from "./audio-manager.js";
import { showCompletionModal } from "./completion-modal.js";

const MATCH_TIME_LIMIT_MS = 30000;

const trimString = (value) =>
  typeof value === "string" ? value.trim() : "";

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

const normalizeMatchingItems = (raw = []) => {
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
      const text = trimString(entry?.text);
      const audio = trimString(entry?.audio);
      const image = trimString(entry?.image);
      if (!text || !image) {
        return null;
      }
      return {
        id,
        text,
        audio,
        image,
      };
    })
    .filter(Boolean);
};

const normalizeExamples = (raw = []) => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry, index) => {
      const id = trimString(entry?.id) || `example_${index + 1}`;
      const text = trimString(entry?.text);
      const image = trimString(entry?.image);
      if (!text || !image) {
        return null;
      }
      return { id, text, image };
    })
    .filter(Boolean);
};

const parseTimerMs = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(5000, parsed);
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

const createSubActivityContext = (base, letter, includeFocus = false) => ({
  activityLabel: base.activityLabel,
  activityNumber: base.activityNumber,
  activityFocus: base.activityFocus,
  includeFocus,
  subActivitySuffix: letter ? letter : "",
  subActivityLetter: letter || "",
});

const buildTimedImageMatchingSlide = (data = {}, context = {}) => {
  const {
    activityLabel = "Activity",
    activityNumber = null,
    subActivitySuffix = "",
    activityFocus = "",
    includeFocus = false,
    subActivityLetter = "",
  } = context;

  const slide = document.createElement("section");
  slide.className = "slide slide--interactive6 interactive6-slide";
  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);
  maybeInsertFocus(slide, activityFocus, includeFocus);

  const instructionEl = slide.querySelector(".slide__instruction");
  if (instructionEl) {
    instructionEl.textContent =
      "Listen to each sentence, then drag the matching image within 30 seconds.";
  }

  const controls = document.createElement("div");
  controls.className = "slide__controls";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "primary-btn";
  startBtn.textContent = "Start";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "secondary-btn";
  resetBtn.textContent = "Reset";

  const status = createStatus();
  controls.append(startBtn, resetBtn, status);
  slide.appendChild(controls);

  const matchingItems = normalizeMatchingItems(data?.content);
  const exampleItems = normalizeExamples(data?.examples ?? data?.example);
  const timeLimitMs = parseTimerMs(
    data?.time_limit_ms ??
      data?.time_per_sentence_ms ??
      data?.time_per_item_ms,
    MATCH_TIME_LIMIT_MS
  );

  if (!matchingItems.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Matching content will be added soon.";
    slide.appendChild(emptyState);
    return {
      id: activityNumber
        ? `activity-${activityNumber}${
            subActivityLetter ? `-${subActivityLetter}` : ""
          }-pre-listening`
        : "activity-pre-listening",
      element: slide,
      onEnter: () => {},
      onLeave: () => {},
    };
  }

  const layout = document.createElement("div");
  layout.className = "interactive6-matching";

  if (exampleItems.length) {
    const example = exampleItems[0];
    const exampleCard = document.createElement("div");
    exampleCard.className = "interactive6-example";
    const exampleLabel = document.createElement("p");
    exampleLabel.className = "interactive6-example__label";
    exampleLabel.textContent = "Example";
    const exampleBody = document.createElement("div");
    exampleBody.className = "interactive6-example__body";
    const exampleText = document.createElement("p");
    exampleText.className = "interactive6-example__text";
    exampleText.textContent = example.text;
    const exampleImage = document.createElement("img");
    exampleImage.src = example.image;
    exampleImage.alt = "Example match";
    exampleImage.loading = "lazy";
    exampleImage.className = "interactive6-example__image";
    exampleBody.append(exampleText, exampleImage);
    exampleCard.append(exampleLabel, exampleBody);
    layout.appendChild(exampleCard);
  }

  const board = document.createElement("div");
  board.className = "interactive6-layout";

  const sentences = document.createElement("div");
  sentences.className = "interactive6-sentences";

  const bank = document.createElement("div");
  bank.className = "interactive6-bank";

  board.append(bank, sentences);
  layout.appendChild(board);

  const feedbackEl = document.createElement("p");
  feedbackEl.className =
    "listening-feedback listening-feedback--neutral interactive6-feedback";
  layout.appendChild(feedbackEl);

  slide.appendChild(layout);

  const dropzones = [];
  const sentenceCards = [];
  const timerEls = [];
  const placements = new Map();
  const zoneLabels = new Map();

  matchingItems.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "interactive6-sentence-card";
    card.dataset.sentenceIndex = String(index);

    const header = document.createElement("div");
    header.className = "interactive6-sentence-header";

    const title = document.createElement("h3");
    title.textContent = `Sentence ${index + 1}`;

    const timer = document.createElement("span");
    timer.className = "interactive6-timer";
    timer.textContent = "--";

    header.append(title, timer);

    const text = document.createElement("p");
    text.className = "interactive6-sentence-text";
    text.textContent = item.text;

    const zone = document.createElement("div");
    zone.className = "interactive6-dropzone";
    zone.dataset.expectedId = item.id;
    zone.dataset.zoneId = item.id;
    zone.dataset.zoneIndex = String(index);
    zone.dataset.locked = "false";

    const label = document.createElement("span");
    label.className = "interactive6-dropzone-label";
    label.textContent = "Drop the matching image here";

    zone.appendChild(label);
    card.append(header, text, zone);
    sentences.appendChild(card);
    sentenceCards.push(card);
    timerEls.push(timer);
    dropzones.push(zone);
    zoneLabels.set(zone, label);
  });

  const createImageCard = (item, index) => {
    const card = document.createElement("div");
    card.className = "interactive6-card";
    card.dataset.itemId = item.id;
    card.dataset.assignedZone = "";
    card.dataset.locked = "false";

    const media = document.createElement("div");
    media.className = "interactive6-card__media";
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = `Image ${index + 1}`;
    img.loading = "lazy";
    media.appendChild(img);
    card.appendChild(media);
    return card;
  };

  const cards = matchingItems.map((item, index) =>
    createImageCard(item, index)
  );

  shuffleArray(cards).forEach((card) => bank.appendChild(card));

  let interactionsReady = false;
  let interactionEnabled = false;
  let sequenceController = null;
  let countdownInterval = null;
  let activeIndex = -1;
  let autoTriggered = false;
  let sequenceRunning = false;
  let sequenceCompleted = false;
  let activeStepIndex = -1;
  let activeStepResolve = null;

  const updateFeedback = (text, variant = "neutral") => {
    feedbackEl.textContent = text;
    feedbackEl.classList.remove(
      "listening-feedback--positive",
      "listening-feedback--negative",
      "listening-feedback--neutral"
    );
    feedbackEl.classList.add(`listening-feedback--${variant}`);
  };

  const resetFeedback = () => {
    updateFeedback("Press Start to begin.", "neutral");
  };

  const resetTimers = () => {
    timerEls.forEach((timer) => {
      if (timer) {
        timer.textContent = "--";
      }
    });
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

  const detachFromZone = (cardEl) => {
    if (!cardEl) {
      return;
    }
    const assigned = cardEl.dataset.assignedZone;
    if (!assigned) {
      return;
    }
    const zone = dropzones.find((entry) => entry.dataset.zoneId === assigned);
    if (zone) {
      placements.delete(assigned);
      zone.classList.remove("is-filled");
      const label = zoneLabels.get(zone);
      label?.classList.remove("is-hidden");
      if (label && !zone.contains(label)) {
        zone.appendChild(label);
      }
      if (zone.contains(cardEl)) {
        zone.removeChild(cardEl);
      }
    }
    cardEl.dataset.assignedZone = "";
  };

  const setInteractionEnabled = (enabled) => {
    interactionEnabled = enabled;
    if (!interactionsReady) {
      return;
    }
    const $ = window.jQuery;
    cards.forEach((card) => {
      const locked = card.dataset.locked === "true";
      if ($ && $(card).data("uiDraggable")) {
        $(card).draggable("option", "disabled", !enabled || locked);
      }
    });
    dropzones.forEach((zone, index) => {
      const locked = zone.dataset.locked === "true";
      const isActive = enabled && index === activeIndex && !locked;
      zone.classList.toggle("is-active", isActive);
      if ($ && $(zone).data("uiDroppable")) {
        $(zone).droppable("option", "disabled", !isActive);
      }
    });
    if ($ && $(bank).data("uiDroppable")) {
      $(bank).droppable("option", "disabled", !enabled);
    }
  };

  const clearCountdown = () => {
    if (countdownInterval) {
      window.clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (activeStepResolve) {
      activeStepResolve = null;
    }
    activeStepIndex = -1;
  };

  const clearHighlights = () => {
    sentenceCards.forEach((card) => card.classList.remove("is-active"));
    dropzones.forEach((zone) => zone.classList.remove("is-active"));
  };

  const resetMatching = () => {
    sequenceController?.abort();
    sequenceController = null;
    sequenceRunning = false;
    sequenceCompleted = false;
    activeIndex = -1;
    autoTriggered = false;
    slide._autoTriggered = false;
    clearCountdown();
    clearHighlights();
    setInteractionEnabled(false);
    status.textContent = "";
    audioManager.stopAll();
    resetTimers();

    dropzones.forEach((zone) => {
      zone.classList.remove(
        "is-filled",
        "is-hover",
        "is-correct",
        "is-incorrect",
        "is-locked"
      );
      zone.dataset.locked = "false";
      const label = zoneLabels.get(zone);
      if (label) {
        label.textContent = "Drop the matching image here";
        label.classList.remove("is-hidden");
        if (!zone.contains(label)) {
          zone.appendChild(label);
        }
      }
      const existing = placements.get(zone.dataset.zoneId);
      if (existing) {
        placements.delete(zone.dataset.zoneId);
      }
      while (zone.firstChild) {
        zone.removeChild(zone.firstChild);
      }
      if (label) {
        zone.appendChild(label);
      }
    });

    cards.forEach((card) => {
      card.dataset.assignedZone = "";
      card.dataset.locked = "false";
      card.classList.remove(
        "is-active",
        "is-correct",
        "is-incorrect",
        "is-locked"
      );
      resetCardPosition(card);
    });

    shuffleArray(cards).forEach((card) => bank.appendChild(card));
    startBtn.disabled = false;
    startBtn.textContent = "Start";
    resetFeedback();
  };

  const lockSentence = (index) => {
    const zone = dropzones[index];
    if (!zone) {
      return;
    }
    const expectedId = zone.dataset.expectedId;
    const zoneId = zone.dataset.zoneId;
    const placed = placements.get(zoneId);

    zone.dataset.locked = "true";
    zone.classList.add("is-locked");
    zone.classList.remove("is-active", "is-hover");

    let isCorrect = false;
    if (placed && placed.dataset.itemId === expectedId) {
      zone.classList.add("is-correct");
      placed.classList.add("is-correct");
      isCorrect = true;
    } else {
      zone.classList.add("is-incorrect");
      placed?.classList.add("is-incorrect");
    }

    if (placed) {
      placed.dataset.locked = "true";
      placed.classList.add("is-locked");
      const $ = window.jQuery;
      if ($ && $(placed).data("uiDraggable")) {
        $(placed).draggable("option", "disabled", true);
      }
    } else {
      const label = zoneLabels.get(zone);
      if (label) {
        label.textContent = "No answer";
        label.classList.remove("is-hidden");
      }
    }

    if (timerEls[index]) {
      timerEls[index].textContent = "Done";
    }

    if (!isCorrect && placed) {
      placed.classList.remove("is-active");
    }
  };

  const completeActiveStep = (index) => {
    if (activeStepResolve && activeStepIndex === index) {
      const resolve = activeStepResolve;
      activeStepResolve = null;
      activeStepIndex = -1;
      clearCountdown();
      resolve();
    }
  };

  const summarizeResults = () => {
    let correctCount = 0;
    dropzones.forEach((zone) => {
      const placed = placements.get(zone.dataset.zoneId);
      if (placed && placed.dataset.itemId === zone.dataset.expectedId) {
        correctCount += 1;
      }
    });
    updateFeedback(
      `You matched ${correctCount} of ${dropzones.length} correctly.`,
      correctCount === dropzones.length ? "positive" : "negative"
    );
    showCompletionModal({
      title: "Results",
      message: `You matched ${correctCount} of ${dropzones.length} sentences correctly.`,
    });
  };

  const runCountdown = (durationMs, index, { signal } = {}) =>
    new Promise((resolve) => {
      const totalSeconds = Math.max(1, Math.ceil(durationMs / 1000));
      let remaining = totalSeconds;

      const updateStatus = () => {
        status.textContent = `Sentence ${index + 1} of ${
          matchingItems.length
        }: Drag the image (${remaining}s)`;
        if (timerEls[index]) {
          timerEls[index].textContent = `${remaining}s`;
        }
      };

      updateStatus();
      clearCountdown();
      activeStepIndex = index;
      activeStepResolve = resolve;

      if (signal?.aborted) {
        activeStepResolve = null;
        activeStepIndex = -1;
        resolve();
        return;
      }

      countdownInterval = window.setInterval(() => {
        if (signal?.aborted) {
          clearCountdown();
          resolve();
          return;
        }

        remaining -= 1;
        if (remaining <= 0) {
          if (timerEls[index]) {
            timerEls[index].textContent = "0s";
          }
          clearCountdown();
          resolve();
          return;
        }
        updateStatus();
      }, 1000);
    });

  const runSequence = async () => {
    if (sequenceRunning) {
      return;
    }

    sequenceRunning = true;
    sequenceCompleted = false;
    startBtn.disabled = true;
    startBtn.textContent = "Running...";
    resetBtn.disabled = false;
    updateFeedback("Follow the audio and drag each matching image.", "neutral");
    resetTimers();

    sequenceController?.abort();
    sequenceController = new AbortController();
    const { signal } = sequenceController;

    setInteractionEnabled(false);
    audioManager.stopAll();

    try {
      for (let index = 0; index < matchingItems.length; index += 1) {
        if (signal.aborted) {
          break;
        }

        activeIndex = index;
        clearHighlights();
        sentenceCards[index]?.classList.add("is-active");
        sentenceCards[index]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        setInteractionEnabled(false);
        status.textContent = `Sentence ${index + 1} of ${
          matchingItems.length
        }: Listening...`;

        const audioUrl = matchingItems[index].audio;
        if (audioUrl) {
          try {
            await audioManager.play(audioUrl, { signal });
          } catch (error) {
            if (!signal.aborted) {
              console.error(error);
              status.textContent = "Unable to play audio.";
            }
          }
        } else {
          await waitMs(500, { signal });
        }

        if (signal.aborted) {
          break;
        }

        setInteractionEnabled(true);
        await runCountdown(timeLimitMs, index, { signal });

        if (signal.aborted) {
          break;
        }

        setInteractionEnabled(false);
        lockSentence(index);
        await waitMs(400, { signal });
      }

      if (!signal.aborted) {
        sequenceCompleted = true;
        status.textContent = "Activity complete.";
        summarizeResults();
      }
    } finally {
      sequenceRunning = false;
      startBtn.disabled = false;
      startBtn.textContent = sequenceCompleted ? "Restart" : "Start";
      setInteractionEnabled(false);
    }
  };

  const setupInteractions = () => {
    if (interactionsReady) {
      return;
    }
    const $ = window.jQuery;
    if (!$ || !$.fn?.draggable || !$.fn?.droppable) {
      console.warn("jQuery UI is required for the matching activity.");
      status.textContent = "Drag and drop is unavailable.";
      startBtn.disabled = true;
      resetBtn.disabled = true;
      return;
    }

    $(cards).draggable({
      revert: "invalid",
      containment: slide,
      start() {
        $(this).addClass("is-active");
      },
      stop() {
        $(this).removeClass("is-active");
      },
    });

    $(dropzones).droppable({
      accept: ".interactive6-card",
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
        if (!cardEl || !interactionEnabled) {
          return;
        }

        if (zoneEl.dataset.locked === "true") {
          return;
        }

        detachFromZone(cardEl);
        const zoneId = zoneEl.dataset.zoneId;
        const existing = placements.get(zoneId);
        if (existing && existing !== cardEl) {
          detachFromZone(existing);
          resetCardPosition(existing);
          bank.appendChild(existing);
        }

        const label = zoneLabels.get(zoneEl);
        label?.classList.add("is-hidden");
        zoneEl.appendChild(cardEl);
        resetCardPosition(cardEl);
        cardEl.dataset.assignedZone = zoneId;
        zoneEl.classList.add("is-filled");
        placements.set(zoneId, cardEl);

        const zoneIndex = Number(zoneEl.dataset.zoneIndex);
        if (Number.isInteger(zoneIndex) && zoneIndex === activeIndex) {
          completeActiveStep(zoneIndex);
        }
      },
    });

    $(bank).droppable({
      accept: ".interactive6-card",
      tolerance: "intersect",
      drop(_, ui) {
        const cardEl = ui.draggable.get(0);
        if (!cardEl || !interactionEnabled) {
          return;
        }
        if (cardEl.dataset.locked === "true") {
          return;
        }
        detachFromZone(cardEl);
        resetCardPosition(cardEl);
        bank.appendChild(cardEl);
      },
    });

    interactionsReady = true;
    setInteractionEnabled(false);
  };

  startBtn.addEventListener("click", () => {
    autoTriggered = true;
    slide._autoTriggered = true;
    if (sequenceRunning) {
      return;
    }
    if (sequenceCompleted) {
      resetMatching();
    }
    runSequence();
  });

  resetBtn.addEventListener("click", () => {
    resetMatching();
  });

  const triggerAutoPlay = () => {
    if (autoTriggered || sequenceRunning) {
      return;
    }
    autoTriggered = true;
    slide._autoTriggered = true;
    runSequence();
  };

  const onLeave = () => {
    resetMatching();
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  resetFeedback();

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-pre-listening`
      : "activity-pre-listening",
    element: slide,
    autoPlay: {
      button: startBtn,
      trigger: triggerAutoPlay,
      status,
    },
    onEnter: () => {
      setupInteractions();
    },
    onLeave,
  };
};

const clearEntryHighlights = (items = []) => {
  items.forEach(({ card, line, segments }) => {
    card?.classList.remove("is-active");
    line?.classList.remove("is-playing");
    if (Array.isArray(segments)) {
      segments.forEach(({ element }) => {
        element?.classList.remove("is-playing");
      });
    }
  });
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

  const entries = [];

  (Array.isArray(items) ? items : []).forEach((entry, index) => {
    if (isParagraphLayout) {
      const paragraph = document.createElement("p");
      paragraph.className = "listening-paragraph__line";
      paragraph.textContent = entry.text;
      list.appendChild(paragraph);
      entries.push({
        entry,
        card: null,
        line: paragraph,
      });
      return;
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

    entries.push({
      entry,
      card,
      line,
    });
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

        const scrollTarget = item.card ?? item.line;
        if (scrollTarget) {
          scrollTarget.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        item.card?.classList.add("is-active");
        item.line?.classList.add("is-playing");
        status.textContent = "Listening...";

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

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-${
          isRepeatMode ? "listen-repeat" : "reading"
        }`
      : `interactive6-${isRepeatMode ? "listen-repeat" : "reading"}`,
    element: slide,
    autoPlay: {
      button: startBtn,
      trigger: triggerAutoPlay,
      status,
    },
    onLeave,
  };
};

export const buildInteractive6Slides = (activityData = {}, context = {}) => {
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

  const matchSlide = buildTimedImageMatchingSlide(
    activityData?.content?.activity_a,
    createSubActivityContext(baseContext, "a", Boolean(activityFocus))
  );

  const repeatItems = normalizeLineItems(activityData?.content?.activity_b);
  const readItems = normalizeLineItems(activityData?.content?.activity_c);

  const repeatPauseMs = getRepeatPauseMs(activityData);

  const slides = [
    matchSlide,
    createSequencedTextSlide(
      repeatItems,
      createSubActivityContext(baseContext, "b"),
      {
        mode: "listen-repeat",
        autoDelayMs: 5000,
        repeatPauseMs,
      }
    ),
    createSequencedTextSlide(
      readItems,
      createSubActivityContext(baseContext, "c"),
      {
        mode: "read",
        autoDelayMs: 5000,
        repeatPauseMs,
      }
    ),
  ];

  return slides;
};
