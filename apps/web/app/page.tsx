import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Camera, Mic, Heart, Shield, Cloud, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-gradient text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-6xl font-bold mb-6 animate-fade-in">
            Memorykeeper
          </h1>
          <p className="text-2xl mb-8 max-w-3xl mx-auto animate-fade-in">
            Your personal, voice-enabled photo memory vault. Preserve your precious moments with AI-powered voice captions and intelligent organization.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in">
            <Link href="/memories">
              <Button size="lg" className="bg-white text-primary-600 hover:bg-gray-50 font-semibold px-8 py-4 text-lg">
                Go to Your Library
              </Button>
            </Link>
            <Link href="/upload">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary-600 font-semibold px-8 py-4 text-lg">
                Upload a Photo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Preserve Your Past, Digitally
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Transform your analog memories into digital treasures with our advanced AI-powered platform.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-lg card-hover">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Mic className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Voice Captions</h3>
              <p className="text-gray-600 text-center">
                Add voice memories to your photos. Our AI transcribes and enhances your spoken stories.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-lg card-hover">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Camera className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Smart Organization</h3>
              <p className="text-gray-600 text-center">
                Automatically tag and organize your photos with AI-powered recognition and smart albums.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-lg card-hover">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Cloud className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Secure Storage</h3>
              <p className="text-gray-600 text-center">
                Your memories are safely stored in the cloud with enterprise-grade security and backup.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Three simple steps to preserve your precious memories forever.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Upload Your Photos</h3>
              <p className="text-gray-600">
                Upload your photos and memories. Our platform supports all major image formats.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Add Voice Stories</h3>
              <p className="text-gray-600">
                Record voice captions for your photos. Share the stories behind your memories.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-primary-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Share & Relive</h3>
              <p className="text-gray-600">
                Create albums, share with family, and relive your precious moments anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Start Preserving Your Memories Today
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of families who trust Memorykeeper to preserve their most precious moments.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/upload">
              <Button size="lg" className="btn-primary">
                Upload Your First Photo
              </Button>
            </Link>
            <Link href="/memories">
              <Button size="lg" className="btn-secondary">
                Explore Your Library
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}