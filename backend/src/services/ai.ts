import type { Env } from '../env';

// This service is responsible for interacting with the Cloudflare AI binding.

/**  
 * Transcribes an audio file stored in R2 and updates the corresponding photo record.  
 * @param env - The Cloudflare environment bindings.  
 * @param r2Key - The R2 key for the audio file.  
 * @param photoId - The ID of the photo to associate the transcription with.  
 */  
export async function transcribeAudioAndUpdatePhoto(env: Env, r2Key: string, photoId: string) {  
  console.log(`Starting transcription for photo ${photoId} with audio key ${r2Key}`);

  // 1. Fetch the audio object from R2  
  const audioObj = await env.PHOTOS_BUCKET.get(r2Key);  
  if (!audioObj) {  
    throw new Error(`Audio object not found in R2 for key: ${r2Key}`);  
  }  
  const audioBuffer = await audioObj.arrayBuffer();

  // 2. Run the transcription using the AI binding  
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
    
  // 3. Update the photo record in D1 with the transcription text  
  await env.DB.prepare(  
    'UPDATE photos SET transcription_text = ? WHERE id = ?'  
  ).bind(transcription, photoId).run();

  // 4. Optionally, create a record in the audio_files table  
  await env.DB.prepare(  
    'INSERT INTO audio_files (id, photo_id, r2_key, transcription_text) VALUES (?, ?, ?, ?)'  
  ).bind(crypto.randomUUID(), photoId, r2Key, transcription).run();

  console.log(`Successfully updated photo ${photoId} with transcription.`);  
  return transcription;  
}

// You can add other AI-related functions here, like image enhancement.
