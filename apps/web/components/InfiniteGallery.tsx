'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import PhotoCard from '@/components/PhotoCard';
import { Photo } from '@memorykeeper/types';
import { useAuthToken } from '@/lib/auth';

export default function InfiniteGallery() {
  const getAuthToken = useAuthToken();

  const { data, isLoading, error } = useQuery<{ photos: Photo[] }>({
    queryKey: ['photos'],
    queryFn: async () => {
      const token = await getAuthToken();
      return apiGet('/api/photos', token);
    },
  });

  if (isLoading) return <div className="text-center">Loading photos...</div>;
  if (error) return <div className="text-center text-red-500">Error: {error.message}</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
      {data?.photos.map((photo) => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}