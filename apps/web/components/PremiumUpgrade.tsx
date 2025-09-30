'use client';
import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Crown, Zap, Check, Star, Users, Share2, Image, Volume2 } from 'lucide-react';

interface PremiumUpgradeProps {
  trigger?: React.ReactNode;
  feature?: string;
  currentUsage?: { current: number; limit: number };
}

export default function PremiumUpgrade({
  trigger,
  feature = "unlimited sharing",
  currentUsage
}: PremiumUpgradeProps) {
  return (
    <Card className="max-w-md mx-auto border-2 border-gradient-to-r from-yellow-400 to-orange-500 bg-gradient-to-br from-yellow-50 to-orange-50">
      <CardHeader className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
          <Crown className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-2xl">Upgrade to Memory Locker</CardTitle>
        <CardDescription className="text-base">
          Unlock premium features and preserve unlimited memories
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Usage */}
        {currentUsage && (
          <div className="p-4 bg-white/50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Current Usage</span>
              <Badge variant="outline">
                {currentUsage.current}/{currentUsage.limit}
              </Badge>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((currentUsage.current / currentUsage.limit) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentUsage.limit - currentUsage.current} shares remaining this month
            </p>
          </div>
        )}

        {/* Premium Features */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            Premium Features
          </h4>

          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center gap-3 p-3 bg-white/70 rounded-lg">
              <Share2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">Unlimited Sharing</p>
                <p className="text-sm text-muted-foreground">Share as many memories as you want</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white/70 rounded-lg">
              <Image className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">AI Image Enhancement</p>
                <p className="text-sm text-muted-foreground">Professional photo quality improvement</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white/70 rounded-lg">
              <Volume2 className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium">Advanced Transcription</p>
                <p className="text-sm text-muted-foreground">Higher accuracy voice-to-text conversion</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white/70 rounded-lg">
              <Users className="h-5 w-5 text-indigo-600" />
              <div>
                <p className="font-medium">Priority Support</p>
                <p className="text-sm text-muted-foreground">Get help when you need it most</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="text-center p-4 bg-white/80 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl font-bold">$4.99</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Cancel anytime • 30-day money-back guarantee
          </p>
          <Button className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600">
            <Zap className="mr-2 h-4 w-4" />
            Upgrade Now
          </Button>
        </div>

        {/* Gamification Incentive */}
        <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            💡 <strong>Pro Tip:</strong> Share memories to earn bonus shares!
            Every 3 shares = 2 bonus, every 6 shares = 5 bonus!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
