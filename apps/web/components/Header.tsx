'use client';

import Link from 'next/link';  
import { UserButton, SignedIn, SignedOut } from '@clerk/nextjs';  
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
            <Link href="/sign-in">  
                <Button>Sign In</Button>  
            </Link>  
          </SignedOut>  
        </nav>  
      </div>  
    </header>  
  );  
}
