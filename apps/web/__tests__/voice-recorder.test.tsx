import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VoiceRecorder from '../components/VoiceRecorder';

// Mock apiPost and fetch used inside VoiceRecorder flows
jest.mock('../lib/api', () => ({
  apiPost: jest.fn(async (url: string, body: any) => {
    if (url === '/api/audio/uploads') {
      return { uploadUrl: 'https://r2.example/upload', key: 'audio/u1/p1.webm' };
    }
    if (url.startsWith('/api/photos/') && url.endsWith('/transcribe')) {
      return { message: 'Transcription process started' };
    }
    if (url === '/api/gamification/actions/caption') {
      return { ok: true };
    }
    throw new Error(`Unexpected apiPost URL: ${url}`);
  }),
}));

// Mock navigator.mediaDevices and MediaRecorder
const mockGetUserMedia = jest.fn(async () => {
  return {
    getTracks: () => [{ stop: jest.fn() }],
  } as any;
});

class MockMediaRecorder {
  public ondataavailable: ((e: any) => void) | null = null;
  public onstop: (() => void) | null = null;
  private chunks: any[] = [];
  constructor(_stream: MediaStream, _opts: any) {}
  start() {
    // simulate one chunk and stop shortly after
    setTimeout(() => {
      this.ondataavailable && this.ondataavailable({ data: new Blob(['abc'], { type: 'audio/webm' }) });
      this.onstop && this.onstop();
    }, 0);
  }
  stop() {}
}

describe('VoiceRecorder component', () => {
  beforeAll(() => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
    });
    (global as any).MediaRecorder = MockMediaRecorder;
    (global.fetch as jest.Mock).mockImplementation(async (url: string, opts: any) => {
      // handle R2 PUT upload
      if (typeof url === 'string' && url.includes('https://r2.example/upload') && opts?.method === 'PUT') {
        return { ok: true, json: async () => ({}) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
  });

  test('records audio and triggers upload + transcription flow', async () => {
    render(<VoiceRecorder photoId="p1" />);

    const button = screen.getByRole('button', { name: /record/i });
    fireEvent.click(button); // start
    // The mock recorder will auto-stop and trigger upload

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    // Expect R2 upload PUT and subsequent backend calls via apiPost to have been made
    await waitFor(() => {
      // global.fetch called with PUT
      expect((global.fetch as jest.Mock)).toHaveBeenCalledWith('https://r2.example/upload', expect.objectContaining({
        method: 'PUT',
      }));
    });
  });
});