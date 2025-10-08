'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import PhotoCard from '@/components/PhotoCard';
import { Photo } from '@memorykeeper/types';

export default function InfiniteGallery() {
  const { data, isLoading, error } = useQuery<{ photos: Photo[] }>({
    queryKey: ['photos'],
    queryFn: () => apiGet('/api/photos'),
    // Poll periodically so captions appear shortly after transcription jobs complete
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  if (isLoading) return <div className="text-center">Loading photos...</div>;
  if (error) return <div className="text-center text-red-500">Error: {(error as Error).message}</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
      {data?.photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}