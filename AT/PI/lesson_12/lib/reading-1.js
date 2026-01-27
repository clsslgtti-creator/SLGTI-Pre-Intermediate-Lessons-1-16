import { showCompletionModal } from "./completion-modal.js";

const trimString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeValue = (value) => {
  const trimmed = trimString(value);
  return trimmed ? trimmed.toLowerCase() : "";
};

const shuffleArray = (items = []) => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
};

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

const maybeInsertFocus = (slide, focusText, includeFocus) => {
  if (!includeFocus) {
    return;
  }
  const trimmed = trimString(focusText);
  if (!trimmed) {
    return;
  }
  const focusEl = document.createElement("p");
  focusEl.className = "activity-focus";
  focusEl.textContent = trimmed;
  const heading = slide.querySelector("h2");
  if (heading) {
    heading.insertAdjacentElement("afterend", focusEl);
  } else {
    slide.prepend(focusEl);
  }
};

const normalizeMatchingPairs = (raw = []) => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const idCounts = new Map();
  return raw
    .map((entry, index) => {
      const baseId = trimString(entry?.id) || `match_${index + 1}`;
      const count = idCounts.get(baseId) ?? 0;
      idCounts.set(baseId, count + 1);
      const id = count > 0 ? `${baseId}_${count + 1}` : baseId;
      const itemA = trimString(entry?.item_a) || trimString(entry?.itemA);
      const itemB = trimString(entry?.item_b) || trimString(entry?.itemB);
      if (!itemA || !itemB) {
        return null;
      }
      return {
        id,
        itemA,
        itemB,
      };
    })
    .filter(Boolean);
};

const normalizeComprehensionData = (raw = {}) => {
  const rawQuestions = Array.isArray(raw?.Questions)
    ? raw.Questions
    : Array.isArray(raw?.questions)
    ? raw.questions
    : [];

  const questions = rawQuestions
    .map((question, index) => {
      const id = trimString(question?.id) || `question_${index + 1}`;
      const prompt = trimString(question?.question);
      const answer = trimString(question?.answer);
      const options = Array.isArray(question?.options)
        ? question.options.map((option) => trimString(option)).filter(Boolean)
        : [];

      if (!prompt || !answer || options.length < 2) {
        return null;
      }

      return {
        id,
        prompt,
        answer,
        answerNormalized: normalizeValue(answer),
        options,
      };
    })
    .filter(Boolean);

  return {
    questions,
  };
};
const buildMatchingSlide = (data = {}, context = {}) => {
  const {
    activityLabel = "Activity",
    activityNumber = null,
    subActivitySuffix = "",
    activityFocus = "",
    includeFocus = false,
    subActivityLetter = "",
  } = context;

  const slide = document.createElement("section");
  slide.className =
    "slide slide--listening listening-slide listening-slide--matching";

  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);
  maybeInsertFocus(slide, activityFocus, includeFocus);

  const items = normalizeMatchingPairs(data?.content);

  if (!items.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Matching content will be added soon.";
    slide.appendChild(emptyState);
    return {
      id: activityNumber
        ? `activity-${activityNumber}${
            subActivityLetter ? `-${subActivityLetter}` : ""
          }-pre-listening`
        : "activity-pre-listening",
      element: slide,
      onLeave: () => {},
    };
  }

  const controls = document.createElement("div");
  controls.className = "slide__controls";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "secondary-btn";
  resetBtn.textContent = "Reset";

  controls.append(resetBtn);
  slide.appendChild(controls);

  const layout = document.createElement("div");
  layout.className = "listening-word-match";

  const wordsColumn = document.createElement("div");
  wordsColumn.className = "word-match-bank";
  layout.appendChild(wordsColumn);

  const sentencesColumn = document.createElement("div");
  sentencesColumn.className = "word-match-sentences";
  layout.appendChild(sentencesColumn);

  const feedbackEl = document.createElement("p");
  feedbackEl.className =
    "listening-feedback listening-feedback--neutral word-match-feedback";
  layout.appendChild(feedbackEl);

  slide.appendChild(layout);

  const placements = new Map();
  const dropzones = [];

  const createSentenceCard = (entry, index) => {
    const card = document.createElement("article");
    card.className = "word-match-sentence";

    const title = document.createElement("h3");
    title.textContent = `Pair ${index + 1}`;
    card.appendChild(title);

    const body = document.createElement("p");
    body.textContent = entry.itemB;
    card.appendChild(body);

    const zone = document.createElement("div");
    zone.className = "word-match-dropzone";
    zone.dataset.expectedId = entry.id;
    zone.dataset.zoneId = entry.id;

    const placeholder = document.createElement("span");
    placeholder.className = "word-match-placeholder";
    placeholder.textContent = "Drop the matching word here";
    zone.appendChild(placeholder);

    card.appendChild(zone);
    dropzones.push(zone);
    return card;
  };

  items.forEach((entry, index) => {
    sentencesColumn.appendChild(createSentenceCard(entry, index));
  });

  const createCard = (entry) => {
    const card = document.createElement("div");
    card.className = "word-match-card";
    card.dataset.itemId = entry.id;
    card.dataset.assignedZone = "";
    card.textContent = entry.itemA;
    return card;
  };

  const cards = items.map((entry) => createCard(entry));
  shuffleArray(cards);
  cards.forEach((card) => wordsColumn.appendChild(card));

  const updateFeedback = (text, variant = "neutral") => {
    feedbackEl.textContent = text;
    feedbackEl.classList.remove(
      "listening-feedback--positive",
      "listening-feedback--negative",
      "listening-feedback--neutral"
    );
    feedbackEl.classList.add(`listening-feedback--${variant}`);
  };

  let evaluationShown = false;

  const markZoneState = (zone, cardEl) => {
    if (!zone) {
      return false;
    }
    const expectedId = zone.dataset.expectedId;
    zone.classList.remove("is-correct", "is-incorrect");
    cardEl?.classList.remove("is-correct", "is-incorrect");
    if (!cardEl) {
      return false;
    }
    const isMatch = cardEl.dataset.itemId === expectedId;
    if (isMatch) {
      zone.classList.add("is-correct");
      cardEl.classList.add("is-correct");
    } else {
      zone.classList.add("is-incorrect");
      cardEl.classList.add("is-incorrect");
    }
    return isMatch;
  };

  const detachFromZone = (cardEl) => {
    if (!cardEl) {
      return;
    }
    const assigned = cardEl.dataset.assignedZone;
    if (!assigned) {
      return;
    }
    const zone = dropzones.find((zoneEl) => zoneEl.dataset.zoneId === assigned);
    if (zone) {
      placements.delete(assigned);
      zone.classList.remove("is-filled", "is-correct", "is-incorrect");
      const placeholder = zone.querySelector(".word-match-placeholder");
      placeholder?.classList.remove("is-hidden");
      if (!zone.contains(placeholder)) {
        zone.appendChild(placeholder);
      }
      const card = zone.querySelector(".word-match-card");
      if (card) {
        zone.removeChild(card);
      }
    }
    cardEl.dataset.assignedZone = "";
  };

  const resetCardPosition = (cardEl) => {
    if (!cardEl) {
      return;
    }
    cardEl.style.top = "";
    cardEl.style.left = "";
    cardEl.style.position = "relative";
    const $ = window.jQuery;
    if ($ && $(cardEl).data("uiDraggable")) {
      $(cardEl).draggable("option", "revert", "invalid");
    }
  };

  const clearEvaluationState = () => {
    evaluationShown = false;
    updateFeedback("Drag each word to the matching definition.", "neutral");
    dropzones.forEach((zone) =>
      zone.classList.remove("is-correct", "is-incorrect")
    );
    cards.forEach((card) =>
      card.classList.remove("is-correct", "is-incorrect")
    );
  };

  const resetMatching = () => {
    placements.clear();
    clearEvaluationState();
    dropzones.forEach((zone) => {
      zone.classList.remove("is-filled");
      const placeholder = zone.querySelector(".word-match-placeholder");
      placeholder?.classList.remove("is-hidden");
      if (placeholder && !zone.contains(placeholder)) {
        zone.appendChild(placeholder);
      }
      const card = zone.querySelector(".word-match-card");
      if (card) {
        zone.removeChild(card);
      }
    });
    cards.forEach((card) => {
      card.dataset.assignedZone = "";
      card.classList.remove("is-active");
      resetCardPosition(card);
      wordsColumn.appendChild(card);
    });
  };
  const evaluatePlacements = () => {
    let correctCount = 0;
    dropzones.forEach((zone) => {
      const cardEl = placements.get(zone.dataset.zoneId);
      const isMatch = cardEl ? markZoneState(zone, cardEl) : false;
      if (isMatch) {
        correctCount += 1;
      }
    });

    evaluationShown = true;
    if (correctCount === dropzones.length) {
      updateFeedback("Great job! Every pair matches.", "positive");
      showCompletionModal({
        title: "Excellent!",
        message: "You matched each word with the correct definition.",
      });
    } else {
      updateFeedback(
        `You matched ${correctCount} of ${dropzones.length}. Adjust the red cards to try again.`,
        "negative"
      );
    }
  };

  const checkForCompletion = () => {
    const filled = dropzones.every((zone) =>
      placements.has(zone.dataset.zoneId)
    );
    if (filled) {
      evaluatePlacements();
    }
  };

  resetBtn.addEventListener("click", () => resetMatching());

  let interactionsReady = false;

  const setupInteractions = () => {
    if (interactionsReady) {
      return;
    }
    const $ = window.jQuery;
    if (!$ || !$.fn?.draggable || !$.fn?.droppable) {
      console.warn("jQuery UI is required for the matching activity.");
      return;
    }

    interactionsReady = true;

    $(cards).draggable({
      revert: "invalid",
      containment: slide,
      start() {
        $(this).addClass("is-active");
        if (evaluationShown) {
          clearEvaluationState();
        }
      },
      stop() {
        $(this).removeClass("is-active");
      },
    });

    $(dropzones).droppable({
      accept: ".word-match-card",
      tolerance: "intersect",
      over() {
        $(this).addClass("is-hover");
      },
      out() {
        $(this).removeClass("is-hover");
      },
      drop(_, ui) {
        const cardEl = ui.draggable.get(0);
        const zoneEl = this;
        $(zoneEl).removeClass("is-hover");
        if (!cardEl) {
          return;
        }

        detachFromZone(cardEl);
        const zoneId = zoneEl.dataset.zoneId;
        const existing = placements.get(zoneId);
        if (existing && existing !== cardEl) {
          detachFromZone(existing);
          resetCardPosition(existing);
          wordsColumn.appendChild(existing);
        }

        const placeholder = zoneEl.querySelector(".word-match-placeholder");
        placeholder?.classList.add("is-hidden");
        zoneEl.appendChild(cardEl);
        resetCardPosition(cardEl);
        cardEl.dataset.assignedZone = zoneId;
        zoneEl.classList.add("is-filled");
        placements.set(zoneId, cardEl);
        markZoneState(zoneEl, cardEl);
        checkForCompletion();
      },
    });

    $(wordsColumn).droppable({
      accept: ".word-match-card",
      tolerance: "intersect",
      drop(_, ui) {
        const cardEl = ui.draggable.get(0);
        if (!cardEl) {
          return;
        }
        detachFromZone(cardEl);
        resetCardPosition(cardEl);
        wordsColumn.appendChild(cardEl);
      },
    });
  };

  const onEnter = () => {
    setupInteractions();
  };

  const onLeave = () => {
    resetMatching();
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  resetMatching();

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-pre-listening`
      : "activity-pre-listening",
    element: slide,
    onEnter,
    onLeave,
  };
};
const buildComprehensionSlide = (data = {}, context = {}) => {
  const {
    activityLabel = "Activity",
    activityNumber = null,
    subActivitySuffix = "",
    activityFocus = "",
    includeFocus = false,
    subActivityLetter = "",
  } = context;

  const slide = document.createElement("section");
  slide.className = "slide slide--listening listening-slide listening-slide--mcq";
  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);
  maybeInsertFocus(slide, activityFocus, includeFocus);

  const list = document.createElement("div");
  list.className = "listening-mcq-grid";
  slide.appendChild(list);

  const questions = Array.isArray(data?.questions) ? data.questions : [];

  const entries = questions.map((question, index) => {
    const card = document.createElement("article");
    card.className = "dialogue-card dialogue-card--listening";

    const title = document.createElement("h3");
    title.className = "dialogue-card__title";
    title.textContent = `Question ${index + 1}`;
    card.appendChild(title);

    const prompt = document.createElement("p");
    prompt.className = "dialogue-card__line dialogue-card__line--question";
    prompt.textContent = question.prompt;
    card.appendChild(prompt);

    const optionGroup = document.createElement("div");
    optionGroup.className = "listening-option-group";

    const buttons = question.options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "listening-option";
      button.textContent = option;
      button.dataset.optionValue = option;
      button.dataset.optionNormalized = normalizeValue(option);
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
      completed: false,
    };
  });

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Questions will be added soon.";
    list.appendChild(empty);
  }

  let completionShown = false;

  const evaluateQuestion = (entry, selectedNormalized) => {
    if (entry.completed) {
      return;
    }
    entry.completed = true;

    entry.buttons.forEach((button) => {
      button.disabled = true;
    });

    const isCorrect =
      selectedNormalized === entry.question.answerNormalized;

    const selectedButton = entry.buttons.find(
      (button) => button.dataset.optionNormalized === selectedNormalized
    );
    const correctButton = entry.buttons.find(
      (button) =>
        button.dataset.optionNormalized === entry.question.answerNormalized
    );

    if (selectedButton) {
      selectedButton.classList.add("is-selected");
      selectedButton.classList.add(
        isCorrect ? "is-correct" : "is-incorrect"
      );
    }

    correctButton?.classList.add("is-correct");

    entry.feedback.textContent = isCorrect
      ? "Correct!"
      : `Incorrect. Correct answer: ${entry.question.answer}`;
    entry.feedback.classList.add(
      isCorrect
        ? "listening-feedback--positive"
        : "listening-feedback--negative"
    );

    entry.card.classList.add(isCorrect ? "is-correct" : "is-incorrect");

    const answeredCount = entries.filter((item) => item.completed).length;
    if (!completionShown && answeredCount === entries.length) {
      completionShown = true;
      showCompletionModal({
        title: "Great Work!",
        message: "You completed all of the questions.",
      });
    }
  };

  entries.forEach((entry) => {
    entry.buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const normalized = button.dataset.optionNormalized || "";
        evaluateQuestion(entry, normalized);
      });
    });
  });

  const onLeave = () => {
    completionShown = false;
    entries.forEach((entry) => {
      entry.completed = false;
      entry.feedback.textContent = "";
      entry.feedback.className = "listening-feedback";
      entry.buttons.forEach((button) => {
        button.disabled = false;
        button.classList.remove(
          "is-selected",
          "is-correct",
          "is-incorrect"
        );
      });
      entry.card.classList.remove("is-correct", "is-incorrect");
    });
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : "";

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-listening2-comprehension`
      : "listening2-comprehension",
    element: slide,
    onLeave,
  };
};
const normalizeContextSectionTitle = (section = {}, index) => {
  const sectionNumber = trimString(section?.section_number);
  const sectionTitle = trimString(section?.section_title);
  if (sectionNumber && sectionTitle) {
    return `${sectionNumber}. ${sectionTitle}`;
  }
  if (sectionTitle) {
    return sectionTitle;
  }
  if (sectionNumber) {
    return `Section ${sectionNumber}`;
  }
  return `Section ${index + 1}`;
};

const createTextList = (items = [], ordered = false) => {
  const entries = Array.isArray(items)
    ? items.map((item) => trimString(item)).filter(Boolean)
    : [];
  if (!entries.length) {
    return null;
  }

  const list = document.createElement(ordered ? "ol" : "ul");
  list.className = ordered
    ? "reading-context-steps"
    : "reading-context-list";

  entries.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    list.appendChild(li);
  });

  return list;
};

const buildContextSlide = (contextData = {}, context = {}) => {
  const {
    activityLabel = "Activity",
    activityNumber = null,
    activityFocus = "",
    includeFocus = false,
  } = context;

  const slide = document.createElement("section");
  slide.className = "slide slide--reading reading-context-slide";
  buildHeading(slide, activityLabel);
  ensureInstructionAnchor(slide);
  maybeInsertFocus(slide, activityFocus, includeFocus);

  const grid = document.createElement("div");
  grid.className = "dialogue-grid dialogue-grid--single-column";
  slide.appendChild(grid);

  const title = trimString(contextData?.title);
  const cover = trimString(contextData?.cover);
  if (title || cover) {
    const introCard = document.createElement("article");
    introCard.className = "dialogue-card dialogue-card--reading";

    if (title) {
      const heading = document.createElement("h3");
      heading.className = "dialogue-card__title";
      heading.textContent = title;
      introCard.appendChild(heading);
    }

    if (cover) {
      const illustration = document.createElement("div");
      illustration.className = "listening-illustration";
      const img = document.createElement("img");
      img.src = cover;
      img.alt = title ? `${title} cover` : "Reading cover";
      img.loading = "lazy";
      illustration.appendChild(img);
      introCard.appendChild(illustration);
    }

    grid.appendChild(introCard);
  }

  const sections = Array.isArray(contextData?.content)
    ? contextData.content
    : [];

  if (!sections.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Reading content will be added soon.";
    grid.appendChild(empty);
    return {
      id: activityNumber ? `activity-${activityNumber}-context` : "activity-context",
      element: slide,
    };
  }

  sections.forEach((section, index) => {
    const card = document.createElement("article");
    card.className = "dialogue-card dialogue-card--reading";

    const sectionTitle = normalizeContextSectionTitle(section, index);
    if (sectionTitle) {
      const heading = document.createElement("h3");
      heading.className = "dialogue-card__title";
      heading.textContent = sectionTitle;
      card.appendChild(heading);
    }

    const body = document.createElement("div");
    body.className = "dialogue-card__texts";

    const intro = trimString(section?.intro);
    if (intro) {
      const paragraph = document.createElement("p");
      paragraph.className = "dialogue-card__line dialogue-card__line--answer";
      paragraph.textContent = intro;
      body.appendChild(paragraph);
    }

    const itemsList = createTextList(section?.items);
    if (itemsList) {
      body.appendChild(itemsList);
    }

    const stepsList = createTextList(section?.steps, true);
    if (stepsList) {
      body.appendChild(stepsList);
    }

    const subsections = Array.isArray(section?.subsections)
      ? section.subsections
      : [];
    subsections.forEach((subsection) => {
      const subtitle = trimString(subsection?.subtitle);
      if (subtitle) {
        const subtitleEl = document.createElement("h4");
        subtitleEl.className = "reading-context-subtitle";
        subtitleEl.textContent = subtitle;
        body.appendChild(subtitleEl);
      }

      const subsectionItems = createTextList(subsection?.items);
      if (subsectionItems) {
        body.appendChild(subsectionItems);
      }
    });

    if (!body.children.length) {
      const emptyLine = document.createElement("p");
      emptyLine.className = "dialogue-card__line dialogue-card__line--answer";
      emptyLine.textContent = "Content will be added soon.";
      body.appendChild(emptyLine);
    }

    card.appendChild(body);
    grid.appendChild(card);
  });

  return {
    id: activityNumber ? `activity-${activityNumber}-context` : "activity-context",
    element: slide,
    onEnter: () => {
      slide.classList.add("is-animated");
    },
    onLeave: () => {
      slide.classList.remove("is-animated");
    },
  };
};
const normalizeJumbledText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeJumbledId = (raw, index, prefix) => {
  const normalized = normalizeJumbledText(raw);
  if (normalized.length) {
    return normalized;
  }
  return `${prefix}_${index + 1}`;
};

const shuffleTokenIds = (items = []) => {
  const clone = items.slice();
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

const tokenizeSentence = (sentence) => {
  const normalized = normalizeJumbledText(sentence).toLowerCase();
  const matches = normalized.match(/[a-z0-9']+|[.?]/g);
  return matches ? matches : [];
};

const normalizeWordList = (input) => {
  if (!Array.isArray(input)) {
    return null;
  }
  const words = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length);
  if (words.length < 2) {
    return null;
  }
  return words;
};

const normalizeJumbledSentences = (raw = []) =>
  (Array.isArray(raw) ? raw : [])
    .map((entry, index) => {
      const sentence = normalizeJumbledText(entry?.sentence || entry?.text);
      if (!sentence) {
        return null;
      }
      const providedWords = normalizeWordList(entry?.words);
      const tokens = providedWords ?? tokenizeSentence(sentence);
      if (tokens.length < 2) {
        return null;
      }
      return {
        id: normalizeJumbledId(entry?.id, index, "jumbled"),
        tokens,
        display: sentence,
      };
    })
    .filter(Boolean);

const resultMessage = (element, correct, total) => {
  if (!element) {
    return;
  }
  if (!total) {
    element.textContent = "";
    return;
  }
  element.textContent = `Score: ${correct} / ${total}`;
  element.classList.toggle("assessment-result--success", correct === total);
  element.classList.toggle("assessment-result--error", correct !== total);
};

const buildTokenElement = (tokenId, label) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "jumbled-token";
  button.draggable = true;
  button.dataset.tokenId = tokenId;
  button.dataset.tokenLabel = label;
  button.textContent = label;
  return button;
};

const ensureScrambledIds = (answerIds) => {
  const shuffled = shuffleTokenIds(answerIds);
  const identical = shuffled.every((id, index) => id === answerIds[index]);
  if (identical && shuffled.length > 1) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }
  return shuffled;
};

const createPlaceholder = (text) => {
  const placeholder = document.createElement("p");
  placeholder.className = "jumbled-placeholder";
  placeholder.textContent = text;
  return placeholder;
};

const updatePlaceholder = (container, placeholder) => {
  if (!placeholder) {
    return;
  }
  const hasTokens = container.querySelector(".jumbled-token");
  placeholder.hidden = Boolean(hasTokens);
};
const buildJumbledSlide = (
  activityData = {},
  context = {},
  assessment = {}
) => {
  const sentences = normalizeJumbledSentences(activityData?.content);
  const {
    activityLabel = "Activity",
    activityNumber = null,
    subActivitySuffix = "",
    activityFocus = "",
    includeFocus = false,
    subActivityLetter = "",
  } = context;

  const slide = document.createElement("section");
  slide.className = "slide slide--assessment slide--jumbled";

  buildHeading(slide, `${activityLabel}${subActivitySuffix}`);
  ensureInstructionAnchor(slide);
  maybeInsertFocus(slide, activityFocus, includeFocus);

  const grid = document.createElement("div");
  grid.className = "jumbled-grid";
  slide.appendChild(grid);

  const actions = document.createElement("div");
  actions.className = "assessment-actions";
  slide.appendChild(actions);

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "primary-btn";
  submitBtn.textContent = "Submit Answers";
  actions.appendChild(submitBtn);

  const resultEl = document.createElement("p");
  resultEl.className = "assessment-result";
  resultEl.setAttribute("role", "status");
  actions.appendChild(resultEl);

  const registerActivity =
    typeof assessment?.registerActivity === "function"
      ? assessment.registerActivity
      : () => {};
  const submitResult =
    typeof assessment?.submitResult === "function"
      ? assessment.submitResult
      : () => {};
  const getSavedState =
    typeof assessment?.getState === "function"
      ? assessment.getState
      : () => null;

  const savedState = getSavedState() || null;
  const savedDetail = savedState?.detail || {};
  let submissionLocked = Boolean(savedState?.submitted);
  let instructionsLocked = false;

  const questionEntries = sentences.map((question, index) => {
    const card = document.createElement("article");
    card.className = "dialogue-card jumbled-card";

    const title = document.createElement("h3");
    title.className = "dialogue-card__title";
    title.textContent = `Sentence ${index + 1}`;
    card.appendChild(title);

    const instructions = document.createElement("p");
    instructions.className = "dialogue-card__line";
    instructions.textContent = "Drag and drop the words to build the sentence.";
    card.appendChild(instructions);

    const layout = document.createElement("div");
    layout.className = "jumbled-layout";
    card.appendChild(layout);

    const targetWrapper = document.createElement("div");
    targetWrapper.className = "jumbled-zone jumbled-zone--target";
    const targetLabel = document.createElement("p");
    targetLabel.className = "jumbled-label";
    targetLabel.textContent = "Arrange here";
    targetWrapper.appendChild(targetLabel);
    const target = document.createElement("div");
    target.className = "jumbled-target";
    target.dataset.questionId = question.id;
    const targetPlaceholder = createPlaceholder("Drop words here");
    target.appendChild(targetPlaceholder);
    targetWrapper.appendChild(target);
    layout.appendChild(targetWrapper);

    const bankWrapper = document.createElement("div");
    bankWrapper.className = "jumbled-zone jumbled-zone--bank";
    const bankLabel = document.createElement("p");
    bankLabel.className = "jumbled-label";
    bankLabel.textContent = "Word bank";
    bankWrapper.appendChild(bankLabel);
    const bank = document.createElement("div");
    bank.className = "jumbled-bank";
    bankWrapper.appendChild(bank);
    layout.appendChild(bankWrapper);

    const feedback = document.createElement("p");
    feedback.className = "jumbled-feedback";
    feedback.textContent = "";
    card.appendChild(feedback);

    const tokenMap = new Map();
    const answerIds = [];

    question.tokens.forEach((tokenText, tokenIndex) => {
      const tokenId = `${question.id}_${tokenIndex}`;
      const element = buildTokenElement(tokenId, tokenText);
      tokenMap.set(tokenId, { id: tokenId, text: tokenText, element });
      answerIds.push(tokenId);
    });

    const entry = {
      question,
      card,
      target,
      bank,
      tokens: tokenMap,
      answerIds,
      feedback,
      locked: false,
      placeholder: targetPlaceholder,
      activeTokenId: null,
    };
    entry.updateInteractivity = () => {
      const disabled = instructionsLocked || entry.locked;
      entry.tokens.forEach((token) => {
        token.element.draggable = !disabled;
        token.element.classList.toggle("is-disabled", disabled);
        token.element.tabIndex = disabled ? -1 : 0;
      });
    };

    const moveToken = (token, destination, beforeNode = null) => {
      if (!token || !destination) {
        return;
      }
      if (beforeNode) {
        destination.insertBefore(token.element, beforeNode);
      } else {
        destination.appendChild(token.element);
      }
      updatePlaceholder(entry.target, entry.placeholder);
    };

    const handleDrop = (event, destination) => {
      if (entry.locked || instructionsLocked) {
        return;
      }
      event.preventDefault();
      const tokenId =
        event.dataTransfer.getData("text/plain") || entry.activeTokenId;
      const token = tokenMap.get(tokenId);
      if (!token) {
        return;
      }
      const beforeToken = event.target.closest(".jumbled-token");
      if (beforeToken && beforeToken.parentElement === destination) {
        moveToken(token, destination, beforeToken);
      } else {
        moveToken(token, destination);
      }
    };

    [target, bank].forEach((zone) => {
      zone.addEventListener("dragover", (event) => {
        if (entry.locked) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      });
      zone.addEventListener("drop", (event) => handleDrop(event, zone));
    });

    tokenMap.forEach((token) => {
      const el = token.element;
      el.addEventListener("dragstart", (event) => {
        if (entry.locked || instructionsLocked) {
          event.preventDefault();
          return;
        }
        entry.activeTokenId = token.id;
        event.dataTransfer.setData("text/plain", token.id);
        event.dataTransfer.effectAllowed = "move";
        el.classList.add("is-dragging");
      });
      el.addEventListener("dragend", () => {
        entry.activeTokenId = null;
        el.classList.remove("is-dragging");
      });
      el.addEventListener("click", () => {
        if (entry.locked || instructionsLocked) {
          return;
        }
        const parent = el.parentElement;
        if (parent === entry.target) {
          moveToken(token, entry.bank);
        } else {
          moveToken(token, entry.target);
        }
      });
    });

    const scrambled = ensureScrambledIds(answerIds);
    scrambled.forEach((tokenId) => {
      const token = tokenMap.get(tokenId);
      if (token) {
        entry.bank.appendChild(token.element);
      }
    });

    entry.updateInteractivity();
    updatePlaceholder(entry.target, entry.placeholder);
    grid.appendChild(card);
    return entry;
  });

  registerActivity({ total: questionEntries.length });

  if (!questionEntries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Sentences will be added soon.";
    grid.appendChild(empty);
    submitBtn.disabled = true;
    return [
      {
        id: activityNumber
          ? `activity-${activityNumber}${
              subActivityLetter ? `-${subActivityLetter}` : ""
            }-reading`
          : "activity-reading",
        element: slide,
      },
    ];
  }

  const evaluateEntry = (entry) => {
    const arranged = Array.from(
      entry.target.querySelectorAll(".jumbled-token")
    ).map((el) => el.dataset.tokenId);
    const isComplete = arranged.length === entry.answerIds.length;
    const isCorrect =
      isComplete &&
      arranged.every((tokenId, index) => tokenId === entry.answerIds[index]);
    entry.locked = true;
    entry.card.classList.toggle("is-correct", isCorrect);
    entry.card.classList.toggle("is-incorrect", !isCorrect);
    entry.tokens.forEach((token) => {
      token.element.draggable = false;
      token.element.classList.add("is-locked");
    });
    const sentenceText =
      typeof entry.question.display === "string"
        ? entry.question.display
        : "";
    entry.feedback.textContent = isCorrect
      ? sentenceText
        ? `Correct! Sentence: ${sentenceText}`
        : "Correct!"
      : sentenceText
      ? `Incorrect. Correct answer: ${sentenceText}`
      : "Incorrect.";
    entry.feedback.classList.toggle("jumbled-feedback--positive", isCorrect);
    entry.feedback.classList.toggle("jumbled-feedback--negative", !isCorrect);
    return { isCorrect, arranged };
  };

  const handleSubmit = () => {
    const incomplete = questionEntries.some((entry) => {
      const count = entry.target.querySelectorAll(".jumbled-token").length;
      return count !== entry.answerIds.length;
    });
    if (incomplete) {
      resultEl.textContent = "Arrange every sentence before submitting.";
      resultEl.classList.add("assessment-result--error");
      return;
    }

    let correctCount = 0;
    const detail = { assembled: {} };

    questionEntries.forEach((entry) => {
      const { isCorrect, arranged } = evaluateEntry(entry);
      if (isCorrect) {
        correctCount += 1;
      }
      detail.assembled[entry.question.id] = arranged;
    });

    submissionLocked = true;
    refreshInteractivity();
    submitBtn.textContent = "Submitted";
    submitResult({
      total: questionEntries.length,
      correct: correctCount,
      detail,
      timestamp: new Date().toISOString(),
    });
    resultMessage(resultEl, correctCount, questionEntries.length);
  };

  const applySavedState = () => {
    let correctCount = 0;
    questionEntries.forEach((entry) => {
      const arrangement = Array.isArray(
        savedDetail?.assembled?.[entry.question.id]
      )
        ? savedDetail.assembled[entry.question.id]
        : [];
      const arrangedIds = [];
      arrangement.forEach((tokenId) => {
        const token = entry.tokens.get(tokenId);
        if (token) {
          entry.target.appendChild(token.element);
          arrangedIds.push(token.id);
        }
      });
      entry.tokens.forEach((token) => {
        if (!arrangedIds.includes(token.id)) {
          entry.bank.appendChild(token.element);
        }
      });
      updatePlaceholder(entry.target, entry.placeholder);
      const { isCorrect } = evaluateEntry(entry);
      if (isCorrect) {
        correctCount += 1;
      }
    });
    submissionLocked = true;
    refreshInteractivity();
    submitBtn.textContent = "Submitted";
    resultMessage(resultEl, correctCount, questionEntries.length);
  };

  const refreshInteractivity = () => {
    questionEntries.forEach((entry) => entry.updateInteractivity?.());
    const noQuestions = !questionEntries.length;
    submitBtn.disabled =
      instructionsLocked || submissionLocked || noQuestions;
  };

  if (savedState?.submitted) {
    applySavedState();
  } else {
    submitBtn.addEventListener("click", handleSubmit);
  }

  slide.addEventListener("instructionstatechange", (event) => {
    instructionsLocked = Boolean(event.detail?.locked);
    refreshInteractivity();
  });

  refreshInteractivity();

  const slideId = activityNumber
    ? `activity-${activityNumber}${
        subActivityLetter ? `-${subActivityLetter}` : ""
      }-reading`
    : "activity-reading";
  return [
    {
      id: slideId,
      element: slide,
    },
  ];
};
const createSubActivityContext = (base, letter, includeFocus = false) => ({
  activityLabel: base.activityLabel,
  activityNumber: base.activityNumber,
  activityFocus: base.activityFocus,
  includeFocus,
  subActivitySuffix: letter ? letter : "",
  subActivityLetter: letter || "",
});

export const buildReadingOneSlides = (activityData = {}, context = {}) => {
  const { activityNumber, focus: rawFocus } = context;
  const activityLabel = activityNumber
    ? `Activity ${activityNumber}`
    : "Activity";
  const activityFocus = trimString(rawFocus);

  const baseContext = {
    activityLabel,
    activityNumber,
    activityFocus,
  };

  const comprehensionData = normalizeComprehensionData(
    activityData?.content?.activity_b
  );

  const slides = [
    buildContextSlide(activityData?.context, {
      ...baseContext,
      includeFocus: Boolean(activityFocus),
    }),
    buildMatchingSlide(
      activityData?.content?.activity_a,
      createSubActivityContext(baseContext, "a", Boolean(activityFocus))
    ),
    buildComprehensionSlide(
      comprehensionData,
      createSubActivityContext(baseContext, "b")
    ),
    ...buildJumbledSlide(
      { content: activityData?.content?.activity_c },
      createSubActivityContext(baseContext, "c")
    ),
  ];

  return slides;
};
