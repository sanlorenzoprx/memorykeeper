import Link from 'next/link';  
import { Button } from '@/components/ui/button';

export default function HomePage() {  
  return (  
    <main className="text-center mt-20">  
      <h1 className="text-5xl font-extrabold mb-4 tracking-tight">  
        Memorykeeper  
      </h1>  
      <p className="text-xl text-muted-foreground mb-8">  
        Your personal, voice-enabled photo memory vault.  
      </p>  
      <div className="flex gap-4 justify-center">  
        <Link href="/memories" passHref>  
          <Button size="lg">Go to Your Library</Button>  
        </Link>  
        <Link href="/upload" passHref>  
          <Button size="lg" variant="secondary">Upload a Photo</Button>  
        </Link>  
      </div>  
    </main>  
  );  
}
