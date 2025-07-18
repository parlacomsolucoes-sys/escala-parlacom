import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let app;

if (getApps().length === 0) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID || "parlacom-sistema";

  if (serviceAccountJson) {
    try {
      // Try to parse as JSON first
      const serviceAccount = JSON.parse(serviceAccountJson);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } catch (error) {
      console.warn("Invalid service account JSON, using default credentials:", error.message);
      // Fall back to default credentials
      app = initializeApp({
        projectId,
      });
    }
  } else {
    // For development, use default credentials if service account is not provided
    app = initializeApp({
      projectId,
    });
  }
} else {
  app = getApps()[0];
}

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export default app;
