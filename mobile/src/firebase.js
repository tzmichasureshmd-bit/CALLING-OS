import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";

// Same Firebase project as web dashboard
const firebaseConfig = {
  apiKey:            "AIzaSyDCLRXATmV6FPQT_9OVpSYAd_tznGpOFlQ",
  authDomain:        "calling-os-da2d7.firebaseapp.com",
  projectId:         "calling-os-da2d7",
  storageBucket:     "calling-os-da2d7.firebasestorage.app",
  messagingSenderId: "94196761149",
  appId:             "1:94196761149:web:c13db2c6bf81033f42e054",
};

// Prevent duplicate app init on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

/**
 * Send OTP to phone number via Firebase Phone Auth.
 * buttonId = nativeID of the invisible recaptcha container element.
 * Returns a ConfirmationResult — call .confirm(otp) to verify.
 */
export async function sendOtp(phoneNumber, buttonId) {
  try {
    // Clear any existing verifier
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
      size: "invisible",
      callback: () => {},
    });
    const confirmation = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
    return confirmation;
  } catch (e) {
    // Clean up on error
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
    throw e;
  }
}
