/* Native modal keeps focus and the reader on the current page. */
(() => {
  const dialog = document.querySelector('[data-image-dialog]');
  if (!dialog) return;
  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('[data-image-caption]');
  let opener;
  document.querySelectorAll('[data-step-image]').forEach(button => {
    button.addEventListener('click', () => {
      opener = button;
      const thumbnail = button.querySelector('img');
      image.src = thumbnail.src;
      image.alt = thumbnail.alt;
      caption.textContent = button.dataset.caption;
      dialog.showModal();
      document.body.classList.add('image-viewer-open');
    });
  });
  // Includes the enlarged image, close button and dimmed backdrop.
  dialog.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('image-viewer-open');
    opener?.focus({ preventScroll: true });
  });
})();
