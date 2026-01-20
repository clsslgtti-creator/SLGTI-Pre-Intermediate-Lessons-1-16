export const DEFAULT_FEEDBACK_ASSETS = {
  correctAudio: "assets/audio/game/correct.wav",
  incorrectAudio: "assets/audio/game/incorrect.wav",
  timeoutAudio: "assets/audio/game/timeout.wav",
  correctImg: "assets/img/game/correct.png",
  incorrectImg: "assets/img/game/incorrect.png",
  timeoutImg: "assets/img/game/timeout.png",
};

export const DEFAULT_BACKGROUND_IMAGE = "assets/img/game/bg-1.jpg";

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
    playTone(frequency = 440, durationMs = 280) {
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

const PALETTE = {
  primary: 0x1f6feb,
  primaryDark: 0x1d4ed8,
  primaryMuted: 0x93c5fd,
  surface: 0xffffff,
  slate: 0x0f172a,
  success: 0x16a34a,
  danger: 0xdc2626,
};

const KEYWORD_CARD_STYLES = {
  base: {
    fillColor: PALETTE.surface,
    fillAlpha: 0.98,
    strokeColor: PALETTE.primaryMuted,
    strokeAlpha: 0.65,
    lineWidth: 3,
  },
  hover: {
    fillColor: 0xf8fafc,
    fillAlpha: 1,
    strokeColor: PALETTE.primaryMuted,
    strokeAlpha: 0.85,
    lineWidth: 3,
  },
  selected: {
    fillColor: 0xdbeafe,
    fillAlpha: 1,
    strokeColor: PALETTE.primaryDark,
    strokeAlpha: 0.95,
    lineWidth: 3,
  },
  success: {
    fillColor: 0xecfdf5,
    fillAlpha: 1,
    strokeColor: PALETTE.success,
    strokeAlpha: 0.95,
    lineWidth: 3,
  },
  error: {
    fillColor: 0xfee2e2,
    fillAlpha: 1,
    strokeColor: PALETTE.danger,
    strokeAlpha: 0.95,
    lineWidth: 3,
  },
};

const IMAGE_CARD_STYLES = {
  base: {
    fillColor: 0xffffff,
    fillAlpha: 0.97,
    strokeColor: PALETTE.primaryMuted,
    strokeAlpha: 0.6,
    lineWidth: 4,
  },
  hover: {
    fillColor: 0xf8fafc,
    fillAlpha: 1,
    strokeColor: PALETTE.primaryDark,
    strokeAlpha: 0.8,
    lineWidth: 4,
  },
  success: {
    fillColor: 0xecfdf5,
    fillAlpha: 1,
    strokeColor: PALETTE.success,
    strokeAlpha: 0.9,
    lineWidth: 4,
  },
  error: {
    fillColor: 0xfee2e2,
    fillAlpha: 1,
    strokeColor: PALETTE.danger,
    strokeAlpha: 0.9,
    lineWidth: 4,
  },
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
  { onClick, baseColor = PALETTE.primary, playTone, fontSize } = {}
) => {
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
      strokeAlpha: 0.85,
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

  const panel = createRoundedPanel(scene, width, height, height / 2);
  panel.update(styles.base);

  const resolvedFontSize = Number.isFinite(fontSize) ? fontSize : height * 0.35;

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
      fontSize: `${resolvedFontSize}px`,
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
    })
    .setOrigin(0.5);

  const container = scene.add.container(0, 0, [panel.graphics, text]);
  container.setSize(width, height);
  container.setDepth(10);
  container.setInteractive({ useHandCursor: true });

  const triggerTone = () => {
    if (typeof playTone === "function") {
      playTone();
    }
  };

  container.on("pointerover", () => {
    if (container.input?.enabled) {
      panel.update(styles.hover);
    }
  });
  container.on("pointerout", () => {
    if (container.input?.enabled) {
      panel.update(styles.base);
    }
  });
  container.on("pointerdown", () => {
    if (container.input?.enabled && typeof onClick === "function") {
      triggerTone();
      onClick();
    }
  });

  const setEnabled = (state) => {
    if (state) {
      container.setInteractive({ useHandCursor: true });
      panel.update(styles.base);
      container.setAlpha(1);
    } else {
      container.disableInteractive();
      panel.update(styles.disabled);
      container.setAlpha(0.85);
    }
  };

  return {
    container,
    text,
    background: panel,
    styles,
    setEnabled,
    setLabel: (value) => text.setText(value),
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

const sanitizeId = (value, fallback) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length ? trimmed : fallback;
};

export const normalizeMatchingPairs = (rawPairs = []) => {
  if (!Array.isArray(rawPairs)) {
    return [];
  }
  const usedIds = new Set();
  return rawPairs
    .map((pair, index) => {
      if (!pair || typeof pair !== "object") {
        return null;
      }
      const fallbackId = `pair_${index + 1}`;
      let id = sanitizeId(pair.id, fallbackId);
      if (usedIds.has(id)) {
        id = `${id}_${index + 1}`;
      }
      usedIds.add(id);

      const keyword = sanitizeId(pair.keyword, `Keyword ${index + 1}`);
      const image =
        typeof pair.image === "string" && pair.image.trim().length
          ? pair.image.trim()
          : null;
      if (!image) {
        return null;
      }
      return {
        id,
        keyword,
        image,
      };
    })
    .filter(Boolean);
};

const createResultBadgeFactory = (scene, assets) => {
  const { correctIconKey, incorrectIconKey } = assets;
  const hasCorrect =
    Boolean(correctIconKey) && scene.textures.exists(correctIconKey);
  const hasIncorrect =
    Boolean(incorrectIconKey) && scene.textures.exists(incorrectIconKey);

  if (hasCorrect && hasIncorrect) {
    return () => {
      const container = scene.add.container(0, 0);
      container.setVisible(false);
      const correctIcon = scene.add.image(0, 0, correctIconKey);
      const incorrectIcon = scene.add.image(0, 0, incorrectIconKey);
      correctIcon.setScale(0.55);
      incorrectIcon.setScale(0.55);
      incorrectIcon.setVisible(false);
      container.add([incorrectIcon, correctIcon]);
      return {
        container,
        show(isCorrect) {
          container.setVisible(true);
          correctIcon.setVisible(Boolean(isCorrect));
          incorrectIcon.setVisible(!isCorrect);
        },
      };
    };
  }

  return () => {
    const container = scene.add.container(0, 0);
    container.setVisible(false);
    const circle = scene.add.circle(0, 0, 26, 0xffffff, 1);
    circle.setStrokeStyle(3, 0x94a3b8, 0.65);
    const lines = scene.add.graphics();
    container.add([circle, lines]);
    return {
      container,
      show(isCorrect) {
        container.setVisible(true);
        lines.clear();
        if (isCorrect) {
          circle.setFillStyle(0xecfdf5, 1);
          circle.setStrokeStyle(3, 0x059669, 0.9);
          lines.lineStyle(4, 0x059669, 1);
          lines.beginPath();
          lines.moveTo(-10, 4);
          lines.lineTo(-2, 14);
          lines.lineTo(12, -10);
          lines.strokePath();
        } else {
          circle.setFillStyle(0xfee2e2, 1);
          circle.setStrokeStyle(3, 0xb91c1c, 0.9);
          lines.lineStyle(4, 0xb91c1c, 1);
          lines.beginPath();
          lines.moveTo(-12, -12);
          lines.lineTo(12, 12);
          lines.moveTo(12, -12);
          lines.lineTo(-12, 12);
          lines.strokePath();
        }
      },
    };
  };
};

export const createMatchingGameScene = (config = {}) => {
  const {
    pairs: rawPairs = [],
    backgroundImage,
    feedbackAssets = DEFAULT_FEEDBACK_ASSETS,
    statusElement = null,
    onRoundUpdate,
  } = config;

  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const makeKey = (name) => `matching_${name}_${randomSuffix}`;

  const sanitizedPairs = normalizeMatchingPairs(rawPairs).map(
    (pair, index) => ({
      ...pair,
      textureKey: makeKey(`pair_${index}`),
    })
  );

  const resolvedFeedback = {
    ...DEFAULT_FEEDBACK_ASSETS,
    ...(feedbackAssets || {}),
  };

  const resolvedBackground =
    typeof backgroundImage === "string" && backgroundImage.trim().length
      ? backgroundImage.trim()
      : DEFAULT_BACKGROUND_IMAGE;

  const tonePlayer = createTonePlayer();
  const statusController = createStatusController(statusElement);

  const backgroundTextureKey = makeKey("bg");
  const correctIconKey = makeKey("correct_icon");
  const incorrectIconKey = makeKey("incorrect_icon");
  const correctAudioKey = makeKey("correct_audio");
  const incorrectAudioKey = makeKey("incorrect_audio");

  return class MatchingGameScene extends Phaser.Scene {
    constructor() {
      super("KeywordImageMatchingScene");
      this.basePairs = sanitizedPairs;
      this.totalPairs = this.basePairs.length;
      this.backgroundAsset = resolvedBackground;
      this.feedbackAssets = resolvedFeedback;
      this.statusController = statusController;
      this.onRoundUpdate =
        typeof onRoundUpdate === "function" ? onRoundUpdate : null;
      this.backgroundTextureKey = backgroundTextureKey;
      this.correctIconKey = correctIconKey;
      this.incorrectIconKey = incorrectIconKey;
      this.correctAudioKey = correctAudioKey;
      this.incorrectAudioKey = incorrectAudioKey;
      this.shouldAutoStart = false;
      this.tipTimer = null;
      this.startButton = null;
      this.resetSessionState();
    }

    init(data = {}) {
      this.shouldAutoStart = Boolean(data.autoStart);
    }

    resetSessionState() {
      this.sessionPairs = this.basePairs.map((pair) => ({ ...pair }));
      this.keywordNodes = [];
      this.imageNodes = [];
      this.connections = [];
      this.matchesCompleted = 0;
      this.correctMatches = 0;
      this.selectedKeyword = null;
      this.gameActive = false;
      this.resultDisplayed = false;
    }

    preload() {
      if (
        this.backgroundAsset &&
        !this.textures.exists(this.backgroundTextureKey)
      ) {
        this.load.image(this.backgroundTextureKey, this.backgroundAsset);
      }

      this.sessionPairs.forEach((pair) => {
        if (!pair.textureKey) {
          return;
        }
        if (!this.textures.exists(pair.textureKey)) {
          this.load.image(pair.textureKey, pair.image);
        }
      });

      if (
        this.feedbackAssets.correctImg &&
        !this.textures.exists(this.correctIconKey)
      ) {
        this.load.image(this.correctIconKey, this.feedbackAssets.correctImg);
      }
      if (
        this.feedbackAssets.incorrectImg &&
        !this.textures.exists(this.incorrectIconKey)
      ) {
        this.load.image(
          this.incorrectIconKey,
          this.feedbackAssets.incorrectImg
        );
      }

      if (
        this.feedbackAssets.correctAudio &&
        !this.cache.audio.exists(this.correctAudioKey)
      ) {
        this.load.audio(this.correctAudioKey, this.feedbackAssets.correctAudio);
      }
      if (
        this.feedbackAssets.incorrectAudio &&
        !this.cache.audio.exists(this.incorrectAudioKey)
      ) {
        this.load.audio(
          this.incorrectAudioKey,
          this.feedbackAssets.incorrectAudio
        );
      }

      this.load.once("complete", () => {
        this.statusController(
          this.shouldAutoStart
            ? "Get ready to match the parts."
            : "Press Start to play."
        );
      });
      this.load.on("loaderror", (file) => {
        console.warn("Unable to load asset:", file?.src ?? file?.key);
        this.statusController(
          "Some game assets failed to load. Please reload if the issue continues.",
          { error: true }
        );
      });
    }

    create() {
      this.sceneWidth = this.scale.width;
      this.sceneHeight = this.scale.height;
      this.resetSessionState();

      if (!this.totalPairs) {
        this.statusController("Game content is not available.", {
          error: true,
        });
        return;
      }

      this.addBackground();
      this.input.on("pointerdown", this.requestFullscreen, this);
      this.lineLayer = this.add.layer();
      this.keywordLayer = this.add.layer();
      this.imageLayer = this.add.layer();
      this.buildColumns();
      this.createHud();
      this.createResultOverlay();
      this.createCenterStartButton(this.sceneWidth, this.sceneHeight);
      this.setInteractionState(false);
      this.updateProgressText();
      this.setGameElementsVisible(false);
      this.updateTip(
        this.shouldAutoStart ? "Matching started automatically." : ""
      );

      if (this.shouldAutoStart) {
        this.handleStartPressed(true);
      } else {
        this.setStartButtonVisible(true);
        this.statusController("Press Start to begin matching.");
      }

      this.events.once("shutdown", () => {
        if (this.tipTimer) {
          this.tipTimer.remove(false);
          this.tipTimer = null;
        }
        this.input.off("pointerdown", this.requestFullscreen, this);
      });
    }

    addBackground() {
      const bg = this.add
        .image(
          this.sceneWidth / 2,
          this.sceneHeight / 2,
          this.backgroundTextureKey
        )
        .setDepth(0);
      bg.setDisplaySize(this.sceneWidth, this.sceneHeight);
    }

    buildColumns() {
      const keywordOrder = shuffleArray(this.sessionPairs);
      const imageOrder = shuffleArray(this.sessionPairs);
      const positions = this.computePositions(keywordOrder.length);

      const keywordWidth = 360;
      const keywordHeight = 70;
      const keywordX = this.sceneWidth / 2;

      keywordOrder.forEach((pair, index) => {
        const y = positions[index];
        const node = this.createKeywordNode(
          pair,
          keywordX,
          y,
          keywordWidth,
          keywordHeight
        );
        this.keywordLayer.add(node.container);
        this.keywordNodes.push(node);
      });

      const imageWidth = 180;
      const imageHeight = 180;

      const createBadge = createResultBadgeFactory(this, {
        correctIconKey: this.correctIconKey,
        incorrectIconKey: this.incorrectIconKey,
      });

      imageOrder.forEach((pair, index) => {
        const y = positions[index % 3] + (index % 3) * 100 + 50;
        const node = this.createImageNode(
          pair,
          index % 2 === 0 ? 1100 : 180,
          y,
          imageWidth,
          imageHeight,
          createBadge,
          index % 2 === 0
        );
        this.imageLayer.add(node.container);
        this.imageNodes.push(node);
      });
    }

    computePositions(count) {
      if (!count) {
        return [];
      }
      const top = 160;
      const bottom = 660;
      if (count === 1) {
        return [(top + bottom) / 2];
      }
      const spacing = (bottom - top) / (count - 1);
      return Array.from({ length: count }, (_, index) => top + spacing * index);
    }

    createKeywordNode(pair, x, y, width, height) {
      const container = this.add.container(x, y);
      const panel = createRoundedPanel(this, width, height, 24);
      panel.update(KEYWORD_CARD_STYLES.base);

      const label = this.add
        .text(0, 0, pair.keyword, {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "30px",
          color: "#0f172a",
          fontStyle: "600",
          align: "center",
          wordWrap: { width: width - 48 },
        })
        .setOrigin(0.5);
      container.add([panel.graphics, label]);
      container.setSize(width, height);
      container.setInteractive();
      if (container.input) {
        container.input.cursor = "pointer";
      }

      const applyStyle = (styleKey) => {
        const style = KEYWORD_CARD_STYLES[styleKey] || KEYWORD_CARD_STYLES.base;
        panel.update(style);
      };

      const node = {
        id: pair.id,
        pair,
        container,
        panel,
        label,
        matched: false,
        selected: false,
        setSelected: (state) => {
          node.selected = Boolean(state);
          if (node.matched) {
            return;
          }
          applyStyle(node.selected ? "selected" : "base");
        },
        setMatched: (isCorrect) => {
          node.matched = true;
          applyStyle(isCorrect ? "success" : "error");
          container.disableInteractive();
          container.setAlpha(0.98);
        },
        enable: () => {
          if (node.matched) {
            return;
          }
          container.setInteractive();
          if (container.input) {
            container.input.cursor = "pointer";
          }
        },
        disable: () => {
          container.disableInteractive();
        },
      };

      container.on("pointerup", () => {
        if (!this.gameActive || node.matched) {
          return;
        }
        this.handleKeywordSelection(node);
      });

      container.on("pointerover", () => {
        if (!this.gameActive || node.matched) {
          return;
        }
        container.setScale(1.02);
        if (!node.selected) {
          applyStyle("hover");
        }
      });
      container.on("pointerout", () => {
        container.setScale(1);
        if (!node.matched) {
          applyStyle(node.selected ? "selected" : "base");
        }
      });

      return node;
    }

    createImageNode(pair, x, y, width, height, badgeFactory, isLeft) {
      const container = this.add.container(x, y);
      const panel = createRoundedPanel(this, width, height, 5);
      panel.update(IMAGE_CARD_STYLES.base);
      const picture = this.add.image(0, 0, pair.textureKey);
      const source = this.textures.get(pair.textureKey)?.getSourceImage();
      if (source?.width && source?.height) {
        const safeWidth = width - 20;
        const safeHeight = height - 20;
        const scale = Math.min(
          safeWidth / source.width,
          safeHeight / source.height
        );
        picture.setDisplaySize(source.width * scale, source.height * scale);
      } else {
        picture.setDisplaySize(width - 20, height - 20);
      }
      container.add([panel.graphics, picture]);
      container.setSize(width, height);
      container.setInteractive();
      if (container.input) {
        container.input.cursor = "pointer";
      }

      const badge = badgeFactory();
      badge.container.setPosition(width / 2 - 28, -height / 2 + 28);
      container.add(badge.container);

      const applyStyle = (styleKey) => {
        const style = IMAGE_CARD_STYLES[styleKey] || IMAGE_CARD_STYLES.base;
        panel.update(style);
      };

      const node = {
        id: pair.id,
        pair,
        container,
        panel,
        picture,
        badge,
        matched: false,
        setMatched: (isCorrect) => {
          node.matched = true;
          applyStyle(isCorrect ? "success" : "error");
          container.disableInteractive();
          container.setAlpha(0.98);
        },
        enable: () => {
          if (node.matched) {
            return;
          }
          container.setInteractive();
          if (container.input) {
            container.input.cursor = "pointer";
          }
        },
        disable: () => {
          container.disableInteractive();
        },
      };

      container.on("pointerup", () => {
        if (!this.gameActive || node.matched) {
          return;
        }
        this.handleImageSelection(node, isLeft);
      });

      container.on("pointerover", () => {
        if (!this.gameActive || node.matched) {
          return;
        }
        container.setScale(1.02);
        applyStyle("hover");
      });
      container.on("pointerout", () => {
        container.setScale(1);
        if (!node.matched) {
          applyStyle("base");
        }
      });

      return node;
    }

    createHud() {
      const progressWidth = 380;
      const progressHeight = 64;
      this.progressPanel = createRoundedPanel(
        this,
        progressWidth,
        progressHeight,
        18
      );
      this.progressPanel.update({
        fillColor: 0xffffff,
        fillAlpha: 0.92,
        strokeColor: PALETTE.primaryMuted,
        strokeAlpha: 0.65,
        lineWidth: 3,
      });
      this.progressText = this.add
        .text(0, 0, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "28px",
          color: "#1d4ed8",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.progressBadge = this.add.container(270, 50, [
        this.progressPanel.graphics,
        this.progressText,
      ]);
      this.progressBadge.setDepth(5);

      const tipWidth = 640;
      const tipHeight = 48;
      this.tipPanel = createRoundedPanel(this, tipWidth, tipHeight, 12);
      this.tipPanel.update({
        fillColor: 0xffffff,
        fillAlpha: 0.94,
        strokeColor: PALETTE.primaryMuted,
        strokeAlpha: 0.4,
        lineWidth: 2,
      });
      this.tipText = this.add
        .text(0, 0, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "20px",
          color: "#0f172a",
        })
        .setOrigin(0.5);
      this.tipBadge = this.add.container(880, 50, [
        this.tipPanel.graphics,
        this.tipText,
      ]);
      this.tipBadge.setDepth(5);
      this.tipBadge.setAlpha(0);
    }

    setGameElementsVisible(isVisible) {
      const targets = [
        this.lineLayer,
        this.keywordLayer,
        this.imageLayer,
        this.progressBadge,
      ];
      targets.forEach((item) => {
        if (item?.setVisible) {
          item.setVisible(isVisible);
        } else if (item) {
          item.visible = isVisible;
        }
      });
      if (this.tipBadge) {
        this.tipBadge.setVisible(isVisible);
        if (!isVisible) {
          this.tipBadge.setAlpha(0);
        }
      }
    }

    createCenterStartButton(width, height) {
      const buttonWidth = 480;
      const buttonHeight = 220;
      this.startButton = createPrimaryButton(
        this,
        "Start",
        buttonWidth,
        buttonHeight,
        {
          onClick: () => this.handleStartPressed(false),
          playTone: () => tonePlayer.playTone(640, 240),
          fontSize: 100,
        }
      );
      this.startButton.container.setPosition(width / 2, height / 2);
      this.startButton.container.setDepth(20);
      this.startButton.container.setVisible(false);
      this.startButton.setEnabled(false);
      this.tweens.add({
        targets: this.startButton.container,
        scale: 1.04,
        duration: 600,
        ease: "Sine.easeInOut",
        repeat: -1,
        yoyo: true,
      });
    }

    setStartButtonVisible(visible) {
      if (!this.startButton) {
        return;
      }
      this.startButton.container.setVisible(visible);
      this.startButton.setEnabled(visible);
    }

    handleStartPressed(autoStart) {
      if (this.gameActive) {
        if (!autoStart) {
          this.restartGame(true);
        }
        return;
      }
      this.setStartButtonVisible(false);
      this.beginMatching(autoStart);
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
        // ignore failures (user gesture requirements, etc.)
      }
    }

    updateProgressText() {
      if (!this.progressText) {
        return;
      }
      this.progressText.setText(
        `Matches ${this.matchesCompleted}/${this.totalPairs}`
      );
    }

    updateTip(message, persistent = false) {
      if (!this.tipText || !this.tipBadge) {
        return;
      }
      if (this.tipTimer) {
        this.tipTimer.remove(false);
        this.tipTimer = null;
      }
      this.tipText.setText(message || "");
      const hasMessage = Boolean(message);
      this.tipBadge.setAlpha(hasMessage ? 0.95 : 0);
      if (!persistent && hasMessage) {
        this.tipTimer = this.time.addEvent({
          delay: 2600,
          callback: () => {
            if (this.tipBadge) {
              this.tipBadge.setAlpha(0.6);
            }
          },
        });
      }
    }

    createResultOverlay() {
      this.resultOverlay = this.add.container(
        this.sceneWidth / 2,
        this.sceneHeight / 2
      );
      this.resultOverlay.setDepth(11);
      this.resultOverlay.setVisible(false);
      const scrim = this.add.rectangle(
        0,
        0,
        this.sceneWidth,
        this.sceneHeight,
        0x0f172a,
        0.65
      );
      scrim.setInteractive();
      const panelWidth = 560;
      const panelHeight = 380;
      const panel = createRoundedPanel(this, panelWidth, panelHeight, 32);
      panel.update({
        fillColor: 0xffffff,
        fillAlpha: 0.98,
        strokeColor: PALETTE.primaryMuted,
        strokeAlpha: 0.8,
        lineWidth: 4,
      });
      const resultTitleY = -panelHeight / 2 + 70;
      const title = this.add
        .text(0, resultTitleY, "Great effort!", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "36px",
          fontStyle: "700",
          color: "#0f172a",
          align: "center",
        })
        .setOrigin(0.5);
      const summaryY = 0;
      this.resultSummary = this.add
        .text(0, summaryY, "", {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: "24px",
          color: "#1f2937",
          align: "center",
          wordWrap: { width: panelWidth - 120 },
        })
        .setOrigin(0.5);

      const buttonWidth = 210;
      const buttonHeight = 86;
      const replayButton = createPrimaryButton(
        this,
        "Replay",
        buttonWidth,
        buttonHeight,
        {
          onClick: () => this.restartGame(true),
          playTone: () => tonePlayer.playTone(640, 240),
        }
      );
      replayButton.container.setPosition(
        -buttonWidth / 2 - 20,
        panelHeight / 2 - 90
      );

      const quitButton = createPrimaryButton(
        this,
        "Quit",
        buttonWidth,
        buttonHeight,
        {
          onClick: () => this.handleQuit(),
          baseColor: PALETTE.slate,
          playTone: () => tonePlayer.playTone(320, 320),
        }
      );
      quitButton.container.setPosition(
        buttonWidth / 2 + 20,
        panelHeight / 2 - 90
      );

      this.resultOverlay.add([
        scrim,
        panel.graphics,
        title,
        this.resultSummary,
        replayButton.container,
        quitButton.container,
      ]);
      this.replayButton = replayButton;
      this.quitButton = quitButton;
    }

    beginMatching(autoStart) {
      if (this.gameActive) {
        return;
      }
      this.setGameElementsVisible(true);
      this.gameActive = true;
      this.statusController("Match each keyword with an image.");
      this.setInteractionState(true);
      this.reportProgress(false);
      this.updateTip(
        autoStart
          ? "Auto start enabled. Select any keyword."
          : "Pick a keyword to get started."
      );
    }

    setInteractionState(enabled) {
      const toggler = enabled ? "enable" : "disable";
      this.keywordNodes.forEach((node) => node[toggler]());
      this.imageNodes.forEach((node) => node[toggler]());
    }

    handleKeywordSelection(node) {
      if (this.selectedKeyword === node) {
        node.setSelected(false);
        this.selectedKeyword = null;
        this.updateTip("Keyword deselected. Choose another one.");
        return;
      }
      if (this.selectedKeyword) {
        this.selectedKeyword.setSelected(false);
      }
      this.selectedKeyword = node;
      node.setSelected(true);
      this.updateTip("Now select the matching image.");
    }

    handleImageSelection(node, isLeft) {
      if (!this.selectedKeyword) {
        this.updateTip("Pick a keyword first.", false);
        return;
      }

      const keywordNode = this.selectedKeyword;
      keywordNode.setSelected(false);
      this.selectedKeyword = null;

      const isCorrect = keywordNode.id === node.id;
      keywordNode.setMatched(isCorrect);
      node.setMatched(isCorrect);

      this.drawConnection(keywordNode, node, isCorrect, isLeft);

      this.matchesCompleted += 1;
      if (isCorrect) {
        this.correctMatches += 1;
      }
      this.updateProgressText();
      this.playFeedbackSound(isCorrect);
      this.connections.push({ keywordNode, imageNode: node, isCorrect });
      this.reportProgress(false);

      if (this.matchesCompleted >= this.totalPairs) {
        this.time.delayedCall(600, () => this.finishGame());
      } else {
        this.updateTip(
          isCorrect ? "Nice match! Keep going." : "Line locked. Continue."
        );
      }
    }

    drawConnection(keywordNode, imageNode, isCorrect, isLeft) {
      const graphics = this.add.graphics();
      graphics.lineStyle(6, isCorrect ? 0x16a34a : 0xdc2626, 0.9);
      const start = new Phaser.Math.Vector2();
      const end = new Phaser.Math.Vector2();
      keywordNode.container
        .getWorldTransformMatrix()
        .transformPoint(isLeft ? 175 : -175, 0, start);
      imageNode.container.getWorldTransformMatrix().transformPoint(isLeft ? -85 : 85, 0, end);
      graphics.beginPath();
      graphics.moveTo(start.x, start.y);
      graphics.lineTo(end.x, end.y);
      graphics.strokePath();
      graphics.setDepth(1);
      this.lineLayer.add(graphics);
    }

    playFeedbackSound(isCorrect) {
      const audioKey = isCorrect
        ? this.correctAudioKey
        : this.incorrectAudioKey;
      if (audioKey && this.sound && this.cache.audio.exists(audioKey)) {
        this.sound.play(audioKey, { volume: 0.5 });
        return;
      }
      tonePlayer.playTone(isCorrect ? 640 : 320, isCorrect ? 240 : 320);
    }

    finishGame() {
      if (this.resultDisplayed) {
        return;
      }
      this.gameActive = false;
      this.setInteractionState(false);
      this.selectedKeyword = null;
      this.showResultMarkers();
      this.reportProgress(true);
      this.updateTip("Review your matches above.", true);
      this.statusController(
        `You matched ${this.correctMatches}/${this.totalPairs} correctly.`
      );
      this.showResultOverlay();
      this.resultDisplayed = true;
    }

    showResultMarkers() {
      this.connections.forEach((connection) => {
        connection.imageNode.badge.show(connection.isCorrect);
      });
    }

    showResultOverlay() {
      if (!this.resultOverlay) {
        return;
      }
      this.resultSummary.setText(
        `You matched ${this.correctMatches} out of ${this.totalPairs} pairs correctly.`
      );
      this.resultOverlay.setVisible(true);
      this.replayButton?.setEnabled(true);
      this.quitButton?.setEnabled(true);
    }

    handleQuit() {
      this.exitToIdleState();
    }

    restartGame(autoStart = false) {
      this.scene.restart({ autoStart });
    }

    exitToIdleState() {
      this.sound?.stopAll?.();
      if (this.tipTimer) {
        this.tipTimer.remove(false);
        this.tipTimer = null;
      }
      this.setInteractionState(false);
      this.setGameElementsVisible(false);
      this.resultOverlay?.setVisible(false);
      this.resultOverlay?.setAlpha?.(0);
      this.replayButton?.setEnabled(false);
      this.quitButton?.setEnabled(false);
      this.selectedKeyword = null;
      this.gameActive = false;
      this.resultDisplayed = false;
      this.shouldAutoStart = false;
      this.updateTip("", true);
      this.statusController("Press Start to begin matching.");
      if (this.scale?.isFullscreen) {
        try {
          this.scale.stopFullscreen();
        } catch (error) {
          // ignore fullscreen errors
        }
      }
      this.scene.restart({ autoStart: false });
    }

    reportProgress(completed) {
      if (!this.onRoundUpdate) {
        return;
      }
      this.onRoundUpdate({
        mode: "matching",
        completedMatches: this.matchesCompleted,
        correctMatches: this.correctMatches,
        total: this.totalPairs,
        completed: Boolean(completed),
      });
    }
  };
};
