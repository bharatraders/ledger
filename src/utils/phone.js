// Phone handling for the party WhatsApp field.
//
// The app targets Indian numbers: ShareSheet.jsx prefixes '91' whenever the stored
// value is exactly 10 digits (wa.me needs the country code), so we always store a bare
// 10-digit number and quietly strip any +91 / 91 / 0 the user types. Keeping storage
// canonical is what makes that length check in ShareSheet reliable.

// The template shown to the user (placeholder + helper text) and the shape of the mask.
export const PHONE_TEMPLATE = '98765 43210';

// Digits only, with a country/trunk prefix dropped when the user pastes more than a
// full number, capped at 10 digits so the input can never hold a partial extra digit.
export function normalizePhone(value) {
  let d = String(value == null ? '' : value).replace(/\D/g, '');
  if (d.length > 10) {
    if (d.startsWith('91')) d = d.slice(2); // +91 98765 43210 / 919876543210
    else if (d.startsWith('0')) d = d.slice(1); // 098765 43210
  }
  return d.slice(0, 10);
}

// Input-mask / display template: 98765 43210 (5 + 5), the usual way Indian mobiles are
// written. Applied while typing and to the number shown on the party screen.
export function formatPhone(value) {
  const d = normalizePhone(value);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}

// '' when the value is acceptable. The field is optional, so empty is valid; anything
// typed has to be a complete Indian mobile number.
export function phoneError(value) {
  const d = normalizePhone(value);
  if (!d) return '';
  if (d.length !== 10) return `Enter all 10 digits, like ${PHONE_TEMPLATE}.`;
  if (!/^[6-9]/.test(d)) return 'A mobile number starts with 6, 7, 8 or 9.';
  return '';
}
