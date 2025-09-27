'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';

interface AlbumFormValues {
  name: string;
  description?: string;
}

interface AlbumFormProps {
  initialValues: AlbumFormValues;
  onSubmit: (values: AlbumFormValues) => void;
  onCancel: () => void;
}

export default function AlbumForm({ initialValues, onSubmit, onCancel }: AlbumFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<AlbumFormValues>({
    defaultValues: initialValues
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Input
          {...register('name', { required: 'Album name is required' })}
          placeholder="Album Name"
          aria-invalid={errors.name ? "true" : "false"}
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <Textarea {...register('description')} placeholder="Description (optional)" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}