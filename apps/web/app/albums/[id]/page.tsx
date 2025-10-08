'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Album, Photo } from '@memorykeeper/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import React from 'react';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';

export default function AlbumDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const publicR2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || '';

  const { data: albumData } = useQuery<{ album: Album }>({
    queryKey: ['album', id],
    queryFn: async () => {
      const token = await getToken();
      return apiGet(`/api/albums/${id}`, token || undefined);
    },
    enabled: !!id,
  });
  const album = albumData?.album;

  const { data: photosInAlbumData } = useQuery<{ photos: Photo[] }>({
    queryKey: ['albumPhotos', id],
    queryFn: async () => {
      const token = await getToken();
      return apiGet(`/api/photos?albumId=${id}`, token || undefined);
    },
    enabled: !!id,
  });
  const photosInAlbum = photosInAlbumData?.photos || [];

  const { data: allPhotosData } = useQuery<{ photos: Photo[] }>({
    queryKey: ['photos'],
    queryFn: async () => {
      const token = await getToken();
      return apiGet('/api/photos', token || undefined);
    },
  });
  const allPhotos = allPhotosData?.photos || [];

  const addPhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const token = await getToken();
      return apiPost(`/api/albums/${id}/photos`, { photoId }, token || undefined);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['albumPhotos', id] }),
  });

  const removePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const token = await getToken();
      return apiDelete(`/api/albums/${id}/photos/${photoId}`, undefined, token || undefined);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['albumPhotos', id] }),
  });

  if (!album) return <div>Loading album...</div>;

  const photosNotInAlbum = allPhotos.filter(p => !photosInAlbum.some(ap => ap.id === p.id));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{album.name}</h1>
      <p className="text-muted-foreground mb-6">{album.description}</p>

      <h2 className="text-2xl font-bold mt-6 mb-4">Photos in Album</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photosInAlbum.map((photo) => (
          <Card key={photo.id}>
            <CardContent className="p-2">
              <div className="w-full h-40 relative mb-2">
                <Image src={`https://${publicR2Domain}/${photo.r2_key}`} alt={photo.alt_text || 'Photo'} fill className="rounded-md" style={{ objectFit: 'cover' }} />
              </div>
              <Button variant="destructive" size="sm" className="w-full" onClick={() => removePhotoMutation.mutate(photo.id)}>Remove</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="text-2xl font-bold mt-8 mb-4">Add Photos to Album</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photosNotInAlbum.map((photo) => (
          <Card key={photo.id}>
            <CardContent className="p-2">
              <div className="w-full h-40 relative mb-2">
                <Image src={`https://${publicR2Domain}/${photo.r2_key}`} alt={photo.alt_text || 'Photo'} fill className="rounded-md" style={{ objectFit: 'cover' }} />
              </div>
              <Button size="sm" className="w-full" onClick={() => addPhotoMutation.mutate(photo.id)}>Add to Album</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}