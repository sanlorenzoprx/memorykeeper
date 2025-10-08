import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoUploader from '@/components/PhotoUploader';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn(async (path: string) => {
    if (path.includes('/uploads/image')) {
      return { uploadUrl: 'https://example.com/upload', key: 'photos/test-key' };
    }
    return {};
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderWithProviders(ui: React.ReactNode) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('PhotoUploader', () => {
  test('upload button disabled when no file selected', () => {
    renderWithProviders(<PhotoUploader />);
    const button = screen.getByRole('button', { name: 'Upload Photo' });
    expect(button).toBeDisabled();
  });

  test('enables after file selection and uploads successfully', async () => {
    // Mock global fetch for presigned URL upload
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) } as any);
    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderWithProviders(<PhotoUploader />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['hello'], 'test.jpg', { type: 'image/jpeg' });

    await userEvent.upload(input, file);

    expect(screen.getByText(/Selected: test.jpg/)).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Upload Photo' });
    expect(button).toBeEnabled();

    await userEvent.click(button);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Upload successful!');
    });
  });
});