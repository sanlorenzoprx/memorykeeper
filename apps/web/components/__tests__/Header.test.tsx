import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Header from '@/components/Header';

let mockRole: string | undefined = 'admin';

vi.mock('@clerk/nextjs', () => ({
  SignedIn: ({ children }: any) => <>{children}</>,
  SignedOut: ({ children }: any) => null,
  useUser: () => ({ user: { organizationMemberships: [], publicMetadata: { role: mockRole } } }),
  UserButton: () => <div data-testid="user-btn" />,
  SignInButton: ({ children }: any) => <>{children}</>,
  SignUpButton: ({ children }: any) => <>{children}</>,
}));

afterEach(() => {
  cleanup();
  mockRole = 'admin';
});

describe('Header', () => {
  test('renders brand title', () => {
    render(<Header />);
    expect(screen.getByText('Memorykeeper')).toBeInTheDocument();
  });

  test('shows Jobs link for admin users', () => {
    render(<Header />);
    expect(screen.getByText('Jobs')).toBeInTheDocument();
  });

  test('hides Jobs link for non-admin users', () => {
    mockRole = 'user';
    render(<Header />);
    expect(screen.queryByText('Jobs')).not.toBeInTheDocument();
  });
});