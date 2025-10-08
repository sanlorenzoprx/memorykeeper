import type { Env } from '../env';

/**
 * Transcribes an audio file stored in R2 and updates the corresponding photo record.
 * @param env - The Cloudflare environment bindings.
 * @param r2Key - The R2 key for the audio file.
 * @param photoId - The ID of the photo to associate the transcription with.
 */
export async function transcribeAudioAndUpdatePhoto(env: Env, r2Key: string, photoId: string) {
  console.log(`Starting transcription for photo ${photoId} with audio key ${r2Key}`);

  const audioObj = await env.PHOTOS_BUCKET.get(r2Key);
  if (!audioObj) {
    throw new Error(`Audio object not found in R2 for key: ${r2Key}`);
  }
  const audioBuffer = await audioObj.arrayBuffer();

  // Basic size limit to keep within Workers constraints (~20MB)
  const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
  if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
    throw new Error(`Audio file too large (${audioBuffer.byteLength} bytes). Max allowed is ${MAX_AUDIO_BYTES} bytes.`);
  }

  const model = env.AI_MODEL_WHISPER || '@cf/openai/whisper';
  const response: { text: string } = await env.AI.run(model, {
    audio: [...new Uint8Array(audioBuffer)],
  });

  const transcription = response.text;
  console.log(`Transcription result for photo ${photoId}: "${transcription}"`);

  if (!transcription) {
    console.warn(`Transcription for ${r2Key} was empty.`);
    return;
  }

  await env.DB.transaction(async (tx) => {
    await tx.prepare(
      'UPDATE photos SET transcription_text = ? WHERE id = ?'
    ).bind(transcription, photoId).run();

    await tx.prepare(
      'INSERT INTO audio_files (id, photo_id, r2_key, transcription_text) VALUES (?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), photoId, r2Key, transcription).run();
  });

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