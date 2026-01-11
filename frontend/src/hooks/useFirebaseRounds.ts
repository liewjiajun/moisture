import { useState, useEffect } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  query,
  orderByChild,
  limitToLast,
  Database,
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

export interface RoundWinner {
  rank: number;
  address: string;
  survivalTime: number;
}

export interface PastRound {
  roundId: number;
  endTime: number;
  winners: RoundWinner[];
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

export interface RoundInfo {
  roundId: number;
  endTime: number;
  timeRemaining: number;
  prizePool: number;
}

export function useFirebaseRounds() {
  const [pastRounds, setPastRounds] = useState<PastRound[]>([]);
  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Demo round info with countdown timer
  useEffect(() => {
    // Demo mode
    if (firebaseConfig.apiKey === 'demo-key') {
      console.log('Firebase rounds running in demo mode');

      // Set demo past rounds
      setPastRounds([
        {
          roundId: 3,
          endTime: Date.now() - 3600000,
          winners: [
            { rank: 1, address: '0x1234...abcd', survivalTime: 125000 },
            { rank: 2, address: '0x5678...efgh', survivalTime: 98000 },
            { rank: 3, address: '0x9abc...ijkl', survivalTime: 87000 },
          ],
        },
        {
          roundId: 2,
          endTime: Date.now() - 7200000,
          winners: [
            { rank: 1, address: '0xdef0...mnop', survivalTime: 142000 },
            { rank: 2, address: '0x1111...qrst', survivalTime: 115000 },
            { rank: 3, address: '0x2222...uvwx', survivalTime: 92000 },
          ],
        },
      ]);

      // Set demo current round info (1 hour rounds)
      const ROUND_DURATION = 3600000; // 1 hour in ms
      const roundStartTime = Math.floor(Date.now() / ROUND_DURATION) * ROUND_DURATION;
      const roundEndTime = roundStartTime + ROUND_DURATION;

      const updateRoundInfo = () => {
        const now = Date.now();
        const timeRemaining = Math.max(0, roundEndTime - now);
        setRoundInfo({
          roundId: 4,
          endTime: roundEndTime,
          timeRemaining,
          prizePool: 5200000000, // 5.2 SUI in MIST
        });
      };

      updateRoundInfo();
      const interval = setInterval(updateRoundInfo, 1000);
      setIsLoading(false);

      return () => clearInterval(interval);
    }

    try {
      const { database } = getFirebase();
      if (!database) return;

      // Query last 3 rounds ordered by endTime
      const roundsRef = ref(database, 'rounds');
      const recentRoundsQuery = query(roundsRef, orderByChild('endTime'), limitToLast(3));

      const unsubscribe = onValue(recentRoundsQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const rounds: PastRound[] = Object.entries(data).map(([key, value]: [string, any]) => ({
            roundId: parseInt(key) || value.roundId,
            endTime: value.endTime || 0,
            winners: value.winners || [],
          }));

          // Sort by endTime descending (most recent first)
          rounds.sort((a, b) => b.endTime - a.endTime);

          setPastRounds(rounds);
        }
        setIsLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Firebase rounds error:', error);
      setIsLoading(false);
    }
  }, []);

  return { pastRounds, roundInfo, isLoading };
}
