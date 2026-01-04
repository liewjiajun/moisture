import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  push,
  serverTimestamp,
  query,
  limitToLast,
  Database,
} from 'firebase/database';

// Firebase config - replace with your own
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://demo.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000',
};

export interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
}

let app: FirebaseApp | null = null;
let database: Database | null = null;

// Initialize Firebase only once
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

export function useFirebaseChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Skip Firebase in demo mode
    if (firebaseConfig.apiKey === 'demo-key') {
      console.log('Firebase chat running in demo mode');
      // Add some demo messages
      setMessages([
        { sender: '0x1234...abcd', message: 'Welcome to the Sauna!', timestamp: Date.now() - 60000 },
        { sender: '0x5678...efgh', message: 'gl everyone', timestamp: Date.now() - 30000 },
      ]);
      return;
    }

    try {
      const { database } = getFirebase();
      if (!database) return;

      const chatRef = ref(database, 'chat/messages');
      const recentQuery = query(chatRef, limitToLast(50));

      const unsubscribe = onValue(recentQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const messageList: ChatMessage[] = Object.values(data);
          setMessages(messageList.sort((a, b) => a.timestamp - b.timestamp));
        }
        setIsConnected(true);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Firebase connection error:', error);
    }
  }, []);

  const sendMessage = useCallback(async (sender: string, message: string) => {
    if (!message.trim()) return;

    // Demo mode
    if (firebaseConfig.apiKey === 'demo-key') {
      setMessages((prev) => [...prev, { sender, message, timestamp: Date.now() }]);
      return;
    }

    try {
      const { database } = getFirebase();
      if (!database) return;

      const chatRef = ref(database, 'chat/messages');
      await push(chatRef, {
        sender,
        message: message.slice(0, 200), // Limit message length
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, []);

  return { messages, sendMessage, isConnected };
}
