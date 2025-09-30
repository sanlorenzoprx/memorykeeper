import type { Env } from '../env';
import { checkTranscriptionLimit, updateTranscriptionUsage, awardTranscriptionAchievements } from '../utils/user-plans';

/**
 * Transcribes an audio file stored in R2 and updates the corresponding photo record.
 * @param env - The Cloudflare environment bindings.
 * @param r2Key - The R2 key for the audio file.
 * @param photoId - The ID of the photo to associate the transcription with.
 * @param userId - The ID of the user requesting transcription.
 */
export async function transcribeAudioAndUpdatePhoto(env: Env, r2Key: string, photoId: string, userId: string) {
  console.log(`Starting transcription for photo ${photoId} with audio key ${r2Key} for user ${userId}`);

  // Get audio file to check duration
  const audioObj = await env.PHOTOS_BUCKET.get(r2Key);
  if (!audioObj) {
    throw new Error(`Audio object not found in R2 for key: ${r2Key}`);
  }

  // For demo purposes, we'll estimate duration (in real app, you'd parse the audio file)
  // For now, assume all audio files are under 30 seconds for free users
  const estimatedDuration = 25; // seconds - this should be calculated from actual audio

  // Check user's transcription limits
  const limitCheck = await checkTranscriptionLimit(env, userId, estimatedDuration);

  if (!limitCheck.canTranscribe) {
    const error = new Error(`Transcription limit exceeded. You have ${Math.floor(limitCheck.remainingSeconds / 60)} minutes remaining this week.`) as any;
    error.upgradeRequired = true;
    error.usage = {
      current: limitCheck.usedSeconds,
      limit: limitCheck.totalLimit,
      remaining: limitCheck.remainingSeconds,
      resetDate: limitCheck.resetDate
    };
    throw error;
  }

  const audioBuffer = await audioObj.arrayBuffer();
  const startTime = Date.now();

  const model = env.AI_MODEL_WHISPER || '@cf/openai/whisper';
  const response: { text: string } = await env.AI.run(model, {
    audio: [...new Uint8Array(audioBuffer)],
  });

  const processingTime = Date.now() - startTime;
  const transcription = response.text;

  console.log(`Transcription result for photo ${photoId}: "${transcription}" (took ${processingTime}ms)`);

  if (!transcription || transcription.trim().length === 0) {
    console.warn(`Transcription for ${r2Key} was empty or failed.`);
    throw new Error('Transcription failed - no text was generated');
  }

  // Update database with transcription
  await env.DB.transaction(async (tx) => {
    await tx.prepare(
      'UPDATE photos SET transcription_text = ? WHERE id = ?'
    ).bind(transcription, photoId).run();

    await tx.prepare(
      'INSERT INTO audio_files (id, photo_id, r2_key, transcription_text) VALUES (?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), photoId, r2Key, transcription).run();
  });

  // Update usage tracking
  await updateTranscriptionUsage(env, userId, photoId, estimatedDuration, transcription.length, processingTime);

  console.log(`Successfully updated photo ${photoId} with transcription (${transcription.length} chars, ${estimatedDuration}s audio)`);
  return transcription;
}

/**
 * Placeholder for a surprise image enhancement function.
 * @param env - The Cloudflare environment bindings.
 * @param r2Key - The R2 key for the image file.
 * @param photoId - The ID of the photo to update.
 */
export async function enhanceImage(env: Env, r2Key: string, photoId: string) {
  const imageObj = await env.PHOTOS_BUCKET.get(r2Key);
  if (!imageObj) throw new Error('Image not found in R2');

  const imageBuffer = await imageObj.arrayBuffer();

  // Example: Using a hypothetical image enhancement model
  // const model = '@cf/hypothetical/image-enhancer';
  // const response = await env.AI.run(model, { image: [...new Uint8Array(imageBuffer)] });

  // For now, we'll just simulate an update
  const newKey = `enhanced/${r2Key}`;
  // await env.PHOTOS_BUCKET.put(newKey, response.image); // In a real scenario

  await env.DB.prepare(
    'UPDATE photos SET enhanced_r2_key = ? WHERE id = ?'
  ).bind(newKey, photoId).run();

  console.log(`Photo ${photoId} has been "enhanced".`);
  return newKey;
}