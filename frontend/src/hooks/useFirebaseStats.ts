import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  update,
  increment,
  Database,
  serverTimestamp,
} from 'firebase/database';

// Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://demo.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000',
};

export interface PlayerStats {
  gamesPlayed: number;
  bestTime: number;  // in milliseconds
  totalSpent: number;  // in SUI (0.1 per game)
  lastPlayed: number;
}

const DEFAULT_STATS: PlayerStats = {
  gamesPlayed: 0,
  bestTime: 0,
  totalSpent: 0,
  lastPlayed: 0,
};

let app: FirebaseApp | null = null;
let database: Database | null = null;

function getFirebase() {
  if (!app) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    database = getDatabase(app);
  }
  return { app, database };
}

// Convert address to Firebase-safe key
function addressToKey(address: string): string {
  return address.replace(/[.#$[\]]/g, '_');
}

export function useFirebaseStats(address: string | null) {
  const [stats, setStats] = useState<PlayerStats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setStats(DEFAULT_STATS);
      setIsLoading(false);
      return;
    }

    // Demo mode
    if (firebaseConfig.apiKey === 'demo-key') {
      console.log('Firebase stats running in demo mode');
      setStats({
        gamesPlayed: 5,
        bestTime: 45000,
        totalSpent: 0.5,
        lastPlayed: Date.now() - 3600000,
      });
      setIsLoading(false);
      return;
    }

    try {
      const { database } = getFirebase();
      if (!database) return;

      const statsRef = ref(database, `stats/${addressToKey(address)}`);

      const unsubscribe = onValue(statsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setStats({
            gamesPlayed: data.gamesPlayed || 0,
            bestTime: data.bestTime || 0,
            totalSpent: data.totalSpent || 0,
            lastPlayed: data.lastPlayed || 0,
          });
        } else {
          setStats(DEFAULT_STATS);
        }
        setIsLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Firebase stats error:', error);
      setIsLoading(false);
    }
  }, [address]);

  // Increment games played and total spent when starting a game
  const recordGameStart = useCallback(async () => {
    if (!address) return;

    // Demo mode
    if (firebaseConfig.apiKey === 'demo-key') {
      setStats((prev) => ({
        ...prev,
        gamesPlayed: prev.gamesPlayed + 1,
        totalSpent: prev.totalSpent + 0.1,
        lastPlayed: Date.now(),
      }));
      return;
    }

    try {
      const { database } = getFirebase();
      if (!database) return;

      const statsRef = ref(database, `stats/${addressToKey(address)}`);
      await update(statsRef, {
        gamesPlayed: increment(1),
        totalSpent: increment(0.1),
        lastPlayed: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to record game start:', error);
    }
  }, [address]);

  // Update best time if new time is better
  const recordGameEnd = useCallback(async (survivalTime: number) => {
    if (!address) return;

    // Demo mode
    if (firebaseConfig.apiKey === 'demo-key') {
      setStats((prev) => ({
        ...prev,
        bestTime: Math.max(prev.bestTime, survivalTime),
      }));
      return;
    }

    // Only update if it's a new best time
    if (survivalTime <= stats.bestTime) return;

    try {
      const { database } = getFirebase();
      if (!database) return;

      const statsRef = ref(database, `stats/${addressToKey(address)}`);
      await update(statsRef, {
        bestTime: survivalTime,
      });
    } catch (error) {
      console.error('Failed to update best time:', error);
    }
  }, [address, stats.bestTime]);

  return { stats, recordGameStart, recordGameEnd, isLoading };
}
