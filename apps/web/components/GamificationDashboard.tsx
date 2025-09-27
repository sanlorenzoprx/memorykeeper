'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Flame } from 'lucide-react';

interface GamificationData {
  streak: number;
  achievements: { name: string; description: string }[];
}

export default function GamificationDashboard() {
  const { data, isLoading } = useQuery<GamificationData>({
    queryKey: ['gamification'],
    queryFn: () => apiGet('/api/gamification'),
  });

  if (isLoading) {
    return <div className="text-center">Loading stats...</div>;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Your Progress</CardTitle>
        <CardDescription>Keep up the great work preserving your memories!</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <h3 className="font-semibold flex items-center"><Flame className="mr-2 h-5 w-5 text-orange-500" /> Current Streak</h3>
          <p className="text-2xl font-bold">{data?.streak || 0} days</p>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Achievements</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {data?.achievements && data.achievements.length > 0 ? (
              data.achievements.map((ach) => <Badge key={ach.name}>{ach.name}</Badge>)
            ) : (
              <p className="text-sm text-muted-foreground">No achievements unlocked yet.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}