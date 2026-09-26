import { supabase } from '../supabaseClient';

export async function uploadEntryPhoto(partyId, entryId, blob) {
  const path = `${partyId}/${entryId}.jpg`;
  const { error } = await supabase.storage
    .from('ledger-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

export async function setEntryPhotoPath(entryId, photoPath) {
  const { error } = await supabase.from('entries').update({ photo_path: photoPath }).eq('id', entryId);
  if (error) throw error;
}

// Used when an entry's photo is removed from the edit sheet. purgeNow() in
// lib/api/trash.js does the same thing when an entry is hard-deleted.
export async function deleteEntryPhoto(path) {
  if (!path) return;
  const { error } = await supabase.storage.from('ledger-photos').remove([path]);
  if (error) throw error;
}

export async function getSignedPhotoUrl(path, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from('ledger-photos')
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
