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
    const transcription = data?.data.transcription_text || '';

    // Create engaging share text that emphasizes the voice aspect
    const shareText = transcription
      ? `🎤 Listen to this voice memory: "${transcription.substring(0, 80)}${transcription.length > 80 ? '...' : ''}"`
      : '🎤 Check out this voice memory!';

    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(url);
        alert('🎤 Voice memory link copied to clipboard!');
        return;
    }

    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Volume2 className="h-6 w-6 text-blue-600 animate-pulse" />
            </div>
          </div>
          <p className="text-xl text-gray-700 font-medium">Loading voice memory...</p>
          <p className="text-gray-500 mt-2">Preparing your shared moment</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="max-w-lg mx-auto bg-white/90 backdrop-blur-sm border-0 shadow-xl">
          <CardContent className="text-center p-8">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <Volume2 className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Voice Memory Not Found</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              {error || 'This shared voice memory could not be found or has expired.'}
            </p>
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Share links are temporary to protect your privacy
              </p>
              <Button variant="outline" className="w-full">
                Create Your Own Voice Memory
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const photo = data.data;
  const publicR2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'your-domain';
  const imageUrl = `https://${publicR2Domain}/${photo.r2_key}`;

  // Create shortened transcription for display
  const shortTranscription = photo.transcription_text && photo.transcription_text.length > 120
    ? `${photo.transcription_text.substring(0, 117)}...`
    : photo.transcription_text || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Hero Section - Image + Play Button + Short Text */}
        <div className="mb-8">
          {/* Large Image with Play Button Overlay */}
          <div className="relative mb-6 group">
            <div className="aspect-video w-full overflow-hidden rounded-2xl shadow-2xl">
              <Image
                src={imageUrl}
                alt={photo.alt_text || 'Voice memory'}
                fill
                className="object-cover"
                priority
                quality={90}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 800px, 1200px"
              />

              {/* Centered Play Button Overlay */}
              {photo.audio_r2_key && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/20 backdrop-blur-sm rounded-full p-6 group-hover:bg-black/30 transition-all duration-300">
                    <Button
                      onClick={playAudio}
                      size="lg"
                      className="rounded-full w-20 h-20 bg-white/90 hover:bg-white text-blue-600 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 border-2 border-blue-200/50"
                    >
                      {isPlaying ? (
                        <Pause className="h-8 w-8" />
                      ) : (
                        <Play className="h-8 w-8 ml-1" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Voice indicator badge */}
              {photo.audio_r2_key && (
                <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Voice Memory
                </div>
              )}
            </div>
          </div>

          {/* Short Transcription */}
          {shortTranscription && (
            <div className="text-center px-4">
              <blockquote className="text-xl md:text-2xl font-medium text-gray-800 leading-relaxed italic">
                "{shortTranscription}"
              </blockquote>
              <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
                <Volume2 className="h-5 w-5" />
                <span className="text-sm font-medium">Click play to hear the full story</span>
              </div>
            </div>
          )}
        </div>

        {/* Social Actions */}
        <Card className="mb-8 bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLiked(!isLiked)}
                  className={`${isLiked ? 'text-red-600 border-red-200 bg-red-50' : 'hover:bg-gray-50'}`}
                >
                  <Heart className={`h-4 w-4 mr-2 ${isLiked ? 'fill-current' : ''}`} />
                  {isLiked ? 'Liked' : 'Like'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => shareToSocial('copy')}
                  className="hover:bg-gray-50"
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
                  className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                >
                  Share on X
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => shareToSocial('facebook')}
                  className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                >
                  Share on Facebook
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Memory Details */}
        {photo.transcription_text && (
          <Card className="mb-8 bg-white/60 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Volume2 className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-3">Full Voice Description</h3>
                  <p className="text-gray-700 leading-relaxed text-base">{photo.transcription_text}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    <span>📅 Shared {new Date(data.shareInfo.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>👁️ {data.shareInfo.viewCount} views</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Volume2 className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Create Your Own Voice Memories</h3>
              <p className="text-blue-100 mb-6 text-lg">
                Preserve your precious moments with voice descriptions and share them with loved ones.
              </p>
            </div>
            <Button className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg font-semibold">
              Start Creating Memories
            </Button>
            <p className="text-blue-100 text-sm mt-4">
              🎤 15 minutes free • Unlimited with premium
            </p>
          </CardContent>
        </Card>

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
