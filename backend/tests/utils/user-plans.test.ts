import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getUserPlan,
  checkTranscriptionLimit,
  updateTranscriptionUsage,
  awardTranscriptionAchievements
} from '../../src/utils/user-plans';
import type { Env } from '../../src/env';

const createMockEnv = () => ({
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
    transaction: vi.fn().mockImplementation(async (fn) => await fn({
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    })),
  } as any,
});

describe('User Plans - Enterprise Tests', () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getUserPlan', () => {
    test('creates new user plan for non-existent user', async () => {
      // Mock user doesn't exist
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      // Mock plan retrieval
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          user_id: 'new-user',
          plan_type: 'free',
          transcription_seconds_used: 0,
          transcription_seconds_limit: 900,
          transcription_reset_date: '2024-01-01T00:00:00.000Z',
        }),
      });

      const plan = await getUserPlan(mockEnv, 'new-user');

      expect(plan.user_id).toBe('new-user');
      expect(plan.plan_type).toBe('free');
      expect(plan.transcription_seconds_limit).toBe(900); // 15 minutes
    });

    test('returns existing user plan', async () => {
      const existingPlan = {
        user_id: 'existing-user',
        plan_type: 'premium_monthly',
        transcription_seconds_used: 100,
        transcription_seconds_limit: 999999999,
        transcription_reset_date: '2024-01-01T00:00:00.000Z',
      };

      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(existingPlan),
      });

      const plan = await getUserPlan(mockEnv, 'existing-user');
      expect(plan).toEqual(existingPlan);
    });

    test('resets usage for free users at start of week', async () => {
      const now = new Date('2024-01-08T10:00:00.000Z'); // Monday
      const resetDate = new Date('2024-01-01T00:00:00.000Z'); // Previous Monday

      vi.setSystemTime(now);

      const existingPlan = {
        user_id: 'reset-user',
        plan_type: 'free',
        transcription_seconds_used: 500,
        transcription_seconds_limit: 900,
        transcription_reset_date: resetDate.toISOString(),
      };

      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(existingPlan),
      });

      // Mock the reset update
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      const plan = await getUserPlan(mockEnv, 'reset-user');

      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_plans')
      );
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('transcription_seconds_used = 0')
      );
    });

    test('downgrades expired premium plans to free', async () => {
      const now = new Date('2024-02-01T00:00:00.000Z'); // After expiration
      const expiredDate = new Date('2024-01-15T00:00:00.000Z'); // Expired

      vi.setSystemTime(now);

      const expiredPlan = {
        user_id: 'expired-user',
        plan_type: 'premium_monthly',
        transcription_seconds_used: 100,
        transcription_seconds_limit: 999999999,
        plan_expires_at: expiredDate.toISOString(),
      };

      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(expiredPlan),
      });

      // Mock the downgrade update
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      const plan = await getUserPlan(mockEnv, 'expired-user');

      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('plan_type = \'free\'')
      );
    });
  });

  describe('checkTranscriptionLimit', () => {
    test('allows transcription within free limits', async () => {
      const plan = {
        user_id: 'test-user',
        plan_type: 'free',
        transcription_seconds_used: 100,
        transcription_seconds_limit: 900,
      };

      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(plan),
      });

      const limit = await checkTranscriptionLimit(mockEnv, 'test-user', 50);

      expect(limit.canTranscribe).toBe(true);
      expect(limit.remainingSeconds).toBe(800);
      expect(limit.upgradeRequired).toBe(false);
    });

    test('blocks transcription exceeding free limits', async () => {
      const plan = {
        user_id: 'test-user',
        plan_type: 'free',
        transcription_seconds_used: 850,
        transcription_seconds_limit: 900,
      };

      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(plan),
      });

      const limit = await checkTranscriptionLimit(mockEnv, 'test-user', 100);

      expect(limit.canTranscribe).toBe(false);
      expect(limit.remainingSeconds).toBe(50);
      expect(limit.upgradeRequired).toBe(true);
    });

    test('allows unlimited transcription for premium users', async () => {
      const plan = {
        user_id: 'premium-user',
        plan_type: 'premium_monthly',
        transcription_seconds_used: 10000,
        transcription_seconds_limit: 999999999,
      };

      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(plan),
      });

      const limit = await checkTranscriptionLimit(mockEnv, 'premium-user', 5000);

      expect(limit.canTranscribe).toBe(true);
      expect(limit.upgradeRequired).toBe(false);
    });

    test('handles zero-duration requests', async () => {
      const plan = {
        user_id: 'test-user',
        plan_type: 'free',
        transcription_seconds_used: 0,
        transcription_seconds_limit: 900,
      };

      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(plan),
      });

      const limit = await checkTranscriptionLimit(mockEnv, 'test-user', 0);

      expect(limit.canTranscribe).toBe(true);
      expect(limit.remainingSeconds).toBe(900);
    });
  });

  describe('updateTranscriptionUsage', () => {
    test('updates usage and creates usage record', async () => {
      // Mock usage update
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      // Mock usage record creation
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      await updateTranscriptionUsage(
        mockEnv,
        'test-user',
        'photo-123',
        120, // 2 minutes
        1500, // 1500 characters
        2500  // 2.5 seconds processing
      );

      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_plans')
      );
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transcription_usage')
      );
    });

    test('handles database errors during usage update', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(
        updateTranscriptionUsage(mockEnv, 'test-user', 'photo-123', 120, 1500, 2500)
      ).rejects.toThrow('Database error');
    });
  });

  describe('awardTranscriptionAchievements', () => {
    test('awards first transcription achievement', async () => {
      // Mock no existing achievement
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      // Mock achievement insertion
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      // Mock streak update
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      await awardTranscriptionAchievements(mockEnv, 'test-user');

      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('FIRST_TRANSCRIPTION')
      );
    });

    test('does not award duplicate achievements', async () => {
      // Mock existing achievement
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ achievement_id: 'FIRST_TRANSCRIPTION' }),
      });

      await awardTranscriptionAchievements(mockEnv, 'test-user');

      // Should not insert duplicate
      expect(mockEnv.DB.prepare).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE INTO user_achievements')
      );
    });

    test('awards streak achievements based on streak length', async () => {
      // Mock existing streak
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ current_streak: 7 }),
      });

      // Mock streak achievement insertion
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      await awardTranscriptionAchievements(mockEnv, 'test-user');

      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('TRANSCRIPTION_STREAK_7')
      );
    });

    test('awards master achievement for 100 transcriptions', async () => {
      // Mock transcription count of 100
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ count: 100 }),
      });

      // Mock achievement insertion
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      await awardTranscriptionAchievements(mockEnv, 'test-user');

      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('TRANSCRIPTION_MASTER')
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles database connection failures', async () => {
      (mockEnv.DB.prepare as any).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(getUserPlan(mockEnv, 'test-user')).rejects.toThrow('Connection failed');
    });

    test('handles malformed plan data gracefully', async () => {
      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      });

      (mockEnv.DB.prepare as any).mockReturnValueOnce({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // No plan found
      });

      await expect(getUserPlan(mockEnv, 'test-user')).rejects.toThrow();
    });

    test('validates input parameters', async () => {
      // Test with invalid user ID
      await expect(getUserPlan(mockEnv, '')).rejects.toThrow();

      // Test with invalid duration
      await expect(checkTranscriptionLimit(mockEnv, 'test-user', -1)).rejects.toThrow();
    });

    test('handles concurrent usage updates', async () => {
      // Simulate concurrent access by mocking the prepare function
      let callCount = 0;
      (mockEnv.DB.prepare as any).mockImplementation((query: string) => {
        callCount++;
        if (callCount === 1 && query.includes('UPDATE user_plans')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true }),
          };
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      });

      // Run multiple concurrent updates
      await Promise.all([
        updateTranscriptionUsage(mockEnv, 'user-1', 'photo-1', 10, 100, 1000),
        updateTranscriptionUsage(mockEnv, 'user-1', 'photo-2', 15, 150, 1500),
      ]);

      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });
});
