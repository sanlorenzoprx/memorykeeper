import type { Env } from '../env';

export async function scheduleR2Delete(env: Env, r2Key: string) {
  const payload = JSON.stringify({ r2Key });
  await env.DB.prepare('INSERT INTO jobs (kind, payload) VALUES (?, ?)')
    .bind('r2-delete', payload)
    .run();
}

export async function scheduleTranscriptionJob(env: Env, r2Key: string, photoId: string) {
  const payload = JSON.stringify({ r2Key, photoId });
  await env.DB.prepare('INSERT INTO jobs (kind, payload) VALUES (?, ?)')
    .bind('transcribe', payload)
    .run();
}

export async function performR2Delete(env: Env, r2Key: string) {
  if (!env.PHOTOS_BUCKET) {
    console.warn('PHOTOS_BUCKET is not configured. Cannot perform R2 delete.');
    return;
  }
  try {
    await env.PHOTOS_BUCKET.delete(r2Key);
    console.log(`Successfully deleted ${r2Key} from R2.`);
  } catch (err) {
    console.error(`Failed to delete ${r2Key} from R2:`, err);
    throw err; // Re-throw to allow the job to be marked as 'failed'
  }
}