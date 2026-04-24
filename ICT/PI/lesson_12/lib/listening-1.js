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
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, duration);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
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
  });

const createStatus = () => {
  const status = document.createElement("p");
  status.className = "playback-status";
  status.textContent = "";
  return status;
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

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const buildHeading = (slide, headingText) => {
  const heading = document.createElement("h2");
  heading.textContent = headingText;
  slide.appendChild(heading);
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

const buildMcqSlide = (questions = [], context = {}) => {
  const {
    activityLabel = "Activity",
    subActivitySuffix = "",
    activityNumber = null,
  } = context;

  const sanitizedQuestions = (Array.isArray(questions) ? questions : [])
    .map((item, index) => {
      const audioUrl = normalizeString(item?.question_audio);
      const answer = normalizeString(item?.answer);
      const options = Array.isArray(item?.options)
        ? item.options
            .map((option) => normalizeString(option))
            .filter((option) => option.length)
        : [];
      if (!audioUrl || !answer || options.length < 2) {
        return null;
      }
      return {
        id: normalizeString(item?.id) || `mcq_${index + 1}`,
        audio: audioUrl,
        answer,
        options: options.slice(0, 2),
      };
    })
    .filter(Boolean);

  const slide = document.createElement("section");
  slide.className =
    "slide slide--listening listening-slide listening-slide--mcq";
  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);

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
  list.className = "listening-mcq-grid";
  slide.appendChild(list);

  const entries = sanitizedQuestions.map((question, index) => {
    const card = document.createElement("article");
    card.className = "dialogue-card dialogue-card--listening";

    const title = document.createElement("h3");
    title.className = "dialogue-card__title";
    title.textContent = `Question ${index + 1}`;
    card.appendChild(title);

    const optionGroup = document.createElement("div");
    optionGroup.className = "listening-option-group";

    const buttons = question.options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "listening-option";
      button.textContent = option;
      button.dataset.optionValue = option;
      button.disabled = true;
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
      question,
      card,
      buttons,
      feedback,
    };
  });

  if (!entries.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Questions will be added soon.";
    slide.appendChild(emptyState);
  }

  let runController = null;
  let autoTriggered = false;

  const resetEntryState = (entry) => {
    entry.buttons.forEach((btn) => {
      btn.disabled = true;
      btn.classList.remove(
        "is-selected",
        "is-correct",
        "is-incorrect",
        "is-disabled"
      );
    });
    entry.card.classList.remove(
      "is-active",
      "is-playing",
      "is-correct",
      "is-incorrect",
      "has-feedback"
    );
    entry.feedback.textContent = "";
    entry.feedback.className = "listening-feedback";
  };

  const resetAll = () => {
    entries.forEach(resetEntryState);
    status.textContent = "";
    startBtn.disabled = false;
  };

  const waitForSelection = (entry, { signal }) =>
    new Promise((resolve) => {
      let resolved = false;

      const cleanup = () => {
        timeoutId && window.clearTimeout(timeoutId);
        entry.buttons.forEach((btn) => {
          btn.disabled = true;
          btn.removeEventListener("click", handleClick);
        });
        signal?.removeEventListener("abort", handleAbort);
      };

      const finalize = (result) => {
        if (resolved) {
          return;
        }
        resolved = true;
        cleanup();
        resolve(result);
      };

      const handleClick = (event) => {
        const value = normalizeString(event.currentTarget.dataset.optionValue);
        finalize({ selected: value, timedOut: false, aborted: false });
      };

      const handleAbort = () => {
        finalize({ selected: null, timedOut: false, aborted: true });
      };

      entry.buttons.forEach((btn) => {
        btn.disabled = false;
        btn.addEventListener("click", handleClick, { once: true });
      });

      const timeoutId = window.setTimeout(() => {
        finalize({ selected: null, timedOut: true, aborted: false });
      }, 5000);

      signal?.addEventListener("abort", handleAbort, { once: true });
    });

  const applyFeedback = (entry, { selected, timedOut }) => {
    const { answer } = entry.question;
    const normalizedSelected = normalizeString(selected);
    const isCorrect = normalizedSelected && normalizedSelected === answer;

    entry.card.classList.add("has-feedback");
    if (normalizedSelected) {
      const selectedBtn = entry.buttons.find(
        (btn) => normalizeString(btn.dataset.optionValue) === normalizedSelected
      );
      if (selectedBtn) {
        selectedBtn.classList.add("is-selected");
        selectedBtn.classList.add(
          isCorrect ? "is-correct" : "is-incorrect"
        );
      }
    }

    const correctBtn = entry.buttons.find(
      (btn) => normalizeString(btn.dataset.optionValue) === answer
    );
    correctBtn?.classList.add("is-correct");

    let message = "";
    if (isCorrect) {
      entry.card.classList.add("is-correct");
      message = "Correct!";
      entry.feedback.textContent = message;
      entry.feedback.classList.add("listening-feedback--positive");
    } else if (timedOut) {
      entry.card.classList.add("is-incorrect");
      message = `Time's up! Answer: ${answer}`;
      entry.feedback.textContent = message;
      entry.feedback.classList.add("listening-feedback--neutral");
    } else {
      entry.card.classList.add("is-incorrect");
      message = `Incorrect. Correct answer: ${answer}`;
      entry.feedback.textContent = message;
      entry.feedback.classList.add("listening-feedback--negative");
    }
    return message;
  };

  const playQuestionAudio = async (entry, index, total, { signal }) => {
    const { audio } = entry.question;
    entry.card.classList.add("is-playing");

    for (let pass = 0; pass < 2; pass += 1) {
      if (signal.aborted) {
        break;
      }
      status.textContent =
        pass === 0
          ? `Question ${index + 1} of ${total}: playing`
          : `Question ${index + 1} of ${total}: replaying`;
      try {
        await audioManager.play(audio, { signal });
      } catch (error) {
        console.error(error);
        break;
      }
      if (signal.aborted) {
        break;
      }
      if (pass === 0) {
        await waitMs(3000, { signal });
      }
    }

    entry.card.classList.remove("is-playing");
  };

  const runSequence = async () => {
    if (!entries.length) {
      status.textContent = "Questions are not available yet.";
      startBtn.disabled = false;
      return;
    }

    runController?.abort();
    runController = new AbortController();
    const { signal } = runController;

    audioManager.stopAll();
    entries.forEach(resetEntryState);
    startBtn.disabled = true;
    status.textContent = "";

    let score = 0;
    try {
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        entry.card.classList.add("is-active");
        smoothScrollIntoView(entry.card);

        await playQuestionAudio(entry, index, entries.length, { signal });
        if (signal.aborted) {
          break;
        }

        status.textContent = "Choose the answer.";
        const windowStart = performance.now();
        const selection = await waitForSelection(entry, { signal });

        if (selection.aborted) {
          break;
        }

        const feedbackMessage = applyFeedback(entry, selection);
        if (feedbackMessage) {
          status.textContent = feedbackMessage;
        }

        if (
          selection.selected &&
          selection.selected === entry.question.answer
        ) {
          score += 1;
        }

        if (signal.aborted) {
          break;
        }

        const elapsed = performance.now() - windowStart;
        const remaining = Math.max(0, 5000 - elapsed);
        await waitMs(remaining, { signal });
        entry.card.classList.remove("is-active");
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error(error);
        status.textContent = "Unable to complete playback.";
      }
    } finally {
      if (signal.aborted) {
        status.textContent = "Practice stopped.";
      } else {
        status.textContent = `Practice complete. Score ${score}/${entries.length}.`;
        showCompletionModal({
          title: "Great Work!",
          message: "You completed all of the listening questions.",
        });
      }
      startBtn.disabled = false;
      runController = null;
      autoTriggered = false;
      slide._autoTriggered = false;
    }
  };

  const startSequence = () => {
    autoTriggered = true;
    slide._autoTriggered = true;
    runSequence();
  };

  const triggerAutoPlay = () => {
    if (autoTriggered) {
      return;
    }
    startSequence();
  };

  startBtn.addEventListener("click", () => {
    if (!autoTriggered) {
      triggerAutoPlay();
    }
  });

  const autoPlay = {
    button: startBtn,
    trigger: triggerAutoPlay,
    status,
  };

  const onLeave = () => {
    runController?.abort();
    runController = null;
    audioManager.stopAll();
    entries.forEach(resetEntryState);
    startBtn.disabled = false;
    status.textContent = "";
    autoTriggered = false;
    slide._autoTriggered = false;
  };

  const suffixSegment = context.subActivityLetter
    ? `-${context.subActivityLetter}`
    : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-listening1-mcq`
      : "activity-listening1-mcq",
    element: slide,
    autoPlay,
    onLeave,
  };
};

const buildListenRepeatSlide = (
  pairs = [],
  context = {},
  { repeatPauseMs } = {}
) => {
  const {
    activityLabel = "Activity",
    subActivitySuffix = "",
    activityNumber = null,
  } = context;

  const sanitizedPairs = (Array.isArray(pairs) ? pairs : [])
    .map((item, index) => {
      const textA = normalizeString(item?.text_a);
      const textB = normalizeString(item?.text_b);
      const audioA = normalizeString(item?.audio_a);
      const audioB = normalizeString(item?.audio_b);
      if (!textA || !audioA) {
        return null;
      }
      return {
        id: normalizeString(item?.id) || `repeat_${index + 1}`,
        textA,
        textB,
        audioA,
        audioB,
      };
    })
    .filter(Boolean);

  const slide = document.createElement("section");
  slide.className =
    "slide slide--listen-repeat listening-slide listening-slide--repeat";
  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);

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
  list.className = "dialogue-grid dialogue-grid--listen-repeat";
  slide.appendChild(list);

  const entries = sanitizedPairs.map((item, index) => {
    const card = document.createElement("article");
    card.className = "dialogue-card listening-repeat-card";

    const title = document.createElement("h3");
    title.className = "dialogue-card__title";
    title.textContent = `Pair ${index + 1}`;
    card.appendChild(title);

    const textsWrapper = document.createElement("div");
    textsWrapper.className = "dialogue-card__texts";

    const lineA = document.createElement("p");
    lineA.className = "dialogue-card__line dialogue-card__line--question";
    lineA.textContent = item.textA;
    textsWrapper.appendChild(lineA);

    if (item.textB) {
      const lineB = document.createElement("p");
      lineB.className = "dialogue-card__line dialogue-card__line--answer";
      lineB.textContent = item.textB;
      textsWrapper.appendChild(lineB);
      card.appendChild(textsWrapper);
      list.appendChild(card);
      return {
        item,
        card,
        segments: [
          { audio: item.audioA, element: lineA },
          { audio: item.audioB, element: lineB },
        ],
      };
    }

    card.appendChild(textsWrapper);
    list.appendChild(card);
    return {
      item,
      card,
      segments: [{ audio: item.audioA, element: lineA }],
    };
  });

  if (!entries.length) {
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

  const clearHighlights = (entry) => {
    entry.card.classList.remove("is-active");
    entry.segments.forEach(({ element }) => {
      element?.classList.remove("is-playing");
    });
  };

  const resetAll = () => {
    entries.forEach(clearHighlights);
  };

  const resetPlaybackState = () => {
    setPlaybackMode("idle", { resumeIndex: 0 });
    autoTriggered = false;
    slide._autoTriggered = false;
    startBtn.disabled = false;
  };

  updateButtonLabel();

  const runSequence = async (fromIndex = 0) => {
    if (!entries.length) {
      status.textContent = "No audio available.";
      resetPlaybackState();
      return;
    }

    pauseRequested = false;

    sequenceAbort?.abort();
    sequenceAbort = new AbortController();
    const { signal } = sequenceAbort;

    resetAll();
    setPlaybackMode("playing", { resumeIndex: fromIndex });
    status.textContent = fromIndex === 0 ? "Starting..." : "Resuming...";

    let completed = false;

    try {
      for (let index = fromIndex; index < entries.length; index += 1) {
        playbackState.resumeIndex = index;
        const entry = entries[index];
        entry.card.classList.add("is-active");
        smoothScrollIntoView(entry.card);

        for (let segIndex = 0; segIndex < entry.segments.length; segIndex += 1) {
          const { audio, element } = entry.segments[segIndex];
          if (!audio) {
            continue;
          }
          element?.classList.add("is-playing");
          status.textContent = "Listening...";
          try {
            await audioManager.play(audio, { signal });
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

          const duration = await audioManager.getDuration(audio);
          const gapMs = computeSegmentGapMs("listen-repeat", duration, {
            repeatPauseMs,
          });
          status.textContent =
            segIndex === entry.segments.length - 1
              ? "Your turn..."
              : "Next line...";
          await waitMs(gapMs, { signal });
          status.textContent = "Listening...";

          if (signal.aborted) {
            break;
          }
        }

        playbackState.resumeIndex = index + 1;
        clearHighlights(entry);

        if (signal.aborted) {
          break;
        }
      }

      if (!signal.aborted) {
        completed = true;
        status.textContent = "Practice complete.";
      }
    } catch (error) {
      if (!sequenceAbort?.signal?.aborted) {
        console.error(error);
        status.textContent = "Unable to play audio.";
      }
    } finally {
      const aborted = sequenceAbort?.signal?.aborted ?? false;
      sequenceAbort = null;

      if (aborted && pauseRequested) {
        setPlaybackMode("paused", { resumeIndex: playbackState.resumeIndex });
        status.textContent = "Paused.";
      } else if (completed) {
        resetPlaybackState();
        resetAll();
      } else if (aborted) {
        status.textContent = "Practice stopped.";
        resetPlaybackState();
        resetAll();
      } else {
        resetPlaybackState();
      }

      pauseRequested = false;
    }
  };

  const startPractice = (fromIndex = 0) => {
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
    startPractice();
  };

  startBtn.addEventListener("click", () => {
    if (playbackState.mode === "playing") {
      pauseRequested = true;
      sequenceAbort?.abort();
      return;
    }
    if (playbackState.mode === "paused") {
      startPractice(playbackState.resumeIndex);
      return;
    }
    startPractice();
  });

  const autoPlay = {
    button: startBtn,
    trigger: triggerAutoPlay,
    status,
  };

  const onLeave = () => {
    pauseRequested = false;
    sequenceAbort?.abort();
    sequenceAbort = null;
    audioManager.stopAll();
    resetAll();
    resetPlaybackState();
    status.textContent = "";
  };

  const suffixSegment = context.subActivityLetter
    ? `-${context.subActivityLetter}`
    : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-listening1-repeat`
      : "activity-listening1-repeat",
    element: slide,
    autoPlay,
    onLeave,
  };
};

const buildReadAlongSlide = (groups = [], context = {}) => {
  const {
    activityLabel = "Activity",
    subActivitySuffix = "",
    activityNumber = null,
  } = context;

  const sanitizedGroups = (Array.isArray(groups) ? groups : [])
    .map((item, index) => {
      const textA = normalizeString(item?.text_a);
      const textB = normalizeString(item?.text_b);
      const textC = normalizeString(item?.text_c);
      const audioA = normalizeString(item?.audio_a);
      const audioB = normalizeString(item?.audio_b);
      const audioC = normalizeString(item?.audio_c);
      const lines = [
        textA && audioA ? { text: textA, audio: audioA } : null,
        textB && audioB ? { text: textB, audio: audioB } : null,
        textC && audioC ? { text: textC, audio: audioC } : null,
      ].filter(Boolean);
      if (!lines.length) {
        return null;
      }
      return {
        id: normalizeString(item?.id) || `read_${index + 1}`,
        lines,
      };
    })
    .filter(Boolean);

  const slide = document.createElement("section");
  slide.className =
    "slide slide--reading listening-slide listening-slide--read";
  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);
  slide.classList.add("is-animated");

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
  list.className = "dialogue-grid listening-read-grid";
  slide.appendChild(list);

  const entries = sanitizedGroups.map((group, index) => {
    const card = document.createElement("article");
    card.className = "dialogue-card dialogue-card--reading listening-read-card";

    const title = document.createElement("h3");
    title.className = "dialogue-card__title";
    title.textContent = `Set ${index + 1}`;
    card.appendChild(title);

    const wrapper = document.createElement("div");
    wrapper.className = "dialogue-card__texts";

    const segments = group.lines.map((line, lineIndex) => {
      const paragraph = document.createElement("p");
      paragraph.className = "dialogue-card__line";
      paragraph.textContent = line.text;
      wrapper.appendChild(paragraph);
      return { audio: line.audio, element: paragraph };
    });

    card.appendChild(wrapper);
    list.appendChild(card);

    return {
      group,
      card,
      segments,
    };
  });

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Audio will be added soon.";
    slide.appendChild(empty);
  }

  let sequenceAbort = null;
  let autoTriggered = false;

  const clearHighlights = (entry) => {
    entry.card.classList.remove("is-active");
    entry.segments.forEach(({ element }) => {
      element?.classList.remove("is-playing");
    });
  };

  const runSequence = async () => {
    if (!entries.length) {
      status.textContent = "No audio available.";
      startBtn.disabled = false;
      return;
    }

    sequenceAbort?.abort();
    sequenceAbort = new AbortController();
    const { signal } = sequenceAbort;

    status.textContent = "";
    startBtn.disabled = true;
    try {
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        entry.card.classList.add("is-active");
        smoothScrollIntoView(entry.card);

        for (let segIndex = 0; segIndex < entry.segments.length; segIndex += 1) {
          const { audio, element } = entry.segments[segIndex];
          if (!audio) {
            continue;
          }
          element?.classList.add("is-playing");
          status.textContent = "Listening...";
          try {
            await audioManager.play(audio, { signal });
          } catch (error) {
            console.error(error);
          } finally {
            element?.classList.remove("is-playing");
          }

          if (signal.aborted) {
            break;
          }

          const duration = await audioManager.getDuration(audio);
          const gapMs = computeSegmentGapMs("read", duration);
          status.textContent = "Read along...";
          await waitMs(gapMs, { signal });
          status.textContent = "Listening...";
        }

        if (signal.aborted) {
          break;
        }

        clearHighlights(entry);
        await waitMs(getBetweenItemGapMs("read"), { signal });
      }

      if (!signal.aborted) {
        status.textContent = "Great work! Reading complete.";
      } else {
        status.textContent = "Playback stopped.";
      }
    } catch (error) {
      if (!signal.aborted) {
        console.error(error);
        status.textContent = "Unable to play audio.";
      }
    } finally {
      startBtn.disabled = false;
      sequenceAbort = null;
      autoTriggered = false;
      slide._autoTriggered = false;
    }
  };

  const startSequence = () => {
    autoTriggered = true;
    slide._autoTriggered = true;
    runSequence();
  };

  const triggerAutoPlay = () => {
    if (autoTriggered) {
      return;
    }
    startSequence();
  };

  startBtn.addEventListener("click", startSequence);

  const autoPlay = {
    button: startBtn,
    trigger: triggerAutoPlay,
    status,
  };

  const onLeave = () => {
    sequenceAbort?.abort();
    sequenceAbort = null;
    audioManager.stopAll();
    entries.forEach(clearHighlights);
    startBtn.disabled = false;
    status.textContent = "";
    autoTriggered = false;
    slide._autoTriggered = false;
  };

  const suffixSegment = context.subActivityLetter
    ? `-${context.subActivityLetter}`
    : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-listening1-read`
      : "activity-listening1-read",
    element: slide,
    autoPlay,
    onLeave,
  };
};

const buildTypingSlide = (items = [], context = {}) => {
  const {
    activityLabel = "Activity",
    subActivitySuffix = "",
    activityNumber = null,
  } = context;

  const sanitizedItems = (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const audio = normalizeString(item?.question_audio);
      const answer = normalizeString(item?.answer);
      if (!audio || !answer) {
        return null;
      }
      return {
        id: normalizeString(item?.id) || `typing_${index + 1}`,
        audio,
        answer,
      };
    })
    .filter(Boolean);

  const slide = document.createElement("section");
  slide.className =
    "slide slide--speaking listening-slide listening-slide--typing";
  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);

  const list = document.createElement("div");
  list.className = "listening-typing-grid";
  slide.appendChild(list);

  const instructionEl = slide.querySelector(".slide__instruction");
  if (instructionEl) {
    instructionEl.textContent = "";
  }

  const entries = sanitizedItems.map((item, index) => {
    const card = document.createElement("article");
    card.className =
      "dialogue-card dialogue-card--speaking listening-typing-card";

    const header = document.createElement("header");
    header.className = "listening-typing-header";
    const title = document.createElement("h3");
    title.className = "listening-typing-title";
    title.textContent = `Question ${index + 1}`;
    header.appendChild(title);

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "secondary-btn listening-play-btn";
    playBtn.textContent = "Play";
    playBtn.disabled = true;
    header.appendChild(playBtn);
    card.appendChild(header);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "listening-typing-input";
    input.autocomplete = "off";
    input.placeholder = "Type what you hear";
    input.disabled = true;
    card.appendChild(input);

    const actions = document.createElement("div");
    actions.className = "listening-typing-actions";
    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "primary-btn listening-check-btn";
    checkBtn.textContent = "Check Answer";
    checkBtn.disabled = true;
    actions.appendChild(checkBtn);
    card.appendChild(actions);

    const feedback = document.createElement("p");
    feedback.className = "listening-typing-feedback";
    feedback.textContent = "";
    card.appendChild(feedback);

    list.appendChild(card);

    return {
      item,
      card,
      playBtn,
      input,
      checkBtn,
    feedback,
  };
});

  const completedAttempts = new Set();
  let completionShown = false;

  const enableControls = () => {
    entries.forEach(({ playBtn, input, checkBtn }) => {
      playBtn.disabled = false;
      input.disabled = false;
      checkBtn.disabled = false;
    });
    if (instructionEl) {
      instructionEl.textContent = "Play each audio and type the number you hear.";
    }
  };

  const disableControls = () => {
    entries.forEach(({ playBtn, input, checkBtn }) => {
      playBtn.disabled = true;
      input.disabled = true;
      checkBtn.disabled = true;
    });
    if (instructionEl) {
      instructionEl.textContent = "";
    }
  };

  entries.forEach((entry) => {
    entry.input.addEventListener("input", () => {
      if (!entry.input.disabled) {
        entry.input.value = entry.input.value.replace(/[^0-9,.\s]/g, "");
      }
    });

    entry.input.addEventListener("keydown", (event) => {
      if (
        entry.input.disabled &&
        !["Tab", "Shift", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();
      }
    });

    entry.playBtn.addEventListener("click", () => {
      if (entry.playBtn.disabled) {
        return;
      }
      audioManager.stopAll();
      entry.card.classList.add("is-playing");
      entry.playBtn.disabled = true;
      audioManager
        .play(entry.item.audio)
        .catch((error) => console.error(error))
        .finally(() => {
          entry.card.classList.remove("is-playing");
          entry.playBtn.disabled = false;
        });
    });

    entry.checkBtn.addEventListener("click", () => {
      const attempt = normalizeString(entry.input.value);
      if (!attempt) {
        entry.feedback.textContent = "Please type an answer first.";
        entry.feedback.classList.remove(
          "is-correct",
          "is-incorrect",
          "is-neutral"
        );
        entry.feedback.classList.add("is-warning");
        return;
      }
      const isCorrect = attempt.toLowerCase() === entry.item.answer.toLowerCase();
      entry.feedback.classList.remove("is-warning", "is-neutral");
      if (isCorrect) {
        entry.feedback.textContent = "Correct!";
        entry.feedback.classList.remove("is-incorrect");
        entry.feedback.classList.add("is-correct");
      } else {
        entry.feedback.textContent = `Incorrect. Correct answer: ${entry.item.answer}`;
        entry.feedback.classList.remove("is-correct");
        entry.feedback.classList.add("is-incorrect");
      }
      completedAttempts.add(entry.item.id);
      if (
        !completionShown &&
        completedAttempts.size === entries.length
      ) {
        completionShown = true;
        showCompletionModal({
          title: "Great Work!",
          message: "You completed all of the questions.",
        });
      }
    });
  });

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Questions will be added soon.";
    slide.appendChild(empty);
  }

  const autoPlay = {
    trigger: () => {
      enableControls();
      slide._autoTriggered = true;
    },
  };

  const onLeave = () => {
    audioManager.stopAll();
    entries.forEach(({ input, feedback, card, playBtn, checkBtn }) => {
      input.value = "";
      feedback.textContent = "";
      feedback.className = "listening-typing-feedback";
      card.classList.remove("is-playing");
      playBtn.disabled = true;
      checkBtn.disabled = true;
    });
    completedAttempts.clear();
    completionShown = false;
    disableControls();
    if (instructionEl) {
      instructionEl.textContent = "";
    }
    slide._autoTriggered = false;
  };

  disableControls();

  const suffixSegment = context.subActivityLetter
    ? `-${context.subActivityLetter}`
    : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-listening1-type`
      : "activity-listening1-type",
    element: slide,
    autoPlay,
    onLeave,
  };
};

const createSubActivityContext = (base, letter) => ({
  activityLabel: base.activityLabel,
  subActivitySuffix: letter ? letter : "",
  subActivityLetter: letter || "",
  activityNumber: base.activityNumber,
});

export const buildListeningOneSlides = (activityData = {}, context = {}) => {
  const { activityNumber, focus } = context;
  const activityLabel = activityNumber
    ? `Activity ${activityNumber}`
    : "Activity";

  const baseContext = {
    activityLabel,
    activityNumber,
  };

  const repeatPauseMs = getRepeatPauseMs(activityData);

  const slides = [];

  const mcqItems = activityData?.content?.activity_4_a;
  if (Array.isArray(mcqItems) && mcqItems.length) {
    slides.push(
      buildMcqSlide(mcqItems, createSubActivityContext(baseContext, "a"))
    );
  }

  const repeatItems = activityData?.content?.activity_4_b;
  if (Array.isArray(repeatItems) && repeatItems.length) {
    slides.push(
      buildListenRepeatSlide(
        repeatItems,
        createSubActivityContext(baseContext, "b"),
        { repeatPauseMs }
      )
    );
  }

  const readItems = activityData?.content?.activity_4_c;
  if (Array.isArray(readItems) && readItems.length) {
    slides.push(
      buildReadAlongSlide(readItems, createSubActivityContext(baseContext, "c"))
    );
  }

  const typingItems = activityData?.content?.activity_4_d;
  if (Array.isArray(typingItems) && typingItems.length) {
    slides.push(
      buildTypingSlide(typingItems, createSubActivityContext(baseContext, "d"))
    );
  }

  return slides;
};
