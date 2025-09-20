'use client';  
import React, { useState } from 'react';  
import { apiPost } from '@/lib/api';  
import { Button } from '@/components/ui/button';  
import { Input } from './ui/input';  
import { useQueryClient } from '@tanstack/react-query';

export default function PhotoUploader() {  
  const queryClient = useQueryClient();  
  const [file, setFile] = useState<File | null>(null);  
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {  
    if (e.target.files?.[0]) {  
      setFile(e.target.files[0]);  
    }  
  };

  const handleUpload = async () => {  
    if (!file) {  
      alert('Please select a file first.');  
      return;  
    }  
    setIsUploading(true);  
    try {  
      // 1. Get a presigned URL from our backend  
      const { uploadUrl, key } = await apiPost('/api/photos/uploads/image', { filename: file.name });

      // 2. Upload the file directly to R2 using the presigned URL  
      const uploadResponse = await fetch(uploadUrl, {  
        method: 'PUT',  
        body: file,  
        headers: {  
          'Content-Type': file.type,  
        },  
      });

      if (!uploadResponse.ok) {  
        throw new Error('Failed to upload file to R2.');  
      }

      // 3. Notify our backend that the upload is complete to create the photo record  
      await apiPost('/api/photos', { r2Key: key });

      alert('Upload successful!');  
      queryClient.invalidateQueries({ queryKey: ['photos'] });  
      setFile(null);  
    } catch (error) {  
      console.error(error);  
      alert(`Upload failed: ${(error as Error).message}`);  
    } finally {  
      setIsUploading(false);  
    }  
  };

  return (  
    <div className="border p-6 rounded-lg space-y-4">  
        <Input type="file" accept="image/*" onChange={handleFileChange} />  
        {file && <p className="text-sm text-muted-foreground">Selected: {file.name}</p>}  
        <Button onClick={handleUpload} disabled={!file || isUploading}>  
            {isUploading ? 'Uploading...' : 'Upload Photo'}  
        </Button>  
    </div>  
  );  
}
