// Performance optimization utilities for MemoryKeeper

// Image optimization settings
export const IMAGE_QUALITIES = {
  thumbnail: 70,
  preview: 80,
  full: 85,
  share: 90
} as const;

// Responsive breakpoints for images
export const IMAGE_BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1200,
  large: 1920
} as const;

// Generate responsive image sizes string
export function generateImageSizes(breakpoints: typeof IMAGE_BREAKPOINTS, defaultSize = '100vw') {
  return Object.entries(breakpoints)
    .map(([key, width]) => `(max-width: ${width}px) ${width}px`)
    .join(', ') + `, ${defaultSize}`;
}

// Preload critical images
export function preloadImage(src: string, as = 'image') {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = as;
    link.href = src;
    document.head.appendChild(link);
  }
}

// Intersection Observer for lazy loading
export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
) {
  if (typeof window !== 'undefined') {
    return new IntersectionObserver(callback, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    });
  }
  return null;
}

// Debounce function for search and filtering
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for scroll events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Memory cleanup for large image operations
export function cleanupImageResources() {
  // Clear any cached images or blobs
  if (typeof window !== 'undefined') {
    // Force garbage collection hint
    if (window.gc) {
      window.gc();
    }
  }
}

// Performance monitoring
export function measurePerformance(name: string, fn: () => void | Promise<void>) {
  if (typeof window !== 'undefined' && window.performance) {
    const start = performance.now();
    const result = fn();
    if (result instanceof Promise) {
      result.finally(() => {
        const end = performance.now();
        console.log(`${name} took ${end - start} milliseconds`);
      });
    } else {
      const end = performance.now();
      console.log(`${name} took ${end - start} milliseconds`);
    }
  } else {
    fn();
  }
}
