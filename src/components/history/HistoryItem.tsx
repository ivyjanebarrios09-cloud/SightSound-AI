'use client';
import { useState, useRef } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { textToSpeech } from '@/ai/flows/text-to-speech-generation';
import { updateHistoryEntryAudio } from '@/lib/firebase/firestore';
import type { HistoryEntry } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Play, Repeat, Loader2, MapPin, Mic } from 'lucide-react';

type VoiceOption = 'male' | 'female';

export default function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentAudioUrl, setCurrentAudioUrl] = useState(entry.audioUrl);
  const [currentVoice, setCurrentVoice] = useState<VoiceOption>(entry.voiceUsed);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleVoiceChange = async (newVoice: VoiceOption) => {
    if (newVoice === currentVoice || isRegenerating || !user) return;

    setIsRegenerating(true);
    setCurrentVoice(newVoice);

    try {
      const { audioUrl: newAudioDataUri } = await textToSpeech({
        text: entry.description,
        voice: newVoice,
      });
      
      await updateHistoryEntryAudio(entry.id, newAudioDataUri, newVoice);
      setCurrentAudioUrl(newAudioDataUri);

      toast({ title: 'Audio regenerated!', description: `Switched to ${newVoice} voice.` });
      setTimeout(() => audioRef.current?.play(), 100);
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Failed to regenerate audio',
        description: error.message,
      });
      setCurrentVoice(entry.voiceUsed); // Revert on failure
    } finally {
      setIsRegenerating(false);
    }
  };
  
  const timeAgo = entry.timestamp ? formatDistanceToNow(entry.timestamp.toDate(), { addSuffix: true }) : 'just now';

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="p-0">
        <div className="relative w-full aspect-video">
          <Image src={entry.imageUrl} alt="History item" layout="fill" objectFit="cover" data-ai-hint="history image" />
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-1">
        <p className="text-sm text-muted-foreground mb-2">{timeAgo}</p>
        <p className="font-semibold text-base leading-snug mb-3">{entry.description}</p>
        <div className="flex items-center text-xs text-muted-foreground space-x-2">
            <MapPin className="h-3 w-3" /> <span>{entry.location}</span>
        </div>
        <div className="flex items-center text-xs text-muted-foreground space-x-2 mt-1">
            <Mic className="h-3 w-3" /> <span>{entry.voiceUsed.charAt(0).toUpperCase() + entry.voiceUsed.slice(1)} voice</span>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex flex-col items-start gap-4">
        <div className="w-full">
          <Label className="text-xs font-semibold">Voice</Label>
           <RadioGroup
              value={currentVoice}
              onValueChange={(v) => handleVoiceChange(v as VoiceOption)}
              className="mt-1 grid grid-cols-2 gap-2"
              disabled={isRegenerating}
            >
              <div>
                <RadioGroupItem value="female" id={`female-${entry.id}`} className="peer sr-only" />
                <Label htmlFor={`female-${entry.id}`} className="text-xs h-8 flex items-center justify-center rounded-md border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                  Female
                </Label>
              </div>
              <div>
                <RadioGroupItem value="male" id={`male-${entry.id}`} className="peer sr-only" />
                <Label htmlFor={`male-${entry.id}`} className="text-xs h-8 flex items-center justify-center rounded-md border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                  Male
                </Label>
              </div>
            </RadioGroup>
        </div>
        <div className="w-full flex items-center gap-2">
          <audio ref={audioRef} src={currentAudioUrl} key={currentAudioUrl} />
          <Button onClick={() => audioRef.current?.play()} variant="outline" size="sm" className="flex-1">
            <Play className="h-4 w-4 mr-2" /> Play
          </Button>
          <Button onClick={() => { if(audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }}} variant="outline" size="icon" className="h-9 w-9">
            <Repeat className="h-4 w-4" />
          </Button>
          {isRegenerating && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
      </CardFooter>
    </Card>
  );
}
