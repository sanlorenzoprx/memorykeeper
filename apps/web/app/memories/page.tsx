'use client';  
import InfiniteGallery from '@/components/InfiniteGallery';  
import React from 'react';

export default function MemoriesPage() {  
  return (  
    <div>  
      <h1 className="text-3xl font-bold mb-6">Your Memories</h1>  
      <InfiniteGallery />  
    </div>  
  );  
}
