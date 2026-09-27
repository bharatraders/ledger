import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { redeemRegistrationCode } from '../../lib/api/deviceAuth';

function guessDeviceName() {
  const ua = navigator.userAgent || '';
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  let os = '';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Macintosh|Mac OS/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return os ? `${browser} on ${os}` : browser;
}

export function formatRegCode(value) {
  const clean = value.toUpperCase().replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, '').slice(0, 12);
  const groups = [clean.slice(0, 4), clean.slice(4, 8), clean.slice(8, 12)].filter(Boolean);
  return groups.join('-');
}

export default function DeviceRegistrationScreen() {
  const { beginCreatePasscode } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState(() => guessDeviceName());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setError('');
    const clean = code.replace(/-/g, '');
    if (clean.length !== 12) {
      setError('Enter the 12-character registration code.');
      return;
    }
    if (!deviceName.trim()) {
      setError('Give this device a name.');
      return;
    }
    setBusy(true);
    try {
      const device = await redeemRegistrationCode(code, deviceName.trim(), navigator.platform ?? 'browser');
      toast('Device registered');
      beginCreatePasscode({ deviceId: device.deviceId, deviceName: deviceName.trim(), deviceSecret: device.deviceSecret });
      navigate('/create-pin', { replace: true });
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('invalid_or_expired')) {
        setError('That code is invalid, expired, or already used. Ask a trusted device for a new one.');
      } else {
        setError('Could not register this device. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-bold">Party Ledger</h1>
      <p className="mt-2 text-muted">
        This device is not registered. To use this application, authorize this device from an existing trusted device.
      </p>
      <form onSubmit={submit} className="mt-6">
        <label htmlFor="regcode" className="mb-1 block text-[15px] font-semibold text-muted">
          Registration code
        </label>
        <input
          id="regcode"
          value={code}
          onChange={(e) => setCode(formatRegCode(e.target.value))}
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="w-full rounded-xl border-2 border-rule bg-card p-3.5 text-center font-mono text-xl font-bold tracking-widest focus:border-accent focus:outline-none"
        />
        <label htmlFor="devname" className="mb-1 mt-4 block text-[15px] font-semibold text-muted">
          Device name
        </label>
        <input
          id="devname"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="e.g. Chrome on Windows"
          className="w-full rounded-xl border-2 border-rule bg-card p-3.5 focus:border-accent focus:outline-none"
        />
        <div className="mt-2 min-h-5 text-[15px] text-dr" role="alert">
          {error}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-3 w-full rounded-[14px] bg-accent p-4 text-xl font-extrabold text-white disabled:opacity-60 dark:text-[#0D1322] md:p-[18px]"
        >
          {busy ? 'Registering…' : 'Register this device'}
        </button>
      </form>
    </div>
  );
}
