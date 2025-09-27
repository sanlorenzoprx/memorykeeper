'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Tag } from '@memorykeeper/types';

interface TagEditorProps {
  photoId: string;
  initialTags: string[];
}

export default function TagEditor({ photoId, initialTags }: TagEditorProps) {
  const queryClient = useQueryClient();
  const [newTag, setNewTag] = useState('');
  const [tags, setTags] = useState(initialTags);

  const { data: allTagsData } = useQuery<{ tags: Tag[] }>({
    queryKey: ['tags'],
    queryFn: () => apiGet('/api/tags'),
  });
  const allTagNames = allTagsData?.tags.map(t => t.name) || [];

  const addTagMutation = useMutation({
    mutationFn: (tag: string) => apiPost(`/api/photos/${photoId}/tags`, { tags: [tag] }),
    onSuccess: (_, newTag) => {
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setNewTag('');
      queryClient.invalidateQueries({ queryKey: ['photos', photoId] });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: (tag: string) => apiDelete(`/api/photos/${photoId}/tags`, { tags: [tag] }),
    onSuccess: (_, removedTag) => {
      setTags(tags.filter(t => t !== removedTag));
      queryClient.invalidateQueries({ queryKey: ['photos', photoId] });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.trim()) {
      addTagMutation.mutate(newTag.trim());
    }
  };

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
            <button className="ml-1 font-bold" onClick={() => removeTagMutation.mutate(tag)}>×</button>
          </Badge>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex gap-2 mt-2">
        <Input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Add a tag"
          list="tag-suggestions"
        />
        <datalist id="tag-suggestions">
          {allTagNames.map((tag) => <option key={tag} value={tag} />)}
        </datalist>
        <Button type="submit" size="sm">Add</Button>
      </form>
    </div>
  );
}