'use client';

import React from 'react';
import Link from 'next/link';
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';
import { Button } from './ui/button';

export default function Header() {
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