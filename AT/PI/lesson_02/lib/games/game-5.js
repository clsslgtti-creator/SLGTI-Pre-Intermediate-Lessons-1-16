const DEFAULT_BACKGROUND_IMAGE = "assets/img/game/bg-1.jpg";
const PRIMARY_BLUE = 0x1f6feb;
const PRIMARY_TEXT = "#0f172a";
const SECONDARY_BLUE_TEXT = "#1d4ed8";
const ACCENT_SKY = 0x0ea5e9;
const WORDS_LABEL_COLOR = "#0ea5e9";
const QUESTION_LABEL_COLOR = "#1d4ed8";
const ANSWER_LABEL_COLOR = "#16a34a";
const WORDS_VALUE_COLOR = "#0f172a";
const QUESTION_VALUE_COLOR = "#102663ff";
const ANSWER_VALUE_COLOR = "#065f46";

const trimText = (value) => (typeof value === "string" ? value.trim() : "");

const clampDuration = (value, fallback) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }
  return Math.min(numericValue, 60000);
};

export const DEFAULT_PRACTICE_TIMINGS = {
  buildMs: 8000,
  responseMs: 10000,
  revealMs: 5000,
  betweenMs: 3000,
};

export const sanitizePracticeTimings = (rawTimings = {}) => {
  if (!rawTimings || typeof rawTimings !== "object") {
    return { ...DEFAULT_PRACTICE_TIMINGS };
  }
  return {
    buildMs: clampDuration(rawTimings.buildMs, DEFAULT_PRACTICE_TIMINGS.buildMs),
    responseMs: clampDuration(
      rawTimings.responseMs,
      DEFAULT_PRACTICE_TIMINGS.responseMs
    ),
    revealMs: clampDuration(
      rawTimings.revealMs,
      DEFAULT_PRACTICE_TIMINGS.revealMs
    ),
    betweenMs: clampDuration(
      rawTimings.betweenMs,
      DEFAULT_PRACTICE_TIMINGS.betweenMs
    ),
  };
};

const buildAudioKey = (prefix, id) =>
  `${prefix}_${String(id || "")
    .replace(/\s+/g, "_")
    .toLowerCase()}`;

export const normalizePracticeItems = (items = []) => {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const id = item.id || `practice_${index + 1}`;
      const words = trimText(item.words);
      const question = trimText(item.txt_question);
      const answer = trimText(item.txt_answer);
      const image =
        typeof item.image === "string" && item.image.trim().length
          ? item.image.trim()
          : null;
      const questionAudio =
        typeof item.audio_question === "string" &&
        item.audio_question.trim().length
          ? item.audio_question.trim()
          : null;
      const answerAudio =
        typeof item.audio_answer === "string" &&
        item.audio_answer.trim().length
          ? item.audio_answer.trim()
          : null;
      if (!words && !question && !answer) {
        return null;
      }
      return {
        id,
        words,
        question,
        answer,
        questionAudio,
        answerAudio,
        questionAudioKey: questionAudio ? buildAudioKey("practice_q", id) : null,
        answerAudioKey: answerAudio ? buildAudioKey("practice_a", id) : null,
        image,
        imageKey: image ? buildAudioKey("practice_img", id) : null,
      };
    })
    .filter(Boolean);
};

export const normalizePracticeExamples = (items = []) =>
  normalizePracticeItems(items);

export const normalizePracticePrompts = (items = []) =>
  normalizePracticeItems(items);

const createRoundedPanel = (
  scene,
  width,
  height,
  radius = 24,
  initialStyle = {}
) => {
  const graphics = scene.add.graphics();
  const style = {
    fillColor: 0xffffff,
    fillAlpha: 1,
    strokeColor: 0x2563eb,
    strokeAlpha: 0.35,
    lineWidth: 3,
    ...initialStyle,
  };

  const redraw = (nextStyle = {}) => {
    Object.assign(style, nextStyle);
    graphics.clear();
    if (style.lineWidth > 0) {
      graphics.lineStyle(style.lineWidth, style.strokeColor, style.strokeAlpha);
    }
    graphics.fillStyle(style.fillColor, style.fillAlpha);
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    if (style.lineWidth > 0) {
      graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
    }
  };

  redraw();

  return {
    graphics,
    update: redraw,
    getStyle: () => ({ ...style }),
  };
};

const createButton = (scene, label, width, height, options = {}) => {
  const { onClick, baseColor = PRIMARY_BLUE } = options;
  const baseColorObj = Phaser.Display.Color.IntegerToColor(baseColor);
  const hoverColor = Phaser.Display.Color.GetColor(
    Math.min(baseColorObj.red + 25, 255),
    Math.min(baseColorObj.green + 25, 255),
    Math.min(baseColorObj.blue + 25, 255)
  );

  const styles = {
    base: {
      fillColor: baseColor,
      fillAlpha: 1,
      strokeColor: baseColor,
      strokeAlpha: 0.9,
      lineWidth: 0,
    },
    hover: {
      fillColor: hoverColor,
      fillAlpha: 1,
      strokeColor: baseColor,
      strokeAlpha: 0.9,
      lineWidth: 0,
    },
    disabled: {
      fillColor: 0xa1a1aa,
      fillAlpha: 1,
      strokeColor: 0x71717a,
      strokeAlpha: 0.8,
      lineWidth: 0,
    },
  };

  const background = createRoundedPanel(
    scene,
    width,
    height,
    Math.min(height / 2, 110)
  );
  background.update(styles.base);

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
      fontSize: Math.min(100, height * 0.55),
      color: "#ffffff",
      fontStyle: "bold",
    })
    .setOrigin(0.5);

  const container = scene.add.container(0, 0, [background.graphics, text]);
  container.setSize(width, height);
  container.setDepth(7);
  container.setInteractive({ useHandCursor: true });

  const updateStyle = (style) => background.update(style);

  container.on("pointerover", () => {
    if (container.input?.enabled) {
      updateStyle(styles.hover);
    }
  });
  container.on("pointerout", () => {
    if (container.input?.enabled) {
      updateStyle(styles.base);
    }
  });
  container.on("pointerdown", () => {
    if (!container.input?.enabled) {
      return;
    }
    updateStyle(styles.hover);
  });
  container.on("pointerup", () => {
    if (!container.input?.enabled) {
      return;
    }
    updateStyle(styles.base);
    if (typeof onClick === "function") {
      onClick();
    }
  });

  const setDisabled = (disabled) => {
    if (disabled) {
      container.disableInteractive();
      updateStyle(styles.disabled);
    } else {
      container.setInteractive({ useHandCursor: true });
      updateStyle(styles.base);
    }
  };

  return {
    container,
    text,
    background,
    styles,
    setDisabled,
    setLabel: (value) => text.setText(value),
  };
};

export const createPracticeGameScene = (config = {}) => {
  const {
    examples = [],
    prompts = [],
    backgroundImage,
    timings,
    statusElement,
    onRoundUpdate,
  } = config;

  const sanitizedTimings = sanitizePracticeTimings(timings);

  class PracticeGameScene extends Phaser.Scene {
    constructor() {
      super("PracticeGameScene");
      this.shouldAutoStart = false;
      this.resetState();
    }

    init(data = {}) {
      this.shouldAutoStart = Boolean(data.autoStart);
      this.resetState();
    }

    resetState() {
      this.examples = Array.isArray(examples) ? [...examples] : [];
      this.prompts = Array.isArray(prompts) ? [...prompts] : [];
      this.timings = { ...sanitizedTimings };
      this.currentExampleIndex = -1;
      this.currentPromptIndex = -1;
      this.countdownShown = this.examples.length === 0;
      this.stageTimerEvent = null;
      this.stageTimerEndsAt = 0;
      this.stageTimerLabel = "";
      this.pendingEvents = [];
      this.countdownEvents = [];
      this.countdownActive = false;
      this.sessionComplete = false;
      this.activeAudio = null;
      this.activeAudioToken = 0;
      this.activeAudioCompleteHandler = null;
      this.currentRound = null;
      this.stagePhase = "idle";
      this.gameUiElements = [];
      this.cardDisplayed = false;
      this.activeCardTween = null;
      this.hudHiddenForCountdown = false;
    }

    preload() {
      const bgAsset =
        typeof backgroundImage === "string" && backgroundImage.trim().length
          ? backgroundImage.trim()
          : DEFAULT_BACKGROUND_IMAGE;

      this.load.once("complete", () => {
        if (!statusElement) {
          return;
        }
        statusElement.textContent = "Press Start to practice.";
        statusElement.classList.add("is-visible");
        statusElement.classList.remove("is-error");
        statusElement.classList.remove("is-transparent");
      });

      [...this.examples, ...this.prompts].forEach((entry) => {
        if (entry?.questionAudioKey && entry.questionAudio) {
          this.load.audio(entry.questionAudioKey, entry.questionAudio);
        }
        if (entry?.answerAudioKey && entry.answerAudio) {
          this.load.audio(entry.answerAudioKey, entry.answerAudio);
        }
        if (entry?.imageKey && entry.image) {
          this.load.image(entry.imageKey, entry.image);
        }
      });

      this.load.image("practice-bg", bgAsset);
    }

    create() {
      this.cameras.main.setBackgroundColor("#eef2f9");
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
      this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
      this.input.on("pointerdown", this.requestFullscreen, this);
      const gameSize = this.scale?.gameSize;
      const width =
        gameSize?.width ?? this.sys.game.config.width ?? this.sys.game.canvas.width;
      const height =
        gameSize?.height ?? this.sys.game.config.height ?? this.sys.game.canvas.height;

      this.backgroundImage = this.add
        .image(width / 2, height / 2, "practice-bg")
        .setOrigin(0.5);
      this.backgroundImage.setDepth(0);
      this.backgroundImage.setDisplaySize(width, height);

      const accentLeft = this.add.circle(width * 0.2, height * 0.85, 160, PRIMARY_BLUE, 0.08);
      const accentRight = this.add.circle(width * 0.82, height * 0.2, 200, ACCENT_SKY, 0.08);
      accentLeft.setBlendMode(Phaser.BlendModes.SCREEN);
      accentRight.setBlendMode(Phaser.BlendModes.SCREEN);

      const phasePanel = createRoundedPanel(this, 420, 78, 28);
      phasePanel.update({
        fillColor: 0xffffff,
        fillAlpha: 0.92,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.4,
        lineWidth: 3,
      });
      this.phaseText = this.add
        .text(0, 0, "Practice Ready", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: 32,
          fontStyle: "bold",
          color: PRIMARY_TEXT,
        })
        .setOrigin(0.5);
      this.phaseContainer = this.add
        .container(360, 60, [phasePanel.graphics, this.phaseText])
        .setDepth(2);

      const timerPanel = createRoundedPanel(this, 220, 64, 20);
      timerPanel.update({
        fillColor: 0xffffff,
        fillAlpha: 0.8,
        strokeColor: PRIMARY_BLUE,
        strokeAlpha: 0.3,
        lineWidth: 2,
      });
      this.timerText = this.add
        .text(0, 0, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: 26,
          fontStyle: "bold",
          color: SECONDARY_BLUE_TEXT,
        })
        .setOrigin(0.5);
      this.timerBadge = this.add
        .container(width - 260, 50, [timerPanel.graphics, this.timerText])
        .setDepth(2);

      const cardWidth = 980;
      const cardHeight = 420;
      this.cardWidth = cardWidth;
      this.cardHeight = cardHeight;
      const cardPanel = createRoundedPanel(this, cardWidth, cardHeight, 32, {
        fillColor: 0xffffff,
        fillAlpha: 0.98,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.45,
        lineWidth: 4,
      });

      const imageColumnWidth = 250;
      const imageColumnHeight = cardHeight - 80;
      this.cardImageMaxWidth = 200;
      this.cardImageMaxHeight = imageColumnHeight - 40;
      this.cardImageColumnHeight = imageColumnHeight;
      const imagePanel = createRoundedPanel(
        this,
        imageColumnWidth - 20,
        imageColumnHeight,
        28,
        {
          fillColor: 0xf8fafc,
          fillAlpha: 1,
          strokeColor: 0x93c5fd,
          strokeAlpha: 0.35,
          lineWidth: 2,
        }
      );
      this.cardImage = this.add.image(0, 0, "");
      this.cardImage.setVisible(false);
      this.cardImage.setActive(false);
      this.cardImageContainer = this.add.container(
        -cardWidth / 2 + imageColumnWidth / 2 + 10,
        0,
        [imagePanel.graphics, this.cardImage]
      );

      const sectionStartX = -cardWidth / 2 + imageColumnWidth + 40;
      const sectionWidth = cardWidth - imageColumnWidth - 80;
      const createCardSection = (
        offsetY,
        labelText,
        labelColor,
        valueColor
      ) => {
        const label = this.add
          .text(sectionStartX, offsetY, labelText.toUpperCase(), {
            fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
            fontSize: 18,
            fontStyle: "bold",
            color: labelColor,
            letterSpacing: 2,
            align: "left",
          })
          .setOrigin(0, 0);
        const value = this.add
          .text(sectionStartX, offsetY + 30, "", {
            fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
            fontSize: 30,
            color: valueColor,
            align: "left",
            lineSpacing: 6,
            wordWrap: { width: sectionWidth },
          })
          .setOrigin(0, 0);
        return { label, value };
      };

      this.cardSections = {
        words: createCardSection(
          -cardHeight / 2 + 40,
          "Words",
          WORDS_LABEL_COLOR,
          WORDS_VALUE_COLOR
        ),
        question: createCardSection(
          -cardHeight / 2 + 170,
          "Question",
          QUESTION_LABEL_COLOR,
          QUESTION_VALUE_COLOR
        ),
        answer: createCardSection(
          -cardHeight / 2 + 300,
          "Answer",
          ANSWER_LABEL_COLOR,
          ANSWER_VALUE_COLOR
        ),
      };
      Object.values(this.cardSections).forEach((section) => {
        section.label.setAlpha(0);
        section.value.setAlpha(0);
      });

      this.cardContainer = this.add
        .container(width / 2, height / 2, [
          cardPanel.graphics,
          this.cardImageContainer,
          this.cardSections.words.label,
          this.cardSections.words.value,
          this.cardSections.question.label,
          this.cardSections.question.value,
          this.cardSections.answer.label,
          this.cardSections.answer.value,
        ])
        .setDepth(2);

      const instructionWidth = 980;
      const instructionHeight = 90;
      const instructionPanel = createRoundedPanel(
        this,
        instructionWidth,
        instructionHeight,
        30
      );
      instructionPanel.update({
        fillColor: 0xffffff,
        fillAlpha: 0.92,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.35,
        lineWidth: 3,
      });
      this.instructionText = this.add
        .text(0, 0, "Press Start to begin.", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: 28,
          color: PRIMARY_TEXT,
        })
        .setOrigin(0.5);
      this.instructionContainer = this.add
        .container(width / 2, height - instructionHeight / 2 - 20, [
          instructionPanel.graphics,
          this.instructionText,
        ])
        .setDepth(2);

      this.startButton = createButton(
        this,
        "Start",
        512,
        202,
        {
          onClick: () => this.handleStartPressed(false),
          baseColor: PRIMARY_BLUE,
        }
      );
      this.startButton.container.setPosition(width / 2, height / 2);
      this.startButton.container.setDepth(6);
      this.tweens.add({
        targets: this.startButton.container,
        scale: 1.04,
        duration: 500,
        ease: "Sine.easeInOut",
        repeat: -1,
        yoyo: true,
      });

      this.countdownBackdrop = this.add
        .rectangle(0, 0, width, height, 0x0f172a, 0.55)
        .setOrigin(0)
        .setAlpha(0);
      this.countdownText = this.add
        .text(width / 2, height / 2, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: 128,
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.countdownOverlay = this.add.container(0, 0, [
        this.countdownBackdrop,
        this.countdownText,
      ]);
      this.countdownOverlay.setDepth(5);

      this.summaryBackdrop = this.add
        .rectangle(width / 2, height / 2, width, height, 0x0f172a, 0.45)
        .setDepth(18);
      this.summaryBackdrop.setAlpha(0);
      this.summaryBackdrop.setVisible(false);

      this.summaryOverlay = this.add.container(width / 2, height / 2);
      this.summaryOverlay.setDepth(19);
      const summaryPanel = createRoundedPanel(this, 760, 420, 36);
      summaryPanel.update({
        fillColor: 0xffffff,
        fillAlpha: 0.98,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.35,
        lineWidth: 4,
      });
      this.summaryTitle = this.add
        .text(0, -110, "Practice complete!", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: 40,
          color: PRIMARY_TEXT,
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.summaryBody = this.add
        .text(0, -20, "Replay the prompts or quit to review instructions.", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: 26,
          color: PRIMARY_TEXT,
          align: "center",
          wordWrap: { width: 560 },
        })
        .setOrigin(0.5);

      const replayButton = createButton(this, "Replay", 280, 96, {
        onClick: () => this.restartPractice(true),
        baseColor: PRIMARY_BLUE,
      });
      replayButton.container.setPosition(-170, 120);

      const exitButton = createButton(this, "Quit", 280, 96, {
        onClick: () => this.exitPracticeToIdleState(),
        baseColor: 0x334155,
      });
      exitButton.container.setPosition(170, 120);

      this.summaryButtons = { replay: replayButton, exit: exitButton };
      this.summaryOverlay.add([
        summaryPanel.graphics,
        this.summaryTitle,
        this.summaryBody,
        replayButton.container,
        exitButton.container,
      ]);
      this.summaryOverlay.setVisible(false);
      this.summaryOverlay.setAlpha(0);

      this.gameUiElements = [
        this.phaseContainer,
        this.timerBadge,
        this.cardContainer,
        this.instructionContainer,
      ];
      this.setGameUiVisible(false);

      if (this.shouldAutoStart) {
        this.time.delayedCall(750, () => this.handleStartPressed(true));
      }
    }

    update() {
      if (!this.timerText) {
        return;
      }
      if (this.stageTimerEndsAt > 0) {
        const remaining = Math.max(
          0,
          this.stageTimerEndsAt - this.time.now
        );
        this.timerText.setText(
          this.stageTimerLabel
            ? `${this.stageTimerLabel}: ${(remaining / 1000).toFixed(1)}s`
            : `${(remaining / 1000).toFixed(1)}s`
        );
      } else {
        this.timerText.setText("");
      }
    }

    handleStartPressed(autoStart) {
      if (!this.prompts.length) {
        if (statusElement) {
          statusElement.textContent = "Practice content is not available.";
          statusElement.classList.add("is-error");
          statusElement.classList.add("is-visible");
        }
        return;
      }

      this.hideCompletionModal(true);
      this.sessionComplete = false;
      this.startButton.setDisabled(true);
      this.startButton.container.setVisible(false);
      this.setGameUiVisible(true);
      this.currentExampleIndex = -1;
      this.currentPromptIndex = -1;
      this.countdownShown = this.examples.length === 0;
      this.stagePhase = "words";
      this.phaseText.setText("Practice Starting");
      this.instructionText.setText("Get ready. First example is loading...");
      if (!autoStart && statusElement) {
        statusElement.textContent = "Practice running...";
        statusElement.classList.remove("is-error");
        statusElement.classList.add("is-visible");
        statusElement.classList.add("is-transparent");
      }
      this.stopStageTimer();
      this.cancelPendingEvents();
      this.stopActiveAudio();
      this.hideCountdown(true);
      this.cardDisplayed = false;
      this.runNextStep();
    }

    runNextStep() {
      if (this.sessionComplete) {
        return;
      }
      this.stopStageTimer();
      this.stopActiveAudio();
      this.stagePhase = "words";

      if (
        this.examples.length &&
        this.currentExampleIndex < this.examples.length - 1
      ) {
        this.currentExampleIndex += 1;
        const entry = this.examples[this.currentExampleIndex];
        this.presentRound(entry, {
          mode: "examples",
          index: this.currentExampleIndex,
          total: this.examples.length,
        });
        return;
      }

      if (this.examples.length && !this.countdownShown) {
        this.countdownShown = true;
        this.slideCardOut(() => {
          this.playCountdown(() => this.runNextStep());
        });
        return;
      }

      if (
        this.prompts.length &&
        this.currentPromptIndex < this.prompts.length - 1
      ) {
        this.currentPromptIndex += 1;
        const entry = this.prompts[this.currentPromptIndex];
        this.presentRound(entry, {
          mode: "practice",
          index: this.currentPromptIndex,
          total: this.prompts.length,
        });
        return;
      }

      this.finishSession();
    }

    presentRound(entry, context) {
      this.currentRound = { entry, context };
      const labelPrefix =
        context.mode === "examples" ? "Example" : "Question";
      this.phaseText.setText(
        `${labelPrefix} ${context.index + 1} of ${context.total}`
      );
      this.phaseText.setColor(
        context.mode === "examples" ? PRIMARY_TEXT : SECONDARY_BLUE_TEXT
      );
      const updateCard = () => {
        this.prepareCardSections(entry);
      };
      this.transitionCardContent(updateCard);
      this.instructionText.setText(
        "Use these words to make a yes/no question. You have 10 seconds."
      );
      this.stagePhase = "words";
      this.emitRoundUpdate({ ...context, phase: "words" });

      this.startStageTimer(this.timings.buildMs, () => {
        this.showQuestionStage(entry, context);
      }, "Prep");
    }

    showQuestionStage(entry, context) {
      this.stagePhase = "question";
      this.revealCardSection(
        "question",
        entry.question || "Listen to the modeled question."
      );
      this.instructionText.setText(
        "Check your question, then answer it aloud before time is up."
      );
      this.emitRoundUpdate({ ...context, phase: "question" });
      this.playEntryAudio(entry, "question");
      this.startStageTimer(this.timings.responseMs, () => {
        this.showAnswerStage(entry, context);
      }, "Answer");
    }

    showAnswerStage(entry, context) {
      this.stagePhase = "answer";
      this.revealCardSection(
        "answer",
        entry.answer || "Think of a suitable short answer."
      );
      this.instructionText.setText("Compare your answer with the model one.");
      this.emitRoundUpdate({ ...context, phase: "answer" });
      this.playEntryAudio(entry, "answer");
      this.startStageTimer(this.timings.revealMs, () => {
        this.scheduleEvent(this.timings.betweenMs, () => this.runNextStep());
      }, "Next");
    }

    playEntryAudio(entry, type) {
      const key =
        type === "question" ? entry.questionAudioKey : entry.answerAudioKey;
      const audioPath =
        type === "question" ? entry.questionAudio : entry.answerAudio;
      if (!key || !audioPath) {
        this.stopActiveAudio();
        return;
      }
      const sound = this.sound.get(key) ?? this.sound.add(key);
      if (!sound) {
        return;
      }
      this.stopActiveAudio();
      const token = (this.activeAudioToken += 1);
      this.activeAudio = sound;
      this.activeAudioCompleteHandler = () => {
        if (this.activeAudioToken === token) {
          this.activeAudio = null;
          this.activeAudioCompleteHandler = null;
        }
      };
      sound.once(
        Phaser.Sound.Events.COMPLETE,
        this.activeAudioCompleteHandler
      );
      sound.play();
    }

    startStageTimer(duration, onComplete, label) {
      this.stopStageTimer();
      this.stageTimerLabel = label || "";
      this.stageTimerEndsAt = this.time.now + duration;
      this.stageTimerEvent = this.time.delayedCall(duration, () => {
        this.stageTimerEvent = null;
        this.stageTimerEndsAt = 0;
        if (typeof onComplete === "function" && !this.sessionComplete) {
          onComplete();
        }
      });
    }

    stopStageTimer() {
      if (this.stageTimerEvent) {
        this.stageTimerEvent.remove(false);
        this.stageTimerEvent = null;
      }
      this.stageTimerEndsAt = 0;
    }

    scheduleEvent(delay, callback) {
      const event = this.time.delayedCall(delay, () => {
        this.pendingEvents = this.pendingEvents.filter((item) => item !== event);
        if (!this.sessionComplete && typeof callback === "function") {
          callback();
        }
      });
      this.pendingEvents.push(event);
      return event;
    }

    cancelPendingEvents() {
      this.pendingEvents.forEach((event) => event.remove(false));
      this.pendingEvents = [];
    }

    playCountdown(onComplete) {
      this.hideCountdown(true);
      this.countdownActive = true;
      if (this.countdownOverlay) {
        this.countdownOverlay.setVisible(true);
        this.countdownOverlay.setAlpha(1);
      }
      if (this.countdownBackdrop) {
        this.countdownBackdrop.setAlpha(0.55);
      }
      if (this.countdownText) {
        this.countdownText.setAlpha(1);
      }
      this.hideHudForCountdown();
      const steps = ["3", "2", "1", "Start"];

      const runStep = (index) => {
        if (!this.countdownActive) {
          return;
        }
        const value = steps[index] || "";
        this.countdownText.setText(value);
        this.emitRoundUpdate({
          mode: "countdown",
          phase: "countdown",
          countdownValue: value,
        });
        if (index >= steps.length - 1) {
          const finalize = this.time.delayedCall(700, () => {
            this.countdownActive = false;
            this.hideCountdown(true);
            if (typeof onComplete === "function") {
              onComplete();
            }
          });
          this.countdownEvents.push(finalize);
          return;
        }
        const event = this.time.delayedCall(800, () => runStep(index + 1));
        this.countdownEvents.push(event);
      };

      runStep(0);
    }

    hideCountdown(stopEvents) {
      if (stopEvents) {
        this.countdownEvents.forEach((event) => event.remove(false));
        this.countdownEvents = [];
      }
      this.countdownActive = false;
      if (this.countdownOverlay) {
        this.countdownOverlay.setVisible(false);
        this.countdownOverlay.setAlpha(0);
      }
      if (this.countdownBackdrop) {
        this.countdownBackdrop.setAlpha(0);
      }
      if (this.countdownText) {
        this.countdownText.setAlpha(0);
        this.countdownText.setText("");
      }
      this.restoreHudAfterCountdown();
    }

    finishSession() {
      this.sessionComplete = true;
      this.stopStageTimer();
      this.cancelPendingEvents();
      this.stopActiveAudio();
      this.transitionCardContent(() => {
        this.setSectionContent("words", "Great job!");
        this.setSectionVisibility("words", true, { immediate: true });
        this.setSectionContent(
          "question",
          "Press Replay to practise again with the same prompts."
        );
        this.setSectionVisibility("question", true, { immediate: true });
        this.setSectionContent("answer", "");
        this.setSectionVisibility("answer", false, { immediate: true });
      });
      this.instructionText.setText("");
      this.phaseText.setText("Session complete");
      if (statusElement) {
        statusElement.textContent =
          "Practice finished. Press Replay to continue.";
        statusElement.classList.remove("is-transparent");
        statusElement.classList.add("is-visible");
      }
      this.emitRoundUpdate({ mode: "complete" });
      this.showCompletionModal();
    }

    requestFullscreen() {
      if (this.scale.isFullscreen) {
        return;
      }
      const target = this.scale.parent || this.game.canvas;
      try {
        this.scale.startFullscreen({ target, navigationUI: "hide" });
      } catch (error) {
        // Ignore if the browser rejects the fullscreen request.
      }
    }

    stopActiveAudio() {
      if (this.activeAudio && this.activeAudioCompleteHandler) {
        this.activeAudio.off(
          Phaser.Sound.Events.COMPLETE,
          this.activeAudioCompleteHandler
        );
      }
      if (this.activeAudio && this.activeAudio.isPlaying) {
        this.activeAudio.stop();
      }
      this.activeAudio = null;
      this.activeAudioCompleteHandler = null;
      this.activeAudioToken += 1;
    }

    setGameUiVisible(isVisible) {
      if (!Array.isArray(this.gameUiElements)) {
        return;
      }
      this.gameUiElements.forEach((element) => {
        if (!element) {
          return;
        }
        if (typeof element.setVisible === "function") {
          element.setVisible(isVisible);
        } else {
          element.visible = isVisible;
        }
      });
    }

    hideHudForCountdown() {
      if (this.hudHiddenForCountdown) {
        return;
      }
      this.hudHiddenForCountdown = true;
      [this.phaseContainer, this.timerBadge, this.instructionContainer]
        .filter(Boolean)
        .forEach((item) => item.setVisible(false));
    }

    restoreHudAfterCountdown() {
      if (!this.hudHiddenForCountdown) {
        return;
      }
      this.hudHiddenForCountdown = false;
      [this.phaseContainer, this.timerBadge, this.instructionContainer]
        .filter(Boolean)
        .forEach((item) => item.setVisible(true));
    }


    emitRoundUpdate(info) {
      if (typeof onRoundUpdate === "function") {
        onRoundUpdate(info);
      }
    }

    shutdown() {
      if (this.input) {
        this.input.off("pointerdown", this.requestFullscreen, this);
      }
      this.stopCardTween();
      this.stopStageTimer();
      this.cancelPendingEvents();
      this.hideCountdown(true);
      this.stopActiveAudio();
      this.restoreHudAfterCountdown();
      this.hideCompletionModal(true);
    }

    stopCardTween() {
      if (this.activeCardTween) {
        this.activeCardTween.stop();
        this.activeCardTween = null;
      }
    }

    slideCardOut(onComplete) {
      if (!this.cardContainer || !this.cardDisplayed) {
        if (typeof onComplete === "function") {
          onComplete();
        }
        return;
      }
      this.stopCardTween();
      const width =
        this.scale?.gameSize?.width ||
        this.sys.game.canvas.width ||
        this.sys.game.config.width ||
        1280;
      const cardWidth = this.cardWidth ?? this.cardContainer.width ?? width;
      const offRight = width + cardWidth;
      this.activeCardTween = this.tweens.add({
        targets: this.cardContainer,
        x: offRight,
        duration: 450,
        ease: "Cubic.easeIn",
        onComplete: () => {
          this.activeCardTween = null;
          this.cardDisplayed = false;
          if (typeof onComplete === "function") {
            onComplete();
          }
        },
      });
    }

    prepareCardSections(entry) {
      this.updateCardImage(entry);
      this.setSectionContent("words", entry.words || entry.question || "");
      this.setSectionVisibility("words", true, { immediate: true });
      this.setSectionContent("question", "");
      this.setSectionVisibility("question", false, { immediate: true });
      this.setSectionContent("answer", "");
      this.setSectionVisibility("answer", false, { immediate: true });
    }

    updateCardImage(entry) {
      if (!this.cardImage) {
        return;
      }
      const hasTexture =
        entry?.imageKey &&
        entry?.image &&
        typeof this.textures?.exists === "function" &&
        this.textures.exists(entry.imageKey);
      if (!hasTexture) {
        this.cardImage.setVisible(false);
        this.cardImage.setActive(false);
        return;
      }
      this.cardImage.setTexture(entry.imageKey);
      this.cardImage.setActive(true);
      this.cardImage.setVisible(true);
      this.cardImage.setAlpha(1);
      this.cardImage.setScale(1);
      const imgWidth = this.cardImage.width || 1;
      const imgHeight = this.cardImage.height || 1;
      const maxWidth = this.cardImageMaxWidth || 200;
      const maxHeight = this.cardImageMaxHeight || 220;
      const scale = Math.min(1, maxWidth / imgWidth, maxHeight / imgHeight);
      this.cardImage.setScale(scale);
      const displayHeight = imgHeight * scale;
      const columnHeight = this.cardImageColumnHeight || maxHeight + 40;
      const paddingTop = 20;
      const topEdge = -columnHeight / 2;
      const imageY = topEdge + paddingTop + displayHeight / 2;
      this.cardImage.setY(imageY);
    }

    setSectionContent(key, text) {
      const section = this.cardSections?.[key];
      if (!section) {
        return;
      }
      section.value.setText(text || "");
    }

    setSectionVisibility(key, visible, options = {}) {
      const section = this.cardSections?.[key];
      if (!section) {
        return;
      }
      const targets = [section.label, section.value];
      const alpha = visible ? 1 : 0;
      if (options.immediate) {
        targets.forEach((item) => item.setAlpha(alpha));
        return;
      }
      this.tweens.add({
        targets,
        alpha,
        duration: options.duration ?? 320,
        ease: "Sine.easeOut",
      });
    }

    revealCardSection(key, text) {
      this.setSectionContent(key, text);
      this.setSectionVisibility(key, true, { immediate: false });
    }

    transitionCardContent(applyContent) {
      if (!this.cardContainer) {
        if (typeof applyContent === "function") {
          applyContent();
        }
        return;
      }
      this.stopCardTween();
      const width =
        this.scale?.gameSize?.width ||
        this.sys.game.canvas.width ||
        this.sys.game.config.width ||
        1280;
      const centerX = width / 2;
      const offLeft = -width;
      const cardWidth = this.cardWidth ?? this.cardContainer.width ?? width;
      const offRight = width + cardWidth;

      const enter = () => {
        if (typeof applyContent === "function") {
          applyContent();
        }
        this.cardContainer.x = offLeft;
        this.cardContainer.setAlpha(1);
        this.activeCardTween = this.tweens.add({
          targets: this.cardContainer,
          x: centerX,
          duration: 600,
          ease: "Cubic.easeOut",
          onComplete: () => {
            this.cardDisplayed = true;
            this.activeCardTween = null;
          },
        });
      };

      if (!this.cardDisplayed) {
        enter();
        return;
      }

      this.activeCardTween = this.tweens.add({
        targets: this.cardContainer,
        x: offRight,
        duration: 450,
        ease: "Cubic.easeIn",
        onComplete: () => {
          this.activeCardTween = null;
          enter();
        },
      });
    }

    showCompletionModal() {
      if (!this.summaryBackdrop || !this.summaryOverlay) {
        return;
      }
      this.summaryTitle?.setText("Practice complete!");
      this.summaryBody?.setText(
        "Replay the prompts or quit to review instructions."
      );
      this.summaryBackdrop.setVisible(true);
      this.summaryOverlay.setVisible(true);
      this.summaryBackdrop.setAlpha(0);
      this.summaryOverlay.setAlpha(0);
      this.tweens.add({
        targets: this.summaryBackdrop,
        alpha: 1,
        duration: 220,
        ease: "Sine.easeOut",
      });
      this.tweens.add({
        targets: this.summaryOverlay,
        alpha: 1,
        duration: 220,
        ease: "Sine.easeOut",
      });
    }

    hideCompletionModal(force = false) {
      if (!this.summaryBackdrop || !this.summaryOverlay) {
        return;
      }
      const finalize = () => {
        this.summaryBackdrop.setVisible(false);
        this.summaryOverlay.setVisible(false);
        this.summaryBackdrop.setAlpha(0);
        this.summaryOverlay.setAlpha(0);
      };
      if (force) {
        finalize();
        return;
      }
      this.tweens.add({
        targets: this.summaryOverlay,
        alpha: 0,
        duration: 180,
        ease: "Sine.easeIn",
        onComplete: finalize,
      });
      this.tweens.add({
        targets: this.summaryBackdrop,
        alpha: 0,
        duration: 180,
        ease: "Sine.easeIn",
      });
    }

    restartPractice(autoStart = false) {
      this.hideCompletionModal(true);
      this.stopStageTimer();
      this.cancelPendingEvents();
      this.stopActiveAudio();
      this.hideCountdown(true);
      this.cardDisplayed = false;
      if (statusElement) {
        statusElement.textContent = "Preparing practice...";
        statusElement.classList.remove("is-error");
        statusElement.classList.remove("is-transparent");
        statusElement.classList.add("is-visible");
      }
      this.scene.restart({ autoStart });
    }

    exitPracticeToIdleState() {
      this.hideCompletionModal(true);
      this.stopStageTimer();
      this.cancelPendingEvents();
      this.hideCountdown(true);
      this.stopActiveAudio();
      this.sessionComplete = false;
      this.cardDisplayed = false;
      this.currentExampleIndex = -1;
      this.currentPromptIndex = -1;
      this.stagePhase = "idle";
      this.setGameUiVisible(false);
      this.startButton.setLabel("Start");
      this.startButton.setDisabled(false);
      this.startButton.container.setVisible(true);
      if (statusElement) {
        statusElement.textContent = "Press Start to practice.";
        statusElement.classList.remove("is-error");
        statusElement.classList.remove("is-transparent");
        statusElement.classList.add("is-visible");
      }
      if (this.scale.isFullscreen) {
        try {
          this.scale.stopFullscreen();
        } catch (error) {
          // ignore fullscreen errors
        }
      }
    }
  }

  return PracticeGameScene;
};
