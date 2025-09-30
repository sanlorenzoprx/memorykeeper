'use client';
import { useRouter } from 'next/navigation';
import PhotoUploader from '@/components/PhotoUploader';

export default function UploadPage() {
    const router = useRouter();

    const handleUploadComplete = () => {
        // Redirect to library after successful upload
        router.push('/memories');
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8 text-center">
                <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Add New Memory
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Capture a special moment or upload an existing photo to preserve it in your digital memory library.
                </p>
            </div>

            <PhotoUploader onUploadComplete={handleUploadComplete} />
        </div>
    );
}