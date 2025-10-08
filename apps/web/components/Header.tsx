'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import { Button } from './ui/button';

export default function Header() {
  const { user } = useUser();
  const isAdmin = useMemo(() => {
    const roles = (user?.organizationMemberships?.map(m => m.role) || []).concat(
      (user?.publicMetadata?.role ? [String(user.publicMetadata.role)] : [])
    );
    return roles.includes('admin');
  }, [user]);

  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center justify-between p-4">
        <Link href="/" className="text-2xl font-bold">
          Memorykeeper
        </Link>
        <nav className="flex items-center gap-4">
          <SignedIn>
            <Link href="/memories"><Button variant="ghost">Library</Button></Link>
            <Link href="/albums"><Button variant="ghost">Albums</Button></Link>
            {isAdmin && <Link href="/admin/jobs"><Button variant="ghost">Jobs</Button></Link>}
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost">Sign In</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button>Sign Up</Button>
            </SignUpButton>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}