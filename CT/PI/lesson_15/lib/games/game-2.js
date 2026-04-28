
export const DEFAULT_FEEDBACK_ASSETS = {
  correctAudio: "assets/audio/game/correct.wav",
  incorrectAudio: "assets/audio/game/incorrect.wav",
  timeoutAudio: "assets/audio/game/timeout.wav",
  correctImg: "assets/img/game/correct.png",
  incorrectImg: "assets/img/game/incorrect.png",
  timeoutImg: "assets/img/game/timeout.png",
};

export const DEFAULT_BACKGROUND_IMAGE = "assets/img/game/bg-2.jpg";

const DEFAULT_TIMER_MS = 40000;
const TOKEN_BASE_WIDTH = 130;
const TOKEN_BASE_HEIGHT = 50;

const trimText = (value) =>
  typeof value === "string" ? value.trim() : "";

const joinWordsForDisplay = (words = []) =>
  words.reduce((acc, word, index) => {
    if (!word) {
      return acc;
    }
    if (index === 0) {
      return word;
    }
    if (/^[.,!?;:]$/.test(word)) {
      return `${acc}${word}`;
    }
    return `${acc} ${word}`;
  }, "");

const shuffleArray = (list = []) => {
  const copy = Array.isArray(list) ? [...list] : [];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const createTonePlayer = () => {
  const getContext = () => window.AudioContext || window.webkitAudioContext;
  return {
    play(frequency = 440, durationMs = 200) {
      const Context = getContext();
      if (!Context) {
        return;
      }
      const context = new Context();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
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
  { onClick, baseColor = 0x1d4ed8, textSize = 32 } = {}
) => {
  const panel = createRoundedPanel(
    scene,
    width,
    height,
    Math.min(30, height / 2),
    {
      fillColor: baseColor,
      fillAlpha: 1,
      strokeColor: baseColor,
      strokeAlpha: 0.8,
      lineWidth: 0,
    }
  );

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
      fontSize: `${textSize}px`,
      color: "#ffffff",
      fontStyle: "bold",
    })
    .setOrigin(0.5);

  const container = scene.add.container(0, 0, [panel.graphics, text]);
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });

  const hoverStyle = {
    fillColor: 0x2563eb,
    strokeColor: 0x1d4ed8,
    strokeAlpha: 0.9,
  };
  const baseStyle = panel.getStyle();

  container.on("pointerover", () => {
    panel.update({ ...baseStyle, ...hoverStyle });
  });
  container.on("pointerout", () => {
    panel.update(baseStyle);
  });
  container.on("pointerdown", () => {
    panel.update({
      ...baseStyle,
      fillColor: 0x1e40af,
      strokeColor: 0x1e3a8a,
      strokeAlpha: 0.9,
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
    setText(value) {
      text.setText(value);
    },
    setVisible(state) {
      container.setVisible(state);
      container.setActive(state);
    },
    setInteractiveState(enabled) {
      if (enabled) {
        container.setInteractive({ useHandCursor: true });
      } else {
        container.disableInteractive();
      }
    },
  };
};

const createBarButton = (
  scene,
  label,
  width,
  height,
  { onClick, baseColor = 0x1f6feb } = {}
) => {
  const baseColorObj = Phaser.Display.Color.IntegerToColor(baseColor);
  const hoverColor = Phaser.Display.Color.GetColor(
    Math.min(baseColorObj.red + 25, 255),
    Math.min(baseColorObj.green + 25, 255),
    Math.min(baseColorObj.blue + 25, 255)
  );

  const panel = createRoundedPanel(scene, width, height, Math.min(42, height / 2));
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
      strokeAlpha: 0.9,
      lineWidth: 0,
    },
  };
  panel.update(styles.base);

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
      fontSize: 58,
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
    })
    .setOrigin(0.5);

  const container = scene.add.container(0, 0, [panel.graphics, text]);
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });
  container.on("pointerover", () => {
    if (!container.input?.enabled) {
      return;
    }
    panel.update(styles.hover);
  });
  container.on("pointerout", () => {
    if (!container.input?.enabled) {
      return;
    }
    panel.update(styles.base);
  });
  container.on("pointerdown", () => {
    if (container.input?.enabled && typeof onClick === "function") {
      onClick();
    }
  });

  return { container, background: panel, text, styles };
};

const TOKEN_STYLES = {
  bank: {
    fillColor: 0xffffff,
    fillAlpha: 1,
    strokeColor: 0x94a3b8,
    strokeAlpha: 0.9,
  },
  hover: {
    fillColor: 0xf1f5f9,
    fillAlpha: 1,
    strokeColor: 0x2563eb,
    strokeAlpha: 0.9,
  },
  selected: {
    fillColor: 0xdbeafe,
    fillAlpha: 1,
    strokeColor: 0x2563eb,
    strokeAlpha: 1,
  },
  correct: {
    fillColor: 0xecfdf5,
    fillAlpha: 1,
    strokeColor: 0x16a34a,
    strokeAlpha: 1,
  },
  incorrect: {
    fillColor: 0xfee2e2,
    fillAlpha: 1,
    strokeColor: 0xdc2626,
    strokeAlpha: 1,
  },
};

const setTokenStyle = (token, styleKey = "bank") => {
  const style = TOKEN_STYLES[styleKey] ?? TOKEN_STYLES.bank;
  token.background.update({
    fillColor: style.fillColor,
    fillAlpha: style.fillAlpha,
    strokeColor: style.strokeColor,
    strokeAlpha: style.strokeAlpha,
    lineWidth: 3,
  });
  token.text.setColor("#0f172a");
};

const createToken = (scene, word, index, onClick) => {
  const width = Math.max(TOKEN_BASE_WIDTH, word.length * 16 + 40);
  const height = TOKEN_BASE_HEIGHT;
  const background = createRoundedPanel(scene, width, height, 18, {
    fillColor: 0xffffff,
    strokeColor: 0x94a3b8,
    strokeAlpha: 0.9,
    lineWidth: 3,
  });

  const text = scene.add
    .text(0, 0, word, {
      fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
      fontSize: "28px",
      color: "#0f172a",
    })
    .setOrigin(0.5);

  const container = scene.add.container(0, 0, [background.graphics, text]);
  container.setSize(width, height);
  container.setDepth(4);
  container.setInteractive({ useHandCursor: true });

  const token = {
    id: `${word}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    word,
    container,
    text,
    background,
    width,
    height,
    state: "bank",
  };

  container.on("pointerdown", () => onClick?.(token));
  container.on("pointerover", () => {
    if (!container.input?.enabled) {
      return;
    }
    if (token.state === "bank") {
      setTokenStyle(token, "hover");
    }
  });
  container.on("pointerout", () => {
    if (!container.input?.enabled) {
      return;
    }
    if (token.state === "bank") {
      setTokenStyle(token, "bank");
    }
  });

  setTokenStyle(token, "bank");
  return token;
};

export const normalizeWordEntries = (raw = []) => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry, index) => {
      const sentence = trimText(entry?.sentence);
      const words = Array.isArray(entry?.words)
        ? entry.words.map((word) => trimText(word)).filter(Boolean)
        : [];
      if (!sentence || !words.length) {
        return null;
      }
      const audio =
        typeof entry?.audio === "string" && entry.audio.trim().length
          ? entry.audio.trim()
          : null;
      const id = trimText(entry?.id) || `line_${index + 1}`;
      return {
        id,
        sentence,
        words,
        audio,
        audioKey: audio ? `arrange_sentence_${id}` : null,
      };
    })
    .filter(Boolean);
};

export const normalizeFirstSentence = (entry) => {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const text = trimText(entry.text);
  if (!text) {
    return null;
  }
  const audio =
    typeof entry.audio === "string" && entry.audio.trim().length
      ? entry.audio.trim()
      : null;
  return {
    text,
    audio,
    audioKey: audio ? "arrange_intro_sentence" : null,
  };
};

const isMobileDevice = () => {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = (navigator.userAgent || "").toLowerCase();
  const hasTouch =
    (typeof window !== "undefined" && "ontouchstart" in window) ||
    navigator.maxTouchPoints > 1 ||
    navigator.msMaxTouchPoints > 1;
  return (
    hasTouch &&
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(
      ua
    )
  );
};
export const createGameScene = (config = {}) => {
  const {
    questions: rawQuestions = [],
    firstSentence: rawFirstSentence = null,
    statusElement,
    feedbackAssets = DEFAULT_FEEDBACK_ASSETS,
    backgroundImage,
    timePerQuestionMs = DEFAULT_TIMER_MS,
  } = config;

  const questions = normalizeWordEntries(rawQuestions);
  const firstSentence = normalizeFirstSentence(rawFirstSentence);
  const tonePlayer = createTonePlayer();

  return class GameTwoScene extends Phaser.Scene {
    constructor() {
      super("GameTwoScene");
      this.questions = questions;
      this.totalQuestions = questions.length;
      this.firstSentence = firstSentence;
      this.feedbackAssets = feedbackAssets;
      this.backgroundImageKey = null;
      this.timePerQuestionMs = Math.max(5000, timePerQuestionMs);
      this.statusElement = statusElement;
      this.defaultTimerLabel = `Time: ${(this.timePerQuestionMs / 1000).toFixed(
        1
      )}s`;
      this.score = 0;
      this.currentIndex = -1;
      this.awaitingAnswer = false;
      this.activeTimer = null;
      this.bankTokens = [];
      this.arrangedTokens = [];
      this.assembledWords = [];
      this.runState = "idle";
      this.gameUiElements = [];
      this.topHudElements = [];
      this.startButton = null;
      this.feedbackBackdrop = null;
      this.feedbackGroup = null;
      this.feedbackPanel = null;
      this.feedbackIcon = null;
      this.feedbackLabel = null;
      this.feedbackAnswerText = null;
      this.previewPanel = null;
      this.summaryOverlay = null;
      this.summaryBackdrop = null;
      this.summaryTitle = null;
      this.summaryBody = null;
      this.orientationLocked = false;
      this.scaleListenersAttached = false;
      this.activeAudio = null;
      this.pendingAudioToken = 0;
      this.lastFeedbackDurationMs = 0;
      this.pendingSentenceEvent = null;
    }

    preload() {
      const backgroundAsset = trimText(backgroundImage);
      const bg = backgroundAsset?.length
        ? backgroundAsset
        : DEFAULT_BACKGROUND_IMAGE;

      this.backgroundImageKey = "word-game-bg";
      this.load.image(this.backgroundImageKey, bg);

      this.questions.forEach((question) => {
        if (question.audioKey && question.audio) {
          this.load.audio(question.audioKey, question.audio);
        }
      });

      if (this.firstSentence?.audioKey && this.firstSentence.audio) {
        this.load.audio(this.firstSentence.audioKey, this.firstSentence.audio);
      }

      if (this.feedbackAssets.correctAudio) {
        this.load.audio(
          "word-game-correct",
          this.feedbackAssets.correctAudio
        );
      }
      if (this.feedbackAssets.incorrectAudio) {
        this.load.audio(
          "word-game-incorrect",
          this.feedbackAssets.incorrectAudio
        );
      }
      if (this.feedbackAssets.timeoutAudio) {
        this.load.audio(
          "word-game-timeout",
          this.feedbackAssets.timeoutAudio
        );
      }
      if (this.feedbackAssets.correctImg) {
        this.load.image(
          "word-game-correct-img",
          this.feedbackAssets.correctImg
        );
      }
      if (this.feedbackAssets.incorrectImg) {
        this.load.image(
          "word-game-incorrect-img",
          this.feedbackAssets.incorrectImg
        );
      }
      if (this.feedbackAssets.timeoutImg) {
        this.load.image(
          "word-game-timeout-img",
          this.feedbackAssets.timeoutImg
        );
      }
    }
    create() {
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
      this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

      const { width, height } = this.sys.game.canvas;
      this.cameras.main.setBackgroundColor("#edf2fb");
      this.gameUiElements = [];
      this.topHudElements = [];

      this.background = this.add
        .image(width / 2, height / 2, this.backgroundImageKey)
        .setOrigin(0.5)
        .setDepth(0);
      this.background.displayWidth = width;
      this.background.displayHeight = height;

      const accentLeft = this.add.circle(
        width * 0.18,
        height * 0.82,
        180,
        0x1f6feb,
        0.08
      );
      accentLeft.setBlendMode(Phaser.BlendModes.SCREEN);
      accentLeft.setDepth(0.5);
      this.gameUiElements.push(accentLeft);

      const accentRight = this.add.circle(
        width * 0.82,
        height * 0.26,
        210,
        0xf0ab00,
        0.08
      );
      accentRight.setBlendMode(Phaser.BlendModes.SCREEN);
      accentRight.setDepth(0.5);
      this.gameUiElements.push(accentRight);

      const topBar = createRoundedPanel(this, width * 0.82, 120, 28);
      topBar.update({
        fillColor: 0xffffff,
        fillAlpha: 0.85,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.18,
        lineWidth: 2,
      });
      topBar.graphics.setPosition(width / 2, 90);
      topBar.graphics.setDepth(2);
      this.topHudElements.push(topBar.graphics);

      this.phaseText = this.add
        .text(width / 2, 70, "Ready to start?", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "34px",
          color: "#0f172a",
          fontStyle: "bold",
          letterSpacing: 0.6,
        })
        .setOrigin(0.5, 0);
      this.phaseText.setDepth(3);
      this.topHudElements.push(this.phaseText);

      const badgeHeight = 68;
      const timerBadgeWidth = 200;
      this.timerPanel = createRoundedPanel(this, timerBadgeWidth, badgeHeight, 20);
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
          fontSize: "26px",
          color: "#1f2937",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.timerBadge = this.add.container(timerBadgeWidth / 2 + 90, 108, [
        this.timerPanel.graphics,
        this.timerText,
      ]);
      this.timerBadge.setDepth(3);
      this.topHudElements.push(this.timerBadge);

      const scoreBadgeWidth = 200;
      this.scorePanel = createRoundedPanel(this, scoreBadgeWidth, badgeHeight, 20);
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
          fontSize: "26px",
          color: "#1d4ed8",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.scoreBadge = this.add.container(width - scoreBadgeWidth / 2 - 90, 108, [
        this.scorePanel.graphics,
        this.scoreText,
      ]);
      this.scoreBadge.setDepth(3);
      this.topHudElements.push(this.scoreBadge);

      const targetPanel = createRoundedPanel(this, width * 0.82, 200, 28, {
        fillColor: 0xf8fafc,
        fillAlpha: 0.98,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.4,
        lineWidth: 3,
      });
      targetPanel.graphics.setPosition(width / 2, height / 2 - 80);
      this.targetPanel = targetPanel;

      this.targetContainer = this.add.container(width / 2, height / 2 - 80);
      this.targetArea = {
        width: width * 0.76,
        height: 160,
      };

      const bankPanel = createRoundedPanel(this, width * 0.82, 180, 26, {
        fillColor: 0xffffff,
        fillAlpha: 0.95,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.35,
        lineWidth: 3,
      });
      bankPanel.graphics.setPosition(width / 2, height - 130);
      this.bankPanel = bankPanel;

      this.bankContainer = this.add.container(width / 2, height - 130);
      this.bankArea = {
        width: width * 0.76,
        height: 140,
      };
      this.setWordAreasVisible(false);

      this.previewPanel = createRoundedPanel(this, width * 0.82, 80, 26, {
        fillColor: 0xffffff,
        fillAlpha: 0.94,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.4,
        lineWidth: 2,
      });
      this.previewPanel.graphics.setPosition(width / 2, height / 2 + 80);
      this.previewPanel.graphics.setDepth(2);
      this.gameUiElements.push(this.previewPanel.graphics);

      this.previewText = this.add
        .text(width / 2, height / 2 + 80, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "26px",
          color: "#0f172a",
          align: "center",
          wordWrap: { width: width * 0.78 },
        })
        .setOrigin(0.5)
        .setDepth(3);
      this.setPreviewVisible(false);
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

      const feedbackWidth = Math.min(width * 0.82, 760);
      const feedbackHeight = 240;
      this.feedbackGroup = this.add.container(width / 2, height / 2 + 120);
      this.feedbackGroup.setAlpha(0);
      this.feedbackGroup.setDepth(9);
      const feedbackPanel = createRoundedPanel(this, feedbackWidth, feedbackHeight, 32);
      feedbackPanel.update({
        fillColor: 0xffffff,
        fillAlpha: 0.98,
        strokeColor: 0x1f2933,
        strokeAlpha: 0.2,
        lineWidth: 3,
      });
      this.feedbackPanel = feedbackPanel;
      this.feedbackIcon = this.add
        .image(-feedbackWidth / 2 + 60, -feedbackHeight / 2 + 60, "")
        .setVisible(false)
        .setScale(0.9);
      this.feedbackLabel = this.add
        .text(0, -feedbackHeight / 2 + 40, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: 32,
          color: "#1f2933",
          fontStyle: "bold",
          align: "center",
        })
        .setOrigin(0.5);
      this.feedbackAnswerText = this.add
        .text(0, -feedbackHeight / 2 + 90, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: 26,
          color: "#0f172a",
          align: "center",
          wordWrap: { width: feedbackWidth - 120 },
        })
        .setOrigin(0.5, 0)
        .setVisible(false);
      this.feedbackGroup.add([
        feedbackPanel.graphics,
        this.feedbackIcon,
        this.feedbackLabel,
        this.feedbackAnswerText,
      ]);

      this.summaryBackdrop = this.add.rectangle(
        width / 2,
        height / 2,
        width,
        height,
        0x0f172a,
        0.45
      );
      this.summaryBackdrop.setVisible(false);
      this.summaryBackdrop.setAlpha(0);
      this.summaryBackdrop.setDepth(18);

      this.summaryOverlay = this.add.container(width / 2, height / 2);
      const summaryPanel = createRoundedPanel(this, 520, 300, 32, {
        fillColor: 0xffffff,
        fillAlpha: 0.98,
        strokeColor: 0x0f172a,
        strokeAlpha: 0.15,
        lineWidth: 3,
      });
      summaryPanel.graphics.setDepth(19);
      this.summaryTitle = this.add
        .text(0, -80, "Great job!", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "34px",
          color: "#0f172a",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.summaryBody = this.add
        .text(0, 0, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "24px",
          color: "#0f172a",
          align: "center",
          wordWrap: { width: 460 },
        })
        .setOrigin(0.5);
      const replayButton = createPrimaryButton(this, "Replay", 200, 64, {
        onClick: () => this.handleReplayPressed(),
      });
      replayButton.container.setPosition(0, 110);
      this.summaryOverlay.add([
        summaryPanel.graphics,
        this.summaryTitle,
        this.summaryBody,
        replayButton.container,
      ]);
      this.summaryOverlay.setDepth(19);
      this.summaryOverlay.setVisible(false);
      this.summaryOverlay.setAlpha(0);

      this.createCenterStartButton(width, height);
      this.registerFeedbackSounds();
      this.attachScaleListeners();
      this.input.on("pointerdown", this.requestFullscreen, this);

      this.prepareIdleState();

      if (this.statusElement) {
        this.statusElement.textContent = "Press Start to play.";
        this.statusElement.classList.add("is-visible");
        this.statusElement.classList.remove("is-error");
      }
    }
    prepareIdleState() {
      this.runState = "idle";
      this.stopTimer(true);
      this.cancelPendingSentencePlayback();
      this.resetTokens();
      this.hideFeedback();
      this.setPreviewVisible(false);
      this.setWordAreasVisible(false);
      if (this.previewText) {
        this.previewText.setText("");
      }
      this.setTopHudVisible(false);
      this.setStartButtonState("Start", false, true);
      this.hideSummary();
      if (this.statusElement) {
        this.statusElement.textContent = "Press Start to play.";
        this.statusElement.classList.remove("is-error");
        this.statusElement.classList.remove("is-transparent");
        this.statusElement.classList.add("is-visible");
      }
    }

    createCenterStartButton(width, height) {
      const buttonWidth = 512;
      const buttonHeight = 202;
      this.startButton = createBarButton(this, "Start", buttonWidth, buttonHeight, {
        onClick: () => this.handleStartPressed(false),
        baseColor: 0x1f6feb,
      });
      this.startButton.container.setPosition(width / 2, height / 2);
      this.startButton.container.setDepth(12);
      this.tweens.add({
        targets: this.startButton.container,
        scale: 1.04,
        duration: 500,
        ease: "Sine.linear",
        repeat: -1,
        yoyo: true,
      });
    }

    setStartButtonState(label, disabled = false, visible = true) {
      if (!this.startButton) {
        return;
      }
      this.startButton.text.setText(label);
      this.startButton.container.setVisible(visible);
      if (disabled) {
        this.startButton.container.disableInteractive();
        this.startButton.background.update(this.startButton.styles.disabled);
      } else {
        this.startButton.container.setInteractive({ useHandCursor: true });
        this.startButton.background.update(this.startButton.styles.base);
      }
    }

    setTopHudVisible(isVisible) {
      this.topHudElements.forEach((element) => {
        if (element?.setVisible) {
          element.setVisible(isVisible);
        } else if (element) {
          element.visible = isVisible;
        }
      });
    }

    setWordAreasVisible(isVisible) {
      [this.targetPanel?.graphics, this.bankPanel?.graphics].forEach(
        (panel) => {
          if (panel) {
            panel.setVisible(isVisible);
          }
        }
      );
      [this.targetContainer, this.bankContainer].forEach((container) => {
        if (!container) {
          return;
        }
        container.setVisible(isVisible);
        container.setActive(isVisible);
      });
    }

    setPreviewVisible(isVisible) {
      if (this.previewPanel?.graphics) {
        this.previewPanel.graphics.setVisible(isVisible);
      }
      if (this.previewText) {
        this.previewText.setVisible(isVisible);
        this.previewText.setActive?.(isVisible);
      }
    }

    cancelPendingSentencePlayback() {
      if (this.pendingSentenceEvent) {
        this.pendingSentenceEvent.remove();
        this.pendingSentenceEvent = null;
      }
    }

    queueSentencePlayback(entry, onComplete) {
      this.cancelPendingSentencePlayback();
      if (!entry) {
        onComplete?.();
        return;
      }
      const waitMs = Math.max(0, this.lastFeedbackDurationMs) + 1000;
      this.pendingSentenceEvent = this.time.delayedCall(waitMs, () => {
        this.pendingSentenceEvent = null;
        this.playSentenceAudio(entry, onComplete);
      });
    }

    registerFeedbackSounds() {
      const audioCache = this.cache?.audio;
      if (!this.sound || !audioCache || typeof audioCache.exists !== "function") {
        return;
      }
      [
        this.feedbackAssets?.correctAudio ? "word-game-correct" : null,
        this.feedbackAssets?.incorrectAudio ? "word-game-incorrect" : null,
        this.feedbackAssets?.timeoutAudio ? "word-game-timeout" : null,
      ].forEach((key) => {
        if (!key || !audioCache.exists(key) || this.sound.get(key)) {
          return;
        }
        this.sound.add(key);
      });
    }

    handleStartPressed(autoStart = false) {
      if (this.runState === "loading") {
        return;
      }
      if (!autoStart) {
        this.requestFullscreen();
      }
      this.runState = "loading";
      this.setStartButtonState("Loading...", true, true);
      this.hideSummary();
      if (this.statusElement) {
        this.statusElement.textContent = "Preparing game...";
        this.statusElement.classList.remove("is-error");
        this.statusElement.classList.remove("is-transparent");
        this.statusElement.classList.add("is-visible");
      }
      this.time.delayedCall(160, () => {
        this.setStartButtonState("Start", true, false);
        this.startGame();
      });
    }

    hideSummary() {
      if (this.summaryOverlay) {
        this.summaryOverlay.setVisible(false);
        this.summaryOverlay.setAlpha(0);
      }
      if (this.summaryBackdrop) {
        this.summaryBackdrop.setVisible(false);
        this.summaryBackdrop.setAlpha(0);
      }
    }

    startGame() {
      if (!this.questions.length) {
        if (this.statusElement) {
          this.statusElement.textContent = "The game content is not ready yet.";
          this.statusElement.classList.add("is-error");
        }
        this.prepareIdleState();
        return;
      }
      this.score = 0;
      this.currentIndex = -1;
      this.updateScoreText();
      this.setTopHudVisible(true);
      this.clearFeedback();
      this.resetTokens();
      this.cancelPendingSentencePlayback();
      this.setPreviewVisible(true);
      if (this.previewText) {
        this.previewText.setText("");
      }
      this.setWordAreasVisible(!this.firstSentence);
      this.runState = "running";
      this.updateTimerText(this.defaultTimerLabel);
      if (this.statusElement) {
        this.statusElement.textContent = "Arrange the words before time runs out.";
        this.statusElement.classList.add("is-visible");
        this.statusElement.classList.remove("is-error");
        this.statusElement.classList.remove("is-transparent");
      }
      if (this.firstSentence) {
        if (this.previewText) {
          this.previewText.setText(this.firstSentence.text);
        }
        this.playSentenceAudio(this.firstSentence, () => {
          this.time.delayedCall(500, () => {
            this.setWordAreasVisible(true);
            this.advanceQuestion();
          });
        });
        return;
      }
      this.setWordAreasVisible(true);
      this.time.delayedCall(300, () => this.advanceQuestion());
    }

    updateQuestionLabel() {
      if (this.currentIndex < 0) {
        this.phaseText.setText("Ready to start?");
        this.phaseText.setColor("#0f172a");
        return;
      }
      this.phaseText.setText(
        `Question ${this.currentIndex + 1} of ${this.totalQuestions}`
      );
      this.phaseText.setColor("#1d4ed8");
    }

    advanceQuestion() {
      this.stopTimer(true);
      this.cancelPendingSentencePlayback();
      this.setWordAreasVisible(true);
      this.setPreviewVisible(true);
      this.clearFeedback();
      this.resetTokens();
      this.currentIndex += 1;
      if (this.currentIndex >= this.totalQuestions) {
        this.finishGame();
        return;
      }
      this.updateQuestionLabel();
      const question = this.questions[this.currentIndex];
      this.assembledWords = [];
      this.awaitingAnswer = true;
      this.createTokens(question);
      this.startTimer();
      if (this.statusElement) {
        this.statusElement.textContent = `Question ${this.currentIndex + 1} of ${this.totalQuestions}`;
        this.statusElement.classList.add("is-transparent");
      }
    }

    startTimer() {
      let remaining = this.timePerQuestionMs;
      this.updateTimerText(remaining);
      this.activeTimer?.remove?.();
      this.activeTimer = this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          remaining -= 100;
          if (remaining <= 0) {
            this.updateTimerText(0);
            this.activeTimer?.remove?.();
            this.activeTimer = null;
            this.handleTimeout();
            return;
          }
          this.updateTimerText(remaining);
        },
      });
    }
    stopTimer(resetDisplay = true) {
      this.activeTimer?.remove?.();
      this.activeTimer = null;
      if (resetDisplay) {
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

    createTokens(question) {
      const shuffled = shuffleArray(question.words);
      let attempts = 0;
      while (
        JSON.stringify(shuffled) === JSON.stringify(question.words) &&
        attempts < 5
      ) {
        attempts += 1;
        shuffled.splice(0, shuffled.length, ...shuffleArray(question.words));
      }
      this.bankTokens = shuffled.map((word, index) =>
        createToken(this, word, index, (token) => this.toggleToken(token))
      );
      const firstWord = question?.words?.[0] ?? null;
      let hintApplied = false;
      this.bankTokens.forEach((token) => {
        token.state = "bank";
        this.bankContainer.add(token.container);
        setTokenStyle(token, "bank");
        const shouldHighlight = Boolean(
          !hintApplied && firstWord && token.word === firstWord
        );
        if (shouldHighlight) {
          // Bold the true starting word to provide a subtle hint.
          token.text.setFontStyle("bold");
          token.isHint = true;
          hintApplied = true;
        } else {
          token.text.setFontStyle("normal");
          token.isHint = false;
        }
      });
      this.arrangedTokens = [];
      this.layoutTokens();
    }

    toggleToken(token) {
      if (!this.awaitingAnswer || !token) {
        return;
      }
      if (token.state === "bank") {
        token.state = "target";
        this.arrangedTokens.push(token);
        this.assembledWords.push(token.word);
        this.targetContainer.add(token.container);
        setTokenStyle(token, "selected");
      } else if (token.state === "target") {
        token.state = "bank";
        this.arrangedTokens = this.arrangedTokens.filter((t) => t !== token);
        const index = this.assembledWords.lastIndexOf(token.word);
        if (index >= 0) {
          this.assembledWords.splice(index, 1);
        }
        this.bankContainer.add(token.container);
        setTokenStyle(token, "bank");
      }
      this.layoutTokens();
      if (this.previewText) {
        this.previewText.setText(joinWordsForDisplay(this.assembledWords));
      }
      const question = this.questions[this.currentIndex];
      if (
        question &&
        this.assembledWords.length === question.words.length &&
        this.awaitingAnswer
      ) {
        this.checkAnswer();
      }
    }

    layoutTokens() {
      const layoutInto = (tokens, area, parent) => {
        if (!tokens.length || !parent) {
          return;
        }
        const columns = Math.min(tokens.length, 5);
        const spacingX = area.width / columns;
        const rows = Math.ceil(tokens.length / columns);
        const spacingY =
          rows > 1
            ? Math.min(area.height / rows, TOKEN_BASE_HEIGHT + 30)
            : TOKEN_BASE_HEIGHT + 10;
        tokens.forEach((token, idx) => {
          const row = Math.floor(idx / columns);
          const col = idx % columns;
          const x = -area.width / 2 + spacingX / 2 + col * spacingX;
          const y = -area.height / 2 + spacingY / 2 + row * spacingY;
          token.container.setPosition(x, y);
          parent.bringToTop(token.container);
        });
      };

      layoutInto(this.arrangedTokens, this.targetArea, this.targetContainer);
      const bankTokens = this.bankTokens.filter((token) => token.state === "bank");
      layoutInto(bankTokens, this.bankArea, this.bankContainer);
    }
    checkAnswer() {
      if (!this.awaitingAnswer) {
        return;
      }
      this.awaitingAnswer = false;
      this.stopTimer();
      const question = this.questions[this.currentIndex];
      const assembled = [...this.assembledWords];
      const isCorrect =
        assembled.length === question.words.length &&
        assembled.every((word, index) => word === question.words[index]);
      const detailSentence = question?.sentence ?? "";
      if (isCorrect) {
        this.score += 1;
        this.updateScoreText();
        this.setTokensFeedback("correct");
        this.showFeedback("correct", "Correct!", detailSentence);
        this.playFeedbackSound("correct");
      } else {
        this.setTokensFeedback("incorrect");
        this.showFeedback("incorrect", "Incorrect", detailSentence);
        this.playFeedbackSound("incorrect");
      }
      if (this.previewText) {
        this.previewText.setText("");
      }
      this.queueSentencePlayback(question, () => {
        this.time.delayedCall(1000, () => this.advanceQuestion());
      });
    }

    handleTimeout() {
      if (!this.awaitingAnswer) {
        return;
      }
      this.awaitingAnswer = false;
      const question = this.questions[this.currentIndex];
      this.setTokensFeedback("incorrect");
      this.showFeedback("timeout", "Time's up!", question?.sentence ?? "");
      this.playFeedbackSound("timeout");
      if (this.previewText) {
        this.previewText.setText("");
      }
      this.queueSentencePlayback(question, () => {
        this.time.delayedCall(1000, () => this.advanceQuestion());
      });
    }

    setTokensFeedback(kind) {
      const styleKey = kind === "correct" ? "correct" : "incorrect";
      this.arrangedTokens.forEach((token) => setTokenStyle(token, styleKey));
    }

    showFeedback(kind, message, detailText = "") {
      const colorMap = {
        correct: { border: 0x16a34a, text: "#065f46", texture: "word-game-correct-img" },
        incorrect: { border: 0xdc2626, text: "#7f1d1d", texture: "word-game-incorrect-img" },
        timeout: { border: 0xf97316, text: "#b45309", texture: "word-game-timeout-img" },
      };
      const style = colorMap[kind] ?? colorMap.incorrect;
      this.feedbackPanel.update({
        fillColor: 0xffffff,
        fillAlpha: 0.98,
        strokeColor: style.border,
        strokeAlpha: 0.35,
        lineWidth: 3,
      });
      if (style.texture && this.textures.exists(style.texture)) {
        this.feedbackIcon.setTexture(style.texture);
        this.feedbackIcon.setVisible(true);
      } else {
        this.feedbackIcon.setVisible(false);
      }
      this.feedbackLabel.setText(message);
      this.feedbackLabel.setColor(style.text);
      if (this.feedbackAnswerText) {
        const detail =
          typeof detailText === "string" && detailText.trim().length
            ? `Correct sentence:\n\n${detailText.trim()}`
            : "";
        this.feedbackAnswerText.setText(detail);
        this.feedbackAnswerText.setVisible(Boolean(detail));
      }
      this.feedbackBackdrop.setVisible(true);
      this.tweens.killTweensOf(this.feedbackBackdrop);
      this.tweens.add({
        targets: this.feedbackBackdrop,
        alpha: 1,
        duration: 200,
        ease: "Sine.easeOut",
      });
      this.tweens.add({
        targets: this.feedbackGroup,
        alpha: 1,
        scale: { from: 0.9, to: 1 },
        duration: 220,
        ease: "Sine.easeOut",
      });
    }

    hideFeedback() {
      if (!this.feedbackGroup) {
        return;
      }
      this.feedbackGroup.setAlpha(0);
      this.feedbackGroup.setScale(1);
      this.feedbackIcon.setVisible(false);
      this.feedbackLabel.setText("");
      if (this.feedbackAnswerText) {
        this.feedbackAnswerText.setText("");
        this.feedbackAnswerText.setVisible(false);
      }
      if (this.feedbackBackdrop?.visible) {
        this.tweens.killTweensOf(this.feedbackBackdrop);
        this.tweens.add({
          targets: this.feedbackBackdrop,
          alpha: 0,
          duration: 200,
          ease: "Sine.easeInOut",
          onComplete: () => this.feedbackBackdrop.setVisible(false),
        });
      }
    }

    clearFeedback() {
      this.hideFeedback();
      if (this.previewText) {
        this.previewText.setText("");
      }
      this.lastFeedbackDurationMs = 0;
    }

    playFeedbackSound(type) {
      const keyMap = {
        correct: "word-game-correct",
        incorrect: "word-game-incorrect",
        timeout: "word-game-timeout",
      };
      const key = keyMap[type];
      let durationMs = 0;
      let usedToneFallback = false;
      if (key) {
        const sound = this.sound.get(key);
        if (sound) {
          sound.play();
          const resolvedDuration =
            sound.totalDuration && sound.totalDuration > 0
              ? sound.totalDuration
              : sound.duration && sound.duration > 0
              ? sound.duration
              : sound.config?.duration && sound.config.duration > 0
              ? sound.config.duration
              : 0;
          durationMs = Math.round(resolvedDuration * 1000);
        } else {
          usedToneFallback = true;
        }
      } else {
        usedToneFallback = true;
      }
      if (usedToneFallback) {
        if (type === "correct") {
          durationMs = 200;
          tonePlayer.play(620, durationMs);
        } else if (type === "incorrect") {
          durationMs = 320;
          tonePlayer.play(320, durationMs);
        } else {
          durationMs = 420;
          tonePlayer.play(260, durationMs);
        }
      } else if (!durationMs) {
        durationMs = 1000;
      }
      this.lastFeedbackDurationMs = durationMs;
      return durationMs;
    }

    playSentenceAudio(entry, onComplete) {
      this.stopSentenceAudio();
      this.pendingAudioToken += 1;
      const token = this.pendingAudioToken;
      if (entry?.audioKey) {
        const sound = this.sound.get(entry.audioKey) ?? this.sound.add(entry.audioKey);
        if (sound) {
          this.activeAudio = sound;
          sound.once(Phaser.Sound.Events.COMPLETE, () => {
            if (token === this.pendingAudioToken) {
              onComplete?.();
            }
          });
          sound.play();
          return;
        }
      }
      this.time.delayedCall(500, () => {
        if (token === this.pendingAudioToken) {
          onComplete?.();
        }
      });
    }

    stopSentenceAudio() {
      if (this.activeAudio) {
        this.activeAudio.stop();
        this.activeAudio = null;
      }
    }

    resetTokens() {
      [...this.bankTokens, ...this.arrangedTokens].forEach((token) => {
        token.container.destroy();
      });
      this.bankTokens = [];
      this.arrangedTokens = [];
      this.assembledWords = [];
    }
    finishGame() {
      this.stopTimer(true);
      this.cancelPendingSentencePlayback();
      this.awaitingAnswer = false;
      this.runState = "finished";
      this.hideFeedback();
      this.setPreviewVisible(false);
      if (this.previewText) {
        this.previewText.setText("");
      }
      if (this.statusElement) {
        this.statusElement.textContent =
          "All sentences complete! Tap Replay to try again.";
        this.statusElement.classList.remove("is-transparent");
        this.statusElement.classList.add("is-visible");
      }
      this.time.delayedCall(300, () => this.showSummary());
      this.setStartButtonState("Start", false, true);
    }

    showSummary() {
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
        `You arranged ${this.score} of ${this.totalQuestions} sentences correctly.\nYour score: ${percentage}%`
      );
      this.summaryBackdrop.setVisible(true);
      this.summaryOverlay.setVisible(true);
      this.tweens.killTweensOf(this.summaryBackdrop);
      this.tweens.add({
        targets: this.summaryBackdrop,
        alpha: 1,
        duration: 260,
        ease: "Sine.easeOut",
      });
      this.tweens.killTweensOf(this.summaryOverlay);
      this.tweens.add({
        targets: this.summaryOverlay,
        alpha: 1,
        scale: { from: 0.9, to: 1 },
        duration: 320,
        ease: "Back.easeOut",
      });
    }

    handleReplayPressed() {
      this.hideSummary();
      this.handleStartPressed(true);
    }

    requestFullscreen() {
      if (this.scale.isFullscreen) {
        return;
      }
      const target = this.scale.parent || this.game.canvas;
      try {
        this.scale.startFullscreen({ target, navigationUI: "hide" });
      } catch (error) {
        // ignore inability to enter fullscreen without user gesture
      }
    }

    attachScaleListeners() {
      if (this.scaleListenersAttached) {
        return;
      }
      this.scale.on("enterfullscreen", this.handleEnterFullscreen, this);
      this.scale.on("leavefullscreen", this.handleLeaveFullscreen, this);
      this.scaleListenersAttached = true;
    }

    async lockLandscapeOrientation() {
      if (!isMobileDevice() || typeof window === "undefined") {
        return;
      }
      const screenRef = window.screen;
      if (!screenRef) {
        return;
      }
      const orientation = screenRef.orientation;
      if (orientation?.lock) {
        try {
          await orientation.lock("landscape");
          this.orientationLocked = true;
          return;
        } catch (error) {
          this.orientationLocked = false;
        }
      }
      const legacyLock =
        screenRef.lockOrientation ||
        screenRef.mozLockOrientation ||
        screenRef.msLockOrientation;
      if (legacyLock) {
        try {
          legacyLock.call(screenRef, "landscape");
          this.orientationLocked = true;
        } catch (error) {
          this.orientationLocked = false;
        }
      }
    }

    unlockOrientation() {
      if (!this.orientationLocked || typeof window === "undefined") {
        return;
      }
      const screenRef = window.screen;
      if (!screenRef) {
        return;
      }
      const orientation = screenRef.orientation;
      if (orientation?.unlock) {
        try {
          orientation.unlock();
        } catch (error) {
          // ignore
        }
      }
      const legacyUnlock =
        screenRef.unlockOrientation ||
        screenRef.mozUnlockOrientation ||
        screenRef.msUnlockOrientation;
      if (legacyUnlock) {
        try {
          legacyUnlock.call(screenRef);
        } catch (error) {
          // ignore
        }
      }
      this.orientationLocked = false;
    }

    handleEnterFullscreen() {
      this.lockLandscapeOrientation();
    }

    handleLeaveFullscreen() {
      this.unlockOrientation();
    }

    shutdown() {
      this.stopTimer(false);
      this.stopSentenceAudio();
      this.cancelPendingSentencePlayback();
      this.input?.off?.("pointerdown", this.requestFullscreen, this);
      if (this.scaleListenersAttached) {
        this.scale.off("enterfullscreen", this.handleEnterFullscreen, this);
        this.scale.off("leavefullscreen", this.handleLeaveFullscreen, this);
        this.scaleListenersAttached = false;
      }
      this.unlockOrientation();
    }
  };
};
