const creature = document.getElementById('creature');
const flipGroup = document.getElementById('flip-group');
const headZone = document.getElementById('head-zone');

const STATES = ['walk', 'idle', 'surf', 'climb', 'code', 'jump', 'music', 'soccer', 'held', 'fall', 'pat', 'think', 'coffee'];
let held = false;

function scheduleBlink() {
  const delay = 3500 + Math.random() * 4000;
  setTimeout(() => {
    const eyes = document.querySelectorAll('.eye');
    eyes.forEach((eye) => eye.classList.add('blinking'));
    setTimeout(() => {
      eyes.forEach((eye) => eye.classList.remove('blinking'));
      scheduleBlink();
    }, 250);
  }, delay);
}
scheduleBlink();

window.petAPI.onState(({ state, facing, careMsg }) => {
  const base = state.startsWith('climb') ? 'climb' : state.startsWith('code') ? 'code' : state.startsWith('coffee') ? 'coffee' : state.startsWith('fall') ? 'fall' : state;
  STATES.forEach((s) => document.body.classList.toggle(s, s === base));
  document.body.classList.toggle('hang', state === 'climb-pause');
  document.body.classList.toggle('closing', state === 'code-closing');
  document.body.classList.toggle('sipping', state === 'coffee-sip');
  document.body.classList.toggle('chute', state.startsWith('fall') && state.includes('chute'));
  document.body.classList.toggle('scared', state.startsWith('fall') && state.includes('scared'));
  document.body.classList.toggle('care-msg', !!careMsg);
  flipGroup.style.transform = `scaleX(${facing})`;
});

creature.addEventListener('mouseenter', () => window.petAPI.setInteractive(true));

creature.addEventListener('mouseleave', () => {
  if (!held) {
    window.petAPI.setInteractive(false);
    window.petAPI.setPat(false);
  }
});

creature.addEventListener('mousedown', (e) => {
  e.preventDefault();
  held = true;
  window.petAPI.setPat(false);
  window.petAPI.dragStart(e.clientX, e.clientY);
});

window.addEventListener('mouseup', () => {
  if (held) {
    held = false;
    window.petAPI.dragEnd();
  }
});

headZone.addEventListener('mouseenter', () => {
  if (!held) window.petAPI.setPat(true);
});

headZone.addEventListener('mouseleave', () => window.petAPI.setPat(false));
