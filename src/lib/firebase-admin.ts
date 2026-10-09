import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  const projectId =
    (typeof process !== "undefined" &&
      (process.env["VITE_FIREBASE_PROJECT_ID"] || process.env["FIREBASE_PROJECT_ID"])) ||
    "mock-project";
  try {
    initializeApp({
      projectId,
    });
  } catch (err) {
    console.warn("[Firebase Admin] Initialization skipped or mocked:", err);
  }
}

export const adminAuth = getApps().length
  ? getAuth()
  : ({
      verifyIdToken: async () => ({ uid: "mock-user" }),
    } as unknown as ReturnType<typeof getAuth>);
