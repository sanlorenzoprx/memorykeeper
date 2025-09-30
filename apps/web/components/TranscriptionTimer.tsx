'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Zap, RefreshCw } from 'lucide-react';

interface TranscriptionUsage {
  plan: {
    type: string;
    transcription_seconds_used: number;
    transcription_seconds_limit: number;
    transcription_reset_date: string;
    remaining_seconds: number;
  };
}

export default function TranscriptionTimer() {
  const { getToken } = useAuth();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const { data: usageData, refetch } = useQuery({
    queryKey: ['transcription-usage'],
    queryFn: async () => {
      const token = await getToken();
      return apiGet('/api/gamification/transcription-usage', token);
    },
    refetchInterval: 60000, // Refetch every minute to update timer
  });

  const usage = usageData as TranscriptionUsage | undefined;

  useEffect(() => {
    if (usage?.plan) {
      setTimeLeft(usage.plan.remaining_seconds);
      setIsLoading(false);
    }
  }, [usage]);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const getTimeColor = (seconds: number) => {
    if (seconds > 300) return 'text-green-600'; // > 5 minutes
    if (seconds > 60) return 'text-yellow-600'; // > 1 minute
    return 'text-red-600'; // < 1 minute
  };

  const getTimeBgColor = (seconds: number) => {
    if (seconds > 300) return 'bg-green-50 border-green-200';
    if (seconds > 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!usage) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Unable to load transcription timer.</p>
        </CardContent>
      </Card>
    );
  }

  const isPremium = usage.plan.type !== 'free';
  const isLowOnTime = timeLeft < 60; // Less than 1 minute

  return (
    <Card className={`${getTimeBgColor(timeLeft)} transition-colors duration-300`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Transcription Time
        </CardTitle>
        <CardDescription>
          {isPremium
            ? 'Unlimited transcription with premium'
            : 'Weekly transcription limit for free users'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPremium ? (
          <div className="text-center py-4">
            <div className="text-2xl font-bold text-green-600 mb-2">∞</div>
            <p className="text-sm text-muted-foreground">Unlimited transcription</p>
          </div>
        ) : (
          <>
            {/* Timer Display */}
            <div className="text-center py-4">
              <div className={`text-3xl font-bold mb-2 ${getTimeColor(timeLeft)}`}>
                {formatTime(timeLeft)}
              </div>
              <p className="text-sm text-muted-foreground">
                remaining this week
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used: {Math.floor((usage.plan.transcription_seconds_used / usage.plan.transcription_seconds_limit) * 100)}%</span>
                <span>Resets: {new Date(usage.plan.transcription_reset_date).toLocaleDateString()}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-1000 ${
                    timeLeft > 300 ? 'bg-green-500' :
                    timeLeft > 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(usage.plan.transcription_seconds_used / usage.plan.transcription_seconds_limit) * 100}%` }}
                />
              </div>
            </div>

            {/* Low Time Warning */}
            {isLowOnTime && timeLeft > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-medium">Running low on transcription time!</span>
                </div>
                <p className="text-xs text-red-600 mt-1">
                  Upgrade to premium for unlimited transcription.
                </p>
              </div>
            )}

            {/* No Time Left */}
            {timeLeft <= 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                <div className="text-red-700 mb-2">
                  <Clock className="h-8 w-8 mx-auto mb-2" />
                  <div className="font-medium">Transcription time expired</div>
                </div>
                <p className="text-sm text-red-600 mb-3">
                  You've used all 15 minutes of free transcription this week.
                </p>
                <Button className="w-full">
                  Upgrade to Premium
                </Button>
              </div>
            )}
          </>
        )}

        {/* Refresh Button */}
        <div className="flex justify-end pt-2">
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
  );
}
