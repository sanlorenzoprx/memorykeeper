'use client';
import InfiniteGallery from '@/components/InfiniteGallery';
import React from 'react';
import GamificationDashboard from '@/components/GamificationDashboard';

export default function MemoriesPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Memories</h1>
      </div>
      <GamificationDashboard />
      <InfiniteGallery />
    </div>
  );
}