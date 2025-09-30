'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Folder, Calendar, Image, Trash2, Edit3, Eye } from 'lucide-react';
import Link from 'next/link';

interface Album {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  photo_count?: number;
}

export default function AlbumsPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');

  const { data: albumsData, isLoading } = useQuery({
    queryKey: ['albums'],
    queryFn: async () => {
        const token = await getToken();
        return apiGet('/api/albums', token);
    },
  });

  const createAlbumMutation = useMutation({
    mutationFn: async (albumData: { name: string; description?: string }) => {
        const token = await getToken();
      return apiPost('/api/albums', albumData, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setIsCreateDialogOpen(false);
      setNewAlbumName('');
      setNewAlbumDescription('');
    },
  });

  const updateAlbumMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description?: string }) => {
        const token = await getToken();
        return apiPut(`/api/albums/${data.id}`, { name: data.name, description: data.description }, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setIsEditDialogOpen(false);
      setEditingAlbum(null);
    },
  });

  const deleteAlbumMutation = useMutation({
    mutationFn: async (albumId: string) => {
        const token = await getToken();
      return apiDelete(`/api/albums/${albumId}`, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
    },
  });

  const handleCreateAlbum = () => {
    if (newAlbumName.trim()) {
      createAlbumMutation.mutate({
        name: newAlbumName.trim(),
        description: newAlbumDescription.trim() || undefined,
      });
    }
  };

  const handleEditAlbum = () => {
    if (editingAlbum && newAlbumName.trim()) {
      updateAlbumMutation.mutate({
        id: editingAlbum.id,
        name: newAlbumName.trim(),
        description: newAlbumDescription.trim() || undefined,
      });
    }
  };

  const startEditAlbum = (album: Album) => {
    setEditingAlbum(album);
    setNewAlbumName(album.name);
    setNewAlbumDescription(album.description || '');
    setIsEditDialogOpen(true);
  };

  const albums = albumsData?.albums || [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Loading albums...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
    <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-1 sm:mb-2">Albums</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Organize your memories into beautiful collections
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Album
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Album</DialogTitle>
              <DialogDescription>
                Give your album a name and optional description to start organizing your memories.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="album-name" className="text-sm font-medium">
                  Album Name *
                </label>
                <Input
                  id="album-name"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  placeholder="e.g., Family Vacation 2024"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="album-description" className="text-sm font-medium">
                  Description (Optional)
                </label>
                <Textarea
                  id="album-description"
                  value={newAlbumDescription}
                  onChange={(e) => setNewAlbumDescription(e.target.value)}
                  placeholder="Tell the story behind this collection..."
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleCreateAlbum}
                disabled={!newAlbumName.trim() || createAlbumMutation.isPending}
                className="w-full"
              >
                {createAlbumMutation.isPending ? 'Creating...' : 'Create Album'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Albums Grid */}
      {albums.length === 0 ? (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Folder className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No albums yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first album to start organizing your memories into beautiful collections.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Album
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {albums.map((album: Album) => (
            <Card key={album.id} className="group hover:shadow-lg transition-all duration-200 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg truncate">{album.name}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm line-clamp-2">
                      {album.description || 'No description'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditAlbum(album);
                      }}
                      aria-label="Edit album"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAlbumMutation.mutate(album.id);
                      }}
                      aria-label="Delete album"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-1">
                      <Image className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>{album.photo_count || 0} photos</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">{new Date(album.created_at).toLocaleDateString()}</span>
                      <span className="sm:hidden">{new Date(album.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                {/* View Album Button */}
                <Link href={`/albums/${album.id}`} className="block">
                  <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors h-9 sm:h-10 text-xs sm:text-sm">
                    <Eye className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    View Album
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
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
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="edit-album-description" className="text-sm font-medium">
                Description (Optional)
              </label>
              <Textarea
                id="edit-album-description"
                value={newAlbumDescription}
                onChange={(e) => setNewAlbumDescription(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleEditAlbum}
                disabled={!newAlbumName.trim() || updateAlbumMutation.isPending}
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