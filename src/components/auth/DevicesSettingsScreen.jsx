import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { generateRegistrationCode, listDevices, revokeDevice } from '../../lib/api/deviceAuth';
import { readDevice } from '../../lib/api/deviceStore';
import { isAuthError } from '../../lib/api/auth';
import AppShell from '../layout/AppShell';
import NavBar from '../layout/NavBar';
import ConfirmDialog from '../sheets/ConfirmDialog';
import Spinner from '../common/Spinner';
import EmptyState from '../common/EmptyState';

function fmtTs(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

export default function DevicesSettingsScreen() {
  const navigate = useNavigate();
  const { lock } = useAuth();
  const { toast } = useToast();
  const [devices, setDevices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState(null);
  const [codeLeft, setCodeLeft] = useState(0);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [thisDeviceId, setThisDeviceId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [list, device] = await Promise.all([listDevices(), readDevice()]);
      setDevices(list || []);
      setThisDeviceId(device?.deviceId || null);
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not load devices.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((new Date(code.expiresAt) - new Date()) / 1000));
      setCodeLeft(left);
      if (left <= 0) {
        clearInterval(t);
        setCode(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [code]);

  async function gen() {
    try {
      const c = await generateRegistrationCode();
      setCode(c);
      setCodeLeft(Math.max(0, Math.round((new Date(c.expiresAt) - new Date()) / 1000)));
    } catch (e) {
      if (isAuthError(e)) lock();
      else toast('Could not generate a code. Try again.');
    }
  }

  async function doRevoke() {
    if (!revokeTarget) return;
    setBusy(true);
    try {
      await revokeDevice(revokeTarget.id);
      setRevokeTarget(null);
      toast('Device revoked');
      // Devices are loaded through load()'s own state (not react-query), so there is
      // nothing to invalidate — a blanket invalidateQueries() used to re-GET every
      // ledger dataset after a revoke.
      await load();
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('cannot_revoke_last')) {
        toast('You cannot revoke the last remaining active device.');
      } else if (isAuthError(e)) {
        lock();
      } else {
        toast('Could not revoke. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  const activeCount = (devices || []).filter((d) => d.status === 'active').length;
  const mm = Math.floor(codeLeft / 60);
  const ss = String(codeLeft % 60).padStart(2, '0');

  return (
    <AppShell>
      <NavBar title="Devices & Security" sub="Trusted browsers for your ledger" onBack={() => navigate('/')} backLabel="All parties" backPill />
      <div className="mx-4 mb-10 mt-4 flex flex-col gap-4">
        <section className="rounded-[14px] border border-rule bg-card p-4">
          <h2 className="text-lg font-bold">Register a new device</h2>
          <p className="mt-1 text-sm text-muted">Single-use code, expires in 10 minutes. Generate it here, enter it on the new device.</p>
          <button type="button" onClick={gen} className="mt-3 w-full rounded-[14px] bg-accent p-4 font-extrabold text-white dark:text-[#0D1322]">
            Generate registration code
          </button>
          {code ? (
            <div className="mt-3 rounded-xl bg-paper p-4 text-center">
              <div className="font-mono text-2xl font-extrabold tracking-[0.2em]">{code.code}</div>
              <div className="mt-1 text-sm text-muted">Expires in {mm}:{ss}</div>
              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(code.code);
                    toast('Code copied');
                  } catch {
                    toast('Copy failed — write it down.');
                  }
                }}
                className="mt-2 rounded-xl border border-rule bg-card px-4 py-2 font-bold"
              >
                Copy code
              </button>
            </div>
          ) : null}
        </section>
        <section className="rounded-[14px] border border-rule bg-card p-4">
          <h2 className="text-lg font-bold">Registered devices</h2>
          {loading ? <Spinner /> : !devices?.length ? <EmptyState>No devices found.</EmptyState> : (
            <div className="mt-2 flex flex-col gap-2.5">
              {devices.map((d) => {
                const isSelf = thisDeviceId && d.id === thisDeviceId;
                const canRevoke = !(activeCount <= 1 && d.status === 'active');
                return (
                  <div key={d.id} className="rounded-xl border border-rule bg-paper p-3">
                    <div className="font-semibold">{d.device_name}{isSelf ? ' (this device)' : ''}</div>
                    <div className="text-sm text-muted">Status: {d.status} · Created: {fmtTs(d.created_at)}<br />Last used: {fmtTs(d.last_used_at)}</div>
                    {d.status === 'active' ? (
                      <button
                        type="button"
                        disabled={!canRevoke}
                        title={canRevoke ? 'Revoke this device' : 'Cannot revoke the last remaining active device'}
                        onClick={() => setRevokeTarget(d)}
                        className="mt-2 rounded-xl bg-dr px-4 py-2 font-bold text-white disabled:opacity-40 dark:text-[#0D1322]"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {revokeTarget ? (
        <ConfirmDialog
          title="Revoke this device?"
          description="That browser will immediately lose access to your ledger. It must re-register with a new code to come back."
          confirmLabel="Revoke device"
          busy={busy}
          onCancel={() => setRevokeTarget(null)}
          onConfirm={doRevoke}
        />
      ) : null}
    </AppShell>
  );
}

