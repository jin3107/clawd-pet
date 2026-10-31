let selected = null;

const frame = document.getElementById('previewFrame');
const hint = document.getElementById('previewHint');
const label = document.getElementById('previewLabel');

// The preview is the real sprite page in preview mode, so it always matches what the pet will look like.
function showPreview(card) {
  hint.style.display = 'none';
  frame.style.display = 'block';
  label.textContent = `Xem trước: ${card.querySelector('.card-name').textContent.trim()}`;
  frame.src = `index.html?preview=${card.dataset.model}`;
}

document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    document.getElementById('next').disabled = false;
    if (selected !== card.dataset.model) showPreview(card);
    selected = card.dataset.model;
  });
});

document.getElementById('next').addEventListener('click', () => {
  if (selected) window.modelPickerAPI.pick(selected);
});
