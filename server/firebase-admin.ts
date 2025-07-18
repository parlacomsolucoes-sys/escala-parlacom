import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
  process.env;

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  throw new Error("Variáveis FIREBASE_* ausentes");
}

// remove aspas de início/fim se existirem e converte \n
const cleanedKey = FIREBASE_PRIVATE_KEY.replace(/^"(.*)"$/, "$1") // tira aspas externas
  .replace(/\\n/g, "\n"); // \n → quebras reais

const serviceAccount = {
  project_id: FIREBASE_PROJECT_ID,
  client_email: FIREBASE_CLIENT_EMAIL,
  private_key: cleanedKey,
};

const app =
  getApps().length === 0
    ? initializeApp({ credential: cert(serviceAccount as any) })
    : getApps()[0];

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
