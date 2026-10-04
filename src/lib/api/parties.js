import { supabase } from '../supabaseClient';
import { normalizePhone } from '../../utils/phone';

export async function fetchActiveParties() {
  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .is('deleted_at', null)
    .eq('is_archived', false)
    .order('name');
  if (error) throw error;
  return data;
}

export async function fetchArchivedParties() {
  const { data, error } = await supabase
    .from('parties')
    .select('*')
    .is('deleted_at', null)
    .eq('is_archived', true)
    .order('name');
  if (error) throw error;
  return data;
}

export async function fetchParty(id) {
  const { data, error } = await supabase.from('parties').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createParty({ name, phone, notes, address }) {
  const { data, error } = await supabase
    .from('parties')
    .insert({
      name: name.trim(),
      phone: normalizePhone(phone),
      notes: (notes || '').trim(),
      // PostgREST drops unknown keys when the 014 migration has not run yet,
      // but a missing-column error is still possible on old schemas — the
      // caller retries without `address` in that case (see createPartySafe).
      address: (address || '').trim(),
    })
    .select()
    .single();
  if (error) throw error; // unique index violation -> surface "This party already exists."
  return data;
}

// Same as createParty, but tolerates databases where 014 has not run yet:
// if the insert fails because `address` is an unknown column, retry without it.
export async function createPartySafe(args) {
  try {
    return await createParty(args);
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase();
    if (msg.includes('address') && (msg.includes('schema cache') || msg.includes('column') || msg.includes('unknown'))) {
      const { address: _dropped, ...rest } = args;
      return createParty({ ...rest, address: '' });
    }
    throw e;
  }
}

export async function updateParty({ id, name, phone, notes, address }) {
  const base = {
    name: name.trim(),
    phone: normalizePhone(phone),
    notes: (notes || '').trim(),
  };
  const payload = address !== undefined ? { ...base, address: (address || '').trim() } : base;
  let { data, error } = await supabase.from('parties').update(payload).eq('id', id).select().single();
  if (error && address !== undefined) {
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('address') && (msg.includes('schema cache') || msg.includes('column') || msg.includes('unknown'))) {
      ({ data, error } = await supabase.from('parties').update(base).eq('id', id).select().single());
    }
  }
  if (error) throw error; // unique index violation -> surface "This party already exists."
  return data;
}

export async function setArchived(id, archived) {
  const { error } = await supabase.rpc('archive_party', { p_id: id, archived });
  if (error) throw error;
}

export async function softDeleteParty(id) {
  const { error } = await supabase.rpc('soft_delete_party', { p_id: id });
  if (error) throw error;
}

export async function restoreParty(id) {
  const { error } = await supabase.rpc('restore_party', { p_id: id });
  if (error) throw error;
}
