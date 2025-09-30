'use client';
import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Photo } from '@memorykeeper/types';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { apiPut, apiDelete, apiPost } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import TagEditor from './TagEditor';
import VoiceRecorder from './VoiceRecorder';
import PremiumUpgrade from './PremiumUpgrade';
import { useAuth } from '@clerk/nextjs';
import { Play, Pause, Volume2, Share2, Crown, Zap } from 'lucide-react';

interface PhotoCardProps {
  photo: Photo;
  viewMode?: 'grid' | 'list';
}

export default function PhotoCard({ photo, viewMode = 'grid' }: PhotoCardProps) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [caption, setCaption] = useState(photo.transcription_text || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareUsage, setShareUsage] = useState<{ current: number; limit: number; bonusEarned: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const publicR2Domain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || '';
  const r2Url = photo.r2_key.startsWith('http') ? photo.r2_key : `https://${publicR2Domain}/${photo.r2_key}`;

  // Construct audio URL if transcription exists (assuming audio file exists)
  const audioUrl = photo.transcription_text
    ? `https://${publicR2Domain}/audio/${photo.id}/voice-caption-${photo.id}.webm`
    : null;

  const shareMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return apiPost('/api/share', { type: 'photo', targetId: photo.id }, token);
    },
    onSuccess: (data) => {
      setShareUrl(`${window.location.origin}/share/${data.shareToken}`);
      setShareUsage(data.usage);
      setShareError(null);
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to create share link';
      setShareError(errorMessage);
      setShareUrl(null);

      // Check if this is an upgrade-required error
      if (error.upgradeRequired) {
        setShareUsage(error.usage);
      }
    },
  });

  const updateCaptionMutation = useMutation({
    mutationFn: async (newCaption: string) => {
        const token = await getToken();
        return apiPut(`/api/photos/${photo.id}/caption`, { caption: newCaption }, token);
    },
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
    onError: (error) => {
        alert(`Failed to update caption: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
        const token = await getToken();
        return apiDelete(`/api/photos/${photo.id}`, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
    onError: (error) => {
      alert(`Failed to delete photo: ${error.message}`);
    }
  });

  const handleSave = () => {
    updateCaptionMutation.mutate(caption);
  };

  return (
    <article
      className={`border rounded-lg overflow-hidden shadow-lg transition-all hover:shadow-xl ${
        viewMode === 'list'
          ? 'flex flex-row h-32'
          : 'flex flex-col transition-transform hover:scale-105'
      }`}
      role="article"
      aria-label={`Memory: ${photo.transcription_text || photo.alt_text || 'Untitled memory'}`}
    >
      <div className={`relative ${
        viewMode === 'list'
          ? 'w-32 h-32 flex-shrink-0'
          : 'w-full h-48'
      }`}>
        <Image
          src={r2Url}
          alt={photo.alt_text || 'A memory'}
          fill
          className="object-cover rounded-t-lg"
          sizes={viewMode === 'list' ? '128px' : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw'}
          priority={false}
          loading="lazy"
          quality={75}
        />
      </div>
      <div className={`p-4 ${viewMode === 'list' ? 'flex-1 min-w-0' : ''}`}>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              aria-label="Edit photo caption"
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm" disabled={updateCaptionMutation.isPending} aria-label="Save caption changes">
                {updateCaptionMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button onClick={() => setIsEditing(false)} size="sm" variant="ghost" aria-label="Cancel caption editing">Cancel</Button>
            </div>
          </div>
        ) : (
          <div>
            {photo.transcription_text ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  {audioUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (audioRef.current) {
                          if (isPlaying) {
                            audioRef.current.pause();
                            setIsPlaying(false);
                          } else {
                            audioRef.current.play().catch(error => {
                              console.error('Audio playback failed:', error);
                            });
                            setIsPlaying(true);
                          }
                        }
                      }}
                      className="shrink-0"
                      aria-label={isPlaying ? 'Pause voice recording' : 'Play voice recording'}
                      aria-pressed={isPlaying}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                  )}
                  <div className="flex-1">
            <p className="text-sm text-muted-foreground min-h-[40px]">
                      {photo.transcription_text}
                    </p>
                    {audioUrl && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Volume2 className="h-3 w-3" />
                        <span>Voice recording available</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setIsEditing(true)} size="sm" variant="outline" aria-label="Edit photo caption">
                    Edit Caption
                  </Button>
                  <VoiceRecorder photoId={photo.id} />
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground min-h-[40px]">
                  No caption yet.
                </p>
                <div className="flex gap-2 mt-2">
                  <Button onClick={() => setIsEditing(true)} size="sm" variant="outline" aria-label="Add photo caption">
                    Add Caption
                  </Button>
                  <VoiceRecorder photoId={photo.id} />
                </div>
              </div>
            )}
          </div>
        )}
        <TagEditor photoId={photo.id} initialTags={photo.tags || []} />

        {/* Share Section */}
        <div className="mt-4 pt-4 border-t">
          <Dialog open={isSharing} onOpenChange={setIsSharing}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Share2 className="mr-2 h-4 w-4" />
                Share Memory
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Share This Memory
                </DialogTitle>
                <DialogDescription>
                  Create a shareable link for this photo. Others can view it with the voice description and play button.
                </DialogDescription>
              </DialogHeader>

              {shareError ? (
                <PremiumUpgrade
                  feature="unlimited sharing"
                  currentUsage={shareUsage || undefined}
                />
              ) : shareUrl ? (
                <div className="space-y-4">
                  {/* Share Success */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <Share2 className="h-4 w-4" />
                      <span className="font-medium">Share Link Created!</span>
                    </div>
                    <p className="text-sm text-green-600 mb-3">
                      Anyone with this link can view your memory with voice playback.
                    </p>
                  </div>

                  {/* Share URL */}
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-mono break-all">{shareUrl}</p>
                  </div>

                  {/* Usage Info */}
                  {shareUsage && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-700 mb-1">
                        <Zap className="h-4 w-4" />
                        <span className="font-medium text-sm">Sharing Bonus!</span>
                      </div>
                      <p className="text-xs text-blue-600">
                        You've shared {shareUsage.current} memories this month.
                        {shareUsage.bonusEarned > 0 && ` Earned ${shareUsage.bonusEarned} bonus shares!`}
                      </p>
                    </div>
                  )}

                  {/* Social Share Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        alert('Link copied to clipboard!');
                      }}
                    >
                      Copy Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        const text = `Check out this memory: ${photo.transcription_text || 'A special moment'}`;
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`);
                      }}
                    >
                      Share on X
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Button
                    onClick={() => shareMutation.mutate()}
                    disabled={shareMutation.isPending}
                    className="w-full"
                  >
                    {shareMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Creating Share Link...
                      </>
                    ) : (
                      <>
                        <Share2 className="mr-2 h-4 w-4" />
                        Create Share Link
                      </>
                    )}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Hidden audio element for playback */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            onError={() => {
              console.error('Audio playback failed');
              setIsPlaying(false);
            }}
            className="hidden"
          />
        )}

        <Button
          variant="destructive"
          size="sm"
          className={`${viewMode === 'list' ? 'mt-2' : 'mt-4 w-full'}`}
          onClick={() => deleteMutation.mutate()}
          aria-label="Delete this photo permanently"
        >
          Delete Photo
        </Button>
      </div>
    </div>
  );
}