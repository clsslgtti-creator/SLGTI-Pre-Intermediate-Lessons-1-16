const trimString = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeInstructionKey = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return value.toString().toLowerCase().replace(/[^a-z0-9]+/g, "");
};

const getInstructionKeyVariants = (normalizedKey) => {
  if (!normalizedKey) {
    return [];
  }
  const variants = new Set();
  if (normalizedKey.includes("instrction")) {
    variants.add(normalizedKey.replace("instrction", "instruction"));
  }
  if (normalizedKey.includes("instruction")) {
    variants.add(normalizedKey.replace("instruction", "instrction"));
  }
  return Array.from(variants);
};

const normalizeSteps = (steps) => {
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps.map((step) => trimString(step)).filter(Boolean);
};

const extractInstructionEntry = (raw) => {
  if (!raw) {
    return null;
  }

  if (typeof raw === "string") {
    const text = trimString(raw);
    return text ? { text, audio: null, steps: [] } : null;
  }

  if (typeof raw === "object") {
    const text = trimString(raw.text);
    const audio = trimString(raw.audio);
    const steps = normalizeSteps(raw.steps);
    if (!text && !audio && !steps.length) {
      return null;
    }
    return {
      text,
      audio: audio || null,
      steps,
    };
  }

  return null;
};

const buildInstructionMap = (rawInstructions) => {
  if (!rawInstructions || typeof rawInstructions !== "object") {
    return new Map();
  }

  const map = new Map();
  Object.entries(rawInstructions).forEach(([key, value]) => {
    const entry = extractInstructionEntry(value);
    if (!entry) {
      return;
    }

    const normalizedKey = normalizeInstructionKey(key);
    if (!normalizedKey) {
      return;
    }

    if (!map.has(normalizedKey)) {
      map.set(normalizedKey, entry);
    }

    getInstructionKeyVariants(normalizedKey).forEach((variant) => {
      if (variant && !map.has(variant)) {
        map.set(variant, entry);
      }
    });
  });

  return map;
};

const resolveInstructionEntry = (instructionMap, key) => {
  if (!instructionMap || !(instructionMap instanceof Map)) {
    return null;
  }
  const normalizedKey = normalizeInstructionKey(key);
  if (!normalizedKey) {
    return null;
  }
  return instructionMap.get(normalizedKey) ?? null;
};

const createStatus = () => {
  const status = document.createElement("p");
  status.className = "playback-status";
  status.textContent = "";
  return status;
};

const buildHeading = (slide, headingText) => {
  const heading = document.createElement("h2");
  heading.textContent = headingText;
  slide.appendChild(heading);
};

const buildInstructionBlock = (instruction) => {
  if (!instruction) {
    return null;
  }

  const { text, steps } = instruction;
  const hasText = Boolean(text);
  const hasSteps = Array.isArray(steps) && steps.length > 0;

  if (!hasText && !hasSteps) {
    return null;
  }

  const wrapper = document.createElement("div");

  if (hasText) {
    const paragraph = document.createElement("p");
    paragraph.className = "slide__instruction";
    paragraph.textContent = text;
    wrapper.appendChild(paragraph);
  }

  if (hasSteps) {
    const list = document.createElement("ol");
    list.className = "video-steps";
    steps.forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      list.appendChild(li);
    });
    wrapper.appendChild(list);
  }

  return wrapper;
};

const resolveVideoSource = (item) =>
  trimString(item?.video) || trimString(item?.audio);

const resolveVideoInstructionKey = (item) =>
  trimString(item?.instruction) || trimString(item?.instrction);

const buildVideoSlide = (item, context, instruction) => {
  const {
    activityLabel = "Activity",
    subActivitySuffix = "",
    activityNumber = null,
    subActivityLetter = "",
  } = context;

  const videoUrl = resolveVideoSource(item);
  const slide = document.createElement("section");
  slide.className =
    "slide slide--listening listening-slide listening-slide--video";

  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);

  const instructionBlock = buildInstructionBlock(instruction);
  if (instructionBlock) {
    slide.appendChild(instructionBlock);
  }

  const videoWrapper = document.createElement("div");
  videoWrapper.className = "listening-video";

  const videoEl = document.createElement("video");
  videoEl.controls = true;
  videoEl.preload = "metadata";
  videoEl.playsInline = true;
  videoEl.style.width = "100%";
  videoEl.style.height = "auto";
  videoEl.style.maxHeight = "65vh";

  if (videoUrl) {
    const source = document.createElement("source");
    source.src = videoUrl;
    source.type = "video/mp4";
    videoEl.appendChild(source);
  } else {
    const placeholder = document.createElement("p");
    placeholder.className = "empty-state";
    placeholder.textContent = "Video will be added soon.";
    videoWrapper.appendChild(placeholder);
  }

  videoWrapper.appendChild(videoEl);
  slide.appendChild(videoWrapper);

  const controls = document.createElement("div");
  controls.className = "slide__controls";

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "primary-btn";
  playBtn.textContent = "Play Video";
  playBtn.disabled = !videoUrl;

  const restartBtn = document.createElement("button");
  restartBtn.type = "button";
  restartBtn.className = "secondary-btn";
  restartBtn.textContent = "Restart";
  restartBtn.disabled = !videoUrl;

  const status = createStatus();
  controls.append(playBtn, restartBtn, status);
  slide.appendChild(controls);

  const updateStatus = (text) => {
    status.textContent = text;
  };

  const syncPlayButton = () => {
    playBtn.textContent = videoEl.paused ? "Play Video" : "Pause Video";
  };

  let autoTriggered = false;

  const startPlayback = () => {
    if (!videoUrl) {
      updateStatus("Video will be added soon.");
      return;
    }
    slide._autoTriggered = true;
    autoTriggered = true;
    const playPromise = videoEl.play();
    updateStatus("Playing...");
    if (playPromise?.catch) {
      playPromise.catch(() => {
        updateStatus("Unable to start playback.");
      });
    }
  };

  playBtn.addEventListener("click", () => {
    if (!videoUrl) {
      updateStatus("Video will be added soon.");
      return;
    }
    slide._autoTriggered = true;
    autoTriggered = true;
    if (videoEl.paused) {
      const playPromise = videoEl.play();
      updateStatus("Playing...");
      if (playPromise?.catch) {
        playPromise.catch(() => {
          updateStatus("Video playback failed.");
        });
      }
      return;
    }
    videoEl.pause();
  });

  restartBtn.addEventListener("click", () => {
    if (!videoUrl) {
      updateStatus("Video will be added soon.");
      return;
    }
    videoEl.currentTime = 0;
    autoTriggered = true;
    slide._autoTriggered = true;
    const playPromise = videoEl.play();
    updateStatus("Restarted...");
    if (playPromise?.catch) {
      playPromise.catch(() => {
        updateStatus("Unable to restart video.");
      });
    }
  });

  const onPlay = () => {
    syncPlayButton();
    updateStatus("Playing...");
  };
  const onPause = () => {
    syncPlayButton();
    if (
      Math.floor(videoEl.currentTime) >= Math.floor(videoEl.duration || 0) &&
      videoEl.duration
    ) {
      updateStatus("Playback complete.");
      return;
    }
    updateStatus("Paused.");
  };
  const onEnded = () => {
    syncPlayButton();
    updateStatus("Playback complete.");
  };

  videoEl.addEventListener("play", onPlay);
  videoEl.addEventListener("pause", onPause);
  videoEl.addEventListener("ended", onEnded);

  const triggerAutoPlay = () => {
    if (autoTriggered || !videoUrl) {
      return;
    }
    startPlayback();
  };

  const onLeave = () => {
    videoEl.pause();
    videoEl.currentTime = 0;
    status.textContent = "";
    autoTriggered = false;
    slide._autoTriggered = false;
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-video`
      : `activity-video${suffixSegment || ""}`,
    element: slide,
    instructionAudio: instruction?.audio ?? null,
    hasCustomInstructions: true,
    autoPlay: {
      button: playBtn,
      trigger: triggerAutoPlay,
      status,
    },
    onLeave,
  };
};

const createSubActivityContext = (base, letter) => ({
  activityLabel: base.activityLabel,
  activityNumber: base.activityNumber,
  subActivitySuffix: letter ? letter : "",
  subActivityLetter: letter || "",
});

export const buildVideosSlides = (activityData = {}, context = {}) => {
  const { activityNumber } = context;
  const activityLabel = activityNumber
    ? `Activity ${activityNumber}`
    : "Activity";

  const baseContext = {
    activityLabel,
    activityNumber,
  };

  const rawInstructions =
    activityData?.instructions ?? activityData?.instrctions ?? null;
  const instructionMap = buildInstructionMap(rawInstructions);
  const items = Array.isArray(activityData?.content) ? activityData.content : [];

  if (!items.length) {
    const emptySlide = document.createElement("section");
    emptySlide.className = "slide slide--listening listening-slide";
    buildHeading(emptySlide, activityLabel);
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Videos will be added soon.";
    emptySlide.appendChild(emptyState);
    return [
      {
        id: activityNumber ? `activity-${activityNumber}-video` : "activity-video",
        element: emptySlide,
        onLeave: () => {},
      },
    ];
  }

  return items.map((item, index) => {
    const letter = String.fromCharCode(97 + index);
    const instructionKey = resolveVideoInstructionKey(item);
    const instruction = resolveInstructionEntry(instructionMap, instructionKey);
    return buildVideoSlide(
      item,
      createSubActivityContext(baseContext, letter),
      instruction
    );
  });
};
