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

export async function createParty({ name, phone, notes }) {
  const { data, error } = await supabase
    .from('parties')
    .insert({
      name: name.trim(),
      phone: normalizePhone(phone),
      notes: (notes || '').trim(),
    })
    .select()
    .single();
  if (error) throw error; // unique index violation -> surface "This party already exists."
  return data;
}

export async function updateParty({ id, name, phone, notes }) {
  const { data, error } = await supabase
    .from('parties')
    .update({
      name: name.trim(),
      phone: normalizePhone(phone),
      notes: (notes || '').trim(),
    })
    .eq('id', id)
    .select()
    .single();
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
