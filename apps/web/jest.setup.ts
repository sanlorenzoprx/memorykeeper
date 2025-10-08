import '@testing-library/jest-dom/extend-expect';

// Mock NEXT_PUBLIC_API_BASE_URL default for tests
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8787';

// Basic fetch mock (can be overridden per test)
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Mock crypto.randomUUID for deterministic tests if needed
if (!global.crypto) {
  (global as any).crypto = { randomUUID: () => 'uuid-mock' };
}