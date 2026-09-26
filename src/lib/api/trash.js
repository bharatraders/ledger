import { supabase } from '../supabaseClient';

export async function fetchDeletedParties() {
  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('purge_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchDeletedEntries() {
  const { data, error } = await supabase
    .from('entries')
    .select('*, parties(name)')
    .not('deleted_at', 'is', null)
    .order('purge_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchDeletedEntryPhotoPathsForParty(partyId) {
  const { data, error } = await supabase
    .from('entries')
    .select('photo_path')
    .eq('party_id', partyId);
  if (error) throw error;
  return (data || []).map((e) => e.photo_path).filter(Boolean);
}

export async function purgeNow(kind, id, photoPaths = []) {
  if (photoPaths.length) {
    await supabase.storage.from('ledger-photos').remove(photoPaths);
  }
  const { error } = await supabase.rpc('purge_now', { kind, target_id: id });
  if (error) throw error;
}

export function daysLeft(purgeAt) {
  if (!purgeAt) return null;
  const ms = new Date(purgeAt) - new Date();
  return Math.max(0, Math.ceil(ms / 86400000));
}
