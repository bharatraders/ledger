import { supabase } from '../supabaseClient';

// entryPhotos(entry) is the single helper every component should use to read an
// entry's photos. photo_paths (014) is the source of truth; photo_path (legacy
// single-photo column, kept in sync by the DB trigger) is the fallback for rows
// written before 014 ran.
export function entryPhotos(entry) {
  if (!entry) return [];
  const arr = Array.isArray(entry.photo_paths) ? entry.photo_paths.filter(Boolean) : [];
  if (arr.length) return arr;
  return entry.photo_path ? [entry.photo_path] : [];
}

export async function fetchEntries(partyId, { includeDeleted = false } = {}) {
  let q = supabase.from('entries').select('*').eq('party_id', partyId).order('entry_date');
  if (!includeDeleted) q = q.is('deleted_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createEntry({ partyId, type, amount, entryDate, remark, photoPath, photoPaths, isOpening }) {
  const payload = {
    party_id: partyId,
    type,
    amount,
    entry_date: entryDate,
    remark: remark || '',
    photo_path: photoPath || (Array.isArray(photoPaths) && photoPaths[0]) || null,
  };
  // Only send the 014 columns when they carry a value — on databases where 014
  // has not run yet PostgREST may reject unknown keys, so plain old creates
  // must keep working.
  if (Array.isArray(photoPaths) && photoPaths.length) payload.photo_paths = photoPaths;
  if (isOpening) payload.is_opening = true;
  let res = await supabase.from('entries').insert(payload).select().single();
  if (res.error && (payload.photo_paths || payload.is_opening)) {
    const msg = String(res.error?.message || '').toLowerCase();
    if (msg.includes('photo_paths') || msg.includes('is_opening') || msg.includes('schema cache')) {
      const { photo_paths: _pp, is_opening: _op, ...legacy } = payload;
      res = await supabase.from('entries').insert(legacy).select().single();
    }
  }
  if (res.error) throw res.error;
  return res.data;
}

// Edits the fields a mistake usually lands in. Photo changes go through
// setEntryPhotoPath() in storage.js, which already owns entries.photo_path.
export async function updateEntry({ id, type, amount, entryDate, remark }) {
  const { data, error } = await supabase
    .from('entries')
    .update({ type, amount, entry_date: entryDate, remark: remark || '' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function softDeleteEntry(id) {
  const { error } = await supabase.rpc('soft_delete_entry', { e_id: id });
  if (error) throw error;
}

export async function restoreEntry(id) {
  const { error } = await supabase.rpc('restore_entry', { e_id: id });
  if (error) throw error;
}
