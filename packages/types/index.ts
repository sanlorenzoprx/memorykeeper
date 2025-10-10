export interface Photo {
  id: string;
  r2_key: string;
  alt_text?: string;
  transcription_text?: string;
  owner_id?: string;
  created_at?: string;
  tags?: string[];
}

export interface AudioFile {
  id: string;
  photo_id: string;
  r2_key: string;
  transcription_text?: string;
}

export interface Album {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  photo_count?: number;
}

export interface Tag {
  name: string;
}

export interface Achievement {
  id: string;
  name: string;
  description?: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: any;
}

export interface TranscriptionError extends Error {
  upgradeRequired?: boolean;
  usage?: {
    current: number;
    limit: number;
    remaining: number;
    resetDate: string;
  };
}

export interface TranscriptionLimitCheck {
  canTranscribe: boolean;
  usedSeconds: number;
  remainingSeconds: number;
  totalLimit: number;
  resetDate: string;
}

export interface PaginationMetadata {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export interface PhotosResponse {
  photos: Photo[];
  pagination: PaginationMetadata;
}