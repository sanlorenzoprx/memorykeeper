'use client';
import PhotoUploader from '@/components/PhotoUploader';
import HDCamera from '@/components/HDCamera';
import { useState } from 'react';
import { useSubscription } from '@/lib/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Crown, Sparkles } from 'lucide-react';

export default function UploadPage() {
    const [showHDCamera, setShowHDCamera] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const { isSubscribed, plan, features } = useSubscription();

    const handleHDCapture = (file: File) => {
        setSelectedFile(file);
        setShowHDCamera(false);
    };

    const handleFileUpload = (file: File) => {
        setSelectedFile(file);
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-4">Upload New Photo</h1>
                <p className="text-xl text-gray-600 mb-6">
                    Choose how you'd like to add your memory
                </p>
            </div>

            {/* Upload Options */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* HD Camera Option */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Camera className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">HD Camera</h3>
                        <p className="text-gray-600 mb-4">
                            {isSubscribed 
                                ? 'Capture stunning photos with AI-powered features'
                                : 'Premium HD camera with AI enhancement'
                            }
                        </p>
                        
                        {isSubscribed ? (
                            <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                    <Sparkles className="w-4 h-4" />
                                    AI Auto-Focus
                                </div>
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                    <Sparkles className="w-4 h-4" />
                                    Scene Detection
                                </div>
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                    <Sparkles className="w-4 h-4" />
                                    4K Quality
                                </div>
                            </div>
                        ) : (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                                <div className="flex items-center gap-2 text-yellow-800">
                                    <Crown className="w-4 h-4" />
                                    <span className="font-semibold">Premium Feature</span>
                                </div>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Upgrade to unlock AI-powered HD camera
                                </p>
                            </div>
                        )}

                        <Button 
                            onClick={() => setShowHDCamera(true)}
                            size="lg"
                            className="w-full"
                            disabled={!isSubscribed}
                        >
                            <Camera className="w-4 h-4 mr-2" />
                            {isSubscribed ? 'Open HD Camera' : 'Upgrade Required'}
                        </Button>
                    </div>
                </div>

                {/* Standard Upload Option */}
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Upload className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">File Upload</h3>
                        <p className="text-gray-600 mb-4">
                            Upload photos from your device or gallery
                        </p>
                        
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span>✓</span>
                                All image formats
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span>✓</span>
                                Voice captions
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span>✓</span>
                                Smart organization
                            </div>
                        </div>

                        <div className="text-sm text-gray-500">
                            Available to all users
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Component */}
            <div className="max-w-2xl mx-auto">
                <PhotoUploader onFileSelect={handleFileUpload} />
            </div>

            {/* HD Camera Modal */}
            {showHDCamera && (
                <HDCamera
                    onCapture={handleHDCapture}
                    onClose={() => setShowHDCamera(false)}
                    isSubscribed={isSubscribed}
                />
            )}

            {/* Selected File Preview */}
            {selectedFile && (
                <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm">✓</span>
                        </div>
                        <div>
                            <h4 className="font-semibold text-green-800">Photo Ready</h4>
                            <p className="text-sm text-green-600">
                                {selectedFile.name} - {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}