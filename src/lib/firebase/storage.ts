import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { storage } from './config';
import { v4 as uuidv4 } from 'uuid';

export const uploadImage = async (file: File, userId: string): Promise<string> => {
  const fileId = uuidv4();
  const storageRef = ref(storage, `images/${userId}/${fileId}_${file.name}`);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
};

export const uploadAudio = async (dataUri: string, userId: string): Promise<string> => {
  const fileId = uuidv4();
  const storageRef = ref(storage, `audio/${userId}/${fileId}.wav`);
  // The AI flow returns a data URI: data:audio/wav;base64,...
  // We need to upload the base64 part.
  const base64String = dataUri.split(',')[1];
  await uploadString(storageRef, base64String, 'base64', { contentType: 'audio/wav' });
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
};
