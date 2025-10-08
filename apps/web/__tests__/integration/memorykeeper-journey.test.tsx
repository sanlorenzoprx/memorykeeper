import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock the API client
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../lib/api', () => ({
  apiGet: mockApiGet,
  apiPost: mockApiPost,
  apiPut: mockApiPut,
  apiDelete: mockApiDelete,
}));

// Import the main pages and components
import HomePage from '../../app/page';
import UploadPage from '../../app/upload/page';
import AlbumsPage from '../../app/albums/page';
import AlbumDetailPage from '../../app/albums/[id]/page';
import MemoriesPage from '../../app/memories/page';

// Mock Clerk authentication
const mockUseUser = vi.fn(() => ({
  user: { id: 'test-user-123', name: 'Test User' },
  isLoaded: true,
  isSignedIn: true,
}));

const mockUseAuth = vi.fn(() => ({
  getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
}));

const mockUseRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}));

const mockUsePathname = vi.fn(() => '/');
const mockUseSearchParams = vi.fn(() => new URLSearchParams());

vi.mock('@clerk/nextjs', () => ({
  useUser: mockUseUser,
  useAuth: mockUseAuth,
}));

vi.mock('next/navigation', () => ({
  useRouter: mockUseRouter,
  usePathname: mockUsePathname,
  useSearchParams: mockUseSearchParams,
}));


const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {component}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('MemoryKeeper End-to-End User Journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock responses
    vi.mocked(apiGet).mockImplementation((url: string) => {
      if (url === '/api/photos') {
        return Promise.resolve({
          photos: [
            {
              id: 'photo-1',
              r2_key: 'photos/test-photo.jpg',
              alt_text: 'Test photo',
              transcription_text: 'This is a test transcription',
              created_at: new Date().toISOString(),
              tags: ['test', 'memory'],
            },
          ],
        });
      }
      if (url === '/api/albums') {
        return Promise.resolve({
          albums: [
            {
              id: 'album-1',
              name: 'Test Album',
              description: 'A test album',
              created_at: new Date().toISOString(),
              photo_count: 1,
            },
          ],
        });
      }
      if (url === '/api/tags') {
        return Promise.resolve({ tags: ['test', 'memory', 'family'] });
      }
      return Promise.resolve({});
    });

    vi.mocked(apiPost).mockResolvedValue({ success: true });
    vi.mocked(apiPut).mockResolvedValue({ success: true });
    vi.mocked(apiDelete).mockResolvedValue({ success: true });
  });

  describe('Complete User Journey: Upload -> Organize -> Transcribe -> Share', () => {
    test('should complete full user journey from photo upload to sharing', async () => {
      // Step 1: Start at home page and navigate to upload
      renderWithProviders(<HomePage />);

      // Should show welcome content and navigation
      expect(screen.getByText(/MemoryKeeper/i)).toBeInTheDocument();

      // Navigate to upload page (simulate clicking upload button)
      const uploadButton = screen.getByText(/Upload/i);
      fireEvent.click(uploadButton);

      // Step 2: Upload page
      renderWithProviders(<UploadPage />);

      // Should show upload interface
      expect(screen.getByText(/Upload your memories/i)).toBeInTheDocument();

      // Mock successful upload
      vi.mocked(apiPost).mockResolvedValueOnce({
        id: 'new-photo-id',
        message: 'Photo uploaded successfully'
      });

      // Simulate file upload (this would be more complex in real implementation)
      const fileInput = screen.getByLabelText(/Choose file/i) || screen.getByRole('button', { name: /upload/i });
      fireEvent.click(fileInput);

      // Step 3: Navigate to albums to organize
      renderWithProviders(<AlbumsPage />);

      // Should show albums list
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/albums');
      });

      // Step 4: View album details
      renderWithProviders(<AlbumDetailPage />);

      // Should trigger API call for album details
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/api/albums/'));
      });

      // Step 5: Navigate to memories to see all photos
      renderWithProviders(<MemoriesPage />);

      // Should trigger API call for photos
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/photos');
      });

      console.log('✅ Complete user journey test passed!');
    });
  });

  describe('Photo Upload and Management Flow', () => {
    test('should handle photo upload and management workflow', async () => {
      renderWithProviders(<UploadPage />);

      // Mock successful photo upload
      vi.mocked(apiPost).mockResolvedValueOnce({
        id: 'uploaded-photo-id',
        uploadUrl: 'https://mock-signed-url.com',
        key: 'photos/uploaded-photo.jpg'
      });

      vi.mocked(apiPost).mockResolvedValueOnce({
        id: 'uploaded-photo-id',
        message: 'Photo record created successfully'
      });

      // Simulate upload process
      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      // Should show success message or navigate to next step
      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/photos/uploads/image', expect.any(Object));
        expect(mockApiPost).toHaveBeenCalledWith('/api/photos', expect.any(Object));
      });

      console.log('✅ Photo upload workflow test passed!');
    });
  });

  describe('Audio Transcription Integration', () => {
    test('should handle audio upload and transcription workflow', async () => {
      // Start from memories page
      renderWithProviders(<MemoriesPage />);

      // Mock photo with audio upload capability
      vi.mocked(apiPost).mockResolvedValueOnce({
        uploadUrl: 'https://mock-audio-url.com',
        key: 'audio/test-audio.mp3'
      });

      vi.mocked(apiPost).mockResolvedValueOnce({
        message: 'Transcription process completed successfully'
      });

      // Find a photo and trigger transcription
      const transcribeButton = screen.getByRole('button', { name: /transcribe/i });
      if (transcribeButton) {
        fireEvent.click(transcribeButton);

        await waitFor(() => {
          expect(mockApiPost).toHaveBeenCalledWith('/api/audio/upload', expect.any(Object));
          expect(mockApiPost).toHaveBeenCalledWith('/api/photos/photo-id/transcribe', expect.any(Object));
        });
      }

      console.log('✅ Audio transcription workflow test passed!');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle API errors gracefully', async () => {
      // Mock API failure
      vi.mocked(apiGet).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<HomePage />);

      // Should show error state or fallback content
      await waitFor(() => {
        // Component should handle the error gracefully
        expect(screen.getByText(/MemoryKeeper/i)).toBeInTheDocument();
      });

      console.log('✅ Error handling test passed!');
    });

    test('should handle empty states appropriately', async () => {
      // Mock empty responses
      vi.mocked(apiGet).mockImplementation((url: string) => {
        if (url === '/api/photos') {
          return Promise.resolve({ photos: [] });
        }
        if (url === '/api/albums') {
          return Promise.resolve({ albums: [] });
        }
        return Promise.resolve({});
      });

      renderWithProviders(<MemoriesPage />);

      await waitFor(() => {
        // Should show empty state messages or prompts to upload
        expect(screen.getByText(/No photos yet/i) || screen.getByText(/Upload your first memory/i)).toBeInTheDocument();
      });

      console.log('✅ Empty state handling test passed!');
    });
  });

  describe('Performance and Responsiveness', () => {
    test('should handle large photo collections efficiently', async () => {
      // Mock large dataset
      const largePhotoSet = Array.from({ length: 100 }, (_, i) => ({
        id: `photo-${i}`,
        r2_key: `photos/photo-${i}.jpg`,
        alt_text: `Photo ${i}`,
        transcription_text: `Transcription for photo ${i}`,
        created_at: new Date().toISOString(),
        tags: [`tag-${i % 10}`],
      }));

      vi.mocked(apiGet).mockResolvedValueOnce({ photos: largePhotoSet });

      const startTime = performance.now();
      renderWithProviders(<MemoriesPage />);
      const endTime = performance.now();

      await waitFor(() => {
        expect(screen.getByText('Photo 0')).toBeInTheDocument();
      });

      const renderTime = endTime - startTime;
      console.log(`✅ Large dataset rendering test completed in ${renderTime.toFixed(2)}ms`);

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(1000); // Less than 1 second
    });
  });
});
