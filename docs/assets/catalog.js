/* Progressive enhancement: the full catalogue remains readable without JS. */
(() => {
  const form = document.querySelector('[data-catalog-controls]');
  if (!form) return;
  const cards = [...document.querySelectorAll('[data-catalog-entry]')];
  const count = document.querySelector('[data-result-count]');
  const empty = document.querySelector('[data-no-results]');
  const normalize = value => value.normalize('NFKD').toLowerCase().trim();
  function filter() {
    const terms = normalize(form.elements.query.value).split(/\s+/).filter(Boolean);
    const game = form.elements.game.value;
    const type = form.elements.type.value;
    let visible = 0;
    cards.forEach(card => {
      const matches = (!game || card.dataset.game === game)
        && (!type || card.dataset.type === type)
        && terms.every(term => normalize(card.dataset.search).includes(term));
      card.hidden = !matches;
      if (matches) visible++;
    });
    count.textContent = `${visible} ${visible === 1 ? 'result' : 'results'}`;
    empty.hidden = visible !== 0;
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  form.addEventListener('reset', () => setTimeout(filter, 0));
  filter();
})();
