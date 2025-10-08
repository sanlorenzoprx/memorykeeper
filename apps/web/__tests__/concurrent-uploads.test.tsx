import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhotoUploader from '../components/PhotoUploader';

jest.mock('../lib/api', () => ({
  apiPost: jest.fn(async (url: string, body: any) => {
    if (url === '/api/photos/uploads/image') {
      // return different URLs per call
      return { uploadUrl: 'https://r2.example/upload', key: `photos/u1/${Date.now()}-${body.filename}` };
    }
    if (url === '/api/photos') {
      return { id: 'p1', message: 'Photo record created successfully' };
    }
    if (url === '/api/gamification/actions/digitize') {
      return { ok: true };
    }
    throw new Error(`Unexpected apiPost URL: ${url}`);
  }),
}));

describe('Concurrent uploads', () => {
  beforeEach(() => {
    let pendingUploads = 0;
    (global.fetch as jest.Mock).mockImplementation(async (url: string, opts: any) => {
      if (typeof url === 'string' && url.includes('https://r2.example/upload') && opts?.method === 'PUT') {
        pendingUploads += 1;
        // simulate slow upload
        await new Promise((r) => setTimeout(r, 50));
        pendingUploads -= 1;
        return { ok: true, json: async () => ({}) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
  });

  test('handles two uploads started in parallel', async () => {
    render(<>
      <PhotoUploader />
      <PhotoUploader />
    </>);

    const inputs = screen.getAllByLabelText(/file/i);
    const buttons = screen.getAllByRole('button', { name: /upload photo/i });

    // mock Files
    const fileA = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const fileB = new File(['b'], 'b.jpg', { type: 'image/jpeg' });

    // set files
    fireEvent.change(inputs[0], { target: { files: [fileA] } });
    fireEvent.change(inputs[1], { target: { files: [fileB] } });

    // start uploads nearly simultaneously
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    // Ensure both PUT requests were initiated (concurrently)
    await waitFor(() => {
      const fetchCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('https://r2.example/upload') && c[1]?.method === 'PUT'
      );
      expect(fetchCalls.length).toBeGreaterThanOrEqual(2);
    });
  });
});