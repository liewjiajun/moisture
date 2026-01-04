import { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove,
  onDisconnect,
  serverTimestamp,
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

export interface OnlinePlayer {
  id: string;
  address: string;
  characterSeed: number;
  x: number;
  y: number;
  lastSeen: number;
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

// Convert address to Firebase-safe key
function addressToKey(address: string): string {
  return address.replace(/[.#$[\]]/g, '_');
}

// Generate character seed from address
function generateSeedFromAddress(address: string): number {
  return parseInt(address.slice(2, 18), 16);
}

export function useFirebasePresence(address: string | null) {
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const presenceRef = useRef<any>(null);
  const myPositionRef = useRef({ x: 90, y: 160 }); // Default position

  // Set up presence and subscribe to other players
  useEffect(() => {
    // Demo mode
    if (firebaseConfig.apiKey === 'demo-key') {
      console.log('Firebase presence running in demo mode');
      // Return some demo online players
      setOnlinePlayers([
        {
          id: 'demo1',
          address: '0x1234...abcd',
          characterSeed: 12345,
          x: 50,
          y: 150,
          lastSeen: Date.now(),
        },
        {
          id: 'demo2',
          address: '0x5678...efgh',
          characterSeed: 67890,
          x: 130,
          y: 160,
          lastSeen: Date.now(),
        },
      ]);
      return;
    }

    try {
      const { database } = getFirebase();
      if (!database) return;

      // Subscribe to presence list
      const presenceListRef = ref(database, 'presence');
      const unsubscribe = onValue(presenceListRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const players: OnlinePlayer[] = [];
          const now = Date.now();
          const staleThreshold = 60000; // 1 minute

          Object.entries(data).forEach(([key, value]: [string, any]) => {
            // Skip stale entries
            if (value.lastSeen && now - value.lastSeen > staleThreshold) {
              return;
            }
            // Skip self
            if (address && addressToKey(address) === key) {
              return;
            }
            players.push({
              id: key,
              address: value.address || key,
              characterSeed: value.characterSeed || 0,
              x: value.x || 90,
              y: value.y || 160,
              lastSeen: value.lastSeen || now,
            });
          });

          setOnlinePlayers(players);
        } else {
          setOnlinePlayers([]);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Firebase presence subscription error:', error);
    }
  }, [address]);

  // Set my presence when connected
  useEffect(() => {
    if (!address) return;

    // Demo mode - no presence updates needed
    if (firebaseConfig.apiKey === 'demo-key') return;

    try {
      const { database } = getFirebase();
      if (!database) return;

      const myKey = addressToKey(address);
      presenceRef.current = ref(database, `presence/${myKey}`);

      // Set initial presence
      const seed = generateSeedFromAddress(address);
      const presenceData = {
        address: address,
        characterSeed: seed,
        x: myPositionRef.current.x,
        y: myPositionRef.current.y,
        lastSeen: serverTimestamp(),
      };

      set(presenceRef.current, presenceData);

      // Set up disconnect handler to remove presence
      onDisconnect(presenceRef.current).remove();

      // Update lastSeen periodically
      const interval = setInterval(() => {
        if (presenceRef.current) {
          set(presenceRef.current, {
            ...presenceData,
            x: myPositionRef.current.x,
            y: myPositionRef.current.y,
            lastSeen: serverTimestamp(),
          });
        }
      }, 10000); // Update every 10 seconds

      return () => {
        clearInterval(interval);
        if (presenceRef.current) {
          remove(presenceRef.current);
        }
      };
    } catch (error) {
      console.error('Firebase presence setup error:', error);
    }
  }, [address]);

  // Update my position (called when player moves in Sauna)
  const updatePosition = useCallback((x: number, y: number) => {
    myPositionRef.current = { x, y };
    // Position will be synced on next interval update
  }, []);

  return { onlinePlayers, updatePosition };
}
