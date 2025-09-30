import { Metadata } from 'next';
import SharePageClient from './SharePageClient';

interface SharePageProps {
  params: { token: string };
}

// Generate metadata for social media sharing
export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';
    const response = await fetch(`${baseUrl}/share/${params.token}`);

    if (!response.ok) {
      return {
        title: 'Memory Not Found',
        description: 'This shared memory could not be found.',
      };
    }

    const data = await response.json();

    if (data.type === 'photo' && data.data) {
      const photo = data.data;
      const transcription = photo.transcription_text || photo.alt_text || 'A cherished memory';

      // Create shortened version for social media (emphasize voice aspect)
      const shortTranscription = transcription.length > 100
        ? `${transcription.substring(0, 97)}...`
        : transcription;

      // Create a description that emphasizes the voice aspect
      const socialDescription = `🎤 Listen to this memory: "${shortTranscription}"`;

      return {
        title: `🎤 Voice Memory: ${shortTranscription.substring(0, 50)}...`,
        description: socialDescription,
        openGraph: {
          title: `🎤 Voice Memory: ${shortTranscription.substring(0, 50)}...`,
          description: socialDescription,
          images: [
            {
              url: `https://${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'your-domain'}/${photo.r2_key}`,
              width: 1200,
              height: 800,
              alt: photo.alt_text || 'Voice memory with audio description',
            },
          ],
          type: 'website',
          siteName: 'MemoryKeeper',
        },
        twitter: {
          card: 'summary_large_image',
          title: `🎤 Voice Memory: ${shortTranscription.substring(0, 50)}...`,
          description: socialDescription,
          images: [`https://${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'your-domain'}/${photo.r2_key}`],
          site: '@MemoryKeeper',
        },
        other: {
          'theme-color': '#3B82F6',
        },
      };
    }
  } catch (error) {
    console.error('Error generating metadata:', error);
  }

  return {
    title: 'Shared Memory',
    description: 'A shared memory from MemoryKeeper',
  };
}

export default function SharePage({ params }: SharePageProps) {
  return <SharePageClient token={params.token} />;
}
