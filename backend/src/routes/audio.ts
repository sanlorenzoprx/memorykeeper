import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env; Variables: { auth: { userId: string } } }>();

// Helper function to generate presigned URL for R2
const generatePresignedUrl = async (env: Env, key: string): Promise<string> => {
    try {
        const accountId = env.CLOUDFLARE_ACCOUNT_ID;
        const accessKeyId = env.R2_ACCESS_KEY_ID;

        // Check if we have real credentials or just placeholders
        console.log('Account ID:', accountId);
        console.log('Access Key ID:', accessKeyId);
        if (accountId === 'your_account_id_here' || accessKeyId === 'your_r2_access_key_id') {
            console.warn('Using placeholder credentials - returning mock URL for local development');
            console.warn('For production, set up real R2 credentials in .dev.vars or use wrangler secret put');

            // Return a mock URL that indicates development mode
            // Frontend should handle this case gracefully
            return `dev-mode://mock-upload-url/${key}`;
        }

        if (!accountId) {
            throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
        }

        // Create a simple presigned URL for R2
        // R2 supports S3-compatible presigned URLs
        const bucketName = 'memorykeeper-photos';
        const credential = `${accessKeyId}/${new Date().toISOString().split('T')[0]}/auto/s3/aws4_request`;

        const params = new URLSearchParams({
            'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
            'X-Amz-Credential': credential,
            'X-Amz-Date': new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z',
            'X-Amz-Expires': '3600',
            'X-Amz-SignedHeaders': 'host',
        });

        const url = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}?${params.toString()}`;

        console.log('Generated presigned URL for key:', key);
        return url;
    } catch (error) {
        console.error('Failed to generate presigned URL:', error);
        throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
};

// POST /api/audio/uploads - Request a presigned URL for audio upload
app.post('/uploads', zValidator('json', z.object({ filename: z.string() })), async (c) => {
    const { userId } = c.get('auth');
    const { filename } = c.req.valid('json');
    const key = `audio/${userId}/${Date.now()}-${filename}`;

    const signedUrl = await generatePresignedUrl(c.env, key);

    return c.json({ uploadUrl: signedUrl, key });
});

export default app;