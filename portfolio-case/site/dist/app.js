document.body.classList.add('js');

const scenarios = {
  less: { paid: 'R$ 1.170,00', difference: 'R$ 80,00', label: 'Pago a menos', color: '#e9aa70', explanation: 'A diferença fica visível para quem confere, junto dos dados que sustentam o cálculo.' },
  equal: { paid: 'R$ 1.250,00', difference: 'R$ 0,00', label: 'Valor confere', color: '#8fdda7', explanation: 'Neste exemplo, o pagamento coincide com o valor previsto. A conferência pode seguir para revisão.' },
  more: { paid: 'R$ 1.310,00', difference: 'R$ 60,00', label: 'Pago a mais', color: '#83cddd', explanation: 'Um pagamento maior também merece análise. O contexto do serviço ajuda a interpretar a diferença.' },
};
const liveDifference = document.querySelector('.difference');
liveDifference.setAttribute('aria-live', 'polite');
document.querySelectorAll('[data-scenario]').forEach((button) => {
  button.addEventListener('click', () => {
    const value = scenarios[button.dataset.scenario];
    document.getElementById('paid-value').textContent = value.paid;
    document.getElementById('difference-value').textContent = value.difference;
    document.getElementById('difference-label').textContent = value.label;
    document.getElementById('difference-value').style.color = value.color;
    document.getElementById('difference-label').style.color = value.color;
    document.getElementById('difference-explanation').textContent = value.explanation;
    document.querySelectorAll('[data-scenario]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
  });
});

const tabs = [...document.querySelectorAll('[role=tab]')];
function selectTab(tab, focus = false) {
  tabs.forEach((item) => {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).classList.toggle('is-active', active);
  });
  if (focus) tab.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectTab(tabs[next], true);
  });
});

const imageDialog = document.querySelector('.image-dialog');
let imageOpener;
document.querySelectorAll('[data-lightbox]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (typeof imageDialog.showModal !== 'function') return;
    event.preventDefault();
    imageOpener = link;
    const image = document.getElementById('expanded-image');
    image.src = link.href;
    image.alt = link.querySelector('img').alt;
    document.getElementById('image-caption').textContent = link.dataset.caption;
    imageDialog.showModal();
    document.body.style.overflow = 'hidden';
    document.getElementById('close-image').focus();
  });
});
document.getElementById('close-image').addEventListener('click', () => imageDialog.close());
imageDialog.addEventListener('click', (event) => {
  if (event.target !== imageDialog) return;
  const bounds = imageDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) imageDialog.close();
});
imageDialog.addEventListener('close', () => {
  document.body.style.overflow = '';
  imageOpener?.focus({ preventScroll: true });
});

document.getElementById('print-case').addEventListener('click', () => window.print());

// A exportação compartilha o conteúdo do site e usa dimensões fixas para as pranchas.
if (new URLSearchParams(location.search).has('presentation')) document.body.classList.add('presentation');
