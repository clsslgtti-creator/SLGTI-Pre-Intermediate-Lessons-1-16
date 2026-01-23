
export const DEFAULT_FEEDBACK_ASSETS = {
  correctAudio: "assets/audio/game/correct.wav",
  incorrectAudio: "assets/audio/game/incorrect.wav",
  timeoutAudio: "assets/audio/game/timeout.wav",
  correctImg: "assets/img/game/correct.png",
  incorrectImg: "assets/img/game/incorrect.png",
  timeoutImg: "assets/img/game/timeout.png",
};

export const DEFAULT_BACKGROUND_IMAGE = "assets/img/game/bg-6.jpg";

const DEFAULT_TIMER_MS = 30000;
const MIN_TIMER_MS = 10000;
const MAX_TIMER_MS = 60000;

const trimText = (value) => (typeof value === "string" ? value.trim() : "");

const clampDuration = (value, fallback) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }
  return Math.min(Math.max(numericValue, MIN_TIMER_MS), MAX_TIMER_MS);
};

const buildKey = (prefix, id) =>
  `${prefix}_${String(id || "")
    .replace(/\s+/g, "_")
    .toLowerCase()}`;

export const normalizeTypeInItems = (items = []) => {
  if (!Array.isArray(items)) {
    return [];
  }
  const usedIds = new Set();
  return items
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const fallbackId = `item_${index + 1}`;
      let id = trimText(item.id) || fallbackId;
      if (usedIds.has(id)) {
        id = `${id}_${index + 1}`;
      }
      usedIds.add(id);

      const question = trimText(
        item.question ??
          item.sentence ??
          item.prompt ??
          item.text ??
          item.txt_question
      );
      const answer = trimText(item.answer ?? item.response ?? item.txt_answer);
      const audio = trimText(item.audio ?? item.audio_question ?? item.audio_q);
      const image = trimText(item.image ?? item.img);
      if (!question) {
        return null;
      }
      return {
        id,
        question,
        answer,
        audio,
        audioKey: audio ? buildKey("typein_audio", id) : null,
        image: image || null,
        imageKey: image ? buildKey("typein_img", id) : null,
      };
    })
    .filter(Boolean);
};

export const normalizeTypeInExamples = (items = []) =>
  normalizeTypeInItems(items);

export const normalizeTypeInQuestions = (items = []) =>
  normalizeTypeInItems(items);
const createTonePlayer = () => {
  const getContext = () => window.AudioContext || window.webkitAudioContext;
  return {
    playTone(frequency = 440, durationMs = 300) {
      const Context = getContext();
      if (!Context) {
        return;
      }
      const context = new Context();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + durationMs / 1000
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + durationMs / 1000 + 0.05);
      oscillator.addEventListener("ended", () => {
        context.close().catch(() => {});
      });
    },
  };
};

const createRoundedPanel = (
  scene,
  width,
  height,
  radius = 24,
  initialStyle = {}
) => {
  const graphics = scene.add.graphics();
  const state = {
    fillColor: 0xffffff,
    fillAlpha: 1,
    strokeColor: 0x000000,
    strokeAlpha: 0,
    lineWidth: 0,
    ...initialStyle,
  };

  const redraw = (style = {}) => {
    Object.assign(state, style);
    graphics.clear();
    if (state.lineWidth > 0) {
      graphics.lineStyle(state.lineWidth, state.strokeColor, state.strokeAlpha);
    } else {
      graphics.lineStyle();
    }
    graphics.fillStyle(state.fillColor, state.fillAlpha);
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    if (state.lineWidth > 0) {
      graphics.strokeRoundedRect(
        -width / 2,
        -height / 2,
        width,
        height,
        radius
      );
    }
  };

  redraw();

  return {
    graphics,
    update: redraw,
    getStyle: () => ({ ...state }),
  };
};

const createPrimaryButton = (
  scene,
  label,
  width,
  height,
  { onClick, baseColor = 0x1f6feb, fontSize = 44 } = {}
) => {
  const panel = createRoundedPanel(
    scene,
    width,
    height,
    Math.min(40, height / 2),
    {
      fillColor: baseColor,
      fillAlpha: 1,
      strokeColor: baseColor,
      strokeAlpha: 0.9,
      lineWidth: 0,
    }
  );

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
      fontSize: `${fontSize}px`,
      color: "#ffffff",
      fontStyle: "bold",
    })
    .setOrigin(0.5);

  const container = scene.add.container(0, 0, [panel.graphics, text]);
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });

  const baseStyle = panel.getStyle();
  const baseColorObj = Phaser.Display.Color.IntegerToColor(baseColor);
  const hoverColor = Phaser.Display.Color.GetColor(
    Math.min(baseColorObj.red + 20, 255),
    Math.min(baseColorObj.green + 20, 255),
    Math.min(baseColorObj.blue + 20, 255)
  );

  container.on("pointerover", () => {
    panel.update({ ...baseStyle, fillColor: hoverColor });
  });
  container.on("pointerout", () => {
    panel.update(baseStyle);
  });
  container.on("pointerdown", () => {
    panel.update({
      ...baseStyle,
      fillColor: Phaser.Display.Color.GetColor(
        Math.max(baseColorObj.red - 10, 0),
        Math.max(baseColorObj.green - 10, 0),
        Math.max(baseColorObj.blue - 10, 0)
      ),
    });
  });
  container.on("pointerup", () => {
    panel.update(baseStyle);
    if (typeof onClick === "function") {
      onClick();
    }
  });

  return {
    container,
    setLabel(value) {
      text.setText(value);
    },
    setVisible(isVisible) {
      container.setVisible(isVisible);
      container.setActive(isVisible);
    },
    setEnabled(enabled) {
      if (enabled) {
        container.setInteractive({ useHandCursor: true });
      } else {
        container.disableInteractive();
      }
    },
  };
};

const createStatusController = (element) => {
  if (!element) {
    return () => {};
  }
  return (message, options = {}) => {
    const { error = false, transparent = false } = options;
    element.textContent = typeof message === "string" ? message : "";
    element.classList.toggle("is-error", Boolean(error));
    element.classList.toggle("is-transparent", Boolean(transparent));
    if (message && message.length) {
      element.classList.add("is-visible");
    } else {
      element.classList.remove("is-visible");
    }
  };
};

const createInputRow = () => {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.gap = "50px";
  wrapper.style.width = "auto";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type your answer";
  input.style.flex = "1";
  input.style.padding = "12px 16px";
  input.style.fontSize = "28px";
  input.style.borderRadius = "12px";
  input.style.border = "2px solid #93c5fd";
  input.style.outline = "none";
  input.style.fontFamily = 'Segoe UI, "Helvetica Neue", Arial, sans-serif';
  input.style.background = "#ffffff";
  input.style.color = "#0f172a";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Done";
  button.style.padding = "16px 20px";
  button.style.margin = "0px 20px";
  button.style.fontSize = "24px";
  button.style.borderRadius = "12px";
  button.style.border = "none";
  button.style.background = "#1f6feb";
  button.style.color = "#ffffff";
  button.style.fontWeight = "600";
  button.style.cursor = "pointer";

  wrapper.append(input, button);

  const setEnabled = (enabled) => {
    input.disabled = !enabled;
    button.disabled = !enabled;
    input.style.opacity = enabled ? "1" : "0.65";
    button.style.opacity = enabled ? "1" : "0.65";
    button.style.cursor = enabled ? "pointer" : "not-allowed";
  };

  return {
    wrapper,
    input,
    button,
    setEnabled,
  };
};
export const createTypeInGameScene = (config = {}) => {
  const {
    examples: rawExamples = [],
    questions: rawQuestions = [],
    backgroundImage,
    feedbackAssets = DEFAULT_FEEDBACK_ASSETS,
    statusElement = null,
    timePerQuestionMs,
    onRoundUpdate,
  } = config;

  const examples = normalizeTypeInExamples(rawExamples);
  const questions = normalizeTypeInQuestions(rawQuestions);
  const resolvedTimerMs = clampDuration(timePerQuestionMs, DEFAULT_TIMER_MS);
  const tonePlayer = createTonePlayer();
  const statusController = createStatusController(statusElement);

  return class TypeInGameScene extends Phaser.Scene {
    constructor() {
      super("TypeInGameScene");
      this.examples = examples;
      this.questions = questions;
      this.totalQuestions = questions.length;
      this.feedbackAssets = feedbackAssets;
      this.statusController = statusController;
      this.onRoundUpdate =
        typeof onRoundUpdate === "function" ? onRoundUpdate : null;
      this.timePerQuestionMs = resolvedTimerMs;
      this.defaultTimerLabel = `Time: ${(resolvedTimerMs / 1000).toFixed(1)}s`;
      this.shouldAutoStart = false;
      this.pendingEvents = [];
      this.activeAudio = null;
      this.activeAudioToken = 0;
      this.timerEvent = null;
      this.awaitingAnswer = false;
      this.currentEntry = null;
      this.currentMode = "idle";
      this.exampleIndex = -1;
      this.questionIndex = -1;
      this.score = 0;
      this.summaryVisible = false;
      this.countdownShown = this.examples.length === 0;
      this.countdownActive = false;
      this.countdownEvents = [];
      this.inputHandlers = null;
    }

    init(data = {}) {
      this.shouldAutoStart = Boolean(data.autoStart);
      this.resetState();
    }

    resetState() {
      this.awaitingAnswer = false;
      this.currentEntry = null;
      this.currentMode = "idle";
      this.exampleIndex = -1;
      this.questionIndex = -1;
      this.score = 0;
      this.summaryVisible = false;
      this.countdownShown = this.examples.length === 0;
      this.countdownActive = false;
      this.hideCountdown(true);
      this.stopTimer();
      this.stopActiveAudio();
      this.cancelPendingEvents();
    }
    preload() {
      const bgAsset =
        typeof backgroundImage === "string" && backgroundImage.trim().length
          ? backgroundImage.trim()
          : DEFAULT_BACKGROUND_IMAGE;

      this.load.once("complete", () => {
        this.statusController("Press Start to play.");
      });

      this.load.image("typein-bg", bgAsset);

      [...this.examples, ...this.questions].forEach((entry) => {
        if (entry.audioKey && entry.audio) {
          this.load.audio(entry.audioKey, entry.audio);
        }
        if (entry.imageKey && entry.image) {
          this.load.image(entry.imageKey, entry.image);
        }
      });

      if (this.feedbackAssets.correctAudio) {
        this.load.audio("typein-correct-audio", this.feedbackAssets.correctAudio);
      }
      if (this.feedbackAssets.incorrectAudio) {
        this.load.audio(
          "typein-incorrect-audio",
          this.feedbackAssets.incorrectAudio
        );
      }
      if (this.feedbackAssets.timeoutAudio) {
        this.load.audio("typein-timeout-audio", this.feedbackAssets.timeoutAudio);
      }
      if (this.feedbackAssets.correctImg) {
        this.load.image("typein-correct-img", this.feedbackAssets.correctImg);
      }
      if (this.feedbackAssets.incorrectImg) {
        this.load.image("typein-incorrect-img", this.feedbackAssets.incorrectImg);
      }
      if (this.feedbackAssets.timeoutImg) {
        this.load.image("typein-timeout-img", this.feedbackAssets.timeoutImg);
      }
    }

    create() {
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
      this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
      this.input.on("pointerdown", this.requestFullscreen, this);

      const { width, height } = this.sys.game.canvas;
      this.cameras.main.setBackgroundColor("#eef2f9");
      this.gameUiElements = [];

      this.background = this.add
        .image(width / 2, height / 2, "typein-bg")
        .setOrigin(0.5)
        .setDepth(0);
      this.background.displayWidth = width;
      this.background.displayHeight = height;

      this.registerFeedbackSounds();

      const topBar = createRoundedPanel(this, width * 0.82, 110, 28);
      topBar.update({
        fillColor: 0xffffff,
        fillAlpha: 0.85,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.18,
        lineWidth: 2,
      });
      topBar.graphics.setPosition(width / 2, 90);
      topBar.graphics.setDepth(2);
      this.gameUiElements.push(topBar.graphics);

      this.phaseText = this.add
        .text(width / 2, 70, "Ready", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "34px",
          color: "#0f172a",
          fontStyle: "bold",
          letterSpacing: 0.6,
        })
        .setOrigin(0.5, 0);
      this.phaseText.setDepth(3);
      this.gameUiElements.push(this.phaseText);

      const badgeHeight = 64;
      const timerBadgeWidth = 210;
      this.timerPanel = createRoundedPanel(
        this,
        timerBadgeWidth,
        badgeHeight,
        20
      );
      this.timerPanel.graphics.setPosition(50, -16);
      this.timerPanelBaseStyle = {
        fillColor: 0x1f6feb,
        fillAlpha: 0.12,
        strokeColor: 0x1f6feb,
        strokeAlpha: 0.24,
        lineWidth: 2,
      };
      this.timerPanelActiveStyle = {
        fillColor: 0x1f6feb,
        fillAlpha: 0.18,
        strokeColor: 0x1d4ed8,
        strokeAlpha: 0.42,
        lineWidth: 2,
      };
      this.timerPanel.update(this.timerPanelBaseStyle);
      this.timerText = this.add
        .text(50, -16, this.defaultTimerLabel, {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "24px",
          color: "#1d4ed8",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.timerBadge = this.add.container(timerBadgeWidth / 2 + 90, 108, [
        this.timerPanel.graphics,
        this.timerText,
      ]);
      this.timerBadge.setDepth(3);
      this.gameUiElements.push(this.timerBadge);

      const scoreBadgeWidth = 220;
      this.scorePanel = createRoundedPanel(
        this,
        scoreBadgeWidth,
        badgeHeight,
        20
      );
      this.scorePanel.graphics.setPosition(-50, -16);
      this.scorePanel.update({
        fillColor: 0x1f6feb,
        fillAlpha: 0.12,
        strokeColor: 0x1f6feb,
        strokeAlpha: 0.24,
        lineWidth: 2,
      });
      this.scoreText = this.add
        .text(-50, -16, `Score: 0/${this.totalQuestions}`, {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "24px",
          color: "#1d4ed8",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.scoreBadge = this.add.container(
        width - scoreBadgeWidth / 2 - 90,
        108,
        [this.scorePanel.graphics, this.scoreText]
      );
      this.scoreBadge.setDepth(3);
      this.gameUiElements.push(this.scoreBadge);

      const cardWidth = 1000;
      const cardHeight = 300;
      this.cardWidth = cardWidth;
      this.cardHeight = cardHeight;
      const cardPanel = createRoundedPanel(this, cardWidth, cardHeight, 32, {
        fillColor: 0xffffff,
        fillAlpha: 0.98,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.32,
        lineWidth: 4,
      });
      this.cardPanel = cardPanel;

      this.questionImage = this.add.image(0, 0, "");
      this.questionImage.setVisible(false);
      this.questionImage.setActive(false);

      this.questionText = this.add
        .text(0, 0, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: 30,
          color: "#111827",
          align: "center",
          wordWrap: { width: cardWidth - 60 },
        })
        .setOrigin(0.5);

      this.questionCard = this.add.container(width / 2, height / 2 - 40, [
        cardPanel.graphics,
        this.questionImage,
        this.questionText,
      ]);
      this.gameUiElements.push(this.questionCard);
      const inputRow = createInputRow();
      this.inputRow = inputRow;
      this.inputDom = this.add.dom(width / 2, height / 2 + 160, inputRow.wrapper);
      this.inputDom.setDepth(4);
      this.gameUiElements.push(this.inputDom);

      const handleSubmit = () => this.handleSubmit();
      const handleKeydown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.handleSubmit();
        }
      };
      inputRow.button.addEventListener("click", handleSubmit);
      inputRow.input.addEventListener("keydown", handleKeydown);
      this.inputHandlers = { handleSubmit, handleKeydown };

      this.startButton = createPrimaryButton(this, "Start", 520, 210, {
        onClick: () => this.handleStartPressed(false),
        fontSize: 88,
      });
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

      this.feedbackBackdrop = this.add.rectangle(
        width / 2,
        height / 2,
        width,
        height,
        0x0f172a,
        0.3
      );
      this.feedbackBackdrop.setAlpha(0);
      this.feedbackBackdrop.setDepth(8);
      this.feedbackBackdrop.setVisible(false);

      this.feedbackPanel = createRoundedPanel(this, 520, 260, 30, {
        fillColor: 0xffffff,
        fillAlpha: 0.98,
        strokeColor: 0x1f2933,
        strokeAlpha: 0.15,
        lineWidth: 3,
      });
      this.feedbackIcon = this.add.image(0, -60, "");
      this.feedbackIcon.setVisible(false);
      this.feedbackLabel = this.add
        .text(0, 10, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "32px",
          fontStyle: "bold",
          color: "#1f2933",
        })
        .setOrigin(0.5);
      this.feedbackAnswer = this.add
        .text(0, 70, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "22px",
          color: "#1f2933",
          align: "center",
          wordWrap: { width: 440 },
        })
        .setOrigin(0.5);

      this.feedbackGroup = this.add.container(width / 2, height / 2, [
        this.feedbackPanel.graphics,
        this.feedbackIcon,
        this.feedbackLabel,
        this.feedbackAnswer,
      ]);
      this.feedbackGroup.setDepth(9);
      this.feedbackGroup.setAlpha(0);

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
      this.countdownOverlay.setDepth(12);
      this.countdownOverlay.setVisible(false);

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
        .text(0, -110, "All done!", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: 40,
          color: "#0f172a",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.summaryBody = this.add
        .text(0, -20, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: 26,
          color: "#0f172a",
          align: "center",
          wordWrap: { width: 560 },
        })
        .setOrigin(0.5);

      const replayButton = createPrimaryButton(this, "Replay", 260, 92, {
        onClick: () => this.handleReplay(),
      });
      replayButton.container.setPosition(-160, 120);

      const quitButton = createPrimaryButton(this, "Quit", 260, 92, {
        onClick: () => this.exitToIdleState(),
        baseColor: 0x334155,
      });
      quitButton.container.setPosition(160, 120);

      this.summaryButtons = { replay: replayButton, quit: quitButton };
      this.summaryOverlay.add([
        summaryPanel.graphics,
        this.summaryTitle,
        this.summaryBody,
        replayButton.container,
        quitButton.container,
      ]);
      this.summaryOverlay.setVisible(false);
      this.summaryOverlay.setAlpha(0);

      this.setGameUiVisible(false);
      this.inputRow.setEnabled(false);

      if (this.shouldAutoStart) {
        this.time.delayedCall(700, () => this.handleStartPressed(true));
      }
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

    setInputEnabled(enabled) {
      if (!this.inputRow) {
        return;
      }
      this.inputRow.setEnabled(enabled);
      if (enabled) {
        this.inputRow.input.focus();
      }
    }

    clearInput() {
      if (this.inputRow?.input) {
        this.inputRow.input.value = "";
      }
    }

    handleStartPressed(autoStart) {
      if (!this.questions.length) {
        this.statusController("No questions available.", { error: true });
        return;
      }
      this.hideSummary(true);
      this.resetState();
      this.setGameUiVisible(true);
      this.startButton.setVisible(false);
      this.startButton.setEnabled(false);
      this.updateScoreText();
      this.countdownShown = this.examples.length === 0;
      this.hideCountdown(true);
      this.setInputEnabled(false);
      this.statusController("Get ready...", { transparent: false });
      if (!autoStart) {
        this.statusController("Starting...", { transparent: true });
      }
      this.advance();
    }

    advance() {
      if (this.examples.length && this.exampleIndex < this.examples.length - 1) {
        this.exampleIndex += 1;
        this.showExample(this.examples[this.exampleIndex]);
        return;
      }

      if (this.examples.length && !this.countdownShown) {
        this.countdownShown = true;
        this.playCountdown(() => this.advance());
        return;
      }

      if (this.questionIndex < this.questions.length - 1) {
        this.questionIndex += 1;
        this.showQuestion(this.questions[this.questionIndex]);
        return;
      }

      this.finishGame();
    }

    showExample(entry) {
      this.currentEntry = entry;
      this.currentMode = "examples";
      this.awaitingAnswer = false;
      this.clearInput();
      this.setInputEnabled(false);
      this.updateQuestionDisplay(entry);
      this.updatePhaseLabel(
        `Example ${this.exampleIndex + 1} of ${this.examples.length}`,
        "#0f172a"
      );
      this.statusController(
        `Example ${this.exampleIndex + 1} of ${this.examples.length}`,
        { transparent: false }
      );
      this.emitRoundUpdate({
        mode: "examples",
        exampleIndex: this.exampleIndex,
        exampleTotal: this.examples.length,
      });
      this.playEntryAudio(entry, () => {
        const answerDelayMs = 800;
        const feedbackDelayMs = 700;
        const advanceDelayMs = 900;

        this.scheduleEvent(answerDelayMs, () => {
          this.inputRow.input.value = entry.answer || "";
        });

        this.scheduleEvent(answerDelayMs + feedbackDelayMs, () => {
          this.showFeedback("correct", "Example", entry.answer || "");
        });

        this.scheduleEvent(
          answerDelayMs + feedbackDelayMs + advanceDelayMs,
          () => {
            this.hideFeedback();
            this.advance();
          }
        );
      });
    }

    showQuestion(entry) {
      this.currentEntry = entry;
      this.currentMode = "questions";
      this.awaitingAnswer = false;
      this.clearInput();
      this.setInputEnabled(false);
      this.updateQuestionDisplay(entry);
      this.updatePhaseLabel(
        `Question ${this.questionIndex + 1} of ${this.questions.length}`,
        "#1d4ed8"
      );
      this.statusController(
        `Question ${this.questionIndex + 1} of ${this.questions.length} - Score ${this.score}/${this.totalQuestions}`,
        { transparent: true }
      );
      this.emitRoundUpdate({
        mode: "questions",
        questionIndex: this.questionIndex,
        questionTotal: this.questions.length,
        score: this.score,
        total: this.totalQuestions,
      });
      this.playEntryAudio(entry, () => {
        this.awaitingAnswer = true;
        this.setInputEnabled(true);
        this.startTimer();
      });
    }

    updatePhaseLabel(text, color) {
      if (this.phaseText) {
        this.phaseText.setText(text || "");
        if (color) {
          this.phaseText.setColor(color);
        }
      }
    }

    updateQuestionDisplay(entry) {
      if (!entry) {
        return;
      }
      this.questionText.setText(entry.question || "");
      this.updateQuestionImage(entry);
      this.layoutQuestionCard();
    }

    updateQuestionImage(entry) {
      const hasTexture =
        entry?.imageKey &&
        entry?.image &&
        typeof this.textures?.exists === "function" &&
        this.textures.exists(entry.imageKey);
      if (!hasTexture) {
        this.questionImage.setVisible(false);
        this.questionImage.setActive(false);
        return;
      }
      this.questionImage.setTexture(entry.imageKey);
      this.questionImage.setActive(true);
      this.questionImage.setVisible(true);
      this.questionImage.setScale(1);
      const imgWidth = this.questionImage.width || 1;
      const imgHeight = this.questionImage.height || 1;
      const maxWidth = this.cardWidth - 120;
      const maxHeight = 120;
      const scale = Math.min(1, maxWidth / imgWidth, maxHeight / imgHeight);
      this.questionImage.setScale(scale);
    }

    layoutQuestionCard() {
      const panelTop = -(this.cardHeight ?? 0) / 2 + 24;
      let y = panelTop;

      if (this.questionImage?.visible) {
        const displayHeight = this.questionImage.displayHeight || 0;
        this.questionImage.setPosition(0, y + displayHeight / 2);
        y += displayHeight + 16;
      }

      this.questionText.setOrigin(0.5, 0);
      this.questionText.setPosition(0, y);
    }
    handleSubmit() {
      if (!this.awaitingAnswer || !this.currentEntry) {
        return;
      }
      const value = this.inputRow?.input?.value ?? "";
      this.finalizeAnswer(value, false);
    }

    finalizeAnswer(value, timedOut) {
      if (!this.currentEntry || !this.awaitingAnswer) {
        return;
      }
      this.awaitingAnswer = false;
      this.setInputEnabled(false);
      this.stopTimer();
      this.stopActiveAudio();

      const expected = trimText(this.currentEntry.answer).toLowerCase();
      const normalizedValue = trimText(value).toLowerCase();
      const isOpenQuestion = !expected.length;
      const isCorrect = isOpenQuestion || normalizedValue === expected;

      if (isCorrect && !isOpenQuestion) {
        this.score += 1;
        this.updateScoreText();
      }

      const feedbackType = isCorrect ? "correct" : "incorrect";
      const feedbackLabel = isCorrect ? "Correct!" : "Incorrect";

      const answerText = this.currentEntry.answer || "";
      this.showFeedback(feedbackType, feedbackLabel, answerText);
      this.playFeedbackSound(feedbackType);

      this.scheduleEvent(1500, () => {
        this.hideFeedback();
        this.advance();
      });
    }

    handleTimeout() {
      if (!this.awaitingAnswer) {
        return;
      }
      const value = this.inputRow?.input?.value ?? "";
      this.finalizeAnswer(value, true);
    }

    startTimer() {
      let remaining = this.timePerQuestionMs;
      this.updateTimerText(remaining);
      this.timerEvent?.remove();
      this.timerEvent = this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          remaining -= 100;
          if (remaining <= 0) {
            this.updateTimerText(0);
            this.timerEvent?.remove();
            this.timerEvent = null;
            this.handleTimeout();
            return;
          }
          this.updateTimerText(remaining);
        },
      });
    }

    stopTimer() {
      this.timerEvent?.remove();
      this.timerEvent = null;
      if (this.timerText) {
        this.updateTimerText(this.defaultTimerLabel);
      }
    }

    updateTimerText(value) {
      const isNumber = Number.isFinite(value);
      let text = this.defaultTimerLabel;
      if (isNumber) {
        text = `Time: ${(Math.max(0, value) / 1000).toFixed(1)}s`;
      } else if (typeof value === "string" && value.trim().length) {
        text = value.trim();
      }
      this.timerText.setText(text);
      if (isNumber && value > 0) {
        this.timerPanel.update(this.timerPanelActiveStyle);
        this.timerText.setColor("#1d4ed8");
      } else {
        this.timerPanel.update(this.timerPanelBaseStyle);
        this.timerText.setColor("#1f2937");
      }
    }

    updateScoreText() {
      this.scoreText.setText(`Score: ${this.score}/${this.totalQuestions}`);
    }

    playCountdown(onComplete) {
      this.hideFeedback();
      this.setInputEnabled(false);
      this.awaitingAnswer = false;
      this.countdownActive = true;
      this.statusController("Get ready...", { transparent: false });

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

      const steps = ["3", "2", "1", "Start"];

      const runStep = (index) => {
        if (!this.countdownActive) {
          return;
        }
        const value = steps[index] || "";
        if (this.countdownText) {
          this.countdownText.setText(value);
        }
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
    }

    registerFeedbackSounds() {
      if (!this.sound) {
        return;
      }
      if (
        this.feedbackAssets.correctAudio &&
        !this.sound.get("typein-correct-audio")
      ) {
        this.sound.add("typein-correct-audio");
      }
      if (
        this.feedbackAssets.incorrectAudio &&
        !this.sound.get("typein-incorrect-audio")
      ) {
        this.sound.add("typein-incorrect-audio");
      }
      if (
        this.feedbackAssets.timeoutAudio &&
        !this.sound.get("typein-timeout-audio")
      ) {
        this.sound.add("typein-timeout-audio");
      }
    }

    playEntryAudio(entry, onComplete) {
      this.stopActiveAudio();
      this.activeAudioToken += 1;
      const token = this.activeAudioToken;
      if (entry?.audioKey) {
        const sound = this.sound.get(entry.audioKey) ?? this.sound.add(entry.audioKey);
        if (sound) {
          this.activeAudio = sound;
          sound.once(Phaser.Sound.Events.COMPLETE, () => {
            if (token === this.activeAudioToken) {
              onComplete?.();
            }
          });
          sound.play();
          return;
        }
      }
      this.scheduleEvent(200, () => {
        if (token === this.activeAudioToken) {
          onComplete?.();
        }
      });
    }

    stopActiveAudio() {
      if (this.activeAudio) {
        this.activeAudio.stop();
      }
      this.activeAudio = null;
      this.activeAudioToken += 1;
    }

    playFeedbackSound(type) {
      const keyMap = {
        correct: "typein-correct-audio",
        incorrect: "typein-incorrect-audio",
        timeout: "typein-timeout-audio",
      };
      const key = keyMap[type];
      if (key && this.sound) {
        const sound = this.sound.get(key) ?? this.sound.add(key);
        if (sound) {
          sound.play();
          return;
        }
      }
      if (type === "correct") {
        tonePlayer.playTone(640, 240);
      } else if (type === "incorrect") {
        tonePlayer.playTone(320, 400);
      } else {
        tonePlayer.playTone(260, 400);
      }
    }

    showFeedback(kind, message, answer) {
      const colorMap = {
        correct: { border: 0x16a34a, text: "#065f46", icon: "typein-correct-img" },
        incorrect: { border: 0xdc2626, text: "#7f1d1d", icon: "typein-incorrect-img" },
        timeout: { border: 0xf97316, text: "#b45309", icon: "typein-timeout-img" },
      };
      const style = colorMap[kind] ?? colorMap.incorrect;
      this.feedbackPanel.update({
        fillColor: 0xffffff,
        fillAlpha: 0.98,
        strokeColor: style.border,
        strokeAlpha: 0.35,
        lineWidth: 3,
      });
      if (style.icon && this.textures.exists(style.icon)) {
        this.feedbackIcon.setTexture(style.icon);
        this.feedbackIcon.setVisible(true);
      } else {
        this.feedbackIcon.setVisible(false);
      }
      this.feedbackLabel.setText(message);
      this.feedbackLabel.setColor(style.text);
      this.feedbackAnswer.setText(answer ? `Answer: ${answer}` : "");
      this.feedbackBackdrop.setVisible(true);
      this.tweens.killTweensOf(this.feedbackBackdrop);
      this.tweens.add({
        targets: this.feedbackBackdrop,
        alpha: 1,
        duration: 200,
        ease: "Sine.easeOut",
      });
      this.tweens.killTweensOf(this.feedbackGroup);
      this.tweens.add({
        targets: this.feedbackGroup,
        alpha: 1,
        scale: { from: 0.96, to: 1 },
        duration: 240,
        ease: "Sine.easeOut",
      });
    }

    hideFeedback() {
      if (!this.feedbackGroup) {
        return;
      }
      this.feedbackGroup.setAlpha(0);
      this.feedbackBackdrop.setVisible(false);
      this.feedbackBackdrop.setAlpha(0);
    }
    finishGame() {
      this.awaitingAnswer = false;
      this.stopTimer();
      this.stopActiveAudio();
      this.updateTimerText(this.defaultTimerLabel);
      this.statusController("All questions complete!", { transparent: false });
      this.showSummary();
      this.emitRoundUpdate({
        mode: "complete",
        score: this.score,
        total: this.totalQuestions,
      });
    }

    showSummary() {
      if (this.summaryVisible) {
        return;
      }
      this.setInputEnabled(false);
      this.inputDom?.setVisible(false);
      const percentage =
        this.totalQuestions > 0
          ? Math.round((this.score / this.totalQuestions) * 100)
          : 0;
      this.summaryTitle.setText(
        percentage === 100
          ? "Outstanding!"
          : percentage >= 60
          ? "Great Job!"
          : "Keep Practicing!"
      );
      this.summaryBody.setText(
        `You answered ${this.score} out of ${this.totalQuestions} correctly.\nYour score: ${percentage}%`
      );
      this.summaryBackdrop.setVisible(true);
      this.summaryOverlay.setVisible(true);
      this.summaryBackdrop.setAlpha(0);
      this.summaryOverlay.setAlpha(0);
      this.tweens.add({
        targets: this.summaryBackdrop,
        alpha: 1,
        duration: 260,
        ease: "Sine.easeOut",
      });
      this.tweens.add({
        targets: this.summaryOverlay,
        alpha: 1,
        scale: { from: 0.94, to: 1 },
        duration: 320,
        ease: "Back.easeOut",
      });
      this.summaryVisible = true;
    }

    hideSummary(force) {
      if (!this.summaryBackdrop || !this.summaryOverlay) {
        return;
      }
      if (force) {
        this.summaryBackdrop.setVisible(false);
        this.summaryBackdrop.setAlpha(0);
        this.summaryOverlay.setVisible(false);
        this.summaryOverlay.setAlpha(0);
        this.inputDom?.setVisible(true);
        this.summaryVisible = false;
        return;
      }
      this.tweens.add({
        targets: this.summaryBackdrop,
        alpha: 0,
        duration: 180,
        ease: "Sine.easeInOut",
        onComplete: () => {
          this.summaryBackdrop.setVisible(false);
        },
      });
      this.tweens.add({
        targets: this.summaryOverlay,
        alpha: 0,
        duration: 180,
        ease: "Sine.easeInOut",
        onComplete: () => {
          this.summaryOverlay.setVisible(false);
          this.inputDom?.setVisible(true);
          this.summaryVisible = false;
        },
      });
    }

    handleReplay() {
      this.hideSummary(true);
      this.handleStartPressed(true);
    }

    exitToIdleState() {
      this.hideSummary(true);
      this.stopTimer();
      this.stopActiveAudio();
      this.cancelPendingEvents();
      this.hideCountdown(true);
      this.setInputEnabled(false);
      this.setGameUiVisible(false);
      this.startButton.setVisible(true);
      this.startButton.setEnabled(true);
      this.statusController("Press Start to play.", { transparent: false });
      this.phaseText.setText("Ready");
      this.phaseText.setColor("#0f172a");
      this.resetState();
      if (this.scale?.isFullscreen) {
        this.scale.stopFullscreen();
      }
    }

    requestFullscreen() {
      if (this.scale?.isFullscreen) {
        return;
      }
      const target = this.scale.parent || this.game.canvas;
      if (!target) {
        return;
      }
      try {
        this.scale.startFullscreen({ target, navigationUI: "hide" });
      } catch (error) {
        // ignore failures
      }
    }

    scheduleEvent(delay, callback) {
      const event = this.time.delayedCall(delay, () => {
        this.pendingEvents = this.pendingEvents.filter((item) => item !== event);
        callback?.();
      });
      this.pendingEvents.push(event);
      return event;
    }

    cancelPendingEvents() {
      this.pendingEvents.forEach((event) => event.remove(false));
      this.pendingEvents = [];
    }

    emitRoundUpdate(info) {
      if (this.onRoundUpdate) {
        this.onRoundUpdate(info);
      }
    }

    shutdown() {
      this.stopTimer();
      this.stopActiveAudio();
      this.cancelPendingEvents();
      this.hideCountdown(true);
      if (this.inputHandlers && this.inputRow) {
        this.inputRow.button.removeEventListener(
          "click",
          this.inputHandlers.handleSubmit
        );
        this.inputRow.input.removeEventListener(
          "keydown",
          this.inputHandlers.handleKeydown
        );
      }
      this.inputHandlers = null;
      this.input?.off?.("pointerdown", this.requestFullscreen, this);
    }
  };
};
