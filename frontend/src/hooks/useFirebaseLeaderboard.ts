import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  push,
  set,
  query,
  orderByChild,
  limitToLast,
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

export interface LeaderboardEntry {
  rank?: number;
  address: string;
  survivalTime: number;
  score: number;
  timestamp: number;
  roundId: number;
}

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

export function useFirebaseLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Demo mode
    if (firebaseConfig.apiKey === 'demo-key') {
      console.log('Firebase leaderboard running in demo mode');
      setLeaderboard([
        { rank: 1, address: '0x1234...abcd', survivalTime: 120000, score: 12000, timestamp: Date.now(), roundId: 1 },
        { rank: 2, address: '0x5678...efgh', survivalTime: 95000, score: 9500, timestamp: Date.now(), roundId: 1 },
        { rank: 3, address: '0x9abc...ijkl', survivalTime: 82000, score: 8200, timestamp: Date.now(), roundId: 1 },
        { rank: 4, address: '0xdef0...mnop', survivalTime: 67000, score: 6700, timestamp: Date.now(), roundId: 1 },
        { rank: 5, address: '0x1111...qrst', survivalTime: 54000, score: 5400, timestamp: Date.now(), roundId: 1 },
      ]);
      return;
    }

    try {
      const { database } = getFirebase();
      if (!database) return;

      // Query top 10 scores ordered by survivalTime (descending)
      const leaderboardRef = ref(database, 'leaderboard/scores');
      const topScoresQuery = query(leaderboardRef, orderByChild('survivalTime'), limitToLast(10));

      const unsubscribe = onValue(topScoresQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          // Convert to array and sort by survivalTime descending
          const entries: LeaderboardEntry[] = Object.values(data);
          entries.sort((a, b) => b.survivalTime - a.survivalTime);

          // Add ranks
          entries.forEach((entry, index) => {
            entry.rank = index + 1;
          });

          setLeaderboard(entries);
        }
        setIsConnected(true);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Firebase leaderboard error:', error);
    }
  }, []);

  const submitScore = useCallback(async (
    address: string,
    survivalTime: number,
    score: number,
    roundId: number
  ) => {
    // Demo mode - just add to local state
    if (firebaseConfig.apiKey === 'demo-key') {
      setLeaderboard((prev) => {
        const newEntry: LeaderboardEntry = {
          address,
          survivalTime,
          score,
          timestamp: Date.now(),
          roundId,
        };

        // Add to list and re-sort
        const updated = [...prev, newEntry];
        updated.sort((a, b) => b.survivalTime - a.survivalTime);

        // Keep top 10 and add ranks
        const top10 = updated.slice(0, 10);
        top10.forEach((entry, index) => {
          entry.rank = index + 1;
        });

        return top10;
      });
      return;
    }

    try {
      const { database } = getFirebase();
      if (!database) return;

      const leaderboardRef = ref(database, 'leaderboard/scores');
      const newScoreRef = push(leaderboardRef);

      await set(newScoreRef, {
        address,
        survivalTime,
        score,
        roundId,
        timestamp: serverTimestamp(),
      });

      console.log('Score submitted to leaderboard');
    } catch (error) {
      console.error('Failed to submit score:', error);
    }
  }, []);

  // Get player's best score
  const getPlayerBest = useCallback((address: string): LeaderboardEntry | undefined => {
    return leaderboard.find(entry =>
      entry.address.toLowerCase() === address.toLowerCase()
    );
  }, [leaderboard]);

  return { leaderboard, submitScore, getPlayerBest, isConnected };
}
