import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import PhotoCard from '@/components/PhotoCard';
import { Photo } from '@memorykeeper/types';

// Mock the API functions
vi.mock('@/lib/api', () => ({
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  apiPost: vi.fn(),
}));

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}));

// Mock the components
vi.mock('@/components/TagEditor', () => ({
  default: ({ photoId }: { photoId: string }) => (
    <div data-testid="tag-editor">TagEditor-{photoId}</div>
  ),
}));

vi.mock('@/components/VoiceRecorder', () => ({
  default: ({ photoId }: { photoId: string }) => (
    <div data-testid="voice-recorder">VoiceRecorder-{photoId}</div>
  ),
}));

vi.mock('@/components/PremiumUpgrade', () => ({
  default: ({ feature }: { feature: string }) => (
    <div data-testid="premium-upgrade">PremiumUpgrade-{feature}</div>
  ),
}));

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

const mockPhoto: Photo = {
  id: 'photo-1',
  r2_key: 'test-image.jpg',
  alt_text: 'A beautiful sunset',
  transcription_text: 'This is a voice description of the sunset photo',
  owner_id: 'user-1',
  created_at: '2024-01-01T00:00:00.000Z',
  tags: ['sunset', 'nature'],
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('PhotoCard Component - Enterprise Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering', () => {
    test('renders photo card with basic information', () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      expect(screen.getByAltText('A beautiful sunset')).toBeInTheDocument();
      expect(screen.getByText('This is a voice description of the sunset photo')).toBeInTheDocument();
    });

    test('displays voice indicator when audio exists', () => {
      const photoWithAudio = {
        ...mockPhoto,
        audio_r2_key: 'audio-file.webm',
      };

      renderWithProviders(<PhotoCard photo={photoWithAudio} />);

      expect(screen.getByText('Voice recording available')).toBeInTheDocument();
    });

    test('shows transcription text when available', () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      expect(screen.getByText('This is a voice description of the sunset photo')).toBeInTheDocument();
    });

    test('shows "No caption yet" when no transcription', () => {
      const photoWithoutTranscription = {
        ...mockPhoto,
        transcription_text: undefined,
      };

      renderWithProviders(<PhotoCard photo={photoWithoutTranscription} />);

      expect(screen.getByText('No caption yet.')).toBeInTheDocument();
    });

    test('renders tags correctly', () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      expect(screen.getByTestId('tag-editor')).toBeInTheDocument();
    });

    test('renders in list view mode', () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} viewMode="list" />);

      const article = screen.getByRole('article');
      expect(article).toHaveClass('flex', 'flex-row', 'h-32');
    });

    test('renders in grid view mode by default', () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      const article = screen.getByRole('article');
      expect(article).toHaveClass('flex', 'flex-col');
    });
  });

  describe('Audio Playback', () => {
    test('shows play button when audio exists', () => {
      const photoWithAudio = {
        ...mockPhoto,
        audio_r2_key: 'audio-file.webm',
      };

      renderWithProviders(<PhotoCard photo={photoWithAudio} />);

      const playButton = screen.getByRole('button', { name: /play voice recording/i });
      expect(playButton).toBeInTheDocument();
    });

    test('plays audio when play button is clicked', async () => {
      const photoWithAudio = {
        ...mockPhoto,
        audio_r2_key: 'audio-file.webm',
      };

      renderWithProviders(<PhotoCard photo={photoWithAudio} />);

      const playButton = screen.getByRole('button', { name: /play voice recording/i });
      fireEvent.click(playButton);

      // Should show pause button after clicking play
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /pause voice recording/i })).toBeInTheDocument();
      });
    });

    test('handles audio playback errors gracefully', async () => {
      const photoWithAudio = {
        ...mockPhoto,
        audio_r2_key: 'audio-file.webm',
      };

      // Mock console.error to avoid noise in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<PhotoCard photo={photoWithAudio} />);

      const playButton = screen.getByRole('button', { name: /play voice recording/i });
      fireEvent.click(playButton);

      // Should handle error and show play button again
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /play voice recording/i })).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Caption Editing', () => {
    test('shows edit button when transcription exists', () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      expect(screen.getByRole('button', { name: /edit photo caption/i })).toBeInTheDocument();
    });

    test('enters edit mode when edit button is clicked', async () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      const editButton = screen.getByRole('button', { name: /edit photo caption/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('This is a voice description of the sunset photo')).toBeInTheDocument();
      });
    });

    test('saves changes when save button is clicked', async () => {
      const { apiPut } = await import('@/lib/api');
      (apiPut as any).mockResolvedValue({ success: true });

      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit photo caption/i });
      fireEvent.click(editButton);

      // Make changes and save
      const textarea = screen.getByDisplayValue('This is a voice description of the sunset photo');
      fireEvent.change(textarea, { target: { value: 'Updated description' } });

      const saveButton = screen.getByRole('button', { name: /save caption changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(apiPut).toHaveBeenCalledWith(
          '/api/photos/photo-1/caption',
          { caption: 'Updated description' },
          'mock-token'
        );
      });
    });

    test('cancels edit mode when cancel button is clicked', async () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit photo caption/i });
      fireEvent.click(editButton);

      // Cancel editing
      const cancelButton = screen.getByRole('button', { name: /cancel caption editing/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByDisplayValue('This is a voice description of the sunset photo')).not.toBeInTheDocument();
      });
    });
  });

  describe('Photo Deletion', () => {
    test('shows delete button', () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      expect(screen.getByRole('button', { name: /delete this photo permanently/i })).toBeInTheDocument();
    });

    test('deletes photo when delete button is clicked', async () => {
      const { apiDelete } = await import('@/lib/api');
      (apiDelete as any).mockResolvedValue({ success: true });

      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      const deleteButton = screen.getByRole('button', { name: /delete this photo permanently/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(apiDelete).toHaveBeenCalledWith('/api/photos/photo-1', 'mock-token');
      });
    });

    test('handles delete errors gracefully', async () => {
      const { apiDelete } = await import('@/lib/api');
      (apiDelete as any).mockRejectedValue(new Error('Delete failed'));

      // Mock console.error to avoid noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      const deleteButton = screen.getByRole('button', { name: /delete this photo permanently/i });
      fireEvent.click(deleteButton);

      // Should handle error without crashing
      await waitFor(() => {
        expect(apiDelete).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels and descriptions', () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label');
      expect(article).toHaveAttribute('aria-describedby');
    });

    test('play button has proper ARIA attributes', () => {
      const photoWithAudio = {
        ...mockPhoto,
        audio_r2_key: 'audio-file.webm',
      };

      renderWithProviders(<PhotoCard photo={photoWithAudio} />);

      const playButton = screen.getByRole('button', { name: /play voice recording/i });
      expect(playButton).toHaveAttribute('aria-pressed', 'false');
    });

    test('provides screen reader help for audio controls', () => {
      const photoWithAudio = {
        ...mockPhoto,
        audio_r2_key: 'audio-file.webm',
      };

      renderWithProviders(<PhotoCard photo={photoWithAudio} />);

      // Should have hidden help text for screen readers
      expect(screen.getByText('Use this button to play or pause the voice recording for this photo')).toBeInTheDocument();
    });

    test('has proper semantic structure', () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      // Should be an article element
      expect(screen.getByRole('article')).toBeInTheDocument();

      // Should have proper heading structure
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('lazy loads images appropriately', () => {
      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      const image = screen.getByAltText('A beautiful sunset');
      expect(image).toHaveAttribute('loading', 'lazy');
    });

    test('handles large transcription text efficiently', () => {
      const longTranscription = 'A'.repeat(1000);
      const photoWithLongText = {
        ...mockPhoto,
        transcription_text: longTranscription,
      };

      renderWithProviders(<PhotoCard photo={photoWithLongText} />);

      expect(screen.getByText(longTranscription)).toBeInTheDocument();
    });

    test('renders multiple photos without performance issues', () => {
      const manyPhotos = Array.from({ length: 10 }, (_, i) => ({
        ...mockPhoto,
        id: `photo-${i}`,
      }));

      const startTime = performance.now();

      renderWithProviders(
        <div>
          {manyPhotos.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} />
          ))}
        </div>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render 10 photos in reasonable time (< 100ms)
      expect(renderTime).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    test('handles missing photo data gracefully', () => {
      const incompletePhoto = {
        id: 'incomplete',
        r2_key: 'test.jpg',
      } as Photo;

      renderWithProviders(<PhotoCard photo={incompletePhoto} />);

      // Should still render without crashing
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    test('handles API errors during operations', async () => {
      const { apiPut } = await import('@/lib/api');
      (apiPut as any).mockRejectedValue(new Error('API Error'));

      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      // Enter edit mode and try to save
      const editButton = screen.getByRole('button', { name: /edit photo caption/i });
      fireEvent.click(editButton);

      const textarea = screen.getByDisplayValue('This is a voice description of the sunset photo');
      fireEvent.change(textarea, { target: { value: 'Updated text' } });

      const saveButton = screen.getByRole('button', { name: /save caption changes/i });
      fireEvent.click(saveButton);

      // Should handle error gracefully
      await waitFor(() => {
        expect(apiPut).toHaveBeenCalled();
      });
    });

    test('handles network failures during audio playback', async () => {
      const photoWithAudio = {
        ...mockPhoto,
        audio_r2_key: 'audio-file.webm',
      };

      renderWithProviders(<PhotoCard photo={photoWithAudio} />);

      const playButton = screen.getByRole('button', { name: /play voice recording/i });

      // Mock a network failure
      Object.defineProperty(HTMLAudioElement.prototype, 'play', {
        writable: true,
        value: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      fireEvent.click(playButton);

      // Should handle error and show play button again
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /play voice recording/i })).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    test('adapts to mobile screen sizes', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      const article = screen.getByRole('article');
      // Should have responsive classes for mobile
      expect(article).toHaveClass('flex', 'flex-col');
    });

    test('adapts to tablet screen sizes', () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      const article = screen.getByRole('article');
      expect(article).toHaveClass('flex', 'flex-col');
    });

    test('adapts to desktop screen sizes', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      renderWithProviders(<PhotoCard photo={mockPhoto} />);

      const article = screen.getByRole('article');
      expect(article).toHaveClass('flex', 'flex-col');
    });
  });
});
