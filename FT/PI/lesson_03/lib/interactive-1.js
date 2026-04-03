import {
  createGameScene,
  DEFAULT_FEEDBACK_ASSETS,
  sanitizeOptions,
  normalizeExamples,
  normalizeQuestions,
} from "./games/game-1.js";
import {
  createMatchingGameScene,
  normalizeMatchingPairs,
} from "./games/game-4.js";
import {
  createPracticeGameScene,
  normalizePracticeExamples,
  normalizePracticePrompts,
  sanitizePracticeTimings,
} from "./games/game-5.js";

const GAME_INSTRUCTION_TEXT =
  "Press Start to play. Listen to each sentence and choose the correct answer before time runs out.";
const MATCHING_INSTRUCTION_TEXT =
  "Match each keyword with its picture. Select a word and connect it to the correct image.";
const PRACTICE_INSTRUCTION_TEXT =
  "Press Start to practice. Use the highlighted words to build questions, then check the model question and answer.";

const trimText = (value) => (typeof value === "string" ? value.trim() : "");
const GAME_MODES = {
  QUIZ: "quiz",
  MATCHING: "matching",
  PRACTICE: "practice",
};

const getPhaser = () => window?.Phaser;

const isMatchingEntry = (entry) => {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  const hasKeyword =
    typeof entry.keyword === "string" && entry.keyword.trim().length > 0;
  const hasImage =
    typeof entry.image === "string" && entry.image.trim().length > 0;
  const hasQuestionFields =
    typeof entry.sentence === "string" ||
    Array.isArray(entry.options) ||
    typeof entry.answer === "string";
  return hasKeyword && hasImage && !hasQuestionFields;
};

const isPracticeEntry = (entry) => {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  const hasWords =
    typeof entry.words === "string" && entry.words.trim().length > 0;
  const hasPracticeDetail =
    typeof entry.txt_question === "string" ||
    typeof entry.txt_answer === "string" ||
    typeof entry.audio_question === "string" ||
    typeof entry.audio_answer === "string";
  return hasWords && hasPracticeDetail;
};

const determineGameMode = (entries = []) => {
  const sample = entries.find(
    (item) => item && typeof item === "object" && !Array.isArray(item)
  );
  if (sample && isPracticeEntry(sample)) {
    return GAME_MODES.PRACTICE;
  }
  if (sample && isMatchingEntry(sample)) {
    return GAME_MODES.MATCHING;
  }
  return GAME_MODES.QUIZ;
};

const resolveContentList = (value, fallback = []) => {
  if (Array.isArray(value?.content)) {
    return value.content;
  }
  if (Array.isArray(value?.questions)) {
    return value.questions;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return fallback;
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

const buildSlideId = (activityNumber, letter = "", mode = "game1") => {
  const suffix = letter ? `-${letter}` : "";
  const modeSuffix = mode ? `-${mode}` : "";
  if (activityNumber) {
    return `activity-${activityNumber}${suffix}${modeSuffix}`;
  }
  return `activity${suffix}${modeSuffix}`;
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

const createMatchingSlide = (gameConfig = {}, context = {}) => {
  const { slideId, activityLabel, focusText, includeFocus } = context;

  const slide = document.createElement("section");
  slide.className = "slide game-slide";
  if (slideId) {
    slide.id = slideId;
  }

  const title = document.createElement("h2");
  title.textContent = trimText(activityLabel) || "Matching Game";
  slide.appendChild(title);

  if (includeFocus && focusText) {
    insertFocusElement(title, focusText);
  }

  const instruction = document.createElement("p");
  instruction.className = "slide__instruction";
  instruction.textContent = MATCHING_INSTRUCTION_TEXT;
  slide.appendChild(instruction);

  const wrapper = document.createElement("div");
  wrapper.className = "game1-shell game4-shell";

  const stage = document.createElement("div");
  stage.className = "game1-stage game4-stage";
  const stageId = `game4-stage-${Math.random().toString(36).slice(2, 8)}`;
  stage.id = stageId;

  const status = document.createElement("p");
  status.className = "game1-status game4-status is-visible";
  status.textContent = "Loading game...";

  wrapper.append(stage, status);
  slide.appendChild(wrapper);

  const backgroundImage =
    gameConfig?.bg_image ?? gameConfig?.backgroundImage ?? null;
  const pairs = normalizeMatchingPairs(
    Array.isArray(gameConfig?.pairs) ? gameConfig.pairs : gameConfig?.content
  );
  const feedbackAssets = cloneFeedbackAssets();

  if (!pairs.length) {
    status.textContent = "The matching content is not ready yet.";
    return {
      id: slideId,
      element: slide,
      onEnter: () => {},
      onLeave: () => {},
    };
  }

  let gameInstance = null;

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

    const GameScene = createMatchingGameScene({
      pairs,
      backgroundImage,
      feedbackAssets,
      statusElement: status,
      onRoundUpdate: (info = {}) => {
        const completedMatches = info.completedMatches ?? 0;
        const total = info.total ?? pairs.length;
        if (info.completed) {
          status.textContent = `Matches complete - ${info.correctMatches ?? completedMatches}/${
            info.total ?? total
          } correct`;
          status.classList.remove("is-transparent");
        } else {
          status.textContent = `Match progress: ${completedMatches}/${total}`;
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

const createPracticeSlide = (gameConfig = {}, context = {}) => {
  const { slideId, activityLabel, focusText, includeFocus } = context;

  const slide = document.createElement("section");
  slide.className = "slide game-slide";
  if (slideId) {
    slide.id = slideId;
  }

  const title = document.createElement("h2");
  title.textContent = trimText(activityLabel) || "Practice Game";
  slide.appendChild(title);

  if (includeFocus && focusText) {
    insertFocusElement(title, focusText);
  }

  const instruction = document.createElement("p");
  instruction.className = "slide__instruction";
  instruction.textContent = PRACTICE_INSTRUCTION_TEXT;
  slide.appendChild(instruction);

  const wrapper = document.createElement("div");
  wrapper.className = "game1-shell game5-shell";

  const stage = document.createElement("div");
  stage.className = "game1-stage game5-stage";
  const stageId = `game5-stage-${Math.random().toString(36).slice(2, 8)}`;
  stage.id = stageId;

  const status = document.createElement("p");
  status.className = "game1-status game5-status is-visible";
  status.textContent = "Loading practice...";

  wrapper.append(stage, status);
  slide.appendChild(wrapper);

  const examples = normalizePracticeExamples(gameConfig?.examples);
  const prompts = normalizePracticePrompts(gameConfig?.content);
  const backgroundImage =
    gameConfig?.bg_image ?? gameConfig?.backgroundImage ?? null;
  const timings = sanitizePracticeTimings(gameConfig?.timings);

  if (!prompts.length) {
    status.textContent = "The practice content is not ready yet.";
    return {
      id: slideId,
      element: slide,
      onEnter: () => {},
      onLeave: () => {},
    };
  }

  let gameInstance = null;

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

    status.textContent = "Loading practice...";
    status.classList.remove("is-error");
    status.classList.remove("is-transparent");
    status.classList.add("is-visible");

    const GameScene = createPracticeGameScene({
      examples,
      prompts,
      backgroundImage,
      timings,
      statusElement: status,
      onRoundUpdate: (info = {}) => {
        const phaseLabels = {
          words: "Build a question",
          question: "Answer the question",
          answer: "Check the answer",
        };
        if (info.mode === "examples" || info.mode === "practice") {
          const prefix = info.mode === "examples" ? "Example" : "Question";
          const baseLabel =
            Number.isInteger(info.index) && Number.isInteger(info.total)
              ? `${prefix} ${info.index + 1} of ${info.total}`
              : prefix;
          const phaseLabel = info.phase ? phaseLabels[info.phase] || "" : "";
          status.textContent = phaseLabel
            ? `${baseLabel} - ${phaseLabel}`
            : baseLabel;
          if (info.mode === "practice") {
            if (info.phase === "words") {
              status.classList.remove("is-transparent");
            } else {
              status.classList.add("is-transparent");
            }
          } else {
            status.classList.remove("is-transparent");
          }
          status.classList.add("is-visible");
          return;
        }
        if (info.mode === "countdown") {
          status.textContent = `Get ready... ${info.countdownValue || ""}`;
          status.classList.remove("is-transparent");
          status.classList.add("is-visible");
          return;
        }
        if (info.mode === "complete") {
          status.textContent = "Practice finished. Press Replay to continue.";
          status.classList.remove("is-transparent");
          status.classList.add("is-visible");
        }
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
    status.textContent = "Practice paused. Reopen this slide to play again.";
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

const collectGameActivities = (activityData = {}) => {
  const content = activityData?.content;
  const baseOptions = activityData?.options;
  const baseExamples = activityData?.examples;
  const defaultBackground =
    activityData?.bg_image ?? activityData?.backgroundImage ?? null;

  const buildActivityPayload = (value, fallbackEntries = []) => {
    const entries = resolveContentList(value, fallbackEntries);
    const mode = determineGameMode(entries);
    return {
      mode,
    data: {
      options: value?.options ?? baseOptions,
      examples: value?.examples ?? baseExamples,
      content: entries,
      pairs: entries,
      bg_image: value?.bg_image ?? value?.backgroundImage ?? defaultBackground,
      timings: value?.timings ?? activityData?.timings ?? null,
    },
  };
};

  if (content && typeof content === "object" && !Array.isArray(content)) {
    return Object.entries(content)
      .map(([key, value], index) => {
        if (!value || typeof value !== "object") {
          return null;
        }
        const letter = deriveSubActivityLetter(key, index);
        const activity = buildActivityPayload(value);
        return activity
          ? {
              key,
              letter,
              mode: activity.mode,
              data: activity.data,
            }
          : null;
      })
      .filter(Boolean);
  }

  const legacyEntries = resolveContentList(content);
  if (legacyEntries.length) {
    const activity = buildActivityPayload(
      { content: legacyEntries },
      legacyEntries
    );
    return [
      {
        key: "activity_a",
        letter: "a",
        mode: activity.mode,
        data: activity.data,
      },
    ];
  }

  return [];
};

export const buildInteractive1Slides = (activityData = {}, context = {}) => {
  const { activityNumber, focus } = context;
  const focusText = trimText(focus);
  const activities = collectGameActivities(activityData);

  if (!activities.length) {
    return [
      createGameSlide(
        { content: [] },
        {
          slideId: buildSlideId(activityNumber, "", "game1"),
          activityLabel: formatActivityLabel(activityNumber, ""),
          focusText,
          includeFocus: Boolean(focusText),
        }
      ),
    ];
  }

  return activities.map((activity, index) => {
    const mode = activity.mode || GAME_MODES.QUIZ;
    const slideContext = {
      slideId: buildSlideId(
        activityNumber,
        activity.letter,
        mode === GAME_MODES.MATCHING
          ? "game4"
          : mode === GAME_MODES.PRACTICE
          ? "game5"
          : "game1"
      ),
      activityLabel: formatActivityLabel(activityNumber, activity.letter),
      focusText,
      includeFocus: Boolean(focusText) && index === 0,
    };
    if (mode === GAME_MODES.MATCHING) {
      return createMatchingSlide(activity.data, slideContext);
    }
    if (mode === GAME_MODES.PRACTICE) {
      return createPracticeSlide(activity.data, slideContext);
    }
    return createGameSlide(activity.data, slideContext);
  });
};
