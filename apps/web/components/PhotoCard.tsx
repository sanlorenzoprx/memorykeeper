'use client';  
import React, { useState } from 'react';  
import Image from 'next/image';  
import { Photo } from '@memorykeeper/types';  
import { Button } from './ui/button';  
import { Textarea } from './ui/textarea';  
import { apiPut } from '@/lib/api';  
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function PhotoCard({ photo }: { photo: Photo }) {  
  const queryClient = useQueryClient();  
  const [isEditing, setIsEditing] = useState(false);  
  const [caption, setCaption] = useState(photo.transcription_text || '');

  const publicR2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || '';  
  const r2Url = photo.r2_key.startsWith('http') ? photo.r2_key : `https://${publicR2Domain}/${photo.r2_key}`;

  const updateCaptionMutation = useMutation({  
    mutationFn: (newCaption: string) => apiPut(`/api/photos/${photo.id}/caption`, { caption: newCaption }),  
    onSuccess: () => {  
      setIsEditing(false);  
      queryClient.invalidateQueries({ queryKey: ['photos'] });  
    },  
    onError: (error) => {  
        alert(`Failed to update caption: ${error.message}`);  
    }  
  });

  const handleSave = () => {  
    updateCaptionMutation.mutate(caption);  
  };

  return (  
    <div className="border rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105">  
      <div className="w-full h-48 relative">  
        <Image src={r2Url} alt={photo.alt_text || 'A memory'} layout="fill" objectFit="cover" />  
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
              <Button onClick={handleSave} size="sm">Save</Button>  
              <Button onClick={() => setIsEditing(false)} size="sm" variant="ghost">Cancel</Button>  
            </div>  
          </div>  
        ) : (  
          <div>  
            <p className="text-sm text-muted-foreground min-h-[40px]">  
              {photo.transcription_text || 'No caption yet.'}  
            </p>  
            <Button onClick={() => setIsEditing(true)} size="sm" variant="outline" className="mt-2">  
              Edit Caption  
            </Button>  
          </div>  
        )}  
      </div>  
    </div>  
  );  
}
