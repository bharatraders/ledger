import { supabase } from '../supabaseClient';

export function isAuthError(error) {
  if (!error) return false;
  const msg = String(error.message || error.code || error.details || '').toLowerCase();
  const code = String(error.code || '');
  return (
    code === '401' ||
    code === 'PGRST301' ||
    code === '42501' ||
    msg.includes('not_trusted') ||
    msg.includes('device_not_trusted') ||
    msg.includes('jwt') ||
    msg.includes('permission denied') ||
    msg.includes('not authenticated') ||
    msg.includes('row-level security') ||
    msg.includes('row level security')
  );
}

export function isDeviceNotTrustedError(error) {
  const msg = String(error?.message || error?.code || '').toLowerCase();
  return msg.includes('not_trusted') || msg.includes('device_not_trusted');
}

export async function probeAccess() {
  const { error } = await supabase.from('parties').select('id').limit(1);
  return !error;
}
