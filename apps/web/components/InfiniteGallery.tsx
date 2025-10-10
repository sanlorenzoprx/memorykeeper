'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import PhotoCard from '@/components/PhotoCard';
import { Photo } from '@memorykeeper/types';
import { useAuth } from '@clerk/nextjs';

export default function InfiniteGallery() {
  const { getToken } = useAuth();
  const { data, isLoading, error } = useQuery<{ photos: Photo[] }>({
    queryKey: ['photos'],
    queryFn: async () => {
      const token = await getToken();
      return apiGet('/api/photos', token || undefined);
    },
  });

  if (isLoading) return <div className="text-center">Loading photos...</div>;
  if (error) return <div className="text-center text-red-500">Error: {error.message}</div>;

  if (!data?.photos || data.photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No photos yet</p>
        <p className="text-muted-foreground text-sm mt-2">Upload your first memory to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
      {data.photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}