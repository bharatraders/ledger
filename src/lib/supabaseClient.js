import { createClient } from '@supabase/supabase-js';
import { getDeviceSecret } from './deviceSecretStore';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in frontend/.env');
}

function deviceAwareFetch(input, init = {}) {
  const secret = getDeviceSecret();
  const headers = new Headers(init.headers || {});
  if (secret) headers.set('x-device-secret', secret);
  return fetch(input, { ...init, headers });
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
  global: { fetch: deviceAwareFetch },
});

