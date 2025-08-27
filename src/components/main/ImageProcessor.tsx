'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getFormattedLocation } from '@/utils/location';
import { addHistoryEntry, updateUserPreferences } from '@/lib/firebase/firestore';
import { generateImageDescription } from '@/ai/flows/generate-image-description';
import { textToSpeech } from '@/ai/flows/text-to-speech-generation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Camera, Volume2, Play, Repeat, RefreshCcw, Video, VideoOff } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';

type VoiceOption = 'male' | 'female';
type Status = 
  | 'idle'
  | 'capturing'
  | 'locating' 
  | 'generatingDescription'
  | 'generatingAudio'
  | 'saving'
  | 'success' 
  | 'error';

type FacingMode = 'user' | 'environment';

const statusMessages: Record<Status, string> = {
  idle: '',
  capturing: 'Scanning scene...',
  locating: 'Getting location...',
  generatingDescription: 'Generating description...',
  generatingAudio: 'Generating audio...',
  saving: 'Saving result...',
  success: 'Done!',
  error: 'An error occurred.',
};

export default function ImageProcessor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [description, setDescription] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [status, setStatus] = useState<Status>('idle');
  const [voice, setVoice] = useState<VoiceOption>('female');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [facingMode, setFacingMode] = useState<FacingMode>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);


  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if(videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, []);

  const startCameraStream = useCallback(async (mode: FacingMode) => {
    stopCameraStream(); // Stop any existing stream
    if (!isCameraOn) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: mode } 
      });
      setHasCameraPermission(true);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      setIsCameraOn(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings.',
      });
    }
  }, [isCameraOn, stopCameraStream, toast]);

  useEffect(() => {
    if (user?.preferences?.voice) {
      setVoice(user.preferences.voice);
    }
    fetchLocation();

    return () => {
      stopCameraStream();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    if (isCameraOn) {
      startCameraStream(facingMode);
    } else {
      stopCameraStream();
    }
  }, [isCameraOn, facingMode, startCameraStream, stopCameraStream]);

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

  const handleSubmit = async () => {
    if (!imagePreview || !user) return;

    try {
      setStatus('generatingDescription');
      const { description: generatedDesc } = await generateImageDescription({ photoDataUri: imagePreview });
      setDescription(generatedDesc);

      setStatus('generatingAudio');
      const { audioUrl: generatedAudioDataUri } = await textToSpeech({ text: generatedDesc, voice });
      setAudioUrl(generatedAudioDataUri);

      setStatus('saving');
      await addHistoryEntry(user.uid, {
        imageUrl: imagePreview,
        description: generatedDesc,
        audioUrl: generatedAudioDataUri,
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
    setImagePreview(null);
    setDescription('');
    setAudioUrl('');
    setStatus('idle');
  }

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }

  const isProcessing = [
    'generatingDescription',
    'generatingAudio',
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
            <CardTitle>1. Scan a Scene</CardTitle>
            <CardDescription>Use your camera to scan the scene.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <canvas ref={canvasRef} className="hidden" />
            <div className="relative w-full max-w-md aspect-video rounded-lg overflow-hidden border bg-muted">
              {imagePreview ? (
                <Image src={imagePreview} alt="Selected preview" layout="fill" objectFit="contain" />
              ) : (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  {!isCameraOn && hasCameraPermission !== false && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-background/80">
                        <VideoOff className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Camera is off</p>
                    </div>
                  )}
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
             <div className="flex items-center justify-center gap-4">
                <div className="flex items-center space-x-2">
                    <Switch id="camera-toggle" checked={isCameraOn} onCheckedChange={setIsCameraOn} disabled={hasCameraPermission === false}/>
                    <Label htmlFor="camera-toggle">{isCameraOn ? 'Cam On' : 'Cam Off'}</Label>
                </div>
                <Button onClick={toggleFacingMode} variant="outline" size="icon" disabled={!isCameraOn || !!imagePreview}>
                    <RefreshCcw className="h-4 w-4" />
                    <span className="sr-only">Switch Camera</span>
                </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleCapture} disabled={!hasCameraPermission || !isCameraOn || !!imagePreview} className="w-full">
                <Camera className="mr-2 h-4 w-4" />
                Scan Scene
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
            <Button onClick={handleSubmit} disabled={!imagePreview || isLoading} size="lg">
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
