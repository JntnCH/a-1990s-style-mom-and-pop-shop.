import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey:
    (typeof process !== "undefined" && process.env?.["VITE_FIREBASE_API_KEY"]) || "mock-api-key",
  authDomain:
    (typeof process !== "undefined" && process.env?.["VITE_FIREBASE_AUTH_DOMAIN"]) ||
    "mock-project.firebaseapp.com",
  projectId:
    (typeof process !== "undefined" && process.env?.["VITE_FIREBASE_PROJECT_ID"]) || "mock-project",
  appId:
    (typeof process !== "undefined" && process.env?.["VITE_FIREBASE_APP_ID"]) ||
    "1:123456789:web:abcdef",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
