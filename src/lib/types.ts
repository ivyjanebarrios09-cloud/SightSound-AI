import type { Timestamp } from 'firebase/firestore';

export type UserPreferences = {
  theme?: 'light' | 'dark' | 'system';
  voice?: 'male' | 'female';
};

export type HistoryEntry = {
  id: string;
  userId: string;
  imageUrl: string;
  description: string;
  audioUrl: string;
  location: string;
  timestamp: Timestamp;
  voiceUsed: 'male' | 'female';
};
