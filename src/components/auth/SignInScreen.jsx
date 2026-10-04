import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { verifyBillingPin } from '../../lib/api/deviceAuth';
import { isDeviceNotTrustedError } from '../../lib/api/auth';
import { readDevice } from '../../lib/api/deviceStore';
import PinPad from './PinPad';

// The one PIN gate in the app, used both for the daily sign-in (/login) and, with
// firstRun, as the final step of registering a new browser (/create-pin). The PIN is
// a single shared secret held server-side (app_config.pin_hash), so both steps do the
// same thing: hand the 6 digits to verify_pin() and, if it says yes, mark the UI
// unlocked. verifyBillingPin also slides this device's session forward.
export default function SignInScreen({ firstRun = false }) {
  const { markUnlocked, forgetDevice, pendingDevice } = useAuth();
  const navigate = useNavigate();
  const [deviceName, setDeviceName] = useState(pendingDevice?.deviceName || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgetting, setForgetting] = useState(false);

  useEffect(() => {
    if (deviceName) return undefined;
    let alive = true;
    readDevice().then(
      (device) => {
        if (alive && device?.deviceName) setDeviceName(device.deviceName);
      },
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [deviceName]);

  async function submit(pin, reset) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const ok = await verifyBillingPin(pin);
      if (ok) {
        markUnlocked();
        navigate('/', { replace: true });
        return;
      }
      reset();
      setError(firstRun ? 'That PIN is not correct. It must match the PIN your other devices use.' : 'That PIN is not correct.');
    } catch (err) {
      reset();
      // ONLY a genuine 'not_trusted' from the server (revoked / server-side
      // expired session) wipes local state. Everything else — offline blips,
      // RLS hiccups, 401s from a stale realtime JWT — must stay on /login with
      // a retry message, or one bad request permanently bricks the device and
      // forces re-registration even though the device is still 'active'.
      if (isDeviceNotTrustedError(err)) {
        // Revoked, expired, or not known to the server: drop local state and send this
        // browser back through registration rather than letting it retry forever.
        await forgetDevice();
        return;
      }
      setError('Could not reach the ledger. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleForget() {
    setForgetting(true);
    try {
      await forgetDevice();
    } finally {
      setForgetting(false);
    }
  }

  const who = deviceName ? `This browser is registered as \u201C${deviceName}\u201D. ` : '';
  const lead = firstRun
    ? 'Confirm your 6-digit PIN to finish setting it up.'
    : 'Enter your 6-digit PIN to open the ledger.';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <img src="/icon.png" alt="Points Ledger logo" className="h-16 w-16 rounded-2xl object-contain" />
      <h1 className="mt-3 text-2xl font-bold">{firstRun ? 'Finish setting up this device' : 'Points Ledger'}</h1>
      <p className="mt-2 text-muted">
        {who}
        {lead}
      </p>
      <div className="mt-8">
        <PinPad
          onComplete={submit}
          disabled={busy}
          error={Boolean(error)}
          label="Enter your 6-digit PIN"
        />
      </div>
      <div className="mt-3 min-h-5 text-center text-[15px] text-dr" role="alert">
        {error}
      </div>
      <p className="mt-5 text-sm text-muted">
        One PIN is shared by every trusted device. If no PIN has been set yet it has to be
        created once from the backend, with{' '}
        <span className="font-mono">backend/scripts/set-pin.js</span>.
      </p>
      <button
        type="button"
        onClick={handleForget}
        disabled={forgetting}
        className="mt-4 self-start text-sm font-semibold text-muted underline disabled:opacity-60"
      >
        {forgetting
          ? 'Forgetting\u2026'
          : firstRun
            ? 'Register a different device'
            : 'Forget this device'}
      </button>
    </div>
  );
}
