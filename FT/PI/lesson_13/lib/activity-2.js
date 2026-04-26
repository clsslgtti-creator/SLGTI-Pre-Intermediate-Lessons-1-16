import { audioManager, computeSegmentGapMs } from "./audio-manager.js";
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

const normalizeKeyword = (value) => {
  const trimmed = trimString(value);
  if (!trimmed) {
    return "";
  }
  return trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");
};

const createStatus = () => {
  const status = document.createElement("p");
  status.className = "playback-status";
  status.textContent = "";
  return status;
};

const renderEmphasizedText = (element, text) => {
  const normalized = typeof text === "string" ? text : "";
  const fragment = document.createDocumentFragment();
  const pattern = /'([^']+)'/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    const leading = normalized.slice(lastIndex, match.index);
    if (leading) {
      fragment.appendChild(document.createTextNode(leading));
    }

    const emphasis = document.createElement("span");
    emphasis.className = "dialogue-text__emphasis";
    emphasis.textContent = match[1];
    fragment.appendChild(emphasis);

    lastIndex = pattern.lastIndex;
  }

  const trailing = normalized.slice(lastIndex);
  if (trailing) {
    fragment.appendChild(document.createTextNode(trailing));
  }

  if (!fragment.childNodes.length) {
    element.textContent = normalized;
    return;
  }

  element.appendChild(fragment);
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

const clearSegmentHighlights = (segments = []) => {
  segments.forEach(({ element }) => {
    element?.classList.remove("is-playing");
  });
};

const TEXT_KEYS = ["text_a", "text_b", "text_c", "text_d", "text_e"];
const AUDIO_KEYS = ["audio_a", "audio_b", "audio_c", "audio_d", "audio_e"];

const normalizeSentenceSegments = (entry = {}) => {
  const segments = [];
  const seen = new Set();

  if (Array.isArray(entry.sentences)) {
    entry.sentences.forEach((item) => {
      const text = trimString(item?.text);
      const audio = trimString(item?.audio);
      const role = trimString(item?.role);
      if (!text && !audio) {
        return;
      }
      const key = `${text}__${audio}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      segments.push({ text, audio, role });
    });
  }

  for (let index = 0; index < TEXT_KEYS.length; index += 1) {
    const textKey = TEXT_KEYS[index];
    const audioKey = AUDIO_KEYS[index];
    const text = trimString(entry?.[textKey]);
    const audio = trimString(entry?.[audioKey]);
    if (!text && !audio) {
      continue;
    }
    const key = `${text}__${audio}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    segments.push({ text, audio });
  }

  return segments;
};

const normalizeSentenceEntries = (raw = []) => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry, index) => {
      const id = trimString(entry?.id) || `activity2_item_${index + 1}`;
      const title = trimString(entry?.title);
      const prompt = trimString(entry?.prompt);
      const image = trimString(entry?.img ?? entry?.image ?? "");
      const segments = normalizeSentenceSegments(entry);
      if (!segments.length) {
        return null;
      }
      return {
        id,
        title,
        prompt,
        image: image || null,
        segments,
      };
    })
    .filter(Boolean);
};

const createSentenceCard = (entry, { title = "", classes = [] } = {}) => {
  const wrapper = document.createElement("article");
  wrapper.className = ["dialogue-card", ...classes].join(" ");
  wrapper.dataset.entryId = entry.id;

  if (entry.image) {
    const img = document.createElement("img");
    img.src = entry.image;
    img.alt = entry.title ? `Illustration: ${entry.title}` : "Activity illustration";
    img.loading = "lazy";
    img.className = "dialogue-card__image";
    wrapper.appendChild(img);
  }

  if (title) {
    const heading = document.createElement("h3");
    heading.className = "dialogue-card__title";
    heading.textContent = title;
    wrapper.appendChild(heading);
  }

  if (entry.prompt) {
    const promptEl = document.createElement("p");
    promptEl.className = "dialogue-card__prompt";
    promptEl.textContent = entry.prompt;
    wrapper.appendChild(promptEl);
  }

  const textsWrapper = document.createElement("div");
  textsWrapper.className = "dialogue-card__texts";
  wrapper.appendChild(textsWrapper);

  const lineElements = entry.segments.map((segment, index) => {
    const line = document.createElement("p");
    line.className = "dialogue-card__line";
    if (index === 0) {
      line.classList.add("dialogue-card__line--answer");
    } else {
      line.classList.add("dialogue-card__line--answer");
    }
    const displayText = segment.text || `Sentence ${index + 1}`;
    renderEmphasizedText(line, displayText);
    textsWrapper.appendChild(line);
    return line;
  });

  return {
    card: wrapper,
    lineElements,
  };
};

const buildListeningSlide = (entries = [], context = {}) => {
  const {
    activityLabel = "Activity",
    activityNumber = null,
    subActivitySuffix = "",
    subActivityLetter = "",
    activityFocus = "",
    includeFocus = false,
  } = context;

  const slide = document.createElement("section");
  slide.className = "slide slide--listening";
  slide.innerHTML = `
    <h2>${activityLabel}${subActivitySuffix}</h2>
    <p class="slide__instruction">Listen to each set of sentences in order.</p>
  `;

  maybeInsertFocus(slide, activityFocus, includeFocus);

  const controls = document.createElement("div");
  controls.className = "slide__controls";
  const startBtn = document.createElement("button");
  startBtn.className = "primary-btn";
  startBtn.textContent = "Start";
  const status = createStatus();
  controls.append(startBtn, status);
  slide.appendChild(controls);

  const grid = document.createElement("div");
  grid.className = "dialogue-grid dialogue-grid--listening";
  slide.appendChild(grid);

  const items = entries.map((entry, index) => {
    const cardTitle = entry.title || `Set ${index + 1}`;
    const { card, lineElements } = createSentenceCard(entry, {
      title: cardTitle,
      classes: ["dialogue-card--listening"],
    });
    grid.appendChild(card);
    return {
      card,
      segments: entry.segments
        .map((segment, segIndex) => ({
          url: segment.audio,
          element: lineElements[segIndex],
        }))
        .filter((segment) => segment.url),
    };
  });

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Audio will be added soon.";
    slide.appendChild(empty);
  }

  let sequenceAbort = null;
  let autoTriggered = false;
  let pauseRequested = false;

  const playbackState = {
    mode: "idle",
    itemIndex: 0,
    segmentIndex: 0,
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

  const setPlaybackMode = (mode, { itemIndex, segmentIndex } = {}) => {
    playbackState.mode = mode;
    if (Number.isInteger(itemIndex)) {
      playbackState.itemIndex = Math.max(0, itemIndex);
    }
    if (Number.isInteger(segmentIndex)) {
      playbackState.segmentIndex = Math.max(0, segmentIndex);
    }
    updateButtonLabel();
  };

  const clearVisualState = () => {
    items.forEach(({ card, segments }) => {
      card.classList.remove("is-active");
      clearSegmentHighlights(segments);
    });
  };

  const resetState = ({ clearStatus = true } = {}) => {
    clearVisualState();
    autoTriggered = false;
    slide._autoTriggered = false;
    setPlaybackMode("idle", { itemIndex: 0, segmentIndex: 0 });
    if (clearStatus) {
      status.textContent = "";
    }
  };

  updateButtonLabel();

  const runSequence = async ({
    itemIndex = 0,
    segmentIndex = 0,
  } = {}) => {
    const hasPlayableSegments = items.some((item) => item.segments.length);
    if (!hasPlayableSegments) {
      status.textContent = "Audio will be added soon.";
      resetState({ clearStatus: false });
      return;
    }

    pauseRequested = false;
    sequenceAbort?.abort();
    sequenceAbort = new AbortController();
    const { signal } = sequenceAbort;

    audioManager.stopAll();
    clearVisualState();
    setPlaybackMode("playing", { itemIndex, segmentIndex });
    status.textContent =
      itemIndex === 0 && segmentIndex === 0 ? "Starting..." : "Resuming...";

    let completed = false;

    try {
      for (let index = itemIndex; index < items.length; index += 1) {
        playbackState.itemIndex = index;
        const item = items[index];
        if (!item.segments.length) {
          playbackState.segmentIndex = 0;
          continue;
        }

        item.card.classList.add("is-active");
        smoothScrollIntoView(item.card);

        const startingSegment = index === itemIndex ? segmentIndex : 0;
        for (
          let segIndex = startingSegment;
          segIndex < item.segments.length;
          segIndex += 1
        ) {
          playbackState.segmentIndex = segIndex;
          const { url, element } = item.segments[segIndex];
          if (!url) {
            continue;
          }

          status.textContent = "Listening...";
          element?.classList.add("is-playing");

          try {
            await audioManager.play(url, { signal });
          } catch (error) {
            if (!signal.aborted) {
              console.error(error);
              status.textContent = "Unable to play audio.";
            }
          }

          element?.classList.remove("is-playing");

          if (signal.aborted) {
            break;
          }

          playbackState.segmentIndex = segIndex + 1;

          try {
            const duration = await audioManager.getDuration(url);
            const gapMs = computeSegmentGapMs("listen", duration);
            const hasMoreSegments = segIndex < item.segments.length - 1;
            const hasMoreItems = index < items.length - 1;

            if ((hasMoreSegments || hasMoreItems) && gapMs > 0) {
              status.textContent = "Next up...";
              await waitMs(gapMs, { signal });
            }
          } catch (error) {
            console.error(error);
          }

          if (signal.aborted) {
            break;
          }
        }

        clearSegmentHighlights(item.segments);
        item.card.classList.remove("is-active");

        if (signal.aborted) {
          break;
        }

        playbackState.segmentIndex = 0;
        playbackState.itemIndex = index + 1;
      }

      if (!sequenceAbort?.signal?.aborted) {
        completed = true;
      }
    } finally {
      const aborted = sequenceAbort?.signal?.aborted ?? false;
      sequenceAbort = null;
      audioManager.stopAll();

      if (aborted && pauseRequested) {
        autoTriggered = false;
        slide._autoTriggered = false;
        setPlaybackMode("paused", {
          itemIndex: playbackState.itemIndex,
          segmentIndex: playbackState.segmentIndex,
        });
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

  const startSequence = (options = {}) => {
    autoTriggered = true;
    slide._autoTriggered = true;
    runSequence(options);
  };

  const triggerAutoPlay = () => {
    if (
      autoTriggered ||
      playbackState.mode === "playing" ||
      playbackState.mode === "paused"
    ) {
      return;
    }
    startSequence({ itemIndex: 0, segmentIndex: 0 });
  };

  startBtn.addEventListener("click", () => {
    if (playbackState.mode === "playing") {
      pauseRequested = true;
      sequenceAbort?.abort();
      return;
    }

    if (playbackState.mode === "paused") {
      startSequence({
        itemIndex: playbackState.itemIndex,
        segmentIndex: playbackState.segmentIndex,
      });
      return;
    }

    startSequence({ itemIndex: 0, segmentIndex: 0 });
  });

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-activity2-listen`
      : "activity-2-listen",
    element: slide,
    autoPlay: {
      button: startBtn,
      trigger: triggerAutoPlay,
      status,
    },
    onLeave: () => {
      sequenceAbort?.abort();
      sequenceAbort = null;
      audioManager.stopAll();
      resetState();
    },
  };
};

const buildListenRepeatSlide = (
  entries = [],
  context = {},
  { repeatPauseMs = 1500 } = {}
) => {
  const {
    activityLabel = "Activity",
    activityNumber = null,
    subActivitySuffix = "",
    subActivityLetter = "",
  } = context;

  const slide = document.createElement("section");
  slide.className = "slide slide--listen-repeat";
  slide.innerHTML = `
    <h2>${activityLabel}${subActivitySuffix}</h2>
    <p class="slide__instruction">Listen to each sentence and use the pause to repeat it aloud.</p>
  `;

  const controls = document.createElement("div");
  controls.className = "slide__controls";
  const startBtn = document.createElement("button");
  startBtn.className = "primary-btn";
  startBtn.textContent = "Start";
  const status = createStatus();
  controls.append(startBtn, status);
  slide.appendChild(controls);

  const grid = document.createElement("div");
  grid.className = "dialogue-grid dialogue-grid--listen-repeat";
  slide.appendChild(grid);

  const items = entries.map((entry, index) => {
    const cardTitle = entry.title || `Set ${index + 1}`;
    const { card, lineElements } = createSentenceCard(entry, {
      title: cardTitle,
      classes: ["dialogue-card--listen-repeat"],
    });
    grid.appendChild(card);
    return {
      card,
      segments: entry.segments
        .map((segment, segIndex) => ({
          url: segment.audio,
          element: lineElements[segIndex],
        }))
        .filter((segment) => segment.url),
    };
  });

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Audio will be added soon.";
    slide.appendChild(empty);
  }

  let sequenceAbort = null;
  let autoTriggered = false;
  let pauseRequested = false;
  const basePauseMs = Number.isFinite(repeatPauseMs)
    ? Math.max(500, repeatPauseMs)
    : 1500;

  const playbackState = {
    mode: "idle",
    itemIndex: 0,
    segmentIndex: 0,
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

  const setPlaybackMode = (mode, { itemIndex, segmentIndex } = {}) => {
    playbackState.mode = mode;
    if (Number.isInteger(itemIndex)) {
      playbackState.itemIndex = Math.max(0, itemIndex);
    }
    if (Number.isInteger(segmentIndex)) {
      playbackState.segmentIndex = Math.max(0, segmentIndex);
    }
    updateButtonLabel();
  };

  const clearVisualState = () => {
    items.forEach(({ card, segments }) => {
      card.classList.remove("is-active");
      clearSegmentHighlights(segments);
    });
  };

  const resetState = ({ clearStatus = true } = {}) => {
    clearVisualState();
    autoTriggered = false;
    slide._autoTriggered = false;
    setPlaybackMode("idle", { itemIndex: 0, segmentIndex: 0 });
    if (clearStatus) {
      status.textContent = "";
    }
  };

  updateButtonLabel();

  const runSequence = async ({
    itemIndex = 0,
    segmentIndex = 0,
  } = {}) => {
    const hasPlayableSegments = items.some((item) => item.segments.length);
    if (!hasPlayableSegments) {
      status.textContent = "Audio will be added soon.";
      resetState({ clearStatus: false });
      return;
    }

    pauseRequested = false;
    sequenceAbort?.abort();
    sequenceAbort = new AbortController();
    const { signal } = sequenceAbort;

    audioManager.stopAll();
    clearVisualState();
    setPlaybackMode("playing", { itemIndex, segmentIndex });
    status.textContent =
      itemIndex === 0 && segmentIndex === 0 ? "Starting..." : "Resuming...";

    let completed = false;

    try {
      for (let index = itemIndex; index < items.length; index += 1) {
        playbackState.itemIndex = index;
        const item = items[index];
        if (!item.segments.length) {
          playbackState.segmentIndex = 0;
          continue;
        }

        item.card.classList.add("is-active");
        smoothScrollIntoView(item.card);

        const startingSegment = index === itemIndex ? segmentIndex : 0;
        for (
          let segIndex = startingSegment;
          segIndex < item.segments.length;
          segIndex += 1
        ) {
          playbackState.segmentIndex = segIndex;
          const { url, element } = item.segments[segIndex];
          if (!url) {
            continue;
          }

          status.textContent = "Listening...";
          element?.classList.add("is-playing");

          try {
            await audioManager.play(url, { signal });
          } catch (error) {
            if (!signal.aborted) {
              console.error(error);
              status.textContent = "Unable to play audio.";
            }
          }

          element?.classList.remove("is-playing");

          if (signal.aborted) {
            break;
          }

          playbackState.segmentIndex = segIndex + 1;

          try {
            const duration = await audioManager.getDuration(url);
            const pauseMs = computeSegmentGapMs("listen-repeat", duration, {
              repeatPauseMs: basePauseMs,
            });
            if (pauseMs > 0) {
              status.textContent = "Your turn...";
              await waitMs(pauseMs, { signal });
            }
          } catch (error) {
            console.error(error);
          }

          if (signal.aborted) {
            break;
          }
        }

        status.textContent = "Listening...";
        clearSegmentHighlights(item.segments);
        item.card.classList.remove("is-active");

        if (signal.aborted) {
          break;
        }

        playbackState.segmentIndex = 0;
        playbackState.itemIndex = index + 1;
      }

      if (!sequenceAbort?.signal?.aborted) {
        completed = true;
      }
    } finally {
      const aborted = sequenceAbort?.signal?.aborted ?? false;
      sequenceAbort = null;
      audioManager.stopAll();

      if (aborted && pauseRequested) {
        autoTriggered = false;
        slide._autoTriggered = false;
        setPlaybackMode("paused", {
          itemIndex: playbackState.itemIndex,
          segmentIndex: playbackState.segmentIndex,
        });
        status.textContent = "Paused.";
      } else {
        const finalStatus = completed
          ? "Practice complete."
          : "Practice stopped.";
        resetState({ clearStatus: false });
        status.textContent = finalStatus;
      }

      pauseRequested = false;
    }
  };

  const startSequence = (options = {}) => {
    autoTriggered = true;
    slide._autoTriggered = true;
    runSequence(options);
  };

  const triggerAutoPlay = () => {
    if (
      autoTriggered ||
      playbackState.mode === "playing" ||
      playbackState.mode === "paused"
    ) {
      return;
    }
    startSequence({ itemIndex: 0, segmentIndex: 0 });
  };

  startBtn.addEventListener("click", () => {
    if (playbackState.mode === "playing") {
      pauseRequested = true;
      sequenceAbort?.abort();
      return;
    }

    if (playbackState.mode === "paused") {
      startSequence({
        itemIndex: playbackState.itemIndex,
        segmentIndex: playbackState.segmentIndex,
      });
      return;
    }

    startSequence({ itemIndex: 0, segmentIndex: 0 });
  });

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-activity2-repeat`
      : "activity-2-repeat",
    element: slide,
    autoPlay: {
      button: startBtn,
      trigger: triggerAutoPlay,
      status,
    },
    onLeave: () => {
      sequenceAbort?.abort();
      sequenceAbort = null;
      audioManager.stopAll();
      resetState();
    },
  };
};

const normalizeMatchingItems = (raw = []) => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seen = new Set();
  return raw
    .map((entry, index) => {
      const label =
        trimString(entry?.keyword) ||
        trimString(entry?.label) ||
        trimString(entry?.text);
      const normalizedKeyword = normalizeKeyword(label);
      const image = trimString(entry?.img ?? entry?.image ?? "");
      if (!label || !normalizedKeyword || !image) {
        return null;
      }
      if (seen.has(normalizedKeyword)) {
        return null;
      }
      seen.add(normalizedKeyword);
      return {
        id: trimString(entry?.id) || `match_${index + 1}`,
        label,
        normalizedKeyword,
        image,
      };
    })
    .filter(Boolean);
};

const shuffle = (array) => {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildMatchingSlide = (items = [], context = {}) => {
  const {
    activityLabel = "Activity",
    subActivitySuffix = "",
    subActivityLetter = "",
    activityNumber = null,
    activityFocus = "",
    includeFocus = false,
  } = context;

  const slide = document.createElement("section");
  slide.className = "slide slide--pre-listening";
  slide.innerHTML = `
    <h2>${activityLabel}${subActivitySuffix}</h2>
    <p class="slide__instruction">Match each description with the correct picture.</p>
  `;

  maybeInsertFocus(slide, activityFocus, includeFocus);

  const layout = document.createElement("div");
  layout.className = "pre-listening-layout";
  slide.appendChild(layout);

  const gallery = document.createElement("div");
  gallery.className = "pre-listening-gallery";
  layout.appendChild(gallery);

  const dropzonesWrapper = document.createElement("div");
  dropzonesWrapper.className = "pre-listening-dropzones";
  layout.appendChild(dropzonesWrapper);

  const cards = [];
  const dropzones = [];

  const shuffledCards = shuffle(items);

  shuffledCards.forEach((item) => {
    const card = document.createElement("div");
    card.className = "pre-listening-card";
    card.dataset.keyword = item.normalizedKeyword;
    card.dataset.label = item.label;

    const imgWrapper = document.createElement("div");
    imgWrapper.className = "pre-listening-card__media";
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.label ? `Match: ${item.label}` : "Matching item";
    img.loading = "lazy";
    imgWrapper.appendChild(img);
    card.appendChild(imgWrapper);

    const caption = document.createElement("span");
    caption.className = "pre-listening-card__caption";
    caption.textContent = "";
    card.appendChild(caption);

    gallery.appendChild(card);
    cards.push(card);
  });

  const shuffledDropzones = shuffle(items);

  shuffledDropzones.forEach((item) => {
    const dropzone = document.createElement("div");
    dropzone.className = "pre-listening-dropzone";
    dropzone.dataset.keyword = item.normalizedKeyword;

    const label = document.createElement("span");
    label.className = "pre-listening-dropzone__label";
    label.textContent = item.label;
    dropzone.appendChild(label);

    const body = document.createElement("div");
    body.className = "pre-listening-dropzone__body";
    dropzone.appendChild(body);

    dropzonesWrapper.appendChild(dropzone);
    dropzones.push(dropzone);
  });

  if (!cards.length || !dropzones.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Matching activity will appear once content is available.";
    layout.appendChild(empty);
  }

  const resetMatching = () => {
    const $ = window.jQuery;
    if (!$) {
      return;
    }

    cards.forEach((card) => {
      const $card = $(card);
      $card.removeClass("is-correct is-incorrect is-active");
      $card.css({ top: "", left: "", position: "relative" });
      $card.find(".pre-listening-card__caption")
        .text("")
        .removeClass("is-visible");
      gallery.appendChild(card);
      if ($card.data("uiDraggable")) {
        $card.draggable("enable");
        $card.draggable("option", "revert", "invalid");
      }
    });

    dropzones.forEach((zone) => {
      const $zone = $(zone);
      $zone.removeClass("is-correct is-incorrect is-hover");
      $zone.find(".pre-listening-dropzone__label").removeClass("is-hidden");
      $zone.find(".pre-listening-dropzone__body").empty();
      $zone.data("complete", false);
      if ($zone.data("uiDroppable")) {
        $zone.droppable("enable");
      }
    });
  };

  let initialized = false;

  const setupInteractions = () => {
    const $ = window.jQuery;
    if (!$ || !$.fn?.draggable || !$.fn?.droppable) {
      console.warn(
        "jQuery UI is required for the Activity 2 matching task."
      );
      return;
    }

    $(cards).draggable({
      revert: "invalid",
      containment: slide,
      zIndex: 100,
      start() {
        $(this).removeClass("is-incorrect");
        $(this).addClass("is-active");
      },
      stop() {
        $(this).removeClass("is-active");
      },
    });

    $(dropzones).droppable({
      accept: ".pre-listening-card",
      tolerance: "intersect",
      over() {
        $(this).addClass("is-hover");
      },
      out() {
        $(this).removeClass("is-hover");
      },
      drop(event, ui) {
        const $zone = $(this);
        const $card = ui.draggable;
        const expected = $zone.data("keyword");
        const actual = $card.data("keyword");

        $zone.removeClass("is-hover");

        if ($zone.data("complete")) {
          $card.draggable("option", "revert", true);
          window.setTimeout(
            () => $card.draggable("option", "revert", "invalid"),
            0
          );
          return;
        }

        if (expected === actual) {
          $zone.data("complete", true);
          $zone.addClass("is-correct");
          $zone.find(".pre-listening-dropzone__label").addClass("is-hidden");

          $card.addClass("is-correct");
          $card.draggable("disable");
          $card.removeClass("is-active");
          $card.css({ top: "", left: "", position: "relative" });
          $card.appendTo($zone.find(".pre-listening-dropzone__body"));

          const baseLabel = $card.data("label");
          if (baseLabel) {
            $card
              .find(".pre-listening-card__caption")
              .text(baseLabel)
              .addClass("is-visible");
          }

          $zone.droppable("disable");

          const allComplete = dropzones.every(
            (zoneEl) => $(zoneEl).data("complete") === true
          );

          if (allComplete) {
            showCompletionModal({
              title: "Great Work!",
              message: "You matched all of the items correctly.",
            });
          }
        } else {
          $card.addClass("is-incorrect");
          $zone.addClass("is-incorrect");
          $card.draggable("option", "revert", true);
          window.setTimeout(() => {
            $card.draggable("option", "revert", "invalid");
            $card.removeClass("is-incorrect");
            $zone.removeClass("is-incorrect");
          }, 600);
        }
      },
    });

    initialized = true;
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-activity2-match`
      : "activity-2-match",
    element: slide,
    onEnter: () => {
      if (!cards.length || !dropzones.length) {
        return;
      }
      if (!initialized) {
        setupInteractions();
      }
    },
    onLeave: () => {
      resetMatching();
    },
  };
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

export const buildActivityTwoSlides = (activityData = {}, context = {}) => {
  const { activityNumber, focus: rawFocus } = context;
  const activityLabel = activityNumber
    ? `Activity ${activityNumber}`
    : "Activity";
  const activityFocus = trimString(rawFocus);

  const sentenceActivityA = normalizeSentenceEntries(
    activityData?.content?.activity_a
  );
  const sentenceActivityB = normalizeSentenceEntries(
    activityData?.content?.activity_b
  );
  const matchingItems = normalizeMatchingItems(
    activityData?.content?.activity_c
  );

  const baseContext = {
    activityLabel,
    activityNumber,
    activityFocus,
  };

  const repeatPauseMs = getRepeatPauseMs(activityData);

  const listeningContext = createSubActivityContext(
    baseContext,
    "a",
    Boolean(activityFocus)
  );
  const listenRepeatContext = createSubActivityContext(baseContext, "b");
  const matchingContext = createSubActivityContext(baseContext, "c");

  return [
    buildListeningSlide(sentenceActivityA, listeningContext),
    buildListenRepeatSlide(sentenceActivityB, listenRepeatContext, {
      repeatPauseMs,
    }),
    buildMatchingSlide(matchingItems, matchingContext),
  ];
};
