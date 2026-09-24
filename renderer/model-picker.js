let selected = null;

document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    selected = card.dataset.model;
    document.getElementById('next').disabled = false;
  });
});

document.getElementById('next').addEventListener('click', () => {
  if (selected) window.modelPickerAPI.pick(selected);
});
