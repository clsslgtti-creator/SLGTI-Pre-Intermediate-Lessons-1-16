const DEFAULT_BACKGROUND_IMAGE = "assets/img/game/bg-6.jpg";
const DEFAULT_TIMER_MS = 20000;
const MIN_TIMER_MS = 20000;
const MAX_TIMER_MS = 60000;

export const DEFAULT_FEEDBACK_ASSETS = {
  correctAudio: "assets/audio/game/correct.wav",
  incorrectAudio: "assets/audio/game/incorrect.wav",
  timeoutAudio: "assets/audio/game/timeout.wav",
  correctImg: "assets/img/game/correct.png",
  incorrectImg: "assets/img/game/incorrect.png",
  timeoutImg: "assets/img/game/timeout.png",
};

const trimText = (value) => (typeof value === "string" ? value.trim() : "");

const clampDuration = (value, fallback) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }
  return Math.min(Math.max(numericValue, MIN_TIMER_MS), MAX_TIMER_MS);
};

const normalizeOptions = (rawOptions, answer) => {
  const rawList = Array.isArray(rawOptions) ? rawOptions : [];
  const trimmed = rawList.map((option) => trimText(option)).filter(Boolean);
  const unique = [];
  trimmed.forEach((option) => {
    const lower = option.toLowerCase();
    if (!unique.some((item) => item.toLowerCase() === lower)) {
      unique.push(option);
    }
  });

  const cleanAnswer = trimText(answer);
  if (
    cleanAnswer &&
    !unique.some((option) => option.toLowerCase() === cleanAnswer.toLowerCase())
  ) {
    unique.unshift(cleanAnswer);
  }

  return unique.slice(0, 4);
};

export const normalizeFillBlankQuestions = (rawQuestions = []) => {
  if (!Array.isArray(rawQuestions)) {
    return [];
  }

  return rawQuestions
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const id = trimText(item.id) || `blank_${index + 1}`;
      const sentence1 = trimText(item.sentence_1 ?? item.sentence1);
      const sentence2 = trimText(item.sentence_2 ?? item.sentence2);
      if (!sentence1) {
        return null;
      }

      const answer1 = trimText(item.answer_1 ?? item.answer1);
      const answer2 = trimText(item.answer_2 ?? item.answer2);
      const options1 = normalizeOptions(item.options_1 ?? item.options1, answer1);
      const options2 = normalizeOptions(item.options_2 ?? item.options2, answer2);
      const fullSentence = trimText(
        item.full_sentance ?? item.full_sentence ?? item.fullSentence
      );
      const audio = trimText(item.audio);
      const audioKey = audio ? `fill_blank_${id}` : null;
      const image = trimText(item.image);
      const imageKey = image ? `fill_blank_img_${id}` : null;

      return {
        id,
        sentence1,
        sentence2,
        options1,
        options2,
        answer1,
        answer2,
        fullSentence,
        audio,
        audioKey,
        image,
        imageKey,
        hasSecondBlank: Boolean(sentence2 && options2.length),
      };
    })
    .filter(Boolean);
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

const OPTION_STYLES = {
  base: {
    fillColor: 0xffffff,
    fillAlpha: 1,
    strokeColor: 0x93c5fd,
    strokeAlpha: 0.9,
    lineWidth: 2,
    textColor: "#0f172a",
  },
  hover: {
    fillColor: 0xf1f5f9,
    fillAlpha: 1,
    strokeColor: 0x2563eb,
    strokeAlpha: 0.9,
    lineWidth: 2,
    textColor: "#0f172a",
  },
  selected: {
    fillColor: 0xdbeafe,
    fillAlpha: 1,
    strokeColor: 0x2563eb,
    strokeAlpha: 1,
    lineWidth: 3,
    textColor: "#1d4ed8",
  },
  correct: {
    fillColor: 0xecfdf5,
    fillAlpha: 1,
    strokeColor: 0x16a34a,
    strokeAlpha: 1,
    lineWidth: 3,
    textColor: "#065f46",
  },
  incorrect: {
    fillColor: 0xfee2e2,
    fillAlpha: 1,
    strokeColor: 0xdc2626,
    strokeAlpha: 1,
    lineWidth: 3,
    textColor: "#7f1d1d",
  },
  disabled: {
    fillColor: 0xe2e8f0,
    fillAlpha: 1,
    strokeColor: 0xcbd5f5,
    strokeAlpha: 0.8,
    lineWidth: 2,
    textColor: "#64748b",
  },
};

const applyOptionStyle = (button, styleKey) => {
  const style = OPTION_STYLES[styleKey] ?? OPTION_STYLES.base;
  button.background.update({
    fillColor: style.fillColor,
    fillAlpha: style.fillAlpha,
    strokeColor: style.strokeColor,
    strokeAlpha: style.strokeAlpha,
    lineWidth: style.lineWidth,
  });
  button.text.setColor(style.textColor);
  button.state = styleKey;
};

const createOptionButton = (scene, width, height, onClick) => {
  const background = createRoundedPanel(scene, width, height, 20, {
    fillColor: OPTION_STYLES.base.fillColor,
    fillAlpha: OPTION_STYLES.base.fillAlpha,
    strokeColor: OPTION_STYLES.base.strokeColor,
    strokeAlpha: OPTION_STYLES.base.strokeAlpha,
    lineWidth: OPTION_STYLES.base.lineWidth,
  });

  const text = scene.add
    .text(0, 0, "", {
      fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
      fontSize: "26px",
      color: OPTION_STYLES.base.textColor,
      align: "center",
      wordWrap: { width: width - 60 },
    })
    .setOrigin(0.5);

  const container = scene.add.container(0, 0, [background.graphics, text]);
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });

  const button = {
    container,
    background,
    text,
    value: "",
    valueLower: "",
    state: "base",
    disabled: false,
    visible: true,
    setLabel(value) {
      const label = trimText(value);
      this.value = label;
      this.valueLower = label.toLowerCase();
      this.text.setText(label);
    },
    setState(styleKey) {
      applyOptionStyle(this, styleKey);
    },
    setEnabled(enabled) {
      this.disabled = !enabled;
      if (enabled) {
        this.container.setInteractive({ useHandCursor: true });
      } else {
        this.container.disableInteractive();
      }
    },
    setVisible(isVisible) {
      this.visible = isVisible;
      this.container.setVisible(isVisible);
      this.container.setActive(isVisible);
      if (!isVisible) {
        this.container.disableInteractive();
      }
    },
  };

  container.on("pointerover", () => {
    if (button.disabled || button.state !== "base") {
      return;
    }
    button.setState("hover");
  });
  container.on("pointerout", () => {
    if (button.disabled || button.state !== "hover") {
      return;
    }
    button.setState("base");
  });
  container.on("pointerdown", () => {
    if (button.disabled || button.state !== "hover") {
      return;
    }
    button.setState("selected");
  });
  container.on("pointerup", () => {
    if (button.disabled) {
      return;
    }
    onClick?.(button);
  });

  return button;
};
const createPrimaryButton = (
  scene,
  label,
  width,
  height,
  { onClick, baseColor = 0x1f6feb, textSize = 44 } = {}
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
      fontSize: `${textSize}px`,
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

const renderSentence = (sentence, fill) => {
  const trimmed = trimText(sentence);
  if (!trimmed) {
    return "";
  }
  const replacement = trimText(fill) || "_____";
  if (/_+/.test(trimmed)) {
    return trimmed.replace(/_{2,}/g, replacement);
  }
  return trimmed;
};

const buildFullSentence = (question) => {
  if (!question) {
    return "";
  }
  if (question.fullSentence) {
    return question.fullSentence;
  }
  const first = renderSentence(question.sentence1, question.answer1);
  const second = question.sentence2
    ? renderSentence(question.sentence2, question.answer2)
    : "";
  return [first, second].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
};

const matchesAnswer = (selected, answer) => {
  const normalizedSelected = trimText(selected).toLowerCase();
  const normalizedAnswer = trimText(answer).toLowerCase();
  if (!normalizedAnswer) {
    return true;
  }
  if (!normalizedSelected) {
    return false;
  }
  return normalizedSelected === normalizedAnswer;
};

const createOptionRow = (
  scene,
  { width, buttonWidth, buttonHeight, gap = 16, onSelect }
) => {
  const buttons = Array.from({ length: 4 }, () =>
    createOptionButton(scene, buttonWidth, buttonHeight, (button) =>
      onSelect?.(button)
    )
  );

  const container = scene.add.container(0, 0, [
    ...buttons.map((button) => button.container),
  ]);
  container.setSize(width, buttonHeight);

  const row = {
    container,
    buttons,
    selectedValue: "",
    selectedLower: "",
    enabled: true,
    setOptions(options = []) {
      const normalized = Array.isArray(options)
        ? options.map((option) => trimText(option)).filter(Boolean)
        : [];
      const visibleCount = Math.min(normalized.length, buttons.length);
      const totalWidth =
        visibleCount * buttonWidth + Math.max(visibleCount - 1, 0) * gap;
      const startX = -totalWidth / 2;

      buttons.forEach((button, index) => {
        if (index < visibleCount) {
          button.setLabel(normalized[index]);
          button.setState("base");
          button.setVisible(true);
          button.container.setPosition(
            startX + buttonWidth / 2 + index * (buttonWidth + gap),
            0
          );
          button.setEnabled(true);
        } else {
          button.setVisible(false);
        }
      });
    },
    setEnabled(enabled) {
      this.enabled = enabled;
      buttons.forEach((button) => {
        if (!button.visible) {
          return;
        }
        button.setEnabled(enabled);
      });
    },
    clearSelection() {
      this.selectedValue = "";
      this.selectedLower = "";
      buttons.forEach((button) => {
        if (button.visible) {
          button.setState("base");
        }
      });
    },
    selectValue(valueLower) {
      this.selectedLower = valueLower;
      this.selectedValue =
        buttons.find((button) => button.valueLower === valueLower)?.value || "";
      buttons.forEach((button) => {
        if (!button.visible) {
          return;
        }
        if (button.valueLower === valueLower) {
          button.setState("selected");
        } else {
          button.setState("base");
        }
      });
    },
    markResult(correctAnswerLower) {
      buttons.forEach((button) => {
        if (!button.visible) {
          return;
        }
        if (button.valueLower === correctAnswerLower) {
          button.setState("correct");
        } else if (
          this.selectedLower &&
          button.valueLower === this.selectedLower &&
          this.selectedLower !== correctAnswerLower
        ) {
          button.setState("incorrect");
        }
      });
    },
    setVisible(isVisible) {
      container.setVisible(isVisible);
      container.setActive(isVisible);
      if (!isVisible) {
        buttons.forEach((button) => button.setEnabled(false));
      }
    },
  };

  return row;
};
export const createGameScene = (config = {}) => {
  const {
    questions: rawQuestions = [],
    feedbackAssets = DEFAULT_FEEDBACK_ASSETS,
    backgroundImage,
    statusElement,
    timePerQuestionMs,
  } = config;

  const questions = normalizeFillBlankQuestions(rawQuestions);
  const tonePlayer = createTonePlayer();
  const resolvedTimerMs = clampDuration(timePerQuestionMs, DEFAULT_TIMER_MS);

  return class GameSixScene extends Phaser.Scene {
    constructor() {
      super("GameSixScene");
      this.questions = questions;
      this.totalQuestions = questions.length;
      this.feedbackAssets = feedbackAssets;
      this.statusElement = statusElement;
      this.timePerQuestionMs = resolvedTimerMs;
      this.defaultTimerLabel = `Time: ${(resolvedTimerMs / 1000).toFixed(1)}s`;
      this.pendingEvents = [];
      this.orientationLocked = false;
      this.scaleListenersAttached = false;
      this.resetState();
    }

    resetState() {
      this.currentIndex = -1;
      this.score = 0;
      this.awaitingAnswer = false;
      this.activeTimer = null;
      this.activeQuestion = null;
      this.activeAudio = null;
      this.pendingAudioToken = 0;
      this.countdownActive = false;
    }

    preload() {
      const backgroundAsset = trimText(backgroundImage);
      const resolvedBackground = backgroundAsset || DEFAULT_BACKGROUND_IMAGE;

      this.load.once("complete", () => {
        if (this.statusElement) {
          this.statusElement.textContent = "Press Start to play.";
          this.statusElement.classList.add("is-visible");
          this.statusElement.classList.remove("is-transparent");
          this.statusElement.classList.remove("is-error");
        }
      });

      this.load.image("fill-blank-bg", resolvedBackground);

      this.questions.forEach((question) => {
        if (question.audioKey && question.audio) {
          this.load.audio(question.audioKey, question.audio);
        }
        if (question.imageKey && question.image) {
          this.load.image(question.imageKey, question.image);
        }
      });

      if (this.feedbackAssets.correctAudio) {
        this.load.audio(
          "fill-blank-correct",
          this.feedbackAssets.correctAudio
        );
      }
      if (this.feedbackAssets.incorrectAudio) {
        this.load.audio(
          "fill-blank-incorrect",
          this.feedbackAssets.incorrectAudio
        );
      }
      if (this.feedbackAssets.timeoutAudio) {
        this.load.audio(
          "fill-blank-timeout",
          this.feedbackAssets.timeoutAudio
        );
      }
      if (this.feedbackAssets.correctImg) {
        this.load.image(
          "fill-blank-correct-img",
          this.feedbackAssets.correctImg
        );
      }
      if (this.feedbackAssets.incorrectImg) {
        this.load.image(
          "fill-blank-incorrect-img",
          this.feedbackAssets.incorrectImg
        );
      }
      if (this.feedbackAssets.timeoutImg) {
        this.load.image(
          "fill-blank-timeout-img",
          this.feedbackAssets.timeoutImg
        );
      }
    }

    create() {
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
      this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
      this.attachScaleListeners();
      this.input?.on?.("pointerdown", this.requestFullscreen, this);

      const { width, height } = this.sys.game.canvas;
      this.cameras.main.setBackgroundColor("#edf2fb");
      this.gameUiElements = [];

      this.background = this.add
        .image(width / 2, height / 2, "fill-blank-bg")
        .setOrigin(0.5)
        .setDepth(0);
      this.background.displayWidth = width;
      this.background.displayHeight = height;

      const accentLeft = this.add.circle(
        width * 0.16,
        height * 0.78,
        190,
        0x1f6feb,
        0.08
      );
      accentLeft.setBlendMode(Phaser.BlendModes.SCREEN);
      accentLeft.setDepth(0.5);
      this.gameUiElements.push(accentLeft);

      const accentRight = this.add.circle(
        width * 0.82,
        height * 0.24,
        220,
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
      this.gameUiElements.push(topBar.graphics);

      this.phaseText = this.add
        .text(width / 2, 70, "Ready to play?", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "34px",
          color: "#0f172a",
          fontStyle: "bold",
          letterSpacing: 0.6,
        })
        .setOrigin(0.5, 0);
      this.phaseText.setDepth(3);
      this.gameUiElements.push(this.phaseText);

      const badgeHeight = 60;
      const timerBadgeWidth = 200;
      this.timerPanel = createRoundedPanel(
        this,
        timerBadgeWidth,
        badgeHeight,
        20
      );
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
        .text(0, 0, this.defaultTimerLabel, {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "26px",
          color: "#1f2937",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.timerBadge = this.add.container(250, 85, [
        this.timerPanel.graphics,
        this.timerText,
      ]);
      this.timerBadge.setDepth(3);
      this.gameUiElements.push(this.timerBadge);

      const scoreBadgeWidth = 200;
      this.scorePanel = createRoundedPanel(
        this,
        scoreBadgeWidth,
        badgeHeight,
        20
      );
      this.scorePanel.update({
        fillColor: 0x1f6feb,
        fillAlpha: 0.12,
        strokeColor: 0x1f6feb,
        strokeAlpha: 0.24,
        lineWidth: 2,
      });
      this.scoreText = this.add
        .text(0, 0, `Score: 0/${this.totalQuestions}`, {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "26px",
          color: "#1d4ed8",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.scoreBadge = this.add.container(
        width - 250,
        85,
        [this.scorePanel.graphics, this.scoreText]
      );
      this.scoreBadge.setDepth(3);
      this.gameUiElements.push(this.scoreBadge);

      const panelWidth = width * 0.86;
      const panelHeight = 520;
      const contentWidth = panelWidth - 100;
      const panelCenterY = height / 2 + 40;
      const panel = createRoundedPanel(this, panelWidth, panelHeight, 36, {
        fillColor: 0xffffff,
        fillAlpha: 0.98,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.32,
        lineWidth: 4,
      });

      const imagePanelWidth = Math.min(contentWidth, 520);
      const imagePanelHeight = 160;
      this.imagePanelWidth = imagePanelWidth;
      this.imagePanelHeight = imagePanelHeight;
      this.imageMaxWidth = imagePanelWidth - 40;
      this.imageMaxHeight = imagePanelHeight - 40;

      this.imagePanel = createRoundedPanel(
        this,
        imagePanelWidth,
        imagePanelHeight,
        24,
        {
          fillColor: 0xf8fafc,
          fillAlpha: 1,
          strokeColor: 0x93c5fd,
          strokeAlpha: 0.35,
          lineWidth: 2,
        }
      );
      this.questionImage = this.add.image(0, 0, "");
      this.questionImage.setVisible(false);
      this.questionImage.setActive(false);
      this.imageContainer = this.add.container(0, 0, [
        this.imagePanel.graphics,
        this.questionImage,
      ]);

      this.sentenceText1 = this.add
        .text(0, 0, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "30px",
          color: "#0f172a",
          align: "center",
          wordWrap: { width: contentWidth },
        })
        .setOrigin(0.5, 0);

      this.sentenceText2 = this.add
        .text(0, 0, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "30px",
          color: "#0f172a",
          align: "center",
          wordWrap: { width: contentWidth },
        })
        .setOrigin(0.5, 0);

      const optionGap = 16;
      const optionButtonHeight = 56;
      const optionButtonWidth = Math.min(
        240,
        (contentWidth - optionGap * 3) / 4
      );

      this.optionRowHeight = optionButtonHeight;
      this.optionRowGap = optionGap;

      this.optionGroupLeft = createOptionRow(this, {
        width: contentWidth,
        buttonWidth: optionButtonWidth,
        buttonHeight: optionButtonHeight,
        gap: optionGap,
        onSelect: (button) => this.handleOptionSelection("first", button),
      });
      this.optionGroupRight = createOptionRow(this, {
        width: contentWidth,
        buttonWidth: optionButtonWidth,
        buttonHeight: optionButtonHeight,
        gap: optionGap,
        onSelect: (button) => this.handleOptionSelection("second", button),
      });

      this.mainPanel = this.add.container(width / 2, panelCenterY + 30, [
        panel.graphics,
        this.imageContainer,
        this.sentenceText1,
        this.optionGroupLeft.container,
        this.sentenceText2,
        this.optionGroupRight.container,
      ]);
      this.mainPanel.setDepth(2);
      this.gameUiElements.push(this.mainPanel);

      this.panelWidth = panelWidth;
      this.panelHeight = panelHeight;
      this.panelContentWidth = contentWidth;
      this.panelTopPadding = 26;
      this.panelRowGap = 16;
      this.panelSectionGap = 24;

      this.feedbackBackdrop = this.add
        .rectangle(width / 2, height / 2, width, height, 0x0f172a, 0.3)
        .setDepth(10);
      this.feedbackBackdrop.setAlpha(0);
      this.feedbackBackdrop.setVisible(false);

      const feedbackPanel = createRoundedPanel(this, 760, 360, 32, {
        fillColor: 0xffffff,
        fillAlpha: 0.98,
        strokeColor: 0x93c5fd,
        strokeAlpha: 0.3,
        lineWidth: 3,
      });
      this.feedbackPanel = feedbackPanel;
      this.feedbackIcon = this.add
        .image(-200, -130, "fill-blank-correct-img")
        .setDisplaySize(90, 90);
      this.feedbackLabel = this.add
        .text(0, -130, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "36px",
          color: "#0f172a",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.feedbackSentence = this.add
        .text(0, -10, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "24px",
          color: "#0f172a",
          align: "center",
          wordWrap: { width: 620 },
        })
        .setOrigin(0.5);

      this.feedbackGroup = this.add.container(width / 2, height / 2, [
        feedbackPanel.graphics,
        this.feedbackIcon,
        this.feedbackLabel,
        this.feedbackSentence,
      ]);
      this.feedbackGroup.setDepth(11);
      this.feedbackGroup.setAlpha(0);

      this.countdownBackdrop = this.add
        .rectangle(0, 0, width, height, 0x0f172a, 0.45)
        .setOrigin(0)
        .setAlpha(0);
      this.countdownText = this.add
        .text(width / 2, height / 2, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "128px",
          color: "#ffffff",
          fontStyle: "bold",
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
        .text(0, -110, "Great work!", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "40px",
          color: "#0f172a",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.summaryBody = this.add
        .text(0, -20, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "26px",
          color: "#0f172a",
          align: "center",
          wordWrap: { width: 560 },
        })
        .setOrigin(0.5);

      const replayButton = createPrimaryButton(this, "Replay", 260, 90, {
        onClick: () => this.handleReplay(),
        baseColor: 0x1f6feb,
        textSize: 34,
      });
      replayButton.container.setPosition(-150, 130);

      const exitButton = createPrimaryButton(this, "Exit", 260, 90, {
        onClick: () => this.exitToIdleState(),
        baseColor: 0x334155,
        textSize: 34,
      });
      exitButton.container.setPosition(150, 130);

      this.summaryOverlay.add([
        summaryPanel.graphics,
        this.summaryTitle,
        this.summaryBody,
        replayButton.container,
        exitButton.container,
      ]);
      this.summaryOverlay.setVisible(false);
      this.summaryOverlay.setAlpha(0);

      this.startButton = createPrimaryButton(this, "Start", 520, 200, {
        onClick: () => this.handleStartPressed(),
        baseColor: 0x1f6feb,
        textSize: 58,
      });
      this.startButton.container.setPosition(width / 2, height / 2 + 20);
      this.startButton.container.setDepth(20);
      this.tweens.add({
        targets: this.startButton.container,
        scale: 1.04,
        duration: 500,
        ease: "Sine.easeInOut",
        repeat: -1,
        yoyo: true,
      });

      this.setGameUiVisible(false);
    }

    setGameUiVisible(isVisible) {
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

    setStatus(text, { transparent = false, isError = false } = {}) {
      if (!this.statusElement) {
        return;
      }
      this.statusElement.textContent = text || "";
      this.statusElement.classList.add("is-visible");
      this.statusElement.classList.toggle("is-transparent", Boolean(transparent));
      this.statusElement.classList.toggle("is-error", Boolean(isError));
    }

    handleStartPressed() {
      if (!this.questions.length) {
        this.setStatus("The game content is not ready yet.", { isError: true });
        return;
      }
      this.stopAllTimers();
      this.stopActiveAudio();
      this.cancelPendingEvents();
      this.hideFeedback(true);
      this.hideSummary(true);
      this.resetState();
      this.updateScoreText();
      this.updateTimerText(this.defaultTimerLabel);
      this.startButton.setVisible(false);
      this.startButton.setEnabled(false);
      this.setGameUiVisible(true);
      this.setStatus("Get ready...", { transparent: false });
      this.showCountdown(() => this.advanceQuestion());
    }

    showCountdown(onComplete) {
      this.countdownOverlay.setVisible(true);
      this.countdownBackdrop.setAlpha(0.6);
      this.countdownText.setAlpha(1);
      this.countdownActive = true;
      const steps = ["3", "2", "1", "Start"];

      const runStep = (index) => {
        if (!this.countdownActive) {
          return;
        }
        const value = steps[index] || "";
        this.countdownText.setText(value);
        tonePlayer.play(index === steps.length - 1 ? 640 : 320, 240);
        if (index >= steps.length - 1) {
          this.scheduleEvent(700, () => {
            this.hideCountdown();
            onComplete?.();
          });
          return;
        }
        this.scheduleEvent(800, () => runStep(index + 1));
      };

      runStep(0);
    }

    hideCountdown() {
      this.countdownActive = false;
      this.countdownOverlay.setVisible(false);
      this.countdownBackdrop.setAlpha(0);
      this.countdownText.setAlpha(0);
      this.countdownText.setText("");
    }

    advanceQuestion() {
      this.hideFeedback(false);
      this.resetOptionGroups();
      this.currentIndex += 1;
      if (this.currentIndex >= this.totalQuestions) {
        this.finishGame();
        return;
      }

      const question = this.questions[this.currentIndex];
      this.activeQuestion = question;
      this.awaitingAnswer = true;
      this.updateQuestionHeader();
      this.configureQuestion(question);
      this.startTimer();
      this.setStatus(
        `Question ${this.currentIndex + 1} of ${this.totalQuestions} - Score ${this.score}/${this.totalQuestions}`,
        { transparent: true }
      );
    }

    updateQuestionHeader() {
      this.phaseText.setText(
        `Question ${this.currentIndex + 1} of ${this.totalQuestions}`
      );
      this.phaseText.setColor("#1d4ed8");
    }

    updateQuestionImage(question) {
      if (!this.questionImage || !this.imageContainer) {
        return;
      }
      const hasTexture =
        question?.imageKey &&
        question?.image &&
        typeof this.textures?.exists === "function" &&
        this.textures.exists(question.imageKey);
      if (!hasTexture) {
        this.questionImage.setVisible(false);
        this.questionImage.setActive(false);
        this.imageContainer.setVisible(false);
        return;
      }

      this.questionImage.setTexture(question.imageKey);
      this.questionImage.setActive(true);
      this.questionImage.setVisible(true);
      this.questionImage.setScale(1);
      const imgWidth = this.questionImage.width || 1;
      const imgHeight = this.questionImage.height || 1;
      const maxWidth = this.imageMaxWidth || imgWidth;
      const maxHeight = this.imageMaxHeight || imgHeight;
      const scale = Math.min(1, maxWidth / imgWidth, maxHeight / imgHeight);
      this.questionImage.setScale(scale);
      this.questionImage.setPosition(0, 0);
      this.imageContainer.setVisible(true);
    }

    layoutQuestion() {
      if (!this.mainPanel) {
        return;
      }
      const panelTop = -(this.panelHeight ?? 0) / 2;
      const topPadding = this.panelTopPadding ?? 26;
      const rowGap = this.panelRowGap ?? 16;
      const sectionGap = this.panelSectionGap ?? 24;
      const imageHeight = this.imageContainer?.visible
        ? this.imagePanelHeight ?? 0
        : 0;
      const imageOffset = this.imageContainer?.visible ? sectionGap : 0;

      let y = panelTop + topPadding;

      if (this.imageContainer) {
        this.imageContainer.setPosition(0, y + imageHeight / 2);
        y += imageHeight + imageOffset;
      }

      if (this.sentenceText1) {
        this.sentenceText1.setPosition(0, y);
        y += this.sentenceText1.height + rowGap;
      }

      if (this.optionGroupLeft?.container) {
        this.optionGroupLeft.container.setPosition(
          0,
          y + (this.optionRowHeight ?? 0) / 2
        );
        y += (this.optionRowHeight ?? 0) + sectionGap;
      }

      if (this.sentenceText2?.visible) {
        this.sentenceText2.setPosition(0, y);
        y += this.sentenceText2.height + rowGap;
      }

      if (this.optionGroupRight?.container) {
        this.optionGroupRight.container.setPosition(
          0,
          y + (this.optionRowHeight ?? 0) / 2
        );
      }
    }

    configureQuestion(question) {
      this.updateQuestionImage(question);
      this.sentenceText1.setText(renderSentence(question.sentence1, ""));
      this.sentenceText2.setText(
        question.hasSecondBlank ? renderSentence(question.sentence2, "") : ""
      );
      this.sentenceText2.setVisible(Boolean(question.hasSecondBlank));

      this.optionGroupLeft.setOptions(question.options1);
      this.optionGroupLeft.clearSelection();
      this.optionGroupLeft.setEnabled(true);
      this.optionGroupLeft.setVisible(true);

      const hasSecond = Boolean(question.hasSecondBlank);
      if (hasSecond) {
        this.optionGroupRight.setOptions(question.options2);
        this.optionGroupRight.clearSelection();
        this.optionGroupRight.setEnabled(true);
        this.optionGroupRight.setVisible(true);
      } else {
        this.optionGroupRight.setVisible(false);
        this.optionGroupRight.clearSelection();
      }
      this.layoutQuestion();
    }

    resetOptionGroups() {
      this.optionGroupLeft?.clearSelection();
      this.optionGroupRight?.clearSelection();
    }

    handleOptionSelection(groupKey, button) {
      if (!this.awaitingAnswer || !button) {
        return;
      }
      const group =
        groupKey === "second" ? this.optionGroupRight : this.optionGroupLeft;
      if (!group?.enabled) {
        return;
      }
      group.selectValue(button.valueLower);
      this.updateSentenceWithSelections();
      if (this.isSelectionComplete()) {
        this.finalizeAnswer(false);
      }
    }

    updateSentenceWithSelections() {
      const question = this.activeQuestion;
      if (!question) {
        return;
      }
      const firstValue = this.optionGroupLeft.selectedValue || "";
      const secondValue = this.optionGroupRight.selectedValue || "";
      this.sentenceText1.setText(renderSentence(question.sentence1, firstValue));
      if (question.hasSecondBlank) {
        this.sentenceText2.setText(
          renderSentence(question.sentence2, secondValue)
        );
      }
      this.layoutQuestion();
    }

    isSelectionComplete() {
      const needsSecond = Boolean(this.activeQuestion?.hasSecondBlank);
      if (!this.optionGroupLeft.selectedValue) {
        return false;
      }
      if (!needsSecond) {
        return true;
      }
      return Boolean(this.optionGroupRight.selectedValue);
    }

    finalizeAnswer(timedOut) {
      if (!this.activeQuestion || !this.awaitingAnswer) {
        return;
      }
      this.awaitingAnswer = false;
      this.stopTimer(true);
      this.optionGroupLeft.setEnabled(false);
      this.optionGroupRight.setEnabled(false);

      const question = this.activeQuestion;
      const isFirstCorrect = matchesAnswer(
        this.optionGroupLeft.selectedValue,
        question.answer1
      );
      const isSecondCorrect = question.hasSecondBlank
        ? matchesAnswer(this.optionGroupRight.selectedValue, question.answer2)
        : true;
      const isCorrect = isFirstCorrect && isSecondCorrect;

      if (!timedOut && isCorrect) {
        this.score += 1;
        this.updateScoreText();
      }

      const firstAnswerLower = trimText(question.answer1).toLowerCase();
      const secondAnswerLower = trimText(question.answer2).toLowerCase();
      this.optionGroupLeft.markResult(firstAnswerLower);
      if (question.hasSecondBlank) {
        this.optionGroupRight.markResult(secondAnswerLower);
      }

      const fullSentence = buildFullSentence(question);
      this.sentenceText1.setText(
        renderSentence(question.sentence1, question.answer1)
      );
      if (question.hasSecondBlank) {
        this.sentenceText2.setText(
          renderSentence(question.sentence2, question.answer2)
        );
      }
      this.layoutQuestion();

      const feedbackType = timedOut
        ? "timeout"
        : isCorrect
        ? "correct"
        : "incorrect";
      const feedbackLabel = timedOut
        ? "Time's up!"
        : isCorrect
        ? "Correct!"
        : "Incorrect";
      
      this.scheduleEvent(2000, () => {
        this.showFeedback(feedbackType, feedbackLabel, fullSentence);
        const feedbackDuration = this.playFeedbackSound(feedbackType);

        const delay = Math.min(Math.max(feedbackDuration + 200, 300), 1500);
        this.scheduleEvent(delay, () => {
          this.playSentenceAudio(question, () => {
            this.scheduleEvent(800, () => this.advanceQuestion());
          });
        });
      });
    }

    handleTimeout() {
      if (!this.awaitingAnswer) {
        return;
      }
      this.finalizeAnswer(true);
    }

    playFeedbackSound(type) {
      const keyMap = {
        correct: "fill-blank-correct",
        incorrect: "fill-blank-incorrect",
        timeout: "fill-blank-timeout",
      };
      const key = keyMap[type];
      let durationMs = 0;
      let usedFallback = false;
      if (key) {
        const sound = this.sound.get(key);
        if (sound) {
          sound.play();
          const resolvedDuration =
            sound.totalDuration && sound.totalDuration > 0
              ? sound.totalDuration
              : sound.duration && sound.duration > 0
              ? sound.duration
              : 0;
          durationMs = Math.round(resolvedDuration * 1000);
        } else {
          usedFallback = true;
        }
      } else {
        usedFallback = true;
      }
      if (usedFallback) {
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
        durationMs = 800;
      }
      return durationMs;
    }

    playSentenceAudio(question, onComplete) {
      this.stopActiveAudio();
      this.pendingAudioToken += 1;
      const token = this.pendingAudioToken;
      if (question?.audioKey) {
        const sound =
          this.sound.get(question.audioKey) ?? this.sound.add(question.audioKey);
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
      this.scheduleEvent(500, () => {
        if (token === this.pendingAudioToken) {
          onComplete?.();
        }
      });
    }

    stopActiveAudio() {
      if (this.activeAudio) {
        this.activeAudio.stop();
        this.activeAudio = null;
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

    stopTimer(resetDisplay) {
      this.activeTimer?.remove?.();
      this.activeTimer = null;
      if (resetDisplay) {
        this.updateTimerText(this.defaultTimerLabel);
      }
    }

    stopAllTimers() {
      this.stopTimer(true);
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

    showFeedback(kind, label, sentence) {
      const styles = {
        correct: {
          border: 0x16a34a,
          text: "#065f46",
          texture: "fill-blank-correct-img",
        },
        incorrect: {
          border: 0xdc2626,
          text: "#7f1d1d",
          texture: "fill-blank-incorrect-img",
        },
        timeout: {
          border: 0xf97316,
          text: "#b45309",
          texture: "fill-blank-timeout-img",
        },
      };
      const style = styles[kind] ?? styles.incorrect;
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
      this.feedbackLabel.setText(label);
      this.feedbackLabel.setColor(style.text);
      this.feedbackSentence.setText(sentence || "");
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

    hideFeedback(force) {
      if (!this.feedbackGroup) {
        return;
      }
      if (force) {
        this.feedbackGroup.setAlpha(0);
        this.feedbackBackdrop.setVisible(false);
        this.feedbackBackdrop.setAlpha(0);
        return;
      }
      this.tweens.killTweensOf(this.feedbackBackdrop);
      this.tweens.add({
        targets: this.feedbackBackdrop,
        alpha: 0,
        duration: 180,
        ease: "Sine.easeInOut",
        onComplete: () => {
          this.feedbackBackdrop.setVisible(false);
        },
      });
      this.tweens.add({
        targets: this.feedbackGroup,
        alpha: 0,
        duration: 180,
        ease: "Sine.easeInOut",
      });
    }

    finishGame() {
      this.stopAllTimers();
      this.awaitingAnswer = false;
      this.optionGroupLeft.setEnabled(false);
      this.optionGroupRight.setEnabled(false);
      this.setStatus(
        "All questions complete! Tap Replay to try again.",
        { transparent: false }
      );
      this.showSummary();
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
          ? "Great job!"
          : "Keep practicing!"
      );
      this.summaryBody.setText(
        `You answered ${this.score} out of ${this.totalQuestions} correctly.\nYour score: ${percentage}%`
      );
      this.summaryBackdrop.setVisible(true);
      this.summaryOverlay.setVisible(true);
      this.summaryBackdrop.setAlpha(0);
      this.summaryOverlay.setAlpha(0);
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
        scale: { from: 0.94, to: 1 },
        duration: 320,
        ease: "Back.easeOut",
      });
    }

    hideSummary(force) {
      if (force) {
        this.summaryBackdrop.setVisible(false);
        this.summaryBackdrop.setAlpha(0);
        this.summaryOverlay.setVisible(false);
        this.summaryOverlay.setAlpha(0);
        return;
      }
      this.tweens.killTweensOf(this.summaryBackdrop);
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
        },
      });
    }

    handleReplay() {
      this.hideSummary(true);
      this.handleStartPressed();
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
        // ignore inability to enter fullscreen without user gesture
      }
    }

    attachScaleListeners() {
      if (this.scaleListenersAttached || !this.scale) {
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

    exitToIdleState() {
      this.stopAllTimers();
      this.cancelPendingEvents();
      this.stopActiveAudio();
      this.resetState();
      this.hideFeedback(true);
      this.hideSummary(true);
      this.startButton.setVisible(true);
      this.startButton.setEnabled(true);
      this.setGameUiVisible(false);
      this.phaseText.setText("Ready to play?");
      this.phaseText.setColor("#0f172a");
      this.setStatus("Press Start to play.", { transparent: false });
      if (this.scale?.isFullscreen) {
        this.scale.stopFullscreen();
      } else {
        this.unlockOrientation();
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

    shutdown() {
      this.stopAllTimers();
      this.cancelPendingEvents();
      this.stopActiveAudio();
      this.input?.off?.("pointerdown", this.requestFullscreen, this);
      if (this.scaleListenersAttached && this.scale) {
        this.scale.off("enterfullscreen", this.handleEnterFullscreen, this);
        this.scale.off("leavefullscreen", this.handleLeaveFullscreen, this);
        this.scaleListenersAttached = false;
      }
      this.unlockOrientation();
      this.input?.setDefaultCursor?.("default");
    }
  };
};
