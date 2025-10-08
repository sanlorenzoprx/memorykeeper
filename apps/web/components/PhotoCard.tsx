'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { Photo } from '@memorykeeper/types';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { apiPut, apiDelete } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import TagEditor from './TagEditor';
import VoiceRecorder from './VoiceRecorder';

export default function PhotoCard({ photo }: { photo: Photo }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [caption, setCaption] = useState(photo.transcription_text || '');
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const publicR2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || '';
  const r2Url = photo.r2_key.startsWith('http') ? photo.r2_key : `https://${publicR2Domain}/${photo.r2_key}`;

  const updateCaptionMutation = useMutation({
    mutationFn: (newCaption: string) => apiPut(`/api/photos/${photo.id}/caption`, { caption: newCaption }),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
    onError: (error: any) => {
        alert(`Failed to update caption: ${error?.message || 'Unknown error'}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/api/photos/${photo.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
    onError: (error: any) => {
      alert(`Failed to delete photo: ${error?.message || 'Unknown error'}`);
    }
  });

  const handleSave = () => {
    updateCaptionMutation.mutate(caption);
  };

  return (
    <div className="border rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105">
      <div className="w-full h-48 relative">
        {!isImageLoaded && (
          <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />
        )}
        <Image
          src={r2Url}
          alt={photo.alt_text || 'A memory'}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          onLoadingComplete={() => setIsImageLoaded(true)}
        />
      </div>
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm" disabled={updateCaptionMutation.isPending}>
                {updateCaptionMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button onClick={() => setIsEditing(false)} size="sm" variant="ghost" disabled={updateCaptionMutation.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground min-h-[40px]">
              {photo.transcription_text || 'No caption yet.'}
            </p>
            <div className="flex gap-2 mt-2">
                <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
                    Edit Caption
                </Button>
                <VoiceRecorder photoId={photo.id} />
            </div>
          </div>
        )}
        <TagEditor photoId={photo.id} initialTags={photo.tags || []} />
        <Button
          variant="destructive"
          size="sm"
          className="mt-4 w-full"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? 'Deleting...' : 'Delete Photo'}
        </Button>
      </div>
    </div>
  );
}