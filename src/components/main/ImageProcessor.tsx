'use client';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getFormattedLocation } from '@/utils/location';
import { uploadImage, uploadAudio } from '@/lib/firebase/storage';
import { addHistoryEntry, updateUserPreferences } from '@/lib/firebase/firestore';
import { generateImageDescription } from '@/ai/flows/generate-image-description';
import { textToSpeech } from '@/ai/flows/text-to-speech-generation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Camera, Volume2, Play, Repeat, RefreshCcw } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type VoiceOption = 'male' | 'female';
type Status = 
  | 'idle'
  | 'capturing'
  | 'locating' 
  | 'uploadingImage' 
  | 'generatingDescription'
  | 'generatingAudio'
  | 'uploadingAudio'
  | 'saving'
  | 'success' 
  | 'error';

const statusMessages: Record<Status, string> = {
  idle: '',
  capturing: 'Capturing photo...',
  locating: 'Getting location...',
  uploadingImage: 'Uploading image...',
  generatingDescription: 'Generating description...',
  generatingAudio: 'Generating audio...',
  uploadingAudio: 'Uploading audio...',
  saving: 'Saving result...',
  success: 'Done!',
  error: 'An error occurred.',
};

export default function ImageProcessor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [description, setDescription] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [status, setStatus] = useState<Status>('idle');
  const [voice, setVoice] = useState<VoiceOption>('female');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (user?.preferences?.voice) {
      setVoice(user.preferences.voice);
    }

    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        fetchLocation();
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
      }
    };
    getCameraPermission();

    return () => {
      // Cleanup: stop camera stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

  const handleVoiceChange = (newVoice: VoiceOption) => {
    setVoice(newVoice);
    if(user) {
      updateUserPreferences(user.uid, { ...user.preferences, voice: newVoice });
    }
  }

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setStatus('capturing');
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      const dataUri = canvas.toDataURL('image/jpeg');
      setImagePreview(dataUri);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
          setImageFile(file);
        }
      }, 'image/jpeg');
    }
    setStatus('idle');
  }

  const fetchLocation = () => {
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const formattedLocation = await getFormattedLocation(latitude, longitude);
        setLocation(formattedLocation);
        setStatus('idle');
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocation('Could not determine location');
        toast({
          variant: 'destructive',
          title: 'Location Error',
          description: 'Could not access your location. Please ensure location services are enabled.',
        });
        setStatus('idle');
      }
    );
  };
  
  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handleSubmit = async () => {
    if (!imageFile || !user) return;

    try {
      setStatus('uploadingImage');
      const imageUrl = await uploadImage(imageFile, user.uid);

      setStatus('generatingDescription');
      const photoDataUri = await fileToDataUri(imageFile);
      const { description: generatedDesc } = await generateImageDescription({ photoDataUri });
      setDescription(generatedDesc);

      setStatus('generatingAudio');
      const { audioUrl: generatedAudioDataUri } = await textToSpeech({ text: generatedDesc, voice });
      
      setStatus('uploadingAudio');
      const finalAudioUrl = await uploadAudio(generatedAudioDataUri, user.uid);
      setAudioUrl(finalAudioUrl);

      setStatus('saving');
      await addHistoryEntry(user.uid, {
        imageUrl,
        description: generatedDesc,
        audioUrl: finalAudioUrl,
        location: location || 'Location not available',
        voiceUsed: voice,
      });

      setStatus('success');
      toast({ title: 'Success!', description: 'Your audio description is ready.' });
      
      setTimeout(() => audioRef.current?.play(), 100);

    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || `An error occurred during: ${statusMessages[status]}`;
      setStatus('error');
      toast({
        variant: 'destructive',
        title: 'An error occurred',
        description: errorMessage,
      });
    }
  };
  
  const resetState = () => {
    setImageFile(null);
    setImagePreview(null);
    setDescription('');
    setAudioUrl('');
    setStatus('idle');
  }

  const isProcessing = [
    'uploadingImage',
    'generatingDescription',
    'generatingAudio',
    'uploadingAudio',
    'saving',
  ].includes(status);
  
  const isLoading = status === 'locating' || isProcessing || status === 'capturing';
  const showResult = isProcessing || status === 'success' || status === 'error';
  const buttonText = isProcessing ? statusMessages[status] : '3. Generate Description';


  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>1. Capture a Photo</CardTitle>
            <CardDescription>Use your camera to take a picture.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <canvas ref={canvasRef} className="hidden" />
            <div className="relative w-full max-w-md aspect-video rounded-lg overflow-hidden border bg-muted">
              {imagePreview ? (
                <Image src={imagePreview} alt="Selected preview" layout="fill" objectFit="contain" />
              ) : (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  {hasCameraPermission === false && (
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      <Alert variant="destructive">
                        <Camera className="h-4 w-4" />
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                          Please allow camera access in your browser settings to use this feature.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                  {hasCameraPermission === null && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {location && <p className="mt-4 text-sm text-muted-foreground">Location: {location}</p>}
            {status === 'locating' && <p className="mt-2 text-sm text-primary flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> {statusMessages[status]}</p>}
            
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-4">
            <div className="flex items-center gap-2">
              <Button onClick={handleCapture} disabled={!hasCameraPermission || !!imagePreview} className="w-full">
                <Camera className="mr-2 h-4 w-4" />
                Capture Photo
              </Button>
              {imagePreview && (
                <Button onClick={resetState} variant="outline" size="icon">
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
             <div>
              <Label className="font-semibold">2. Choose a Voice</Label>
              <RadioGroup value={voice} onValueChange={(v) => handleVoiceChange(v as VoiceOption)} className="mt-2 grid grid-cols-2 gap-4">
                  <div>
                    <RadioGroupItem value="female" id="female" className="peer sr-only" />
                    <Label htmlFor="female" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                      Female
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="male" id="male" className="peer sr-only" />
                    <Label htmlFor="male" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                      Male
                    </Label>
                  </div>
              </RadioGroup>
            </div>
            <Button onClick={handleSubmit} disabled={!imageFile || isLoading} size="lg">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {buttonText}
                </>
              ) : (
                '3. Generate Description'
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card className={`transition-opacity duration-500 ${showResult ? 'opacity-100' : 'opacity-0'}`}>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>Here is the AI-generated description and audio for your image.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="description">Generated Description</Label>
              {isProcessing && !description && (
                <div className="mt-2 space-y-2">
                   <div className="h-4 w-full animate-pulse rounded-md bg-muted"></div>
                   <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted"></div>
                </div>
              )}
              <Textarea
                id="description"
                readOnly
                value={description}
                placeholder="Description will appear here..."
                className="mt-2 min-h-[120px]"
              />
            </div>
             <div>
              <Label>Generated Audio</Label>
              {isProcessing && !audioUrl && (
                  <div className="mt-2 h-10 w-full animate-pulse rounded-md bg-muted"></div>
              )}
              {audioUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <audio ref={audioRef} src={audioUrl} />
                  <Button onClick={() => audioRef.current?.play()} variant="outline" size="icon">
                    <Play className="h-4 w-4" />
                  </Button>
                   <Button onClick={() => { if(audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }}} variant="outline" size="icon">
                    <Repeat className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
