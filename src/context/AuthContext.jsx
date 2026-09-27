import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { readDevice } from '../lib/api/deviceStore';
import { setDeviceSecret, getDeviceSecret } from '../lib/deviceSecretStore';
import { supabase } from '../lib/supabaseClient';
import { forgetThisDevice } from '../lib/api/deviceAuth';

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

// Inactivity auto-lock: lock the UI after 15 min idle. This ONLY flips the UI
// back to /login — it must NOT touch the device secret (see lockApp()), or the
// next PIN attempt would go out without x-device-secret and look "revoked".
const IDLE_MS = 15 * 60 * 1000;
// While unlocked, keep the server-side 90-day session alive so an always-open
// tab never silently expires server-side (device still lists "active" via
// devices.status, but its device_sessions row has passed expires_at).
const HEARTBEAT_MS = 30 * 60 * 1000;

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

  // Auto-lock on idle + when tab hidden for a while. Neither path clears the
  // device secret: verify_pin needs the x-device-secret header, so the secret
  // must survive the lock or the next PIN entry fails with 'not_trusted'.
  useEffect(() => {
    let idleTimer = null;
    let hiddenAt = null;

    function doIdleLock() {
      // Only the 'ready' (unlocked) UI needs locking; on /login there is
      // nothing to lock and clearing/re-attaching state would just race the
      // PIN submit. Status check via functional set keeps this race-free.
      setStatus((s) => (s === 'ready' ? 'unlock' : s));
    }

    function arm() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(doIdleLock, IDLE_MS);
    }

    const onActivity = () => arm();
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    function onVisibility() {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > IDLE_MS) {
        doIdleLock();
        hiddenAt = null;
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    arm();
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Server-session heartbeat: while the UI is unlocked, slide the 90-day
  // device_sessions expiry forward every 30 min so a long-lived tab never
  // expires server-side. On 'not_trusted' the device really is revoked/
  // expired — drop to /login (NOT /register: the user may just need to
  // re-register, and SignInScreen decides that from the next PIN attempt).
  // Static import keeps supabaseClient in the entry chunk: a dynamic import()
  // would force AuthContext (entry chunk) to also pull the ledger chunk.
  useEffect(() => {
    if (status !== 'ready') return undefined;
    let cancelled = false;
    async function beat() {
      try {
        const { error } = await supabase.rpc('touch_device_session');
        if (error && !cancelled) {
          const msg = String(error.message || '').toLowerCase();
          if (msg.includes('not_trusted')) setStatus('unlock');
        }
      } catch {
        // offline blip — next beat retries; never lock on network errors
      }
    }
    const t = setInterval(beat, HEARTBEAT_MS);
    // Slide expiry on unlock too, so "some time" of use always extends it.
    beat();
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [status]);

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
    // Manual lock (header Lock button): UI-only. The in-memory device secret is
    // deliberately left alone — verify_pin needs x-device-secret — so no
    // re-attach dance is needed here (the old readDevice().then(setSecret)
    // raced the next PIN submit and could still send a headerless request).
    setPendingDevice(null);
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
