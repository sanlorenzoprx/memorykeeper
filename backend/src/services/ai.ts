import type { Env } from '../env';

/**
 * Transcribes an audio file stored in R2 and updates the corresponding photo record.
 * Adds bounded retry logic and records usage metrics.
 * Gracefully handles empty transcriptions by still recording the audio file entry.
 */
export async function transcribeAudioAndUpdatePhoto(env: Env, r2Key: string, photoId: string) {
  console.log(`Starting transcription for photo ${photoId} with audio key ${r2Key}`);

  const audioObj = await env.PHOTOS_BUCKET.get(r2Key);
  if (!audioObj) {
    throw new Error(`Audio object not found in R2 for key: ${r2Key}`);
  }
  const audioBuffer = await audioObj.arrayBuffer();

  const model = env.AI_MODEL_WHISPER || '@cf/openai/whisper';

  const maxAttempts = 3;
  let attempt = 0;
  let transcription = '';
  const start = Date.now();

  while (attempt < maxAttempts) {
    try {
      const response: { text: string } = await env.AI.run(model, {
        audio: [...new Uint8Array(audioBuffer)],
      });
      transcription = response.text || '';
      break;
    } catch (error) {
      attempt += 1;
      console.error(`Transcription attempt ${attempt} failed for photo ${photoId}`, error);
      if (attempt >= maxAttempts) {
        throw error;
      }
      // small backoff
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }

  const processingTimeMs = Date.now() - start;
  const transcriptionLengthChars = transcription.length;
  // We don't have audio duration here; set to 0 as a placeholder
  const audioDurationSeconds = 0;

  await env.DB.transaction(async (tx) => {
    // Always record the audio file row (even if transcription is empty)
    await tx
      .prepare(
        'INSERT INTO audio_files (id, photo_id, r2_key, transcription_text, duration_seconds) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(crypto.randomUUID(), photoId, r2Key, transcription || null, audioDurationSeconds)
      .run();

    if (transcription) {
      await tx
        .prepare('UPDATE photos SET transcription_text = ? WHERE id = ?')
        .bind(transcription, photoId)
        .run();
    }

    // Usage metrics for observability and quota
    await tx
      .prepare(
        'INSERT INTO transcription_usage (id, user_id, photo_id, audio_duration_seconds, transcription_length_chars, processing_time_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        crypto.randomUUID(),
        // We don't have userId in this function; infer via photo owner lookup
        // Fallback to NULL if not found
        await (async () => {
          const owner = await env.DB.prepare('SELECT owner_id FROM photos WHERE id = ?').bind(photoId).first<{ owner_id: string }>();
          return owner?.owner_id ?? null;
        })(),
        photoId,
        audioDurationSeconds,
        transcriptionLengthChars,
        processingTimeMs,
        new Date().toISOString()
      )
      .run();
  });

  if (!transcription) {
    console.warn(`Transcription for ${r2Key} was empty. Audio recorded; photo left unchanged.`);
    return null;
  }

  console.log(`Successfully updated photo ${photoId} with transcription.`);
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