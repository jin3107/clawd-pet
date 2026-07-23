const bubble = document.getElementById('bubble');
const wrap = document.getElementById('wrap');

window.bubbleAPI.onText((text) => {
  bubble.textContent = text;
  requestAnimationFrame(() => {
    const rect = wrap.getBoundingClientRect();
    window.bubbleAPI.reportSize(Math.ceil(rect.width), Math.ceil(rect.height));
  });
});
