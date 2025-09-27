'use client';
import React, { useRef, useState } from 'react';
import { apiPost } from '@/lib/api';
import { Button } from './ui/button';
import { Mic, StopCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function VoiceRecorder({ photoId }: { photoId: string }) {
  const queryClient = useQueryClient();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        handleUploadAndTranscribe(audioBlob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not start recording. Please ensure microphone permissions are granted.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleUploadAndTranscribe = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const filename = `${photoId}-caption.webm`;
      // 1. Get presigned URL for audio upload
      const { uploadUrl, key } = await apiPost('/api/audio/uploads', { filename });

      // 2. Upload audio blob directly to R2
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/webm' },
        body: audioBlob,
      });

      // 3. Tell backend to start transcription process
      await apiPost(`/api/photos/${photoId}/transcribe`, { r2Key: key });

      // 4. Trigger gamification action for captioning
      await apiPost('/api/gamification/actions/caption', {});

      alert('Caption submitted for transcription! It will appear shortly.');
      queryClient.invalidateQueries({ queryKey: ['photos', photoId] });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    } catch (error) {
      console.error(error);
      alert(`Processing failed: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center">
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        variant={isRecording ? 'destructive' : 'default'}
        size="sm"
      >
        {isRecording ? <StopCircle className="mr-2 h-4 w-4"/> : <Mic className="mr-2 h-4 w-4"/>}
        {isRecording ? 'Stop' : 'Record'}
      </Button>
      {isProcessing && <p className="text-sm ml-2">Processing...</p>}
    </div>
  );
}