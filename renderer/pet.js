const creature = document.getElementById('creature');
let flipGroup = null;
let headZone = null;
let held = false;

const CODE_PHASES = ['prep', 'raise', 'hold', 'swing', 'land', 'ears', 'sit', 'typing', 'up', 'carry', 'away', 'relax'];
// Group classes for states.css (see the seated-coding comment there).
const CODE_GROUPS = {
  'cs-seated': new Set(['sit', 'typing', 'up']),
  'cs-shade': new Set(['ears', 'sit', 'typing', 'up', 'carry']),
  'cs-look': new Set(['sit', 'typing', 'up', 'carry']),
  'cs-open': new Set(['land', 'ears', 'sit', 'typing', 'up']),
};
const STATES = ['walk', 'idle', 'surf', 'climb', 'code', 'jump', 'music', 'soccer', 'held', 'fall', 'pat', 'think', 'coffee', 'butterfly'];

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

// ?preview=<model> runs the sprite on its own (used by the model picker): no IPC, just a looping set of poses.
const previewModel = new URLSearchParams(location.search).get('preview');
const PREVIEW_LOOP = [['idle', 2600], ['walk', 2600], ['jump', 1300], ['think', 2600]];

function runPreview(apply) {
  let i = 0;
  const step = () => {
    const [state, ms] = PREVIEW_LOOP[i++ % PREVIEW_LOOP.length];
    apply({ state, facing: 1, careMsg: false });
    setTimeout(step, ms);
  };
  step();
}

async function init() {
  const model = previewModel || await window.petAPI.getModel();
  document.body.classList.add(`model-${model}`);
  // Only the hand-drawn cat/sheep art faces left by default; the original
  // Clawd sprite already faces right, so it needs no flip negation.
  const facingSign = model === 'clawd' ? 1 : -1;

  // Use innerHTML on the SVG element so content is parsed in SVG namespace
  // (template elements parse SVG as HTML nodes — wrong namespace, won't render)
  const scriptEl = document.getElementById(`tpl-${model}`);
  creature.innerHTML = scriptEl.textContent;

  flipGroup = document.getElementById('flip-group');
  headZone = document.getElementById('head-zone');

  const applyState = ({ state, facing, careMsg }) => {
    const base =
      state.startsWith('climb') ? 'climb' :
      state.startsWith('code')  ? 'code'  :
      state.startsWith('coffee')? 'coffee':
      state.startsWith('fall')  ? 'fall'  : state;
    STATES.forEach((s) => document.body.classList.toggle(s, s === base));
    document.body.classList.toggle('hang',    state === 'climb-pause');
    // One class per seated-coding phase (cp-draw … cp-closing); states.css builds the sequence from them.
    CODE_PHASES.forEach((p) => document.body.classList.toggle(`cp-${p}`, state === `code-${p}`));
    const codePhase = state.startsWith('code-') ? state.slice(5) : '';
    Object.entries(CODE_GROUPS).forEach(([cls, phases]) => document.body.classList.toggle(cls, phases.has(codePhase)));
    document.body.classList.toggle('sipping', state === 'coffee-sip');
    document.body.classList.toggle('chute',   state.startsWith('fall') && state.includes('chute'));
    document.body.classList.toggle('scared',  state.startsWith('fall') && state.includes('scared'));
    document.body.classList.toggle('care-msg', !!careMsg);
    flipGroup.style.transform = `scaleX(${facingSign * facing})`;
  };

  if (previewModel) {
    document.body.classList.add('preview');
    runPreview(applyState);
    scheduleBlink();
    return;
  }
  window.petAPI.onState(applyState);

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

  scheduleBlink();
}

init();
