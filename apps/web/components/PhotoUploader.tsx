'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from './ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { Camera, Upload, X } from 'lucide-react';

interface PhotoUploaderProps {
  onFileSelect?: (file: File) => void;
}

export default function PhotoUploader({ onFileSelect }: PhotoUploaderProps = {}) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setCapturedImage(null); // Clear captured image if file is selected
      onFileSelect?.(selectedFile);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Use back camera on mobile
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('Failed to access camera:', err);
      alert('Could not access camera. Please ensure camera permissions are granted.');
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setFile(file);
            setCapturedImage(canvas.toDataURL('image/jpeg'));
            onFileSelect?.(file);
            stopCamera();
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const clearCapture = () => {
    setCapturedImage(null);
    setFile(null);
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleUpload = async () => {
    if (!file && !capturedImage) {
      alert('Please select a file or take a photo first.');
      return;
    }
    setIsUploading(true);
    try {
      // Get Clerk token for authenticated requests
      const token = await getToken();

      // 1. Get a presigned URL from our backend
      const filename = file ? file.name : `camera-capture-${Date.now()}.jpg`;
      const { uploadUrl, key } = await apiPost('/api/photos/uploads/image', { filename }, token || undefined);

      // 2. Upload the file directly to R2 using the presigned URL
      let uploadBody: File | Blob;
      if (file) {
        uploadBody = file;
      } else if (capturedImage) {
        // Convert data URL to blob for upload
        const response = await fetch(capturedImage);
        uploadBody = await response.blob();
      } else {
        throw new Error('No file to upload');
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: uploadBody,
        headers: {
          'Content-Type': file?.type || 'image/jpeg',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to R2.');
      }

      // 3. Notify our backend that the upload is complete to create the photo record
      await apiPost('/api/photos', { r2Key: key }, token || undefined);

      // 4. Trigger gamification action for digitizing
      await apiPost('/api/gamification/actions/digitize', {}, token || undefined);

      alert('Upload successful!');
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      setFile(null);
      setCapturedImage(null);
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="border p-6 rounded-lg space-y-4">
      {/* Camera Section */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            onClick={isCameraActive ? stopCamera : startCamera}
            variant={isCameraActive ? "destructive" : "outline"}
            className="flex-1"
          >
            <Camera className="mr-2 h-4 w-4" />
            {isCameraActive ? 'Stop Camera' : 'Take Photo'}
          </Button>
        </div>

        {isCameraActive && (
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-64 object-cover"
            />
            <Button
              onClick={capturePhoto}
              className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
              size="lg"
            >
              📸 Capture
            </Button>
          </div>
        )}

        {capturedImage && (
          <div className="relative bg-gray-100 rounded-lg p-2">
            <img
              src={capturedImage}
              alt="Captured photo"
              className="w-full h-48 object-cover rounded"
            />
            <Button
              onClick={clearCapture}
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="space-y-2">
        <Input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
        />
        {file && !capturedImage && (
          <p className="text-sm text-muted-foreground">Selected: {file.name}</p>
        )}
      </div>

      {/* Upload Button */}
      <Button
        onClick={handleUpload}
        disabled={(!file && !capturedImage) || isUploading}
        className="w-full"
      >
        <Upload className="mr-2 h-4 w-4" />
        {isUploading ? 'Uploading...' : 'Upload Photo'}
      </Button>
    </div>
  );
}