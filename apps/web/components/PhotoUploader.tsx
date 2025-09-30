'use client';
import React, { useState, useRef, useCallback } from 'react';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Upload, RotateCcw, CheckCircle, AlertCircle, Sparkles, Volume2 } from 'lucide-react';
import VoiceRecorder from './VoiceRecorder';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useI18n } from '@/contexts/I18nProvider';

interface PhotoUploaderProps {
  onUploadComplete?: () => void;
}

export default function PhotoUploader({ onUploadComplete }: PhotoUploaderProps) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [voiceTranscription, setVoiceTranscription] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const processImage = useCallback(async (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas for processing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        // Set canvas size
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Apply image enhancements
        for (let i = 0; i < data.length; i += 4) {
          // Increase contrast and brightness
          data[i] = Math.min(255, data[i] * 1.1 + 10);     // Red
          data[i + 1] = Math.min(255, data[i + 1] * 1.1 + 10); // Green
          data[i + 2] = Math.min(255, data[i + 2] * 1.1 + 10); // Blue

          // Apply slight sharpening (simple high-pass filter)
          if (i > 0 && i < data.length - 4) {
            const factor = 0.1;
            data[i] = Math.max(0, Math.min(255, data[i] + factor * (data[i] - data[i - 4])));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + factor * (data[i + 1] - data[i - 3])));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + factor * (data[i + 2] - data[i - 1])));
          }
        }

        // Put processed image data back
        ctx.putImageData(imageData, 0, 0);

        // Convert to data URL
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = imageSrc;
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setCameraError(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const originalPreview = e.target?.result as string;
        setPreview(originalPreview);

        // Process the image for enhancement
        setIsProcessing(true);
        processImage(originalPreview).then((processed) => {
          setProcessedPreview(processed);
          setIsProcessing(false);
        });
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraMode(true);
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setCameraError('Camera access denied or unavailable. Please check permissions.');
    }
  }, []);

  // Keyboard navigation for accessibility
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isCameraMode) {
        stopCamera();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCameraMode, stopCamera]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraMode(false);
    setCameraError(null);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert canvas to data URL for processing
    const originalPreview = canvas.toDataURL('image/jpeg');

    // Convert canvas to blob for file
    canvas.toBlob(async (blob) => {
      if (blob) {
        const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setFile(capturedFile);

        // Set original preview
        setPreview(originalPreview);

        // Process the captured image
        setIsProcessing(true);
        const processed = await processImage(originalPreview);
        setProcessedPreview(processed);
        setIsProcessing(false);

        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  }, [stopCamera, processImage]);

  const handleUpload = async (useEnhanced: boolean = false) => {
    if (!file) {
      alert('Please select or capture a photo first.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const token = await getToken();

      // Use processed image if available and selected
      let uploadFile = file;
      let filename = file.name;

      if (processedPreview && useEnhanced) {
        // Convert processed preview back to file
        const response = await fetch(processedPreview);
        const blob = await response.blob();
        uploadFile = new File([blob], `enhanced-${filename}`, { type: 'image/jpeg' });
        filename = `enhanced-${filename}`;
      }

      // 1. Get a presigned URL from our backend
      setUploadProgress(25);
      const { uploadUrl, key } = await apiPost('/api/photos/uploads/image', { filename }, token);

      // 2. Check if we're in development mode with mock URLs
      if (uploadUrl.startsWith('dev-mode://')) {
        console.log('Development mode: Simulating file upload');
        setUploadProgress(50);

        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        setUploadProgress(75);

        // Skip actual upload and proceed to create photo record
        console.log('Mock upload completed, creating photo record...');
      } else {
        setUploadProgress(50);
      // 2. Upload the file directly to R2 using the presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
          body: uploadFile,
        headers: {
            'Content-Type': uploadFile.type,
        },
      });

      if (!uploadResponse.ok) {
          throw new Error(`Failed to upload file to R2: ${uploadResponse.status}`);
        }
        setUploadProgress(75);
      }

      // 3. Notify our backend that the upload is complete to create the photo record
      await apiPost('/api/photos', { r2Key: key }, token);
      setUploadProgress(100);

      // 4. Trigger gamification action for digitizing
      try {
      await apiPost('/api/gamification/actions/digitize', {}, token);
      } catch (gamificationError) {
        console.warn('Gamification update failed:', gamificationError);
      }

      alert('Photo uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: ['photos'] });

      // Reset state
      setFile(null);
      setPreview(null);
      setProcessedPreview(null);
      setShowComparison(false);
      setUploadProgress(0);

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setPreview(null);
    setProcessedPreview(null);
    setUploadProgress(0);
    setCameraError(null);
    setIsProcessing(false);
    setShowComparison(false);
    setShowVoiceRecorder(false);
    setVoiceTranscription('');
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6" role="main" aria-label={t('upload.ariaLabel', { defaultValue: 'Photo upload interface' })}>
      {/* Header */}
      <div className="text-center px-4 sm:px-0">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">{t('upload.title')}</h2>
        <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
          {t('upload.subtitle')}
        </p>
      </div>

      {/* Upload Interface */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Camera className="h-5 w-5" />
            {t('upload.photoCapture')}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            {t('upload.chooseMethod')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <Tabs defaultValue="camera" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12" role="tablist" aria-label="Photo capture methods">
              <TabsTrigger value="camera" role="tab" aria-label={t('upload.camera')} className="text-sm sm:text-base">
                📷 {t('upload.camera')}
              </TabsTrigger>
              <TabsTrigger value="upload" role="tab" aria-label={t('upload.upload')} className="text-sm sm:text-base">
                📁 {t('upload.upload')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="space-y-4">
              {!isCameraMode ? (
                <div className="text-center py-6 sm:py-8">
                  <Button
                    onClick={startCamera}
                    className="w-full max-w-sm mx-auto h-14 text-base"
                    aria-label={t('upload.openCamera')}
                  >
                    <Camera className="mr-2 h-5 w-5" />
                    {t('upload.openCamera')}
                  </Button>
                  {cameraError && (
                    <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg" role="alert" aria-live="polite">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{cameraError}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={capturePhoto}
                      className="flex-1 h-12 text-base"
                      aria-label={t('upload.capture')}
                    >
                      <Camera className="mr-2 h-5 w-5" />
                      {t('upload.capture')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={stopCamera}
                      className="h-12 px-6"
                      aria-label={t('upload.cancel')}
                    >
                      {t('upload.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 sm:p-8 text-center" role="region" aria-label="File upload area">
                <Upload className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" aria-hidden="true" />
                <div className="space-y-3">
                  <label htmlFor="file-upload" className="cursor-pointer" aria-label={t('upload.uploadFile')}>
                    <div className="bg-primary/10 hover:bg-primary/20 rounded-lg p-4 transition-colors">
                      <span className="text-sm sm:text-base font-medium text-primary">{t('upload.clickToUpload')}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground block mt-1">{t('upload.dragOrDrop')}</span>
                    </div>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    aria-describedby="upload-instructions"
                  />
                  <p id="upload-instructions" className="text-xs text-muted-foreground">
                    {t('upload.uploadInstructions')}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview and Enhancement */}
          {(preview || processedPreview) && (
            <div className="mt-6 space-y-4" role="region" aria-label="Photo preview and enhancement">
              {/* Processing Indicator */}
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 p-4 bg-muted/50 rounded-lg" role="status" aria-live="polite">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" aria-hidden="true" />
                  <span className="text-sm">Enhancing image quality...</span>
                </div>
              )}

              {/* Before/After Comparison Toggle */}
              {processedPreview && preview && !isProcessing && (
                <div className="flex items-center justify-center gap-4 mb-4">
                  <span className="text-sm text-muted-foreground" aria-label="Original photo">Before</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowComparison(!showComparison)}
                    aria-label={showComparison ? 'Hide enhancement comparison' : 'Show enhancement comparison'}
                  >
                    <Sparkles className="h-4 w-4 mr-2" aria-hidden="true" />
                    {showComparison ? 'Hide' : 'Show'} Enhancement
                  </Button>
                  <span className="text-sm text-muted-foreground" aria-label="Enhanced photo">After</span>
                </div>
              )}

              {/* Image Preview */}
              <div className="relative">
                {showComparison && processedPreview && preview ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <Image
                        src={preview}
                        alt="Original"
                        width={400}
                        height={300}
                        className="w-full h-48 sm:h-64 object-cover rounded-lg border"
                        quality={80}
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                      <span className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Original
                      </span>
                    </div>
                    <div className="relative">
                      <Image
                        src={processedPreview}
                        alt="Enhanced"
                        width={400}
                        height={300}
                        className="w-full h-48 sm:h-64 object-cover rounded-lg border"
                        quality={80}
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                      <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                        Enhanced
                      </span>
                    </div>
                  </div>
                ) : (
                  <Image
                    src={processedPreview || preview}
                    alt="Preview"
                    width={400}
                    height={300}
                    className="w-full max-h-64 object-cover rounded-lg border"
                    quality={80}
                    sizes="(max-width: 768px) 100vw, 400px"
                  />
                )}

                <div className="absolute top-2 right-2 flex gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                    aria-label="Add voice caption"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetUpload}
                    aria-label="Reset upload"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Voice Recorder */}
              {showVoiceRecorder && (
                <div className="mt-4">
                  <VoiceRecorder
                    photoId={`temp-${Date.now()}`}
                    onTranscriptionComplete={(transcription) => {
                      setVoiceTranscription(transcription);
                    }}
                    compact={true}
                  />
                </div>
              )}

              {/* Voice Caption Display */}
              {voiceTranscription && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Voice Caption</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{voiceTranscription}</p>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Upload Buttons */}
              <div className="flex gap-2">
                {processedPreview && (
                  <Button
                    onClick={() => handleUpload(true)}
                    disabled={!file || isUploading || isProcessing}
                    variant="default"
                    className="flex-1"
                    size="lg"
                    aria-label="Upload enhanced version of the photo"
                  >
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" aria-hidden="true" />
                        Uploading Enhanced...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                        Upload Enhanced
                      </>
                    )}
                  </Button>
                )}

                <Button
                  onClick={() => handleUpload(false)}
                  disabled={!file || isUploading || isProcessing}
                  variant={processedPreview ? "outline" : "default"}
                  className={processedPreview ? "flex-1" : "w-full"}
                  size="lg"
                  aria-label={processedPreview ? 'Upload original version of the photo' : 'Upload the photo'}
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" aria-hidden="true" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                      {processedPreview ? 'Upload Original' : 'Upload Photo'}
                    </>
                  )}
        </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}