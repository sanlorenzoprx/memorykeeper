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
      const description = photo.transcription_text || photo.alt_text || 'A cherished memory';

      return {
        title: `Shared Memory: ${description.substring(0, 60)}...`,
        description: description,
        openGraph: {
          title: `Shared Memory: ${description.substring(0, 60)}...`,
          description: description,
          images: [
            {
              url: `https://${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'your-domain'}/${photo.r2_key}`,
              width: 1200,
              height: 800,
              alt: photo.alt_text || 'Shared memory',
            },
          ],
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title: `Shared Memory: ${description.substring(0, 60)}...`,
          description: description,
          images: [`https://${process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'your-domain'}/${photo.r2_key}`],
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
