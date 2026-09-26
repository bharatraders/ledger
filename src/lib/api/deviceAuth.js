import { supabase } from '../supabaseClient';
import { setDeviceSecret, clearDeviceSecret } from '../deviceSecretStore';
import { readDevice, writeDevice, clearDevice } from './deviceStore';

export async function isDeviceProvisioned() {
  return (await readDevice()) !== null;
}

export async function redeemRegistrationCode(regCode, deviceName, deviceType) {
  const { data, error } = await supabase.rpc('register_device', {
    reg_code: regCode.trim(),
    p_device_name: deviceName,
    p_device_type: deviceType ?? navigator.platform ?? 'browser',
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  // The 12-char registration code is the one-time gate; the 6-digit PIN stays
  // the shared secret in Supabase. The device secret is stored in plaintext
  // locally because it alone grants nothing without the PIN (verify_pin is the
  // only path that marks this browser unlocked, and it needs both).
  await writeDevice({ deviceId: row.device_id, deviceName, deviceSecret: row.device_secret });
  setDeviceSecret(row.device_secret);
  await supabase.rpc('touch_device_session');
  return { deviceId: row.device_id, deviceSecret: row.device_secret };
}

export async function verifyBillingPin(pin) {
  if (!/^\d{6}$/.test(pin)) return false;
  const { data, error } = await supabase.rpc('verify_pin', { pin });
  if (error) throw error;
  if (data === true) {
    await supabase.rpc('touch_device_session');
    return true;
  }
  return false;
}

export function lockApp() {
  clearDeviceSecret(); // forgets the header; device row stays for next PIN entry
}

export async function forgetThisDevice() {
  clearDeviceSecret();
  await clearDevice(); // wipes local state; this browser must re-register from scratch
}

export async function generateRegistrationCode() {
  const { data, error } = await supabase.rpc('create_registration_code');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { code: row.code, expiresAt: row.expires_at };
}

export async function listDevices() {
  const { data, error } = await supabase.rpc('list_devices');
  if (error) throw error;
  return data;
}

export async function revokeDevice(deviceId) {
  const { error } = await supabase.rpc('revoke_device', { target_device_id: deviceId });
  if (error) throw error;
}
