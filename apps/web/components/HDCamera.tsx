'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  X, 
  Zap, 
  Eye, 
  Target, 
  Sparkles, 
  Crown,
  Settings,
  RotateCcw,
  Download
} from 'lucide-react';

interface HDCameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  isSubscribed: boolean;
}

interface AISettings {
  autoFocus: boolean;
  sceneDetection: boolean;
  faceDetection: boolean;
  imageEnhancement: boolean;
  smartCropping: boolean;
}

export default function HDCamera({ onCapture, onClose, isSubscribed }: HDCameraProps) {
  const [isActive, setIsActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState<AISettings>({
    autoFocus: true,
    sceneDetection: true,
    faceDetection: true,
    imageEnhancement: true,
    smartCropping: false,
  });
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraQuality, setCameraQuality] = useState<'standard' | 'hd' | '4k'>('hd');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: cameraQuality === '4k' ? 3840 : cameraQuality === 'hd' ? 1920 : 1280 },
          height: { ideal: cameraQuality === '4k' ? 2160 : cameraQuality === 'hd' ? 1080 : 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsActive(true);
      }
    } catch (err) {
      console.error('Failed to access camera:', err);
      alert('Could not access HD camera. Please ensure camera permissions are granted.');
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsActive(false);
  }, []);

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        // AI-powered image enhancement
        if (isSubscribed && aiSettings.imageEnhancement) {
          await enhanceImage(context, canvas);
        }

        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], `hd-capture-${Date.now()}.jpg`, { 
              type: 'image/jpeg' 
            });
            
            setCapturedImage(canvas.toDataURL('image/jpeg'));
            
            // AI Analysis for subscribed users
            if (isSubscribed) {
              await analyzeImage(canvas);
            }
            
            stopCamera();
          }
        }, 'image/jpeg', 0.95); // Higher quality for HD
      }
    }
  };

  const enhanceImage = async (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Simulate AI image enhancement
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Basic enhancement: increase contrast and saturation
    for (let i = 0; i < data.length; i += 4) {
      // Increase contrast
      data[i] = Math.min(255, data[i] * 1.1);     // Red
      data[i + 1] = Math.min(255, data[i + 1] * 1.1); // Green
      data[i + 2] = Math.min(255, data[i + 2] * 1.1); // Blue
    }
    
    context.putImageData(imageData, 0, 0);
  };

  const analyzeImage = async (canvas: HTMLCanvasElement) => {
    setIsAnalyzing(true);
    
    // Simulate AI analysis
    setTimeout(() => {
      const analyses = [
        "🎯 Auto-focused on main subject",
        "👥 Detected 2 faces in frame",
        "🌅 Scene: Outdoor daylight",
        "📐 Optimal composition detected",
        "✨ Image enhanced with AI processing"
      ];
      
      setAiAnalysis(analyses.join('\n'));
      setIsAnalyzing(false);
    }, 2000);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setAiAnalysis('');
    startCamera();
  };

  const confirmCapture = () => {
    if (capturedImage) {
      // Convert data URL to File
      fetch(capturedImage)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `hd-capture-${Date.now()}.jpg`, { 
            type: 'image/jpeg' 
          });
          onCapture(file);
        });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">HD Camera</h2>
            {isSubscribed && (
              <Badge variant="secondary" className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white">
                <Crown className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* AI Settings Panel for Subscribed Users */}
        {isSubscribed && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              AI Features
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(aiSettings).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setAiSettings(prev => ({
                      ...prev,
                      [key]: e.target.checked
                    }))}
                    className="rounded"
                  />
                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Camera Quality Selector */}
        <div className="flex gap-2 mb-4">
          {['standard', 'hd', '4k'].map((quality) => (
            <Button
              key={quality}
              variant={cameraQuality === quality ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCameraQuality(quality as any)}
              disabled={quality === '4k' && !isSubscribed}
            >
              {quality.toUpperCase()}
              {quality === '4k' && !isSubscribed && <Crown className="w-3 h-3 ml-1" />}
            </Button>
          ))}
        </div>

        {/* Camera View */}
        {!capturedImage ? (
          <div className="space-y-4">
            {!isActive ? (
              <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
                <div className="text-center">
                  <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">HD Camera Ready</p>
                  <Button onClick={startCamera} size="lg" className="btn-primary">
                    <Camera className="w-4 h-4 mr-2" />
                    Start HD Camera
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-96 object-cover"
                />
                
                {/* AI Overlay Indicators */}
                {isSubscribed && (
                  <div className="absolute top-4 left-4 flex gap-2">
                    {aiSettings.autoFocus && (
                      <div className="bg-green-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Auto Focus
                      </div>
                    )}
                    {aiSettings.sceneDetection && (
                      <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Scene AI
                      </div>
                    )}
                  </div>
                )}

                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
                  <Button
                    onClick={stopCamera}
                    variant="destructive"
                    size="lg"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={capturePhoto}
                    size="lg"
                    className="bg-white text-black hover:bg-gray-100"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capture HD
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Captured Image Preview */
          <div className="space-y-4">
            <div className="relative bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={capturedImage}
                alt="Captured HD photo"
                className="w-full h-96 object-cover"
              />
              
              {/* AI Analysis Results */}
              {isSubscribed && aiAnalysis && (
                <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white p-3 rounded-lg max-w-xs">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    AI Analysis
                  </h4>
                  <div className="text-sm whitespace-pre-line">
                    {isAnalyzing ? 'Analyzing...' : aiAnalysis}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 justify-center">
              <Button onClick={retakePhoto} variant="outline" size="lg">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              <Button onClick={confirmCapture} size="lg" className="btn-primary">
                <Download className="w-4 h-4 mr-2" />
                Use This Photo
              </Button>
            </div>
          </div>
        )}

        {/* Subscription Upgrade Prompt */}
        {!isSubscribed && (
          <div className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-800">Unlock Premium AI Features</h3>
                <p className="text-sm text-yellow-700">
                  Get AI-powered image enhancement, scene detection, and 4K capture quality.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
