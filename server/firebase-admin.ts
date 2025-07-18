import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  throw new Error("Variáveis FIREBASE_* ausentes");
}

// Fix common issues with Firebase private key formatting
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Handle potential JSON escaped newlines and quotes
if (privateKey.includes('\\n')) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

// Remove extra quotes that might be present
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}

// Ensure the key starts and ends with the proper PEM markers
if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
  console.error("[Firebase] ❌ Private key seems malformed - missing PEM headers");
  console.error("[Firebase] Key starts with:", privateKey.substring(0, 50) + "...");
}

const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  private_key: privateKey,
};

console.log("[Firebase] Initializing with project:", process.env.FIREBASE_PROJECT_ID);
console.log("[Firebase] Client email:", process.env.FIREBASE_CLIENT_EMAIL);
console.log("[Firebase] Private key length:", privateKey.length);

const app =
  getApps().length === 0
    ? initializeApp({ credential: cert(serviceAccount as any) })
    : getApps()[0];

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
