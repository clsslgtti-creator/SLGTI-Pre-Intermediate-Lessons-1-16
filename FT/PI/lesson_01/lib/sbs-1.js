import { audioManager, computeSegmentGapMs, getBetweenItemGapMs } from './audio-manager.js';
import { showCompletionModal } from './completion-modal.js';

const smoothScrollIntoView = (element) => {
  if (!element) {
    return;
  }
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const renderEmphasizedText = (element, text) => {
  const normalized = typeof text === 'string' ? text : '';
  const fragment = document.createDocumentFragment();
  const pattern = /'([^']+)'/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    const leading = normalized.slice(lastIndex, match.index);
    if (leading) {
      fragment.appendChild(document.createTextNode(leading));
    }

    const emphasis = document.createElement('span');
    emphasis.className = 'dialogue-text__emphasis';
    emphasis.textContent = match[1];
    fragment.appendChild(emphasis);

    lastIndex = pattern.lastIndex;
  }

  const trailing = normalized.slice(lastIndex);
  if (trailing) {
    fragment.appendChild(document.createTextNode(trailing));
  }

  element.appendChild(fragment);
};

const createDialogueCard = (dialogue, options = {}) => {
  const { showTexts = true, showAnswer = true, classes = [] } = options;
  const wrapper = document.createElement('article');
  wrapper.className = ['dialogue-card', ...classes].join(' ');
  wrapper.dataset.dialogueId = dialogue.id;

  if (dialogue.img) {
    const img = document.createElement('img');
    img.src = dialogue.img;
    img.alt = dialogue.text_a ? `Illustration: ${dialogue.text_a}` : 'Dialogue illustration';
    img.loading = 'lazy';
    img.className = 'dialogue-card__image';
    wrapper.appendChild(img);
  }

  if (showTexts && (dialogue.text_a || dialogue.text_b)) {
    const texts = document.createElement('div');
    texts.className = 'dialogue-card__texts';

    if (dialogue.text_a) {
      const question = document.createElement('p');
      question.className = 'dialogue-card__line dialogue-card__line--question';
      renderEmphasizedText(question, dialogue.text_a);
      texts.appendChild(question);
    }

    if (dialogue.text_b) {
      const answer = document.createElement('p');
      answer.className = 'dialogue-card__line dialogue-card__line--answer';
      renderEmphasizedText(answer, dialogue.text_b);
      if (!showAnswer) {
        answer.classList.add('is-hidden');
      }
      texts.appendChild(answer);
    }

    wrapper.appendChild(texts);
  }

  return wrapper;
};

const createDialogueSegments = (dialogue, card) => {
  if (!card) {
    return [];
  }

  const questionEl = card.querySelector('.dialogue-card__line--question');
  const answerEl = card.querySelector('.dialogue-card__line--answer');

  return [
    dialogue.audio_a ? { url: dialogue.audio_a, element: questionEl } : null,
    dialogue.audio_b ? { url: dialogue.audio_b, element: answerEl } : null,
  ].filter(Boolean);
};

const createDialogueTables = (tablesData = []) => {
  if (!Array.isArray(tablesData) || tablesData.length === 0) {
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'dialogue-table-group';

  tablesData.forEach((tableData) => {
    if (!Array.isArray(tableData) || tableData.length === 0) {
      return;
    }

    const table = document.createElement('table');
    table.className = 'dialogue-table';
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    const columnSpans = [];

    tableData.forEach((rowData) => {
      if (!Array.isArray(rowData) || rowData.length === 0) {
        return;
      }

      const row = document.createElement('tr');
      let hasCell = false;

      rowData.forEach((cellValue, columnIndex) => {
        if (cellValue === null || cellValue === undefined) {
          const spanTracker = columnSpans[columnIndex];
          if (spanTracker && spanTracker.cell) {
            spanTracker.rowSpan += 1;
            spanTracker.cell.rowSpan = spanTracker.rowSpan;
          }
          return;
        }

        const cell = document.createElement('td');
        cell.textContent = `${cellValue}`;
        columnSpans[columnIndex] = { cell, rowSpan: 1 };
        row.appendChild(cell);
        hasCell = true;
      });

      if (hasCell) {
        tbody.appendChild(row);
      }
    });

    if (tbody.children.length > 0) {
      wrapper.appendChild(table);
    }
  });

  if (!wrapper.children.length) {
    return null;
  }

  return wrapper;
};

const clearSegmentHighlights = (segments = []) => {
  segments.forEach(({ element }) => {
    element?.classList.remove('is-playing');
  });
};

const normalizeKeyword = (value) => {
  return typeof value === "string" && value.trim().length
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
    : "";
};

const maybeInsertFocus = (slide, focusText, includeFocus) => {
  if (!includeFocus) {
    return;
  }

  const trimmed = typeof focusText === 'string' ? focusText.trim() : '';
  if (!trimmed) {
    return;
  }

  const focusEl = document.createElement('p');
  focusEl.className = 'activity-focus';
  focusEl.append(`${trimmed}`);

  const heading = slide.querySelector('h2');
  heading?.insertAdjacentElement('afterend', focusEl);
};

const buildModelDialogueSlide = (
  exampleDialogues,
  {
    activityLabel = 'Activity',
    activityNumber = null,
    activityFocus = '',
    includeFocus = false,
    tables = [],
  } = {},
) => {
  const slide = document.createElement('section');
  slide.className = 'slide slide--model';
  slide.innerHTML = `
    <h2>${activityLabel}</h2>
    <p class="slide__instruction">Listen to the model dialogue. Each line plays automatically in sequence.</p>
  `;

  maybeInsertFocus(slide, activityFocus, includeFocus);

  const controls = document.createElement('div');
  controls.className = 'slide__controls';
  const playBtn = document.createElement('button');
  playBtn.className = 'primary-btn';
  playBtn.textContent = 'Start';
  const status = document.createElement('p');
  status.className = 'playback-status';
  controls.append(playBtn, status);
  slide.appendChild(controls);

  const tablesContainer = createDialogueTables(tables);
  if (tablesContainer) {
    slide.appendChild(tablesContainer);
  }

  const content = document.createElement('div');
  content.className = 'dialogue-grid dialogue-grid--model';
  slide.appendChild(content);

  const dialogueCards = exampleDialogues.map((dialogue, index) => {
    const card = createDialogueCard(dialogue, {
      showTexts: Boolean(dialogue.text_a || dialogue.text_b),
      classes: ['dialogue-card--model'],
    });
    content.appendChild(card);
    return {
      card,
      segments: createDialogueSegments(dialogue, card),
    };
  });

  let sequenceAbort = null;
  let autoTriggered = false;
  let pauseRequested = false;

  const playbackState = {
    mode: 'idle',
    itemIndex: 0,
    segmentIndex: 0,
  };

  const updateButtonLabel = () => {
    if (playbackState.mode === 'playing') {
      playBtn.textContent = 'Pause';
      return;
    }
    if (playbackState.mode === 'paused') {
      playBtn.textContent = 'Resume';
      return;
    }
    playBtn.textContent = 'Start';
  };

  const setPlaybackMode = (mode, { itemIndex, segmentIndex } = {}) => {
    playbackState.mode = mode;
    if (Number.isInteger(itemIndex)) {
      playbackState.itemIndex = Math.max(0, itemIndex);
    }
    if (Number.isInteger(segmentIndex)) {
      playbackState.segmentIndex = Math.max(0, segmentIndex);
    }
    updateButtonLabel();
  };

  const resetCards = () => {
    dialogueCards.forEach(({ card, segments }) => {
      card.classList.remove('is-active');
      clearSegmentHighlights(segments);
    });
  };

  const resetState = ({ clearStatus = true } = {}) => {
    autoTriggered = false;
    slide._autoTriggered = false;
    pauseRequested = false;
    setPlaybackMode('idle', { itemIndex: 0, segmentIndex: 0 });
    resetCards();
    if (clearStatus) {
      status.textContent = '';
    }
  };

  updateButtonLabel();

  const runSequence = async ({ itemIndex = 0, segmentIndex = 0 } = {}) => {
    if (!dialogueCards.length) {
      status.textContent = 'No audio available.';
      resetState({ clearStatus: false });
      return;
    }

    pauseRequested = false;
    sequenceAbort?.abort();
    sequenceAbort = new AbortController();
    const { signal } = sequenceAbort;

    setPlaybackMode('playing', { itemIndex, segmentIndex });
    slide._autoTriggered = true;
    autoTriggered = true;
    status.textContent = itemIndex === 0 && segmentIndex === 0
      ? 'Starting...'
      : 'Resuming...';

    let completed = false;

    try {
      for (let i = itemIndex; i < dialogueCards.length; i += 1) {
        playbackState.itemIndex = i;
        const item = dialogueCards[i];
        item.card.classList.add('is-active');
        smoothScrollIntoView(item.card);

        const startingSegment = i === itemIndex ? segmentIndex : 0;
        for (let segIndex = startingSegment; segIndex < item.segments.length; segIndex += 1) {
          playbackState.segmentIndex = segIndex;
          const { url, element } = item.segments[segIndex];
          if (!url) {
            continue;
          }

          status.textContent = 'Playing...';
          element?.classList.add('is-playing');
          try {
            await audioManager.play(url, { signal });
          } catch (error) {
            if (!signal.aborted) {
              console.error(error);
              status.textContent = 'Unable to play audio.';
            }
          }
          element?.classList.remove('is-playing');

          if (signal.aborted) {
            break;
          }

          playbackState.segmentIndex = segIndex + 1;
        }

        item.card.classList.remove('is-active');
        clearSegmentHighlights(item.segments);

        if (signal.aborted) {
          break;
        }

        playbackState.segmentIndex = 0;
        playbackState.itemIndex = i + 1;
      }

      if (!sequenceAbort?.signal?.aborted) {
        completed = true;
      }
    } finally {
      const aborted = sequenceAbort?.signal?.aborted ?? false;
      sequenceAbort = null;

      if (aborted && pauseRequested) {
        autoTriggered = false;
        slide._autoTriggered = false;
        setPlaybackMode('paused', {
          itemIndex: playbackState.itemIndex,
          segmentIndex: playbackState.segmentIndex,
        });
        status.textContent = 'Paused.';
      } else {
        const finalStatus = completed ? 'Playback complete.' : 'Playback stopped.';
        resetState({ clearStatus: false });
        status.textContent = finalStatus;
      }

      pauseRequested = false;
    }
  };

  const triggerAutoPlay = () => {
    if (
      autoTriggered ||
      playbackState.mode === 'playing' ||
      playbackState.mode === 'paused'
    ) {
      return;
    }
    runSequence({ itemIndex: 0, segmentIndex: 0 });
  };

  playBtn.addEventListener('click', () => {
    if (playbackState.mode === 'playing') {
      pauseRequested = true;
      sequenceAbort?.abort();
      return;
    }

    if (playbackState.mode === 'paused') {
      runSequence({
        itemIndex: playbackState.itemIndex,
        segmentIndex: playbackState.segmentIndex,
      });
      return;
    }

    runSequence({ itemIndex: 0, segmentIndex: 0 });
  });

  const autoPlay = {
    button: playBtn,
    trigger: triggerAutoPlay,
    status,
  };

  return {
    id: activityNumber ? `activity-${activityNumber}-model` : 'activity-model',
    element: slide,
    autoPlay,
    onLeave: () => {
      sequenceAbort?.abort();
      sequenceAbort = null;
      audioManager.stopAll();
      resetState();
      slide._instructionComplete = false;
    },
  };
};

const buildPreListeningSlide = (
  dialogues,
  {
    activityLabel = 'Activity',
    subActivitySuffix = '',
    subActivityLetter = '',
    activityNumber = null,
    activityFocus = '',
    includeFocus = false,
  } = {},
) => {
  const usableDialogues = (Array.isArray(dialogues) ? dialogues : [])
    .map((dialogue, index) => {
      const keyword = typeof dialogue.keyword === 'string' ? dialogue.keyword.trim() : '';
      const normalizedKeyword = normalizeKeyword(keyword);
      return {
        index,
        dialogue,
        keyword,
        normalizedKeyword,
      };
    })
    .filter((item) => item.keyword && item.normalizedKeyword && item.dialogue.img);

  const slide = document.createElement('section');
  slide.className = 'slide slide--pre-listening';
  slide.innerHTML = `
    <h2>${activityLabel}${subActivitySuffix}</h2>
    <p class="slide__instruction">Match each picture with the correct place.</p>
  `;

  maybeInsertFocus(slide, activityFocus, includeFocus);

  const layout = document.createElement('div');
  layout.className = 'pre-listening-layout';
  slide.appendChild(layout);

  const gallery = document.createElement('div');
  gallery.className = 'pre-listening-gallery';
  layout.appendChild(gallery);

  const dropzonesWrapper = document.createElement('div');
  dropzonesWrapper.className = 'pre-listening-dropzones';
  layout.appendChild(dropzonesWrapper);

  const keywordSet = new Set();

  const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const shuffledDialogues = shuffle([...usableDialogues]);
  const cardItems = [];

  shuffledDialogues.forEach((item) => {
    const { dialogue, keyword, normalizedKeyword } = item;

    if (keywordSet.has(normalizedKeyword)) {
      return;
    }
    keywordSet.add(normalizedKeyword);

    const card = document.createElement('div');
    card.className = 'pre-listening-card';
    card.dataset.keyword = normalizedKeyword;

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'pre-listening-card__media';
    const img = document.createElement('img');
    img.src = dialogue.img;
    img.alt = keyword ? `Location: ${keyword}` : `Pre-Listening image`;
    img.loading = 'lazy';
    imgWrapper.appendChild(img);
    card.appendChild(imgWrapper);

    const caption = document.createElement('span');
    caption.className = 'pre-listening-card__caption';
    caption.textContent = '';
    card.appendChild(caption);
    card.dataset.label = keyword;

    gallery.appendChild(card);
    cardItems.push({ keyword, normalizedKeyword });
  });

  const dropzoneItems = shuffle([...cardItems]);

  dropzoneItems.forEach(({ keyword, normalizedKeyword }) => {
    const dropzone = document.createElement('div');
    dropzone.className = 'pre-listening-dropzone';
    dropzone.dataset.keyword = normalizedKeyword;

    const label = document.createElement('span');
    label.className = 'pre-listening-dropzone__label';
    label.textContent = keyword;
    dropzone.appendChild(label);

    const body = document.createElement('div');
    body.className = 'pre-listening-dropzone__body';
    dropzone.appendChild(body);

    dropzonesWrapper.appendChild(dropzone);
  });

  const cards = Array.from(gallery.querySelectorAll('.pre-listening-card'));
  const dropzones = Array.from(dropzonesWrapper.querySelectorAll('.pre-listening-dropzone'));

  if (!cards.length || !dropzones.length) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Pre-Listening activity will appear here once content is available.';
    layout.appendChild(emptyState);

    const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : '';

    return {
      id: activityNumber ? `activity-${activityNumber}${suffixSegment}-pre-listening` : 'activity-pre-listening',
      element: slide,
      onEnter: () => {},
      onLeave: () => {},
    };
  }

  const resetPreListening = () => {
    const $ = window.jQuery;
    if (!$) {
      return;
    }

    cards.forEach((card) => {
      const $card = $(card);
      $card.removeClass('is-correct is-incorrect is-active');
      $card.css({ top: '', left: '', position: 'relative' });
      $card.find('.pre-listening-card__caption').text('').removeClass('is-visible');
      gallery.appendChild(card);
      if ($card.data('uiDraggable')) {
        $card.draggable('enable');
        $card.draggable('option', 'revert', 'invalid');
      }
    });

    dropzones.forEach((zone) => {
      const $zone = $(zone);
      $zone.removeClass('is-correct is-incorrect is-hover');
      $zone.find('.pre-listening-dropzone__label').removeClass('is-hidden');
      $zone.find('.pre-listening-dropzone__body').empty();
      $zone.data('complete', false);
      if ($zone.data('uiDroppable')) {
        $zone.droppable('enable');
      }
    });
  };

  let initialized = false;

  const setupInteractions = () => {
    const $ = window.jQuery;
    if (!$ || !$.fn?.draggable || !$.fn?.droppable) {
      console.warn('jQuery UI is required for the Pre-Listening activity.');
      return;
    }

    const $cards = $(cards);
    const $dropzones = $(dropzones);

    $cards.draggable({
      revert: 'invalid',
      containment: slide,
      zIndex: 100,
      start(_, ui) {
        $(this).removeClass('is-incorrect');
        $(this).addClass('is-active');
      },
      stop() {
        $(this).removeClass('is-active');
      },
    });

    $dropzones.droppable({
      accept: '.pre-listening-card',
      tolerance: 'intersect',
      over() {
        $(this).addClass('is-hover');
      },
      out() {
        $(this).removeClass('is-hover');
      },
      drop(event, ui) {
        const $zone = $(this);
        const $card = ui.draggable;
        const expected = $zone.data('keyword');
        const actual = $card.data('keyword');

        $zone.removeClass('is-hover');

        if ($zone.data('complete')) {
          $card.draggable('option', 'revert', true);
          window.setTimeout(() => $card.draggable('option', 'revert', 'invalid'), 0);
          return;
        }

        if (expected === actual) {
          $zone.data('complete', true);
          $zone.addClass('is-correct');
          $zone.find('.pre-listening-dropzone__label').addClass('is-hidden');

          $card.addClass('is-correct');
          $card.draggable('disable');
          $card.removeClass('is-active');
          $card.css({ top: '', left: '', position: 'relative' });
          $card.appendTo($zone.find('.pre-listening-dropzone__body'));
          const baseLabel = $card.data('label');
          if (baseLabel) {
            $card.find('.pre-listening-card__caption').text(baseLabel).addClass('is-visible');
          }

          $zone.droppable('disable');

          const allComplete = dropzones.every((zone) => $(zone).data('complete'));
          if (allComplete) {
            showCompletionModal({
              title: 'Great Work!',
              message: 'You matched all of the pictures correctly.',
            });
          }
        } else {
          $card.addClass('is-incorrect');
          $zone.addClass('is-incorrect');
          $card.draggable('option', 'revert', true);
          window.setTimeout(() => {
            $card.draggable('option', 'revert', 'invalid');
            $card.removeClass('is-incorrect');
            $zone.removeClass('is-incorrect');
          }, 600);
        }
      },
    });

    initialized = true;
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : '';

  return {
    id: activityNumber ? `activity-${activityNumber}${suffixSegment}-pre-listening` : 'activity-pre-listening',
    element: slide,
    onEnter: () => {
      if (!initialized) {
        setupInteractions();
      }
    },
    onLeave: () => {
      resetPreListening();
    },
  };
};

const buildListeningSlide = (
  dialogues,
  {
    activityLabel = 'Activity',
    subActivitySuffix = '',
    subActivityLetter = '',
    activityNumber = null,
    activityFocus = '',
    includeFocus = false,
  } = {},
) => {
  const slide = document.createElement('section');
  slide.className = 'slide slide--listening';
  slide.innerHTML = `
    <h2>${activityLabel}${subActivitySuffix}</h2>
    <p class="slide__instruction">Listen to each dialogue from the lesson. They will play one after another.</p>
  `;

  maybeInsertFocus(slide, activityFocus, includeFocus);

  const controls = document.createElement('div');
  controls.className = 'slide__controls';
  const playBtn = document.createElement('button');
  playBtn.className = 'primary-btn';
  playBtn.textContent = 'Start';
  const status = document.createElement('p');
  status.className = 'playback-status';
  controls.append(playBtn, status);
  slide.appendChild(controls);

  const list = document.createElement('div');
  list.className = 'dialogue-grid dialogue-grid--listening';
  slide.appendChild(list);

  const items = dialogues.map((dialogue, index) => {
    const card = createDialogueCard(dialogue, { classes: ['dialogue-card--listening'] });
    const heading = document.createElement('h3');
    heading.className = 'dialogue-card__title';
    heading.textContent = `Dialogue ${index + 1}`;
    card.prepend(heading);
    list.appendChild(card);
    return {
      card,
      segments: createDialogueSegments(dialogue, card),
    };
  });

  let sequenceAbort = null;
  let autoTriggered = false;

  const delay = (ms, { signal } = {}) =>
    new Promise((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      const timeoutId = window.setTimeout(() => {
        cleanup();
        resolve();
      }, Math.max(0, ms));

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const onAbort = () => {
        cleanup();
        resolve();
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });

  const runSequence = async () => {
    if (!items.length) {
      status.textContent = 'No audio available.';
      return;
    }

    sequenceAbort?.abort();
    sequenceAbort = new AbortController();
    const { signal } = sequenceAbort;
    playBtn.disabled = true;
    status.textContent = 'Playing...';

    try {
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        item.card.classList.add('is-active');
        smoothScrollIntoView(item.card);
        const { segments } = item;

        for (let segIndex = 0; segIndex < segments.length; segIndex += 1) {
          const { url, element } = segments[segIndex];
          if (!url) {
            continue;
          }

          status.textContent = 'Playing...';
          element?.classList.add('is-playing');
          try {
            await audioManager.play(url, { signal });
          } finally {
            element?.classList.remove('is-playing');
          }

          if (signal.aborted) {
            break;
          }

          const duration = await audioManager.getDuration(url);
          const gapMs = computeSegmentGapMs('listen', duration);
          const hasMoreSegments = segIndex < segments.length - 1;
          const hasMoreItems = itemIndex < items.length - 1;

          if ((hasMoreSegments || hasMoreItems) && gapMs > 0) {
            status.textContent = 'Next up...';
            await delay(gapMs, { signal });
            if (signal.aborted) {
              break;
            }
          }
        }
        clearSegmentHighlights(item.segments);
        item.card.classList.remove('is-active');
        if (signal.aborted) {
          break;
        }
      }

      if (!signal.aborted) {
        status.textContent = 'Playback complete.';
      } else {
        status.textContent = 'Playback stopped.';
      }
    } catch (error) {
      status.textContent = 'Unable to play audio.';
      console.error(error);
    } finally {
      sequenceAbort = null;
      playBtn.disabled = false;
    }
  };

  const startSequence = () => {
    autoTriggered = true;
    slide._autoTriggered = true;
    runSequence();
  };

  const triggerAutoPlay = () => {
    if (autoTriggered) {
      return;
    }
    startSequence();
  };

  playBtn.addEventListener('click', startSequence);

  const autoPlay = {
    button: playBtn,
    trigger: triggerAutoPlay,
    status,
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : '';

  return {
    id: activityNumber ? `activity-${activityNumber}${suffixSegment}-listening` : 'activity-listening',
    element: slide,
    autoPlay,
    onLeave: () => {
      sequenceAbort?.abort();
      sequenceAbort = null;
      audioManager.stopAll();
      items.forEach((item) => {
        item.card.classList.remove('is-active');
        clearSegmentHighlights(item.segments);
      });
      status.textContent = '';
      playBtn.disabled = false;
      slide._autoTriggered = false;
      slide._instructionComplete = false;
      autoTriggered = false;
    },
  };
};

const buildListenAndRepeatSlide = (
  dialogues,
  {
    activityLabel = 'Activity',
    subActivitySuffix = '',
    subActivityLetter = '',
    activityNumber = null,
    repeatPauseMs = 1500,
  } = {},
) => {
  const slide = document.createElement('section');
  slide.className = 'slide slide--listen-repeat';
  slide.innerHTML = `
    <h2>${activityLabel}${subActivitySuffix}</h2>
    <p class="slide__instruction">Listen to each sentence and use the pause to repeat it aloud.</p>
  `;

  const controls = document.createElement('div');
  controls.className = 'slide__controls';
  const startBtn = document.createElement('button');
  startBtn.className = 'primary-btn';
  startBtn.textContent = 'Start';
  const status = document.createElement('p');
  status.className = 'playback-status';
  controls.append(startBtn, status);
  slide.appendChild(controls);

  const list = document.createElement('div');
  list.className = 'dialogue-grid dialogue-grid--listen-repeat';
  slide.appendChild(list);

  const items = dialogues.map((dialogue, index) => {
    const card = createDialogueCard(dialogue, { classes: ['dialogue-card--listen-repeat'] });
    const heading = document.createElement('h3');
    heading.className = 'dialogue-card__title';
    heading.textContent = `Dialogue ${index + 1}`;
    card.prepend(heading);
    list.appendChild(card);
    return {
      card,
      segments: createDialogueSegments(dialogue, card),
    };
  });

  let sequenceAbort = null;
  let autoTriggered = false;
  const basePauseMs = Number.isFinite(repeatPauseMs) ? Math.max(500, repeatPauseMs) : 1500;

  const delay = (ms, { signal } = {}) =>
    new Promise((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      const timeoutId = window.setTimeout(() => {
        cleanup();
        resolve();
      }, Math.max(0, ms));

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const onAbort = () => {
        cleanup();
        resolve();
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });

  const resetCards = () => {
    items.forEach(({ card, segments }) => {
      card.classList.remove('is-active');
      clearSegmentHighlights(segments);
    });
  };

  const runSequence = async () => {
    if (!items.length) {
      status.textContent = 'No dialogues available.';
      return;
    }

    sequenceAbort?.abort();
    sequenceAbort = new AbortController();
    const { signal } = sequenceAbort;

    resetCards();
    startBtn.disabled = true;
    status.textContent = 'Playing...';

    try {
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        item.card.classList.add('is-active');
        smoothScrollIntoView(item.card);

        const { segments } = item;

        for (let segIndex = 0; segIndex < segments.length; segIndex += 1) {
          const { url, element } = segments[segIndex];
          if (!url) {
            continue;
          }

          status.textContent = 'Playing...';
          element?.classList.add('is-playing');
          try {
            await audioManager.play(url, { signal });
          } finally {
            element?.classList.remove('is-playing');
          }

          if (signal.aborted) {
            break;
          }

          const duration = await audioManager.getDuration(url);
          const pauseMs = computeSegmentGapMs('listen-repeat', duration, {
            repeatPauseMs: basePauseMs,
          });
          if (pauseMs > 0) {
            status.textContent = 'Your turn...';
            await delay(pauseMs, { signal });
            if (signal.aborted) {
              break;
            }
          }

          const hasMoreSegments = segIndex < segments.length - 1;
          const hasMoreItems = itemIndex < items.length - 1;
          if ((hasMoreSegments || hasMoreItems) && !signal.aborted) {
            status.textContent = 'Next up...';
          }
        }

        item.card.classList.remove('is-active');
        clearSegmentHighlights(item.segments);

        if (signal.aborted) {
          break;
        }
      }

      status.textContent = signal.aborted
        ? 'Playback stopped.'
        : 'Great work! Listen & repeat complete.';
    } catch (error) {
      status.textContent = 'Unable to play audio.';
      console.error(error);
    } finally {
      startBtn.disabled = false;
      sequenceAbort = null;
    }
  };

  const startSequence = () => {
    autoTriggered = true;
    slide._autoTriggered = true;
    runSequence();
  };

  const triggerAutoPlay = () => {
    if (autoTriggered) {
      return;
    }
    startSequence();
  };

  startBtn.addEventListener('click', startSequence);

  const autoPlay = {
    button: startBtn,
    trigger: triggerAutoPlay,
    status,
  };

  const onLeave = () => {
    sequenceAbort?.abort();
    sequenceAbort = null;
    audioManager.stopAll();
    resetCards();
    startBtn.disabled = false;
    status.textContent = '';
    autoTriggered = false;
    slide._autoTriggered = false;
    slide._instructionComplete = false;
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : '';

  return {
    id: activityNumber
      ? `activity-${activityNumber}${suffixSegment}-listen-repeat`
      : 'activity-listen-repeat',
    element: slide,
    autoPlay,
    onLeave,
  };
};

const buildReadingSlide = (
  dialogues,
  {
    activityLabel = 'Activity',
    subActivitySuffix = '',
    subActivityLetter = '',
    activityNumber = null,
    activityFocus = '',
    includeFocus = false,
  } = {},
) => {
  const slide = document.createElement('section');
  slide.className = 'slide slide--reading';
  slide.innerHTML = `
    <h2>${activityLabel}${subActivitySuffix}</h2>
    <p class="slide__instruction">Read along with the audio. Each dialogue plays automatically.</p>
  `;

  maybeInsertFocus(slide, activityFocus, includeFocus);

  const controls = document.createElement('div');
  controls.className = 'slide__controls';
  const playBtn = document.createElement('button');
  playBtn.className = 'primary-btn';
  playBtn.textContent = 'Start';
  const status = document.createElement('p');
  status.className = 'playback-status';
  controls.append(playBtn, status);
  slide.appendChild(controls);

  const grid = document.createElement('div');
  grid.className = 'dialogue-grid';
  slide.appendChild(grid);

  const items = dialogues.map((dialogue, index) => {
    const card = createDialogueCard(dialogue, { classes: ['dialogue-card--reading'] });
    const heading = document.createElement('h3');
    heading.className = 'dialogue-card__title';
    heading.textContent = `Dialogue ${index + 1}`;
    card.prepend(heading);
    grid.appendChild(card);
    return {
      card,
      segments: createDialogueSegments(dialogue, card),
    };
  });

  let sequenceAbort = null;
  let autoTriggered = false;

  const delay = (ms, { signal } = {}) =>
    new Promise((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      const timeoutId = window.setTimeout(() => {
        cleanup();
        resolve();
      }, Math.max(0, ms));

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const onAbort = () => {
        cleanup();
        resolve();
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });

  const runSequence = async () => {
    if (!items.length) {
      status.textContent = 'No audio available.';
      return;
    }

    sequenceAbort?.abort();
    sequenceAbort = new AbortController();
    const { signal } = sequenceAbort;

    playBtn.disabled = true;
    status.textContent = 'Playing...';

    try {
      for (const item of items) {
        item.card.classList.add('is-active');
        smoothScrollIntoView(item.card);

        for (const segment of item.segments) {
          const { url, element } = segment;
          if (!url) {
            continue;
          }

          element?.classList.add('is-playing');
          try {
            await audioManager.play(url, { signal });
          } finally {
            element?.classList.remove('is-playing');
          }

          if (signal.aborted) {
            break;
          }

          const duration = await audioManager.getDuration(url);
          const pauseMs = computeSegmentGapMs('read', duration);
          await delay(pauseMs, { signal });
          if (signal.aborted) {
            break;
          }
        }

        if (signal.aborted) {
          item.card.classList.remove('is-active');
          clearSegmentHighlights(item.segments);
          break;
        }

        await delay(getBetweenItemGapMs('read'), { signal });
        if (signal.aborted) {
          item.card.classList.remove('is-active');
          clearSegmentHighlights(item.segments);
          break;
        }

        item.card.classList.remove('is-active');
        clearSegmentHighlights(item.segments);

        if (signal.aborted) {
          break;
        }
      }

      status.textContent = signal.aborted ? 'Playback stopped.' : 'Great work! Reading complete.';
    } catch (error) {
      status.textContent = 'Unable to play audio.';
      console.error(error);
    } finally {
      playBtn.disabled = false;
      sequenceAbort = null;
    }
  };

  const startSequence = () => {
    autoTriggered = true;
    slide._autoTriggered = true;
    runSequence();
  };

  const triggerAutoPlay = () => {
    if (autoTriggered) {
      return;
    }
    startSequence();
  };

  playBtn.addEventListener('click', startSequence);

  const autoPlay = {
    button: playBtn,
    trigger: triggerAutoPlay,
    status,
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : '';

  return {
    id: activityNumber ? `activity-${activityNumber}${suffixSegment}-reading` : 'activity-reading',
    element: slide,
    autoPlay,
    onEnter: () => {
      slide.classList.add('is-animated');
    },
    onLeave: () => {
      sequenceAbort?.abort();
      sequenceAbort = null;
      audioManager.stopAll();
      slide.classList.remove('is-animated');
      items.forEach(({ card, segments }) => {
        card.classList.remove('is-active');
        clearSegmentHighlights(segments);
      });
      playBtn.disabled = false;
      status.textContent = '';
      autoTriggered = false;
      slide._autoTriggered = false;
      slide._instructionComplete = false;
    },
  };
};

const buildSpeakingSlide = (
  dialogues,
  {
    activityLabel = 'Activity',
    subActivitySuffix = '',
    subActivityLetter = '',
    activityNumber = null,
    activityFocus = '',
    includeFocus = false,
  } = {},
) => {
  const slide = document.createElement('section');
  slide.className = 'slide slide--speaking';
  slide.innerHTML = `
    <h2>${activityLabel}${subActivitySuffix}</h2>
    <p class="slide__instruction">Listen to each question, use the pause to answer, then compare your response with the model answer.</p>
  `;

  maybeInsertFocus(slide, activityFocus, includeFocus);

  const controls = document.createElement('div');
  controls.className = 'slide__controls';
  const startBtn = document.createElement('button');
  startBtn.className = 'primary-btn';
  startBtn.textContent = 'Start';
  const status = document.createElement('p');
  status.className = 'playback-status';
  controls.append(startBtn, status);
  slide.appendChild(controls);

  const cardsWrapper = document.createElement('div');
  cardsWrapper.className = 'dialogue-grid dialogue-grid--speaking';
  slide.appendChild(cardsWrapper);

  const cards = dialogues.map((dialogue, index) => {
    const card = createDialogueCard(dialogue, {
      classes: ['dialogue-card--speaking'],
      showAnswer: false,
    });
    const heading = document.createElement('h3');
    heading.className = 'dialogue-card__title';
    heading.textContent = `Dialogue ${index + 1}`;
    card.prepend(heading);

    const prompt = document.createElement('p');
    prompt.className = 'dialogue-card__prompt';
    prompt.textContent = 'Your turn to answer...';
    card.appendChild(prompt);

    cardsWrapper.appendChild(card);

    const questionEl = card.querySelector('.dialogue-card__line--question');
    const answerEl = card.querySelector('.dialogue-card__line--answer');
    const segments = createDialogueSegments(dialogue, card);

    return {
      dialogue,
      card,
      questionEl,
      answerEl,
      prompt,
      segments,
    };
  });

  let sequenceAbort = null;
  let autoTriggered = false;

  const delay = (ms, { signal } = {}) =>
    new Promise((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      const timeoutId = window.setTimeout(() => {
        cleanup();
        resolve();
      }, Math.max(0, ms));

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const onAbort = () => {
        cleanup();
        resolve();
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });

  const resetCards = () => {
    cards.forEach(({ card, answerEl, segments }) => {
      card.classList.remove('is-active', 'show-answer');
      if (answerEl) {
        answerEl.classList.add('is-hidden');
      }
      clearSegmentHighlights(segments);
    });
  };

  const runSpeakingPractice = async () => {
    if (!cards.length) {
      status.textContent = 'No dialogues available.';
      return;
    }

    sequenceAbort?.abort();
    sequenceAbort = new AbortController();
    const { signal } = sequenceAbort;

    resetCards();
    startBtn.disabled = true;
    status.textContent = 'Playing...';

    try {
      for (let index = 0; index < cards.length; index += 1) {
        const item = cards[index];
        const { dialogue, card, answerEl, questionEl, segments } = item;
        card.classList.add('is-active');
        smoothScrollIntoView(card);
        if (answerEl) {
          answerEl.classList.add('is-hidden');
        }

        if (questionEl) {
          questionEl.classList.add('is-playing');
        }
        try {
          await audioManager.play(dialogue.audio_a, { signal });
        } finally {
          questionEl?.classList.remove('is-playing');
        }
        if (signal.aborted) {
          clearSegmentHighlights(segments);
          break;
        }

        const answerDuration = await audioManager.getDuration(dialogue.audio_b);
        const waitMs = Math.max(1000, Math.round(answerDuration * 1500));
        status.textContent = 'Your turn...';
        await delay(waitMs, { signal });
        if (signal.aborted) {
          clearSegmentHighlights(segments);
          break;
        }

        if (answerEl) {
          answerEl.classList.remove('is-hidden');
          card.classList.add('show-answer');
        }

        if (answerEl) {
          answerEl.classList.add('is-playing');
        }
        try {
          await audioManager.play(dialogue.audio_b, { signal });
        } finally {
          answerEl?.classList.remove('is-playing');
        }
        if (signal.aborted) {
          clearSegmentHighlights(segments);
          break;
        }

        const hasMoreCards = index < cards.length - 1;
        if (hasMoreCards) {
          status.textContent = 'Next up...';
        }

        await delay(400, { signal });
        card.classList.remove('is-active');
        clearSegmentHighlights(segments);
        if (signal.aborted) {
          break;
        }

        await delay(3000, { signal });
        if (signal.aborted) {
          break;
        }
      }

      if (!signal.aborted) {
        status.textContent = 'Great work! Practice complete.';
        showCompletionModal({
          title: 'Great Work!',
          message: 'You completed the speaking practice.',
        });
      } else {
        status.textContent = 'Practice stopped.';
      }
    } catch (error) {
      status.textContent = 'Unable to play audio.';
      console.error(error);
    } finally {
      startBtn.disabled = false;
      sequenceAbort = null;
    }
  };

  const startPractice = () => {
    autoTriggered = true;
    slide._autoTriggered = true;
    runSpeakingPractice();
  };

  const triggerAutoPlay = () => {
    if (autoTriggered) {
      return;
    }
    startPractice();
  };

  startBtn.addEventListener('click', startPractice);

  const autoPlay = {
    button: startBtn,
    trigger: triggerAutoPlay,
    status,
  };

  const onLeave = () => {
    sequenceAbort?.abort();
    sequenceAbort = null;
    audioManager.stopAll();
    resetCards();
    startBtn.disabled = false;
    status.textContent = '';
    autoTriggered = false;
    slide._autoTriggered = false;
    slide._instructionComplete = false;
  };

  const suffixSegment = subActivityLetter ? `-${subActivityLetter}` : '';

  return {
    id: activityNumber ? `activity-${activityNumber}${suffixSegment}-speaking` : 'activity-speaking',
    element: slide,
    autoPlay,
    onLeave,
  };
};

const createSubActivityContext = (base, letter) => ({
  activityLabel: base.activityLabel,
  activityNumber: base.activityNumber,
  activityFocus: base.activityFocus,
  includeFocus: false,
  subActivitySuffix: letter ? letter : '',
  subActivityLetter: letter || '',
});

export const buildSbsOneSlides = (activityData = {}, context = {}) => {
  const { activityNumber, focus: rawFocus } = context;
  const activityLabel = activityNumber ? `Activity ${activityNumber}` : 'Activity';
  const activityFocus =
    typeof rawFocus === 'string' && rawFocus.trim().length ? rawFocus.trim() : '';

  const baseContext = { activityLabel, activityNumber, activityFocus };

  const modelContext = {
    ...baseContext,
    includeFocus: Boolean(activityFocus),
  };

  const preListeningContext = createSubActivityContext(baseContext, 'a');
  const listeningContext = createSubActivityContext(baseContext, 'b');

  const parsePauseValue = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const configuredPause =
    parsePauseValue(activityData.listen_repeat_pause_ms) ?? parsePauseValue(activityData.repeat_pause_ms);

  const listenRepeatContext = {
    ...createSubActivityContext(baseContext, 'c'),
    repeatPauseMs: configuredPause !== null ? Math.max(500, configuredPause) : 1500,
  };
  const readingContext = createSubActivityContext(baseContext, 'd');
  const speakingContext = createSubActivityContext(baseContext, 'e');

  const dialogues = Array.isArray(activityData.dialogues) ? activityData.dialogues : [];
  const exampleDialogues = Array.isArray(activityData.example_dialogues)
    ? activityData.example_dialogues
    : [];
  const tables = Array.isArray(activityData.tables) ? activityData.tables : [];

  return [
    buildModelDialogueSlide(exampleDialogues, { ...modelContext, tables }),
    buildPreListeningSlide(dialogues, preListeningContext),
    buildListeningSlide(dialogues, listeningContext),
    buildListenAndRepeatSlide(dialogues, listenRepeatContext),
    buildReadingSlide(dialogues, readingContext),
    buildSpeakingSlide(dialogues, speakingContext),
  ];
};















