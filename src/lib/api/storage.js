import { supabase } from '../supabaseClient';

export async function uploadEntryPhoto(partyId, entryId, blob, index = 0) {
  // Indexed path keeps every photo addressable and deterministic:
  // <party>/<entry>.jpg (index 0, legacy path) then <party>/<entry>-<i>.jpg.
  const path = index === 0 ? `${partyId}/${entryId}.jpg` : `${partyId}/${entryId}-${index}.jpg`;
  const { error } = await supabase.storage
    .from('ledger-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

export async function uploadEntryPhotos(partyId, entryId, blobs, startIndex = 0) {
  const paths = [];
  for (let i = 0; i < blobs.length; i += 1) {
    // Sequential on purpose — deterministic order matches the photo strip.
    // startIndex lets edits append after kept photos without clobbering them.
    // eslint-disable-next-line no-await-in-loop
    paths.push(await uploadEntryPhoto(partyId, entryId, blobs[i], startIndex + i));
  }
  return paths;
}

export async function setEntryPhotoPath(entryId, photoPath) {
  const { error } = await supabase.from('entries').update({ photo_path: photoPath }).eq('id', entryId);
  if (error) throw error;
}

// Writes the full photo list. Sends both columns: the DB trigger (014) keeps
// single-photo readers in sync, and pre-014 databases get the legacy fallback.
export async function setEntryPhotoPaths(entryId, photoPaths) {
  const paths = (photoPaths || []).filter(Boolean);
  const payload = { photo_path: paths[0] || null, photo_paths: paths };
  let { error } = await supabase.from('entries').update(payload).eq('id', entryId);
  if (error) {
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('photo_paths') || msg.includes('schema cache')) {
      ({ error } = await supabase.from('entries').update({ photo_path: payload.photo_path }).eq('id', entryId));
    }
  }
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
