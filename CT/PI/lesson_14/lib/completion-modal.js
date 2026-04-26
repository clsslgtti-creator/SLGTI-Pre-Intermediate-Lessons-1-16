let modalElement = null;

const ensureModal = () => {
  if (modalElement) {
    return modalElement;
  }

  const overlay = document.createElement("div");
  overlay.className = "completion-modal";
  overlay.innerHTML = `
    <div class="completion-modal__backdrop"></div>
    <div class="completion-modal__dialog" role="dialog" aria-modal="true">
      <svg class="end-of-lesson__check" viewBox="0 0 64 64" focusable="false">
          <circle cx="32" cy="32" r="30" fill="var(--accent-200, #2e7d32)"></circle>
          <path d="M27.6 41.2 19.8 33.4a2.4 2.4 0 0 1 3.4-3.4l6 6 11.6-11.6a2.4 2.4 0 0 1 3.4 3.4L31 41.2a2.4 2.4 0 0 1-3.4 0Z" fill="var(--accent-600, #e6f4ea)"></path>
        </svg>
      <h3 class="completion-modal__title"></h3>
      <p class="completion-modal__message"></p>
      <button type="button" class="primary-btn completion-modal__close">Close</button>
    </div>
  `;

  const closeBtn = overlay.querySelector(".completion-modal__close");
  const hide = () => {
    overlay.classList.remove("is-visible");
    window.setTimeout(() => {
      overlay.remove();
      modalElement = null;
    }, 300);
  };

  closeBtn.addEventListener("click", hide);
  overlay.querySelector(".completion-modal__backdrop").addEventListener("click", hide);

  modalElement = overlay;
  document.body.appendChild(overlay);
  return modalElement;
};

export const showCompletionModal = ({
  title = "Great Work!",
  message = "You completed this activity.",
} = {}) => {
  const modal = ensureModal();
  modal.querySelector(".completion-modal__title").textContent = title;
  modal.querySelector(".completion-modal__message").textContent = message;
  modal.classList.add("is-mounted");
  window.requestAnimationFrame(() => modal.classList.add("is-visible"));
};
