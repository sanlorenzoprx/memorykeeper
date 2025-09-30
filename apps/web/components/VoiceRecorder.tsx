'use client';
import React, { useRef, useState, useCallback } from 'react';
import { apiPost } from '@/lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Mic, StopCircle, Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';

interface VoiceRecorderProps {
  photoId: string;
  onTranscriptionComplete?: (transcription: string) => void;
  existingTranscription?: string;
  existingAudioUrl?: string;
  compact?: boolean;
}

export default function VoiceRecorder({
  photoId,
  onTranscriptionComplete,
  existingTranscription,
  existingAudioUrl,
  compact = false
}: VoiceRecorderProps) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState(existingTranscription || '');
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Recording timer
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Keyboard navigation for accessibility
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isRecording) {
        stopRecording();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, stopRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    try {
      setRecordingDuration(0);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: recorder.mimeType });
        setAudioBlob(audioBlob);

        // Create audio URL for playback
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(audioUrl);

        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not start recording. Please ensure microphone permissions are granted.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const playRecording = useCallback(() => {
    if (recordedAudioUrl && audioPlaybackRef.current) {
      const audio = audioPlaybackRef.current;
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().catch(error => {
          console.error('Audio playback failed:', error);
          alert('Audio playback failed. Please try again.');
        });
        setIsPlaying(true);
      }
    }
  }, [recordedAudioUrl, isPlaying]);

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleUploadAndTranscribe = async () => {
    if (!audioBlob) return;
    setIsProcessing(true);

    try {
      const token = await getToken();
      const filename = `voice-caption-${photoId}-${Date.now()}.webm`;

      // 1. Get a presigned URL
      const { uploadUrl, key } = await apiPost('/api/audio/uploads', { filename }, token);

      // 2. Check if we're in development mode with mock URLs
      if (uploadUrl.startsWith('dev-mode://')) {
        console.log('Development mode: Simulating audio upload');

        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Skip actual upload and proceed to transcription
        console.log('Mock upload completed, simulating transcription...');

        // Simulate transcription result
        const mockTranscription = "This is a mock transcription of the voice recording for development purposes.";
        setTranscription(mockTranscription);

        if (onTranscriptionComplete) {
          onTranscriptionComplete(mockTranscription);
        }
      } else {
      // 2. Upload the file to R2
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
          headers: { 'Content-Type': audioBlob.type },
        body: audioBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload audio to R2.');
      }

      // 3. Notify backend to start transcription
      await apiPost(`/api/photos/${photoId}/transcribe`, { r2Key: key }, token);

        // In a real implementation, we'd wait for the transcription to complete
        // For now, we'll simulate it
        setTranscription("Transcription processing... This will be updated when the AI processes your audio.");

        if (onTranscriptionComplete) {
          onTranscriptionComplete("Transcription processing...");
        }
      }

      // 4. Trigger gamification
      try {
      await apiPost('/api/gamification/actions/caption', {}, token);
      } catch (gamificationError) {
        console.warn('Gamification update failed:', gamificationError);
      }

      alert('Voice caption uploaded! Transcription will be available shortly.');
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    } catch (error) {
      console.error(error);
      alert(`Processing failed: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setRecordedAudioUrl(null);
    setTranscription('');
    setRecordingDuration(0);
    setIsPlaying(false);

    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
      audioPlaybackRef.current.currentTime = 0;
    }
  };

  if (compact) {
  return (
      <div className="flex items-center gap-2">
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        variant={isRecording ? 'destructive' : 'default'}
        size="sm"
      >
          {isRecording ? <StopCircle className="h-4 w-4"/> : <Mic className="h-4 w-4"/>}
        </Button>

        {isRecording && (
          <span className="text-sm text-muted-foreground">
            {formatDuration(recordingDuration)}
          </span>
        )}

        {isProcessing && <span className="text-sm text-blue-600">Processing...</span>}
      </div>
    );
  }

  return (
    <Card className="w-full" role="region" aria-label="Voice caption recorder">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" aria-hidden="true" />
          Voice Caption
        </CardTitle>
        <CardDescription>
          Record a voice description for this photo. Your recording will be transcribed automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording Interface */}
        <div className="flex items-center justify-center gap-4 p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg">
          {!audioBlob ? (
            <div className="text-center">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                variant={isRecording ? 'destructive' : 'default'}
                size="lg"
                aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
                aria-pressed={isRecording}
              >
                {isRecording ? <StopCircle className="mr-2 h-5 w-5" aria-hidden="true"/> : <Mic className="mr-2 h-5 w-5" aria-hidden="true"/>}
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </Button>

              {isRecording && (
                <div className="mt-4" role="status" aria-live="polite">
                  <div className="flex items-center justify-center gap-2 text-lg font-mono">
                    <div className="animate-pulse w-2 h-2 bg-red-500 rounded-full" aria-hidden="true" />
                    <span className="text-red-600" aria-label={`Recording duration: ${formatDuration(recordingDuration)}`}>
                      {formatDuration(recordingDuration)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Recording...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-4">
              {/* Playback Controls */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  onClick={playRecording}
                  variant="outline"
                  size="sm"
                  aria-label={isPlaying ? 'Pause audio playback' : 'Play recorded audio'}
                  aria-pressed={isPlaying}
                >
                  {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true"/> : <Play className="h-4 w-4" aria-hidden="true"/>}
                </Button>

                <Button
                  onClick={resetRecording}
                  variant="outline"
                  size="sm"
                  aria-label="Reset and delete recording"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true"/>
                </Button>
              </div>

              {/* Hidden audio element for playback */}
              <audio
                ref={audioPlaybackRef}
                onEnded={handleAudioEnded}
                className="hidden"
                aria-label="Voice recording playback"
              />

              {/* Recording Duration */}
              <p className="text-sm text-muted-foreground" aria-label={`Recording duration: ${formatDuration(recordingDuration)}`}>
                Duration: {formatDuration(recordingDuration)}
              </p>
            </div>
          )}
        </div>

        {/* Transcription Display */}
        {transcription && (
          <div className="space-y-2">
            <h4 className="font-medium">Transcription:</h4>
            <div className="p-3 bg-muted/50 rounded-lg" role="textbox" aria-readonly="true" aria-label="Voice transcription text">
              <p className="text-sm">{transcription}</p>
            </div>
          </div>
        )}

        {/* Upload Controls */}
        {audioBlob && (
          <div className="flex gap-2">
            <Button
              onClick={handleUploadAndTranscribe}
              disabled={isProcessing}
              className="flex-1"
              aria-label="Upload voice recording and generate transcription"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" aria-hidden="true" />
                  Processing...
                </>
              ) : (
                <>
                  <Volume2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Upload & Transcribe
                </>
              )}
            </Button>
          </div>
        )}

        {/* Existing Audio Playback */}
        {existingAudioUrl && !audioBlob && (
          <div className="space-y-2">
            <h4 className="font-medium">Existing Recording:</h4>
            <div className="flex items-center gap-2">
              <Button
                onClick={playRecording}
                variant="outline"
                size="sm"
                aria-label={isPlaying ? 'Pause existing voice recording' : 'Play existing voice recording'}
                aria-pressed={isPlaying}
              >
                {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true"/> : <Play className="h-4 w-4" aria-hidden="true"/>}
      </Button>
              <span className="text-sm text-muted-foreground">Play existing recording</span>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="text-center text-sm text-blue-600" role="status" aria-live="polite">
            Uploading audio and processing transcription...
    </div>
        )}
      </CardContent>
    </Card>
  );
}