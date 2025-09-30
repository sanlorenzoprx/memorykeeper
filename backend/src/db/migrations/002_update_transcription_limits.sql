-- Migration to update transcription limits from 30s monthly to 15min weekly
-- This migration updates existing user plans to use the new weekly limits

-- Update all free users to have 15 minutes (900 seconds) weekly limit
UPDATE user_plans
SET transcription_seconds_limit = 900,
    transcription_reset_date = datetime('now', 'start of day', 'weekday 1', '+7 days'),
    updated_at = datetime('now')
WHERE plan_type = 'free';

-- Update premium users to have unlimited access (set limit to a very high number)
UPDATE user_plans
SET transcription_seconds_limit = 999999999,
    updated_at = datetime('now')
WHERE plan_type != 'free';

-- Note: This migration preserves existing usage data but resets the limits according to the new system
