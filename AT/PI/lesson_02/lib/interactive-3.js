import {
  createGameScene,
  DEFAULT_FEEDBACK_ASSETS,
  sanitizeOptions,
  normalizeExamples,
  normalizeQuestions,
} from "./games/game-1.js";

const GAME_INSTRUCTION_TEXT =
  "Press Start to play. Listen to each sentence and choose the correct answer before time runs out.";

const trimText = (value) => (typeof value === "string" ? value.trim() : "");

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

const buildSlideId = (activityNumber, letter = "", role = "game1") => {
  const suffix = letter ? `-${letter}` : "";
  if (activityNumber) {
    return `activity-${activityNumber}${suffix}-${role}`;
  }
  return `activity${suffix}-${role}`;
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

const normalizeSentenceGroups = (input) => {
  if (!input) {
    return [];
  }

  const source = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray(input.sentences)
    ? input.sentences
    : [];

  return source
    .map((group) => {
      if (Array.isArray(group)) {
        return group.map((item) => trimText(item)).filter(Boolean);
      }
      const trimmed = trimText(group);
      return trimmed ? [trimmed] : [];
    })
    .filter((group) => group.length);
};

const createSentenceListSlide = (groups = [], context = {}) => {
  const { slideId, activityLabel, focusText, includeFocus } = context;

  const slide = document.createElement("section");
  slide.className = "slide interactive3-reading-slide";
  if (slideId) {
    slide.id = slideId;
  }

  const title = document.createElement("h2");
  title.textContent = trimText(activityLabel) || "Activity";
  slide.appendChild(title);

  if (includeFocus && focusText) {
    insertFocusElement(title, focusText);
  }

  const instruction = document.createElement("p");
  instruction.className = "slide__instruction";
  instruction.textContent = "Read the sentences below.";
  slide.appendChild(instruction);

  if (!groups.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Sentence list is not available yet.";
    slide.appendChild(emptyState);
    return {
      id: slideId,
      element: slide,
      onEnter: () => {},
      onLeave: () => {},
    };
  }

  const board = document.createElement("div");
  board.className = "sentence-groups";

  groups.forEach((group) => {
    const card = document.createElement("div");
    card.className = "sentence-group-card";

    const list = document.createElement("ul");
    list.className = "sentence-group-card__list";

    group.forEach((sentence) => {
      const item = document.createElement("li");
      item.textContent = sentence;
      list.appendChild(item);
    });

    card.appendChild(list);
    board.appendChild(card);
  });

  slide.appendChild(board);

  return {
    id: slideId,
    element: slide,
    onEnter: () => {},
    onLeave: () => {},
  };
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

const collectInteractiveActivities = (activityData = {}) => {
  const content = activityData?.content;
  const baseOptions = activityData?.options;
  const baseExamples = activityData?.examples;
  const defaultBackground =
    activityData?.bg_image ?? activityData?.backgroundImage ?? null;
  const activities = [];

  const createGameData = (value) => ({
    options:
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.options
        ? value.options
        : baseOptions,
    examples:
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.examples
        ? value.examples
        : baseExamples,
    content: Array.isArray(value)
      ? value
      : Array.isArray(value?.content)
      ? value.content
      : Array.isArray(value?.questions)
      ? value.questions
      : [],
    bg_image:
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value.bg_image ?? value.backgroundImage)
        ? value.bg_image ?? value.backgroundImage
        : defaultBackground,
  });

  if (content && typeof content === "object" && !Array.isArray(content)) {
    Object.entries(content).forEach(([key, value], index) => {
      const letter = deriveSubActivityLetter(key, index);
      const sentenceGroups = normalizeSentenceGroups(value);
      if (sentenceGroups.length) {
        activities.push({
          key,
          letter,
          kind: "sentences",
          data: { groups: sentenceGroups },
        });
        return;
      }

      if (value) {
        activities.push({
          key,
          letter,
          kind: "game",
          data: createGameData(value),
        });
      }
    });
    return activities;
  }

  if (Array.isArray(content)) {
    const sentenceGroups = normalizeSentenceGroups(content);
    if (sentenceGroups.length) {
      activities.push({
        key: "activity_a",
        letter: "a",
        kind: "sentences",
        data: { groups: sentenceGroups },
      });
      return activities;
    }

    if (content.length) {
      activities.push({
        key: "activity_a",
        letter: "a",
        kind: "game",
        data: {
          options: baseOptions,
          examples: baseExamples,
          content,
          bg_image: defaultBackground,
        },
      });
    }
    return activities;
  }

  return activities;
};

export const buildInteractive3Slides = (activityData = {}, context = {}) => {
  const { activityNumber, focus } = context;
  const focusText = trimText(focus);
  const activities = collectInteractiveActivities(activityData);

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
    const commonContext = {
      slideId: buildSlideId(
        activityNumber,
        activity.letter,
        activity.kind === "sentences" ? "reading" : "game1"
      ),
      activityLabel: formatActivityLabel(activityNumber, activity.letter),
      focusText,
      includeFocus: Boolean(focusText) && index === 0,
    };

    if (activity.kind === "sentences") {
      return createSentenceListSlide(activity.data?.groups ?? [], commonContext);
    }

    return createGameSlide(activity.data, commonContext);
  });
};
