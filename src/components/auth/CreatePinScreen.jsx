import SignInScreen from './SignInScreen';

// Reached once per browser, straight after DeviceRegistrationScreen redeems a
// registration code. By that point the device is already stored (deviceStore) and its
// secret is attached to requests, so there is no new secret to invent: the PIN is one
// shared value that lives server-side. This step therefore reuses the normal PIN gate
// in "first run" wording, which also confirms the PIN works before the UI opens.
export default function CreatePinScreen() {
  return <SignInScreen firstRun />;
}
