// Knob and selector widgets in the spirit of Vital/Serum: drag vertically, Shift for fine,
// double-click to reset, arrow keys when focused.

export function toNorm(c, v) {
  if (c.scale === 'log') return Math.log(v / c.min) / Math.log(c.max / c.min);
  return (v - c.min) / (c.max - c.min);
}

export function fromNorm(c, n) {
  n = Math.min(1, Math.max(0, n));
  let v = c.scale === 'log' ? c.min * Math.pow(c.max / c.min, n) : c.min + n * (c.max - c.min);
  if (c.step) v = Math.round(v / c.step) * c.step;
  return v;
}

const R = 22;
const START_A = -135;
const END_A = 135;

function arc(a0, a1) {
  const rad = (a) => ((a - 90) * Math.PI) / 180;
  const x0 = 28 + R * Math.cos(rad(a0));
  const y0 = 28 + R * Math.sin(rad(a0));
  const x1 = 28 + R * Math.cos(rad(a1));
  const y1 = 28 + R * Math.sin(rad(a1));
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
}

export function createKnob(c, value, resetValue, onChange) {
  const el = document.createElement('div');
  el.className = 'knob';
  el.dataset.id = c.id;
  el.innerHTML = `
    <svg viewBox="0 0 56 56" aria-hidden="true">
      <path class="track" d="${arc(START_A, END_A)}"/>
      <path class="fill" d=""/>
      <line class="pointer" x1="28" y1="28" x2="28" y2="10"/>
    </svg>
    <div class="knob-label">${c.label}</div>
    <div class="knob-value"></div>`;
  el.tabIndex = 0;
  el.setAttribute('role', 'slider');
  el.setAttribute('aria-label', c.label);
  const fill = el.querySelector('.fill');
  const pointer = el.querySelector('.pointer');
  const valueEl = el.querySelector('.knob-value');
  let current = value;

  function render(v) {
    current = v;
    const n = toNorm(c, v);
    const a = START_A + n * (END_A - START_A);
    fill.setAttribute('d', n > 0.001 ? arc(START_A, a) : '');
    pointer.setAttribute('transform', `rotate(${a} 28 28)`);
    valueEl.textContent = c.format ? c.format(v) : v.toFixed(2);
    el.setAttribute('aria-valuetext', valueEl.textContent);
  }

  function set(v) {
    if (v === current) return;
    render(v);
    onChange(v);
  }

  let startY = 0;
  let startN = 0;
  el.addEventListener('pointerdown', (e) => {
    if (el.classList.contains('locked')) return;
    el.setPointerCapture(e.pointerId);
    startY = e.clientY;
    startN = toNorm(c, current);
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const range = e.shiftKey ? 900 : 180;
    set(fromNorm(c, startN + (startY - e.clientY) / range));
  });
  const end = (e) => {
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el.classList.remove('dragging');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', () => {
    if (!el.classList.contains('locked')) set(resetValue);
  });
  el.addEventListener('keydown', (e) => {
    if (el.classList.contains('locked')) return;
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const stepN = c.step ? c.step / (c.max - c.min) : e.shiftKey ? 0.002 : 0.01;
    set(fromNorm(c, toNorm(c, current) + d * stepN));
  });

  render(value);
  return { el, render, get value() { return current; } };
}

export function createSelect(c, value, onChange) {
  const el = document.createElement('div');
  el.className = 'select';
  el.dataset.id = c.id;
  el.innerHTML = `<div class="knob-label">${c.label}</div><div class="seg" role="radiogroup" aria-label="${c.label}"></div>`;
  const seg = el.querySelector('.seg');
  const buttons = c.options.map((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = o.label;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => {
      if (el.classList.contains('locked')) return;
      render(o.value);
      onChange(o.value);
    });
    seg.appendChild(b);
    return { b, value: o.value };
  });
  let current = value;
  function render(v) {
    current = v;
    for (const { b, value: bv } of buttons) {
      b.classList.toggle('on', bv === v);
      b.setAttribute('aria-checked', bv === v ? 'true' : 'false');
    }
  }
  render(value);
  return { el, render, get value() { return current; } };
}
