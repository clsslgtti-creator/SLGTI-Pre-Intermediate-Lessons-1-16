
export const DEFAULT_FEEDBACK_ASSETS = {
  correctAudio: "assets/audio/game/correct.wav",
  incorrectAudio: "assets/audio/game/incorrect.wav",
  timeoutAudio: "assets/audio/game/timeout.wav",
  correctImg: "assets/img/game/correct.png",
  incorrectImg: "assets/img/game/incorrect.png",
  timeoutImg: "assets/img/game/timeout.png",
};

export const DEFAULT_BACKGROUND_IMAGE = "assets/img/game/bg-5.jpg";

const trimText = (value) => (typeof value === "string" ? value.trim() : "");

const shuffleArray = (list = []) => {
  const copy = Array.isArray(list) ? [...list] : [];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const sanitizeId = (value, fallback) => {
  const trimmed = trimText(value);
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

      const leftText = trimText(
        pair.leftText ??
          pair.colunm_a ??
          pair.column_a ??
          pair.columnA ??
          pair.col_a ??
          pair.left ??
          pair.a
      );
      const rightText = trimText(
        pair.rightText ??
          pair.colunm_b ??
          pair.column_b ??
          pair.columnB ??
          pair.col_b ??
          pair.right ??
          pair.b
      );
      if (!leftText || !rightText) {
        return null;
      }
      return {
        id,
        leftText,
        rightText,
      };
    })
    .filter(Boolean);
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

const WORD_CARD_STYLES = {
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

const measureWrappedTextHeight = (scene, text, width, fontSize) => {
  const label = scene.add
    .text(-9999, -9999, text, {
      fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
      fontSize: `${fontSize}px`,
      color: "#0f172a",
      align: "center",
      wordWrap: { width },
    })
    .setOrigin(0.5);
  label.setVisible(false);
  const height = label.height || 0;
  label.destroy();
  return height;
};

const computeRowLayout = (
  rowHeights,
  {
    top = 150,
    bottom = 660,
    preferredGap = 12,
    minHeight = 44,
    maxHeight = 96,
    minGap = 6,
  } = {}
) => {
  if (!rowHeights.length) {
    return { positions: [], heights: [], gap: preferredGap };
  }

  let heights = rowHeights.map((height) =>
    Math.max(minHeight, Math.min(height, maxHeight))
  );
  let gap = preferredGap;
  const available = Math.max(0, bottom - top);

  const totalHeight = () =>
    heights.reduce((sum, height) => sum + height, 0) +
    gap * Math.max(heights.length - 1, 0);

  if (totalHeight() > available) {
    gap = minGap;
    const usable = available - gap * Math.max(heights.length - 1, 0);
    if (usable > 0) {
      const baseTotal = heights.reduce((sum, height) => sum + height, 0);
      const scale = Math.min(1, usable / baseTotal);
      heights = heights.map((height) =>
        Math.max(minHeight, Math.floor(height * scale))
      );
    }
  }

  const extraSpace = Math.max(0, available - totalHeight());
  const positions = [];
  let currentY = top + extraSpace / 2 + heights[0] / 2;
  positions.push(currentY);
  for (let i = 1; i < heights.length; i += 1) {
    currentY += heights[i - 1] / 2 + gap + heights[i] / 2;
    positions.push(currentY);
  }

  return { positions, heights, gap };
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
      correctIcon.setScale(0.5);
      incorrectIcon.setScale(0.5);
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
    const circle = scene.add.circle(0, 0, 22, 0xffffff, 1);
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
          lines.moveTo(-8, 4);
          lines.lineTo(-1, 12);
          lines.lineTo(10, -8);
          lines.strokePath();
        } else {
          circle.setFillStyle(0xfee2e2, 1);
          circle.setStrokeStyle(3, 0xb91c1c, 0.9);
          lines.lineStyle(4, 0xb91c1c, 1);
          lines.beginPath();
          lines.moveTo(-9, -9);
          lines.lineTo(9, 9);
          lines.moveTo(9, -9);
          lines.lineTo(-9, 9);
          lines.strokePath();
        }
      },
    };
  };
};
export const createWordMatchingGameScene = (config = {}) => {
  const {
    pairs: rawPairs = [],
    backgroundImage,
    feedbackAssets = DEFAULT_FEEDBACK_ASSETS,
    statusElement = null,
    onRoundUpdate,
  } = config;

  const sanitizedPairs = normalizeMatchingPairs(rawPairs);
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

  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const makeKey = (name) => `matching_words_${name}_${randomSuffix}`;
  const backgroundTextureKey = makeKey("bg");
  const correctIconKey = makeKey("correct_icon");
  const incorrectIconKey = makeKey("incorrect_icon");
  const correctAudioKey = makeKey("correct_audio");
  const incorrectAudioKey = makeKey("incorrect_audio");

  return class WordMatchingScene extends Phaser.Scene {
    constructor() {
      super("WordMatchingScene");
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
      this.leftNodes = [];
      this.rightNodes = [];
      this.connections = [];
      this.matchesCompleted = 0;
      this.correctMatches = 0;
      this.selectedLeft = null;
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
            ? "Get ready to match the columns."
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
      this.leftLayer = this.add.layer();
      this.rightLayer = this.add.layer();
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
      const leftOrder = [...this.sessionPairs];
      const rightOrder = shuffleArray(this.sessionPairs);
      const leftX = this.sceneWidth * 0.35;
      const rightX = this.sceneWidth * 0.9;
      const leftWidth = 750;
      const rightWidth = 200;
      const leftFontSize = Math.max(18, Math.min(28, Math.floor(leftWidth / 18)));
      const rightFontSize = Math.max(
        18,
        Math.min(26, Math.floor(rightWidth / 18))
      );

      const rowHeights = leftOrder.map((pair, index) => {
        const leftHeight = measureWrappedTextHeight(
          this,
          pair.leftText,
          leftWidth - 36,
          leftFontSize
        );
        const rightHeight = measureWrappedTextHeight(
          this,
          rightOrder[index]?.rightText ?? "",
          rightWidth - 36,
          rightFontSize
        );
        return Math.max(leftHeight, rightHeight) + 24;
      });

      const { positions, heights } = computeRowLayout(rowHeights, {
        top: 110,
        bottom: this.sceneHeight - 50,
        preferredGap: 12,
        minHeight: 48,
        maxHeight: 112,
        minGap: 6,
      });

      leftOrder.forEach((pair, index) => {
        const y = positions[index];
        const node = this.createWordNode(
          pair,
          pair.leftText,
          leftX,
          y,
          leftWidth,
          heights[index],
          { selectable: true, fontSize: leftFontSize }
        );
        this.leftLayer.add(node.container);
        this.leftNodes.push(node);
      });

      const createBadge = createResultBadgeFactory(this, {
        correctIconKey: this.correctIconKey,
        incorrectIconKey: this.incorrectIconKey,
      });

      rightOrder.forEach((pair, index) => {
        const y = positions[index];
        const node = this.createWordNode(
          pair,
          pair.rightText,
          rightX,
          y,
          rightWidth,
          heights[index],
          {
            selectable: false,
            badgeFactory: createBadge,
            fontSize: rightFontSize,
          }
        );
        this.rightLayer.add(node.container);
        this.rightNodes.push(node);
      });
    }

    computePositions(count) {
      if (!count) {
        return [];
      }
      const top = 120;
      const bottom = this.sceneHeight - 50;
      if (count === 1) {
        return [(top + bottom) / 2];
      }
      const spacing = (bottom - top) / (count - 1);
      return Array.from({ length: count }, (_, index) => top + spacing * index);
    }
    createWordNode(
      pair,
      labelText,
      x,
      y,
      width,
      height,
      { selectable, badgeFactory, fontSize, minFontSize } = {}
    ) {
      const container = this.add.container(x, y);
      const panel = createRoundedPanel(this, width, height, 22);
      panel.update(WORD_CARD_STYLES.base);

      const resolvedFontSize = Number.isFinite(fontSize)
        ? fontSize
        : Math.max(18, Math.min(28, Math.floor(width / 18)));
      const resolvedMinFontSize = Number.isFinite(minFontSize)
        ? minFontSize
        : 16;
      const textPaddingX = 5;
      const textPaddingY = 5;
      const wrapWidth = width - textPaddingX * 2;
      let currentFontSize = resolvedFontSize;
      const label = this.add
        .text(0, 0, labelText, {
          fontFamily: 'Segoe UI, "Helvetica Neue", Arial, sans-serif',
          fontSize: `${currentFontSize}px`,
          color: "#0f172a",
          align: "center",
          wordWrap: { width: wrapWidth },
        })
        .setOrigin(0.5);

      const maxTextHeight = height - textPaddingY * 2;
      if (maxTextHeight > 0 && label.height > maxTextHeight) {
        const ratio = maxTextHeight / label.height;
        currentFontSize = Math.max(
          resolvedMinFontSize,
          Math.floor(currentFontSize * ratio)
        );
        label.setFontSize(currentFontSize);
        label.setWordWrapWidth(wrapWidth);
        let guard = 0;
        while (
          label.height > maxTextHeight &&
          currentFontSize > resolvedMinFontSize &&
          guard < 6
        ) {
          currentFontSize = Math.max(
            resolvedMinFontSize,
            Math.floor(currentFontSize * 0.92)
          );
          label.setFontSize(currentFontSize);
          label.setWordWrapWidth(wrapWidth);
          guard += 1;
        }
      }
      container.add([panel.graphics, label]);
      container.setSize(width, height);
      container.setInteractive();
      if (container.input) {
        container.input.cursor = "pointer";
      }

      const badge = badgeFactory ? badgeFactory() : null;
      if (badge) {
        badge.container.setPosition(width / 2 - 26, -height / 2 + 26);
        container.add(badge.container);
      }

      const applyStyle = (styleKey) => {
        const style = WORD_CARD_STYLES[styleKey] || WORD_CARD_STYLES.base;
        panel.update(style);
      };

      const node = {
        id: pair.id,
        pair,
        container,
        panel,
        label,
        badge,
        width,
        height,
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
        if (selectable) {
          this.handleLeftSelection(node);
        } else {
          this.handleRightSelection(node);
        }
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
      this.tipBadge = this.add.container(this.sceneWidth - 320, 50, [
        this.tipPanel.graphics,
        this.tipText,
      ]);
      this.tipBadge.setDepth(5);
      this.tipBadge.setAlpha(0);
    }

    setGameElementsVisible(isVisible) {
      const targets = [
        this.lineLayer,
        this.leftLayer,
        this.rightLayer,
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
      this.statusController("Match column A with column B.");
      this.setInteractionState(true);
      this.reportProgress(false);
      this.updateTip(
        autoStart
          ? "Auto start enabled. Select any item from column A."
          : "Pick a word from column A to get started."
      );
    }

    setInteractionState(enabled) {
      const toggler = enabled ? "enable" : "disable";
      this.leftNodes.forEach((node) => node[toggler]());
      this.rightNodes.forEach((node) => node[toggler]());
    }

    handleLeftSelection(node) {
      if (this.selectedLeft === node) {
        node.setSelected(false);
        this.selectedLeft = null;
        this.updateTip("Selection cleared. Choose another item.");
        return;
      }
      if (this.selectedLeft) {
        this.selectedLeft.setSelected(false);
      }
      this.selectedLeft = node;
      node.setSelected(true);
      this.updateTip("Now select the matching item in column B.");
    }

    handleRightSelection(node) {
      if (!this.selectedLeft) {
        this.updateTip("Select a word from column A first.", false);
        return;
      }

      const leftNode = this.selectedLeft;
      leftNode.setSelected(false);
      this.selectedLeft = null;

      const isCorrect = leftNode.id === node.id;
      leftNode.setMatched(isCorrect);
      node.setMatched(isCorrect);

      this.drawConnection(leftNode, node, isCorrect);

      this.matchesCompleted += 1;
      if (isCorrect) {
        this.correctMatches += 1;
      }
      this.updateProgressText();
      this.playFeedbackSound(isCorrect);
      this.connections.push({ leftNode, rightNode: node, isCorrect });
      this.reportProgress(false);

      if (this.matchesCompleted >= this.totalPairs) {
        this.time.delayedCall(600, () => this.finishGame());
      } else {
        this.updateTip(
          isCorrect ? "Nice match! Keep going." : "Line locked. Continue."
        );
      }
    }

    drawConnection(leftNode, rightNode, isCorrect) {
      const graphics = this.add.graphics();
      graphics.lineStyle(6, isCorrect ? 0x16a34a : 0xdc2626, 0.9);
      const start = new Phaser.Math.Vector2();
      const end = new Phaser.Math.Vector2();
      leftNode.container
        .getWorldTransformMatrix()
        .transformPoint(leftNode.width / 2, 0, start);
      rightNode.container
        .getWorldTransformMatrix()
        .transformPoint(-rightNode.width / 2, 0, end);
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
      this.selectedLeft = null;
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
        connection.rightNode.badge?.show(connection.isCorrect);
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
      this.selectedLeft = null;
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
