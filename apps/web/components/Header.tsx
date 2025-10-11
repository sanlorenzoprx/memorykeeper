'use client';

import React from 'react';
import Link from 'next/link';
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';
import { Button } from './ui/button';
import { Camera, Library, FolderOpen, Upload } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900">Memorykeeper</span>
        </Link>
        
        <nav className="flex items-center gap-2">
          <SignedIn>
            <Link href="/memories">
              <Button variant="ghost" className="flex items-center gap-2 text-gray-700 hover:text-primary-600 hover:bg-primary-50">
                <Library className="w-4 h-4" />
                Library
              </Button>
            </Link>
            <Link href="/albums">
              <Button variant="ghost" className="flex items-center gap-2 text-gray-700 hover:text-primary-600 hover:bg-primary-50">
                <FolderOpen className="w-4 h-4" />
                Albums
              </Button>
            </Link>
            <Link href="/upload">
              <Button className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white">
                <Upload className="w-4 h-4" />
                Upload
              </Button>
            </Link>
            <div className="ml-2">
              <UserButton 
                afterSignOutUrl="/" 
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8",
                    userButtonPopoverCard: "shadow-lg border border-gray-200",
                    userButtonPopoverActionButton: "hover:bg-primary-50",
                  }
                }}
              />
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" className="text-gray-700 hover:text-primary-600 hover:bg-primary-50">
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button className="bg-primary-500 hover:bg-primary-600 text-white">
                Sign Up
              </Button>
            </SignUpButton>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}