export class UploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export const ERROR_CODES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PRESIGNED_URL_FAILED: 'PRESIGNED_URL_FAILED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  PHOTO_CREATION_FAILED: 'PHOTO_CREATION_FAILED',
  CAMERA_ACCESS_DENIED: 'CAMERA_ACCESS_DENIED',
  CAMERA_NOT_AVAILABLE: 'CAMERA_NOT_AVAILABLE',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export function getErrorMessage(error: unknown): { title: string; message: string; retryable: boolean } {
  if (error instanceof UploadError) {
    return {
      title: getErrorTitle(error.code),
      message: error.message,
      retryable: error.retryable,
    };
  }

  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('fetch')) {
      return {
        title: 'Connection Error',
        message: 'Please check your internet connection and try again.',
        retryable: true,
      };
    }

    if (error.message.includes('permission') || error.message.includes('denied')) {
      return {
        title: 'Permission Denied',
        message: 'Please check your permissions and try again.',
        retryable: false,
      };
    }

    if (error.message.includes('quota') || error.message.includes('storage')) {
      return {
        title: 'Storage Full',
        message: 'You\'ve reached your storage limit. Please free up space or upgrade your plan.',
        retryable: false,
      };
    }

    return {
      title: 'Upload Failed',
      message: error.message,
      retryable: false,
    };
  }

  return {
    title: 'Unknown Error',
    message: 'An unexpected error occurred. Please try again.',
    retryable: true,
  };
}

function getErrorTitle(code: string): string {
  const titles: Record<string, string> = {
    [ERROR_CODES.FILE_TOO_LARGE]: 'File Too Large',
    [ERROR_CODES.INVALID_FILE_TYPE]: 'Invalid File Type',
    [ERROR_CODES.NETWORK_ERROR]: 'Connection Error',
    [ERROR_CODES.PRESIGNED_URL_FAILED]: 'Upload Preparation Failed',
    [ERROR_CODES.UPLOAD_FAILED]: 'Upload Failed',
    [ERROR_CODES.PHOTO_CREATION_FAILED]: 'Save Failed',
    [ERROR_CODES.CAMERA_ACCESS_DENIED]: 'Camera Access Denied',
    [ERROR_CODES.CAMERA_NOT_AVAILABLE]: 'Camera Not Available',
    [ERROR_CODES.PROCESSING_FAILED]: 'Image Processing Failed',
    [ERROR_CODES.PERMISSION_DENIED]: 'Permission Denied',
    [ERROR_CODES.QUOTA_EXCEEDED]: 'Storage Full',
    [ERROR_CODES.UNKNOWN_ERROR]: 'Upload Failed',
  };

  return titles[code] || 'Upload Error';
}

export function createUploadError(
  message: string,
  code: string,
  retryable: boolean = false
): UploadError {
  return new UploadError(message, code, retryable);
}
