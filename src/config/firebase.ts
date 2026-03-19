import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

function getExtra() {
  const primary = Constants.expoConfig?.extra;
  if (primary?.FIREBASE_API_KEY) return primary;
  const ota = (Updates as any).manifest?.extra?.expoClient?.extra;
  if (ota?.FIREBASE_API_KEY) return ota;
  return primary ?? {};
}

const extra = getExtra();
const firebaseConfig = {
  apiKey: extra?.FIREBASE_API_KEY,
  authDomain: extra?.FIREBASE_AUTH_DOMAIN,
  projectId: extra?.FIREBASE_PROJECT_ID,
  storageBucket: extra?.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: extra?.FIREBASE_MESSAGING_SENDER_ID,
  appId: extra?.FIREBASE_APP_ID,
  measurementId: extra?.FIREBASE_MEASUREMENT_ID
};
const app = initializeApp(firebaseConfig);

const persistence = Platform.OS === 'web'
  ? browserLocalPersistence
  : getReactNativePersistence(AsyncStorage);

export const auth = initializeAuth(app, {
  persistence
});
export const firestore = getFirestore(app);
export default app;
