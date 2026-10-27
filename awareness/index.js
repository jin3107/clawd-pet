const observer = require('./observer');
const memory = require('./memory');
const gate = require('./gate');

let running = false;

// onActivity(category): called on every sample so the pet can bias its tricks.
// onSay(text): returns true if the pet showed the line (so the gate only spends its cooldown on shown lines).
function start({ onActivity, onSay }) {
  if (running) return;
  running = true;
  observer.start((sample) => {
    memory.push(sample);
    onActivity(sample.category);

    const snap = memory.snapshot();
    const decision = gate.evaluate(snap, sample.fullscreen);
    if (!decision) return;
    if (onSay(decision.text)) {
      decision.commit();
      memory.clearReturn();
    }
  });
}

function stop() {
  observer.stop();
  running = false;
}

module.exports = { start, stop, isRunning: () => running, previewLine: gate.previewLine };
