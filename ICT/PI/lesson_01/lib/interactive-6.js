import {
  createGameScene,
  DEFAULT_FEEDBACK_ASSETS,
  sanitizeOptions,
  normalizeExamples,
  normalizeQuestions,
} from "./games/game-7.js";
import {
  audioManager,
  computeSegmentGapMs,
  getBetweenItemGapMs,
} from "./audio-manager.js";

const GAME_INSTRUCTION_TEXT =
  "Press Start to play. Listen to each sentence and choose the correct answer before time runs out.";

const trimText = (value) => (typeof value === "string" ? value.trim() : "");

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

const READ_ALONG_VARIANT_SUFFIXES = ["a", "b", "c"];

const normalizeReadAlongGroups = (raw = []) => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry, index) => {
      const baseId = trimText(entry?.id) || `line_${index + 1}`;

      const variantLines = READ_ALONG_VARIANT_SUFFIXES.map((suffix) => {
        const text = trimText(entry?.[`text_${suffix}`]);
        const audio = trimText(entry?.[`audio_${suffix}`]);
        if (!text || !audio) {
          return null;
        }
        return { text, audio };
      }).filter(Boolean);

      if (variantLines.length) {
        return {
          id: baseId,
          lines: variantLines,
        };
      }

      const fallbackText = trimText(entry?.text);
      const fallbackAudio = trimText(entry?.audio);
      if (fallbackText && fallbackAudio) {
        return {
          id: baseId,
          lines: [{ text: fallbackText, audio: fallbackAudio }],
        };
      }

      return null;
    })
    .filter(Boolean);
};

const resolveListeningMode = (key = "", letter = "") => {
  if (letter === "b") {
    return "listen";
  }
  if (letter === "c") {
    return "listen-repeat";
  }
  if (letter === "d") {
    return "read";
  }
  const normalizedKey = typeof key === "string" ? key.toLowerCase() : "";
  if (normalizedKey.includes("read")) {
    return "read";
  }
  if (normalizedKey.includes("repeat")) {
    return "listen-repeat";
  }
  if (normalizedKey.includes("listen")) {
    return "listen";
  }
  return "listen-repeat";
};

const collectListeningActivities = (activityData = {}) => {
  const content = activityData?.content;
  const buckets = {
    listen: [],
    listenRepeat: [],
    read: [],
  };

  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return buckets;
  }

  Object.entries(content).forEach(([key, value], index) => {
    if (!Array.isArray(value)) {
      return;
    }
    const letter = deriveSubActivityLetter(key, index);
    const mode = resolveListeningMode(key, letter);
    const items =
      mode === "read"
        ? normalizeReadAlongGroups(value)
        : normalizeListenRepeatItems(value);
    if (!items.length) {
      return;
    }
    const entry = {
      key,
      letter,
      items,
    };
    if (mode === "listen") {
      buckets.listen.push(entry);
    } else if (mode === "read") {
      buckets.read.push(entry);
    } else {
      buckets.listenRepeat.push(entry);
    }
  });

  return buckets;
};

const buildListenRepeatSlideId = (activityNumber, letter = "") => {
  const suffix = letter ? `-${letter}` : "";
  if (activityNumber) {
    return `activity-${activityNumber}${suffix}-listen-repeat`;
  }
  return `activity${suffix}-listen-repeat`;
};

const buildListenSlideId = (activityNumber, letter = "") => {
  const suffix = letter ? `-${letter}` : "";
  if (activityNumber) {
    return `activity-${activityNumber}${suffix}-listening`;
  }
  return `activity${suffix}-listening`;
};

const buildReadAlongSlideId = (activityNumber, letter = "") => {
  const suffix = letter ? `-${letter}` : "";
  if (activityNumber) {
    return `activity-${activityNumber}${suffix}-reading`;
  }
  return `activity${suffix}-reading`;
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

  const options = sanitizeOptions(gameConfig?.options);
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

const createSequencedTextSlide = (
  items = [],
  {
    slideId,
    activityLabel = "Activity",
    focusText = "",
    includeFocus = false,
    repeatPauseMs = 1500,
    mode = "listen-repeat",
    autoDelayMs = 5000,
    layout = "grid",
    showLineNumbers = true,
    presentation = "cards",
    groupedEntries = false,
    groupLabel = "Set",
  } = {}
) => {
  const resolvedSlideId = slideId || "interactive-listen-repeat";
  const isRepeatMode = mode === "listen-repeat";
  const isReadMode = mode === "read";
  const slide = document.createElement("section");
  slide.className = isRepeatMode
    ? "slide slide--listen-repeat listening-slide listening-slide--repeat"
    : "slide slide--listening listening-slide listening-slide--read";
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
    if (groupedEntries) {
      const segments = Array.isArray(entry?.lines)
        ? entry.lines
            .map((line) => {
              const text = trimText(line?.text);
              const audio = trimText(line?.audio);
              if (!text || !audio) {
                return null;
              }
              return { text, audio };
            })
            .filter(Boolean)
        : [];
      if (!segments.length) {
        return;
      }

      const card = document.createElement("article");
      card.className =
        "dialogue-card dialogue-card--reading listening-read-card";

      const title = document.createElement("h3");
      title.className = "dialogue-card__title";
      title.textContent = `${groupLabel} ${index + 1}`;
      card.appendChild(title);

      const wrapper = document.createElement("div");
      wrapper.className = "dialogue-card__texts";

      const renderedSegments = segments.map((segment) => {
        const paragraph = document.createElement("p");
        paragraph.className = "dialogue-card__line";
        paragraph.textContent = segment.text;
        wrapper.appendChild(paragraph);
        return {
          audio: segment.audio,
          element: paragraph,
        };
      });

      card.appendChild(wrapper);
      list.appendChild(card);

      entries.push({
        entry,
        card,
        line: null,
        segments: renderedSegments,
      });
      return;
    }

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
    card.className =
      "dialogue-card dialogue-card--reading listening-read-card";

    if (showLineNumbers) {
      const cardTitle = document.createElement("h3");
      cardTitle.className = "dialogue-card__title";
      cardTitle.textContent = `Line ${index + 1}`;
      card.appendChild(cardTitle);
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

        const segments = groupedEntries
          ? item.segments ?? []
          : item.entry?.audio
          ? [
              {
                audio: item.entry.audio,
                element: item.line,
              },
            ]
          : [];

        if (!segments.length) {
          continue;
        }

        const scrollTarget = item.card ?? item.line;
        if (scrollTarget) {
          smoothScrollIntoView(scrollTarget);
        }

        item.card?.classList.add("is-active");

        for (let segIndex = 0; segIndex < segments.length; segIndex += 1) {
          const segment = segments[segIndex];
          if (!segment?.audio) {
            continue;
          }

          const element = segment.element ?? item.line;
          element?.classList.add("is-playing");
          status.textContent = "Listening...";

          try {
            await audioManager.play(segment.audio, { signal });
          } catch (error) {
            if (!signal.aborted) {
              console.error(error);
              status.textContent = "Unable to play audio.";
            }
          } finally {
            element?.classList.remove("is-playing");
          }

          if (signal.aborted) {
            break;
          }

          let gapMs = 0;
          try {
            const duration = await audioManager.getDuration(segment.audio);
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

          const isLastSegment = segIndex >= segments.length - 1;

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
            } else if (!isLastSegment || index < entries.length - 1) {
              status.textContent = "Next up...";
              await waitMs(gapMs, { signal });
            }
          }

          if (signal.aborted) {
            break;
          }
        }

        if (signal.aborted) {
          break;
        }

        playbackState.resumeIndex = index + 1;

        item.card?.classList.remove("is-active");
        item.line?.classList.remove("is-playing");

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

export const buildInteractive6Slides = (activityData = {}, context = {}) => {
  const { activityNumber, focus } = context;
  const focusText = trimText(focus);
  const activities = collectGameActivities(activityData);
  const {
    listen: listenActivities,
    listenRepeat: listenRepeatActivities,
    read: readAlongActivities,
  } = collectListeningActivities(activityData);

  if (
    !activities.length &&
    !listenActivities.length &&
    !listenRepeatActivities.length &&
    !readAlongActivities.length
  ) {
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

  const slides = [];
  let focusAssigned = false;

  const shouldIncludeFocus = () => {
    if (!focusText || focusAssigned) {
      return false;
    }
    focusAssigned = true;
    return true;
  };

  activities.forEach((activity) => {
    slides.push(
      createGameSlide(activity.data, {
        slideId: buildSlideId(activityNumber, activity.letter),
        activityLabel: formatActivityLabel(activityNumber, activity.letter),
        focusText,
        includeFocus: shouldIncludeFocus(),
      })
    );
  });

  const repeatPauseMs = getRepeatPauseMs(activityData);

  listenActivities.forEach((activity) => {
    slides.push(
      createSequencedTextSlide(activity.items, {
        slideId: buildListenSlideId(activityNumber, activity.letter),
        activityLabel: formatActivityLabel(activityNumber, activity.letter),
        focusText,
        includeFocus: shouldIncludeFocus(),
        repeatPauseMs,
        mode: "listen",
        autoDelayMs: 5000,
        layout: "single-column",
        showLineNumbers: false,
        presentation: "paragraph",
      })
    );
  });

  listenRepeatActivities.forEach((activity) => {
    slides.push(
      createSequencedTextSlide(activity.items, {
        slideId: buildListenRepeatSlideId(activityNumber, activity.letter),
        activityLabel: formatActivityLabel(activityNumber, activity.letter),
        focusText,
        includeFocus: shouldIncludeFocus(),
        repeatPauseMs,
        mode: "listen-repeat",
      })
    );
  });

  readAlongActivities.forEach((activity) => {
    slides.push(
      createSequencedTextSlide(activity.items, {
        slideId: buildReadAlongSlideId(activityNumber, activity.letter),
        activityLabel: formatActivityLabel(activityNumber, activity.letter),
        focusText,
        includeFocus: shouldIncludeFocus(),
        repeatPauseMs,
        mode: "read",
        autoDelayMs: 5000,
        groupedEntries: true,
        groupLabel: "Set",
        showLineNumbers: false,
      })
    );
  });

  return slides;
};
