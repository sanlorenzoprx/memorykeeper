'use client';
import PhotoUploader from '@/components/PhotoUploader';

export default function UploadPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Upload New Photo</h1>
            <div className="max-w-md mx-auto">
                <PhotoUploader />
            </div>
        </div>
    );
}