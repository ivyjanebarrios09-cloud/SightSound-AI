import { db } from './config';
import { doc, setDoc, updateDoc, collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import type { UserPreferences, HistoryEntry } from '@/lib/types';

export const createUserProfile = async (user: User, name?: { firstName?: string, lastName?: string }) => {
  const userRef = doc(db, 'users', user.uid);
  const userProfile = {
    userId: user.uid,
    email: user.email,
    firstName: name?.firstName || '',
    lastName: name?.lastName || '',
    createdAt: serverTimestamp(),
    preferences: {
      theme: 'system',
      voice: 'female',
    },
  };
  await setDoc(userRef, userProfile, { merge: true });
};

export const updateUserPreferences = async (userId: string, preferences: Partial<UserPreferences>) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    preferences: preferences,
  });
};

export const addHistoryEntry = async (
  userId: string,
  entryData: Omit<HistoryEntry, 'id' | 'userId' | 'timestamp'> & { timestamp?: Timestamp }
) => {
  const historyCollectionRef = collection(db, 'history');
  await addDoc(historyCollectionRef, {
    ...entryData,
    userId,
    timestamp: serverTimestamp(),
  });
};

export const getUserHistory = async (userId: string): Promise<HistoryEntry[]> => {
  const historyCollectionRef = collection(db, 'history');
  const q = query(historyCollectionRef, where('userId', '==', userId), orderBy('timestamp', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoryEntry));
};

export const updateHistoryEntryAudio = async (historyId: string, audioUrl: string, voiceUsed: 'male' | 'female') => {
  const historyDocRef = doc(db, 'history', historyId);
  await updateDoc(historyDocRef, {
    audioUrl,
    voiceUsed,
  });
};
