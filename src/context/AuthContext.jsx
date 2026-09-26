import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { readDevice } from '../lib/api/deviceStore';
import { setDeviceSecret, getDeviceSecret } from '../lib/deviceSecretStore';
import { lockApp, forgetThisDevice } from '../lib/api/deviceAuth';

const AuthContext = createContext({
  status: 'checking', // 'checking' | 'register' | 'create-pin' | 'unlock' | 'ready'
  checking: true,
  unlocked: false,
  pendingDevice: null,
  refresh: () => {},
  markUnlocked: () => {},
  beginCreatePasscode: () => {},
  lock: () => {},
  forgetDevice: async () => {},
});

// Inactivity auto-lock: forget the in-memory secret after 15 min idle.
const IDLE_MS = 15 * 60 * 1000;

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('checking');
  // Set by DeviceRegistrationScreen once a device has redeemed its code: the device
  // is already persisted (deviceStore) and its secret is in memory, so the only step
  // left is confirming the ledger PIN on /create-pin.
  const [pendingDevice, setPendingDevice] = useState(null);

  const refresh = useCallback(async () => {
    setStatus('checking');
    try {
      const device = await readDevice();
      if (!device?.deviceSecret) {
        setStatus('register');
      } else {
        // Re-attach the stored device secret so this browser's requests carry
        // the x-device-secret header; the user still enters the PIN each
        // launch to actually unlock the UI (see SignInScreen).
        setDeviceSecret(device.deviceSecret);
        setStatus(getDeviceSecret() ? 'unlock' : 'register');
      }
    } catch {
      setStatus('register');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-lock on idle + when tab hidden for a while.
  useEffect(() => {
    let idleTimer = null;
    let hiddenAt = null;

    function arm() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (getDeviceSecret()) {
          lockApp();
          setStatus((s) => (s === 'ready' ? 'unlock' : s));
        }
      }, IDLE_MS);
    }

    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);
    function onVisibility() {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > IDLE_MS) {
        if (getDeviceSecret()) {
          lockApp();
          setStatus((s) => (s === 'ready' ? 'unlock' : s));
        }
        hiddenAt = null;
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    arm();
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const markUnlocked = useCallback(() => {
    setPendingDevice(null);
    setStatus('ready');
  }, []);

  // Called by DeviceRegistrationScreen after `register_device` has stored this
  // browser. Nothing extra is persisted here: the PIN is one shared secret that
  // lives server-side (app_config.pin_hash), so on a new device "creating" it just
  // means confirming the PIN that the ledger already uses.
  const beginCreatePasscode = useCallback((device) => {
    setPendingDevice(device ?? null);
    setStatus('create-pin');
  }, []);

  const lock = useCallback(() => {
    lockApp();
    setPendingDevice(null);
    // Re-attach the secret header immediately: locking only clears the
    // in-memory "PIN verified" state, it must not force re-registration.
    readDevice().then(
      (device) => {
        if (device?.deviceSecret) setDeviceSecret(device.deviceSecret);
      },
      () => {}
    );
    setStatus('unlock');
  }, []);

  const forgetDevice = useCallback(async () => {
    await forgetThisDevice();
    setPendingDevice(null);
    setStatus('register');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        checking: status === 'checking',
        unlocked: status === 'ready',
        pendingDevice,
        refresh,
        markUnlocked,
        beginCreatePasscode,
        lock,
        forgetDevice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
