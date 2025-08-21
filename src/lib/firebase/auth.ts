import {
  auth,
  db
} from './config';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import {
  createUserProfile
} from './firestore';

export const signUpWithEmail = async (email, password, name) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await createUserProfile(userCredential.user, name);
  return userCredential;
};

export const signInWithEmail = async (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Check if user profile already exists
  const userRef = doc(db, 'users', user.uid);
  const docSnap = await getDoc(userRef);

  if (!docSnap.exists()) {
    // Create profile if it doesn't exist
    const displayName = user.displayName?.split(' ') || [];
    const firstName = displayName[0] || '';
    const lastName = displayName[displayName.length - 1] || '';
    await createUserProfile(user, { firstName, lastName });
  }

  return result;
};


export const signOutUser = async () => {
  await signOut(auth);
};
