'use client';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Volume2, Share2, Download, Heart, MessageCircle } from 'lucide-react';

interface SharedPhoto {
  id: string;
  r2_key: string;
  alt_text?: string;
  transcription_text?: string;
  audio_r2_key?: string;
  audio_transcription?: string;
  created_at?: string;
}

interface ShareInfo {
  shareToken: string;
  createdAt: string;
  viewCount: number;
}

interface ShareData {
  type: 'photo';
  data: SharedPhoto;
  shareInfo: ShareInfo;
}

export default function SharePageClient({ token }: { token: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchShareData = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';
        const response = await fetch(`${baseUrl}/share/${token}`);

        if (!response.ok) {
          throw new Error('Failed to load shared memory');
        }

        const shareData = await response.json();
        setData(shareData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shared memory');
      } finally {
        setIsLoading(false);
      }
    };

    fetchShareData();
  }, [token]);

  const playAudio = async () => {
    if (!data?.data.audio_r2_key || !audioRef.current) return;

    try {
      const publicR2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'your-domain';
      const audioUrl = `https://${publicR2Domain}/${data.data.audio_r2_key}`;

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const shareToSocial = (platform: string) => {
    const url = window.location.href;
    const text = data?.data.transcription_text || 'Check out this memory!';

    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
        return;
    }

    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading shared memory...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Memory Not Found</h2>
            <p className="text-gray-600">
              {error || 'This shared memory could not be found or has expired.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const photo = data.data;
  const publicR2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'your-domain';
  const imageUrl = `https://${publicR2Domain}/${photo.r2_key}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm mb-4">
            <Volume2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Shared Memory</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            A Cherished Memory
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Discover this special moment preserved in time
          </p>
        </div>

        {/* Main Content */}
        <Card className="overflow-hidden shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="p-0">
            {/* Photo */}
            <div className="relative">
              <Image
                src={imageUrl}
                alt={photo.alt_text || 'Shared memory'}
                width={800}
                height={600}
                className="w-full h-auto object-cover"
                priority
                quality={85}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 800px, 1200px"
              />

              {/* Audio Play Button Overlay */}
              {photo.audio_r2_key && (
                <div className="absolute bottom-4 right-4">
                  <Button
                    onClick={playAudio}
                    size="lg"
                    className="rounded-full w-14 h-14 shadow-lg bg-white/90 hover:bg-white text-blue-600 border-2 border-blue-200"
                  >
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                  </Button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-8">
              {/* Description */}
              {photo.transcription_text && (
                <div className="mb-8">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Volume2 className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2">Voice Description</h3>
                      <p className="text-gray-700 leading-relaxed">{photo.transcription_text}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Share Actions */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsLiked(!isLiked)}
                      className={isLiked ? 'text-red-600 border-red-200' : ''}
                    >
                      <Heart className={`h-4 w-4 mr-2 ${isLiked ? 'fill-current' : ''}`} />
                      {isLiked ? 'Liked' : 'Like'}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('copy')}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Copy Link
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('twitter')}
                    >
                      Share on Twitter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareToSocial('facebook')}
                    >
                      Share on Facebook
                    </Button>
                  </div>
                </div>

                {/* Share Stats */}
                <div className="mt-4 pt-4 border-t text-center text-sm text-gray-500">
                  <span>{data.shareInfo.viewCount} views • Shared {new Date(data.shareInfo.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="mt-12 text-center">
          <Card className="max-w-md mx-auto bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-2">Create Your Own Memories</h3>
              <p className="mb-4 opacity-90">
                Start preserving your precious moments with voice descriptions and AI enhancement.
              </p>
              <Button className="bg-white text-blue-600 hover:bg-gray-100">
                Try MemoryKeeper Free
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Hidden audio element */}
        {photo.audio_r2_key && (
          <audio
            ref={audioRef}
            onEnded={handleAudioEnded}
            onError={() => setIsPlaying(false)}
            className="hidden"
          />
        )}
      </div>
    </div>
  );
}
