'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { Album } from '@memorykeeper/types';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import AlbumForm from '@/components/AlbumForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthToken } from '@/lib/auth';

export default function AlbumsPage() {
  const queryClient = useQueryClient();
  const getAuthToken = useAuthToken();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);

  const { data, isLoading } = useQuery<{ albums: Album[] }>({
    queryKey: ['albums'],
    queryFn: async () => {
      const token = await getAuthToken();
      return apiGet('/api/albums', token);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const token = await getAuthToken();
      return apiPost('/api/albums', data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description?: string }) => {
      const token = await getAuthToken();
      return apiPut(`/api/albums/${data.id}`, { name: data.name, description: data.description }, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      setIsDialogOpen(false);
      setEditingAlbum(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAuthToken();
      return apiDelete(`/api/albums/${id}`, undefined, token);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['albums'] }),
  });

  const handleSubmit = (values: { name: string; description?: string }) => {
    if (editingAlbum) {
      updateMutation.mutate({ ...values, id: editingAlbum.id });
    } else {
      createMutation.mutate(values);
    }
  };

  if (isLoading) return <div>Loading albums...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Albums</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingAlbum(null); setIsDialogOpen(true); }}>Create Album</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAlbum ? 'Edit Album' : 'Create New Album'}</DialogTitle>
            </DialogHeader>
            <AlbumForm
              initialValues={editingAlbum || { name: '', description: '' }}
              onSubmit={handleSubmit}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.albums.map((album) => (
            <TableRow key={album.id}>
              <TableCell className="font-medium">{album.name}</TableCell>
              <TableCell>{album.description}</TableCell>
              <TableCell className="text-right">
                <Link href={`/albums/${album.id}`} passHref>
                  <Button variant="ghost" size="sm">View</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => { setEditingAlbum(album); setIsDialogOpen(true); }}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(album.id)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}