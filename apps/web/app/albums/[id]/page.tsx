'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete, apiPut } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Calendar, Image, Edit3, Trash2, CheckSquare, Square } from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';

interface Album {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  photo_count?: number;
}

interface Photo {
  id: string;
  r2_key: string;
  alt_text?: string;
  transcription_text?: string;
  created_at: string;
  tags?: string[];
}

export default function AlbumDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddPhotosDialogOpen, setIsAddPhotosDialogOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const publicR2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || '';

  const { data: albumData, isLoading: isAlbumLoading } = useQuery({
    queryKey: ['album', id],
    queryFn: async () => {
        const token = await getToken();
        return apiGet(`/api/albums/${id}`, token);
    },
    enabled: !!id,
  });
  const album = albumData?.album;

  const { data: photosData, isLoading: arePhotosLoading } = useQuery({
    queryKey: ['photos', { albumId: id }],
    queryFn: async () => {
        const token = await getToken();
        return apiGet(`/api/photos?albumId=${id}`, token);
    },
    enabled: !!id,
  });
  const photosInAlbum = photosData?.photos || [];

  const { data: allPhotosData } = useQuery({
    queryKey: ['photos'],
    queryFn: async () => {
        const token = await getToken();
        return apiGet('/api/photos', token);
    },
  });
  const allPhotos = allPhotosData?.photos || [];

  const addPhotosMutation = useMutation({
    mutationFn: async (photoIds: string[]) => {
        const token = await getToken();
        // Add all selected photos to album
        const promises = photoIds.map(photoId =>
          apiPost(`/api/albums/${id}/photos`, { photoId }, token)
        );
        await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', { albumId: id }] });
      setIsAddPhotosDialogOpen(false);
      setSelectedPhotos(new Set());
    },
  });

  const removePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
        const token = await getToken();
        return apiDelete(`/api/albums/${id}/photos/${photoId}`, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', { albumId: id }] });
    },
  });

  const updateAlbumMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
        const token = await getToken();
        return apiPut(`/api/albums/${id}`, data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['album', id] });
      setIsEditDialogOpen(false);
    },
  });

  const deleteAlbumMutation = useMutation({
    mutationFn: async () => {
        const token = await getToken();
        return apiDelete(`/api/albums/${id}`, token);
    },
    onSuccess: () => {
      window.location.href = '/albums';
    },
  });

  const handleEditAlbum = () => {
    if (editName.trim()) {
      updateAlbumMutation.mutate({
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
    }
  };

  const handleAddSelectedPhotos = () => {
    if (selectedPhotos.size > 0) {
      addPhotosMutation.mutate(Array.from(selectedPhotos));
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  const photosNotInAlbum = allPhotos.filter(p => !photosInAlbum.some(ap => ap.id === p.id));

  if (isAlbumLoading) return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading album...</span>
      </div>
    </div>
  );

  if (!album) return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardContent className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <Image className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Album Not Found</h2>
          <p className="text-muted-foreground">This album doesn't exist or you don't have access to it.</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Album Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">{album.name}</h1>
            <p className="text-muted-foreground text-base sm:text-lg mb-4">
              {album.description || 'No description yet'}
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Image className="h-4 w-4" />
                <span>{album.photo_count || 0} photos</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Created {new Date(album.created_at).toLocaleDateString()}</span>
                <span className="sm:hidden">{new Date(album.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => {
              setEditName(album.name);
              setEditDescription(album.description || '');
              setIsEditDialogOpen(true);
            }} className="flex-1 sm:flex-none">
              <Edit3 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => deleteAlbumMutation.mutate()} className="flex-1 sm:flex-none">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <Dialog open={isAddPhotosDialogOpen} onOpenChange={setIsAddPhotosDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Photos
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Photos to Album</DialogTitle>
              <DialogDescription>
                Select photos from your library to add to this album.
              </DialogDescription>
            </DialogHeader>

            {photosNotInAlbum.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">All your photos are already in this album!</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">
                    {selectedPhotos.size} photo{selectedPhotos.size !== 1 ? 's' : ''} selected
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
                  {photosNotInAlbum.map((photo: Photo) => (
                    <Card key={photo.id} className={`cursor-pointer transition-all ${
                      selectedPhotos.has(photo.id) ? 'ring-2 ring-primary' : ''
                    }`}>
                      <CardContent className="p-2">
                        <div className="relative">
                          <div className="w-full h-24 sm:h-32 relative mb-2">
                            <Image
                              src={`https://${publicR2Domain}/${photo.r2_key}`}
                              alt={photo.alt_text || 'Photo'}
                              fill
                              className="object-cover rounded-md"
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                              priority={false}
                              loading="lazy"
                              quality={75}
                            />
                          </div>
                          <div className="absolute top-1 left-1 sm:top-2 sm:left-2">
                            <Checkbox
                              checked={selectedPhotos.has(photo.id)}
                              onCheckedChange={() => togglePhotoSelection(photo.id)}
                              aria-label={`Select ${photo.alt_text || 'photo'}`}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {photo.transcription_text || 'No caption'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddPhotosDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddSelectedPhotos}
                    disabled={selectedPhotos.size === 0 || addPhotosMutation.isPending}
                  >
                    {addPhotosMutation.isPending ? 'Adding...' : `Add ${selectedPhotos.size} Photo${selectedPhotos.size !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Photos in Album */}
      {photosInAlbum.length === 0 ? (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Image className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No photos in this album</h3>
            <p className="text-muted-foreground mb-6">
              Start building your album by adding photos from your library.
            </p>
            <Button onClick={() => setIsAddPhotosDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Photos
            </Button>
          </div>
        </div>
      ) : (
        <>
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Photos in Album ({photosInAlbum.length})</h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Click on any photo to view details and manage captions
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {photosInAlbum.map((photo: Photo) => (
              <Card key={photo.id} className="group hover:shadow-lg transition-all duration-200">
                <CardContent className="p-0">
                  <div className="relative">
                    <div className="w-full h-48 relative">
                      <Image
                        src={`https://${publicR2Domain}/${photo.r2_key}`}
                        alt={photo.alt_text || 'Photo'}
                        fill
                        className="object-cover rounded-t-lg"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        priority={false}
                        loading="lazy"
                        quality={75}
                      />
                    </div>

                    {/* Photo overlay actions */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-t-lg">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removePhotoMutation.mutate(photo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Voice description indicator */}
                    {photo.transcription_text && (
                      <div className="mb-2">
                        <Badge variant="secondary" className="text-xs">
                          Voice Caption
                        </Badge>
                      </div>
                    )}

                    {/* Caption preview */}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {photo.transcription_text || photo.alt_text || 'No caption yet'}
                    </p>

                    {/* Tags */}
                    {photo.tags && photo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {photo.tags.slice(0, 3).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {photo.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{photo.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* View details button */}
                    <Button variant="outline" size="sm" className="w-full">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Edit Album Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Album</DialogTitle>
            <DialogDescription>
              Update your album name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-album-name" className="text-sm font-medium">
                Album Name *
              </label>
              <Input
                id="edit-album-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="edit-album-description" className="text-sm font-medium">
                Description (Optional)
              </label>
              <Textarea
                id="edit-album-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleEditAlbum}
                disabled={!editName.trim() || updateAlbumMutation.isPending}
                className="flex-1"
              >
                {updateAlbumMutation.isPending ? 'Updating...' : 'Update Album'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}