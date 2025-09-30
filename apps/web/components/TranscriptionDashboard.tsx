'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, TrendingUp, Zap, RefreshCw } from 'lucide-react';

interface TranscriptionUsage {
  plan: {
    type: string;
    transcription_seconds_used: number;
    transcription_seconds_limit: number;
    transcription_reset_date: string;
    remaining_seconds: number;
  };
  recent_activity: Array<{
    audio_duration_seconds: number;
    transcription_length: number;
    created_at: string;
  }>;
}

export default function TranscriptionDashboard() {
  const { getToken } = useAuth();

  const { data: usageData, isLoading, refetch } = useQuery({
    queryKey: ['transcription-usage'],
    queryFn: async () => {
      const token = await getToken();
      return apiGet('/api/gamification/transcription-usage', token);
    },
  });

  const usage = usageData as TranscriptionUsage | undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-24 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Unable to load transcription usage data.</p>
        </CardContent>
      </Card>
    );
  }

  const usagePercentage = (usage.plan.transcription_seconds_used / usage.plan.transcription_seconds_limit) * 100;
  const isPremium = usage.plan.type !== 'free';
  const usedMinutes = Math.floor(usage.plan.transcription_seconds_used / 60);
  const totalMinutes = Math.floor(usage.plan.transcription_seconds_limit / 60);
  const remainingMinutes = Math.floor(usage.plan.remaining_seconds / 60);

  return (
    <div className="space-y-6">
      {/* Usage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Transcription Usage
          </CardTitle>
          <CardDescription>
            Track your voice caption transcription usage and limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {usedMinutes} of {totalMinutes} minutes used this week
            </span>
            <Badge variant={isPremium ? "default" : "secondary"}>
              {usage.plan.type === 'free' ? 'Free Plan' : 'Premium Plan'}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Usage: {usagePercentage.toFixed(1)}%</span>
              <span>
                Resets: {new Date(usage.plan.transcription_reset_date).toLocaleDateString()}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  usagePercentage > 80 ? 'bg-red-500' :
                  usagePercentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              {remainingMinutes} minutes remaining
            </span>
            <span>
              Weekly limit: {totalMinutes} minutes
            </span>
          </div>

          {/* Low Usage Warning */}
          {!isPremium && usage.plan.remaining_seconds < 300 && usage.plan.remaining_seconds > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {remainingMinutes < 1 ? 'Less than 1 minute' : `${remainingMinutes} minutes`} remaining this week
                </span>
              </div>
              <p className="text-xs text-yellow-600 mt-1">
                Upgrade to premium for unlimited transcription and sharing.
              </p>
            </div>
          )}

          {/* No Time Left */}
          {!isPremium && usage.plan.remaining_seconds <= 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
              <div className="text-red-700 mb-2">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <div className="font-medium">Weekly transcription limit reached</div>
              </div>
              <p className="text-sm text-red-600 mb-3">
                You've used all 15 minutes of free transcription this week.
              </p>
              <Button className="w-full">
                Upgrade to Premium
              </Button>
            </div>
          )}

          {/* Premium User */}
          {isPremium && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <div className="text-green-700">
                <Zap className="h-6 w-6 mx-auto mb-2" />
                <div className="font-medium">Premium Plan Active</div>
              </div>
              <p className="text-sm text-green-600">
                Unlimited transcription and sharing included.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity (Simplified) */}
      {usage.recent_activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usage.recent_activity.slice(0, 3).map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <div>
                      <div className="font-medium text-sm">
                        {Math.floor(activity.audio_duration_seconds / 60)}:{(activity.audio_duration_seconds % 60).toString().padStart(2, '0')} audio
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {activity.transcription_length} characters transcribed
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(activity.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Refresh Button */}
            <div className="flex justify-end pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
