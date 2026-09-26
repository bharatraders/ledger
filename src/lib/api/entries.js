import { supabase } from '../supabaseClient';

export async function fetchEntries(partyId, { includeDeleted = false } = {}) {
  let q = supabase.from('entries').select('*').eq('party_id', partyId).order('entry_date');
  if (!includeDeleted) q = q.is('deleted_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createEntry({ partyId, type, amount, entryDate, remark, photoPath }) {
  const { data, error } = await supabase
    .from('entries')
    .insert({
      party_id: partyId,
      type,
      amount,
      entry_date: entryDate,
      remark: remark || '',
      photo_path: photoPath || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
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
