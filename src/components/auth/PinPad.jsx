import { useState } from 'react';

export default function PinPad({ onComplete, disabled, error, label = 'Enter PIN' }) {
  const [pin, setPin] = useState('');

  function press(d) {
    if (disabled) return;
    if (d === 'clear') {
      setPin('');
      return;
    }
    if (d === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) {
      onComplete(next, () => setPin(''));
    }
  }

  function handleKey(e) {
    if (e.key >= '0' && e.key <= '9') press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter' && pin.length === 6) onComplete(pin, () => setPin(''));
  }

  return (
    <div onKeyDown={handleKey} tabIndex={0} aria-label={label} className="outline-none">
      <div className={`flex justify-center gap-3 ${error ? 'animate-shake' : ''}`} aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`grid h-14 w-11 place-items-center rounded-xl border-2 text-2xl font-bold ${
              pin.length > i ? 'border-accent bg-card' : 'border-rule bg-card'
            }`}
          >
            {pin.length > i ? '•' : ''}
          </div>
        ))}
      </div>
      <div className="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-3" role="group" aria-label="PIN keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => press(k)}
            className="rounded-2xl border border-rule bg-card py-4 text-xl font-bold disabled:opacity-50"
            aria-label={k === 'clear' ? 'Clear' : k === 'back' ? 'Backspace' : `Digit ${k}`}
          >
            {k === 'clear' ? 'C' : k === 'back' ? '⌫' : k}
          </button>
        ))}
      </div>
    </div>
  );
}
