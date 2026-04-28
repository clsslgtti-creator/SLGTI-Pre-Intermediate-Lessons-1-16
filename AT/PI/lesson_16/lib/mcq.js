const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeId = (raw, index, prefix) => {
  const normalized = normalizeText(raw);
  if (normalized.length) {
    return normalized;
  }
  return `${prefix}_${index + 1}`;
};

const normalizeAnswer = (value) => normalizeText(value).toLowerCase();

const normalizeShuffleOptions = (value, fallback = true) =>
  typeof value === "boolean" ? value : fallback;

const shuffleArray = (items = []) => {
  const clone = items.slice();
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

const normalizeQuestions = (raw = [], activityShuffleOptions = true) =>
  (Array.isArray(raw) ? raw : [])
    .map((entry, index) => {
      const prompt = normalizeText(entry?.question);
      const answer = normalizeText(entry?.answer);
      const options = Array.isArray(entry?.options)
        ? entry.options
            .map((option) => normalizeText(option))
            .filter(Boolean)
        : [];
      if (!prompt || !answer || options.length < 2) {
        return null;
      }
      return {
        id: normalizeId(entry?.id, index, "mcq"),
        prompt,
        answer,
        answerNormalized: normalizeAnswer(answer),
        options,
        shuffleOptions: normalizeShuffleOptions(
          entry?.shuffleOptions,
          normalizeShuffleOptions(activityShuffleOptions, true)
        ),
      };
    })
    .filter(Boolean);

const createHeading = (context = {}) => {
  if (context.activityNumber) {
    return `Activity ${context.activityNumber}`;
  }
  return "Activity";
};

const getMarksPerQuestion = (context = {}) => {
  const parsed = Number(context?.marksPerQuestion);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
};

const createMarksSummaryText = (total, marksPerQuestion) => {
  if (!Number.isInteger(total) || total <= 0) {
    return "";
  }
  return `${total} x ${marksPerQuestion} = ${total * marksPerQuestion} marks`;
};

const createResultText = (correct, total, marksPerQuestion = 1) => {
  if (!Number.isInteger(total) || total <= 0) {
    return "";
  }
  return `Score: ${correct * marksPerQuestion} / ${
    total * marksPerQuestion
  } marks`;
};

const getOptionOrder = (question, savedDetail) => {
  if (!question.shuffleOptions) {
    return question.options.slice();
  }
  const savedOrder = Array.isArray(savedDetail?.[question.id])
    ? savedDetail[question.id].map((value) => normalizeText(value))
    : null;
  if (savedOrder && savedOrder.length === question.options.length) {
    const map = new Map();
    question.options.forEach((option) => {
      map.set(normalizeText(option), option);
    });
    const ordered = savedOrder
      .map((key) => map.get(key))
      .filter((value) => typeof value === "string");
    if (ordered.length === question.options.length) {
      return ordered;
    }
  }
  return shuffleArray(question.options);
};

const getQuestionOrder = (questions, savedOrder) => {
  const savedIds = Array.isArray(savedOrder) ? savedOrder : [];
  if (savedIds.length === questions.length) {
    const ordered = savedIds
      .map((id) => questions.find((question) => question.id === id))
      .filter(Boolean);
    if (ordered.length === questions.length) {
      return ordered;
    }
  }
  return shuffleArray(questions);
};

const createOptionButton = (label) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "listening-option";
  button.textContent = label;
  button.dataset.value = label;
  button.dataset.normalized = normalizeAnswer(label);
  return button;
};

const resultMessage = (
  element,
  correct,
  total,
  marksPerQuestion = 1,
  tone = "neutral"
) => {
  element.textContent = createResultText(correct, total, marksPerQuestion);
  element.classList.remove(
    "assessment-result--error",
    "assessment-result--success"
  );
  if (tone === "error") {
    element.classList.add("assessment-result--error");
  } else if (tone === "success") {
    element.classList.add("assessment-result--success");
  }
};

export const buildMcqSlides = (
  activityData = {},
  context = {},
  assessment = {}
) => {
  const questions = normalizeQuestions(
    activityData?.content,
    activityData?.shuffleOptions
  );
  const marksPerQuestion = getMarksPerQuestion(context);
  const slide = document.createElement("section");
  slide.className = "slide slide--assessment slide--mcq";

  const heading = document.createElement("h2");
  heading.textContent = createHeading(context);
  slide.appendChild(heading);

  const marksSummary = createMarksSummaryText(
    questions.length,
    marksPerQuestion
  );
  if (marksSummary) {
    const marksEl = document.createElement("p");
    marksEl.className = "assessment-marks-summary";
    marksEl.textContent = `(${marksSummary})`;
    slide.appendChild(marksEl);
  }

  const grid = document.createElement("div");
  grid.className = "listening-mcq-grid";
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

  const orderedQuestions = getQuestionOrder(
    questions,
    savedDetail.questionOrder
  );

  const questionEntries = orderedQuestions.map((question, index) => {
    const card = document.createElement("article");
    card.className = "dialogue-card dialogue-card--listening quiz-card";

    const title = document.createElement("h3");
    title.className = "dialogue-card__title";
    title.textContent = `${index + 1}.`;
    card.appendChild(title);

    const prompt = document.createElement("p");
    prompt.className = "dialogue-card__line dialogue-card__line--question";
    prompt.textContent = question.prompt;
    card.appendChild(prompt);

    const optionGroup = document.createElement("div");
    optionGroup.className = "listening-option-group";
    card.appendChild(optionGroup);

    const optionOrder = getOptionOrder(
      question,
      savedDetail?.optionOrder || {}
    );
    const buttons = optionOrder.map((optionLabel) => {
      const button = createOptionButton(optionLabel);
      optionGroup.appendChild(button);
      return button;
    });

    const entry = {
      question,
      card,
      buttons,
      selected: null,
      selectedNormalized: "",
      locked: false,
      feedback: document.createElement("p"),
    };
    entry.feedback.className = "listening-feedback";
    entry.feedback.textContent = "";
    card.appendChild(entry.feedback);

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        if (entry.locked) {
          return;
        }
        entry.selected = button.dataset.value;
        entry.selectedNormalized = button.dataset.normalized || "";
        buttons.forEach((btn) => btn.classList.remove("is-selected"));
        button.classList.add("is-selected");
      });
    });

    grid.appendChild(card);
    return entry;
  });

  registerActivity({
    total: questionEntries.length,
    marksPerQuestion,
  });

  const refreshInteractivity = () => {
    const shouldDisableButtons = instructionsLocked || submissionLocked;
    questionEntries.forEach((entry) => {
      const entryDisabled = shouldDisableButtons || entry.locked;
      entry.buttons.forEach((button) => {
        button.disabled = entryDisabled;
      });
    });
    const noQuestions = !questionEntries.length;
    submitBtn.disabled =
      instructionsLocked || submissionLocked || noQuestions;
  };

  if (!questionEntries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Questions will be available soon.";
    grid.appendChild(empty);
    submitBtn.disabled = true;
    resultMessage(resultEl, 0, 0, marksPerQuestion);
  }

  const lockEntry = (entry, isCorrect) => {
    entry.locked = true;
    entry.card.classList.toggle("is-correct", isCorrect);
    entry.card.classList.toggle("is-incorrect", !isCorrect);
    entry.buttons.forEach((button) => {
      const isAnswer =
        button.dataset.normalized === entry.question.answerNormalized;
      if (isCorrect && isAnswer) {
        button.classList.add("is-correct");
      } else if (!isCorrect && button.classList.contains("is-selected")) {
        button.classList.add("is-incorrect");
      }
      if (isAnswer) {
        button.classList.add("is-correct");
      }
    });
    refreshInteractivity();
    entry.feedback.textContent = isCorrect
      ? "Correct!"
      : `Answer: ${entry.question.answer}`;
    entry.feedback.classList.toggle(
      "listening-feedback--positive",
      isCorrect
    );
    entry.feedback.classList.toggle(
      "listening-feedback--negative",
      !isCorrect
    );
  };

  const evaluate = () => {
    if (!questionEntries.length) {
      return;
    }
    const unanswered = questionEntries.filter(
      (entry) => !entry.selectedNormalized
    );
    if (unanswered.length) {
      resultEl.textContent = "Please answer every question.";
      resultEl.classList.add("assessment-result--error");
      return;
    }

    let correctCount = 0;

    questionEntries.forEach((entry) => {
      const isCorrect =
        entry.selectedNormalized === entry.question.answerNormalized;
      if (isCorrect) {
        correctCount += 1;
      }
      lockEntry(entry, isCorrect);
    });

    submissionLocked = true;
    refreshInteractivity();
    submitBtn.textContent = "Submitted";

    const detail = {
      questionOrder: questionEntries.map((entry) => entry.question.id),
      optionOrder: questionEntries.reduce((acc, entry) => {
        acc[entry.question.id] = entry.buttons.map(
          (button) => button.dataset.value
        );
        return acc;
      }, {}),
      answers: questionEntries.reduce((acc, entry) => {
        acc[entry.question.id] = entry.selected ?? null;
        return acc;
      }, {}),
    };

    submitResult({
      total: questionEntries.length,
      correct: correctCount,
      marksPerQuestion,
      detail,
      timestamp: new Date().toISOString(),
    });

    resultMessage(
      resultEl,
      correctCount,
      questionEntries.length,
      marksPerQuestion,
      correctCount === questionEntries.length ? "success" : "neutral"
    );
  };

  const applySavedState = () => {
    if (!savedState?.submitted) {
      return;
    }
    const storedAnswers = savedDetail?.answers || {};
    let correctCount = 0;
    questionEntries.forEach((entry) => {
      const storedAnswer = storedAnswers[entry.question.id];
      if (typeof storedAnswer === "string") {
        const normalizedStored = normalizeAnswer(storedAnswer);
        entry.selected = storedAnswer;
        entry.selectedNormalized = normalizedStored;
        const buttonToSelect = entry.buttons.find(
          (button) => button.dataset.normalized === normalizedStored
        );
        if (buttonToSelect) {
          buttonToSelect.classList.add("is-selected");
        }
      }
      const isCorrect =
        entry.selectedNormalized === entry.question.answerNormalized;
      if (isCorrect) {
        correctCount += 1;
      }
      lockEntry(entry, isCorrect);
    });
    submissionLocked = true;
    refreshInteractivity();
    submitBtn.textContent = "Submitted";
    resultMessage(
      resultEl,
      correctCount,
      questionEntries.length,
      marksPerQuestion
    );
  };

  if (savedState?.submitted) {
    applySavedState();
  } else {
    submitBtn.addEventListener("click", evaluate);
  }

  slide.addEventListener("instructionstatechange", (event) => {
    instructionsLocked = Boolean(event.detail?.locked);
    refreshInteractivity();
  });

  refreshInteractivity();

  const slideId = context.key ? `${context.key}-mcq` : "assessment-mcq";

  return [
    {
      id: slideId,
      element: slide,
    },
  ];
};
