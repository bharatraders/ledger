let secret = null;

export function setDeviceSecret(value) {
  secret = value;
}
export function clearDeviceSecret() {
  secret = null;
}
export function getDeviceSecret() {
  return secret;
}
export function hasDeviceSecret() {
  return Boolean(secret);
}
