// server/firebase-admin.ts
import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const required = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error("[firebase-admin] Variáveis ausentes: " + missing.join(", "));
}

// --- Normalização da PRIVATE KEY ---
let rawKey = process.env.FIREBASE_PRIVATE_KEY!;

// Se vier com aspas (ex: replit colou com "...")
if (
  (rawKey.startsWith('"') && rawKey.endsWith('"')) ||
  (rawKey.startsWith("'") && rawKey.endsWith("'"))
) {
  rawKey = rawKey.slice(1, -1);
}

// Troca \\n (literais) por quebras reais
rawKey = rawKey.replace(/\\n/g, "\n").trim();

// Opcional: avisar se parece incorreta
if (
  !rawKey.includes("BEGIN PRIVATE KEY") ||
  !rawKey.includes("END PRIVATE KEY")
) {
  console.warn(
    "[firebase-admin] ⚠️ A chave privada não contém os marcadores PEM esperados.",
  );
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: rawKey,
};

const app =
  getApps().length === 0
    ? initializeApp({ credential: cert(serviceAccount as any) })
    : getApps()[0];

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
