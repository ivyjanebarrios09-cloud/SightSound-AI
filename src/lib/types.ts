import type { Timestamp } from 'firebase/firestore';

export type UserPreferences = {
  theme?: 'light' | 'dark' | 'system';
  voice?: 'male' | 'female';
};

export type HistoryEntry = {
  id: string;
  userId: string;
  imageUrl: string; // This will be a data URI
  description: string;
  audioUrl: string; // This will be a data URI
  location: string;
  timestamp: Timestamp;
  voiceUsed: 'male' | 'female';
};
