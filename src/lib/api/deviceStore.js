import { get, set, del } from 'idb-keyval';

const DEVICE_KEY = 'party-ledger-device';

export async function readDevice() {
  return (await get(DEVICE_KEY)) ?? null; // { deviceId, deviceName, deviceSecret }
}
export async function writeDevice(device) {
  await set(DEVICE_KEY, device);
}
export async function clearDevice() {
  await del(DEVICE_KEY);
}
