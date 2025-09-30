// This ensures TypeScript knows about the bindings defined in wrangler.toml
export interface Env {
    DB: D1Database;
    PHOTOS_BUCKET: R2Bucket;
    AI: any; // The AI binding

    // Secrets (set via `wrangler secret put` or in .dev.vars for local)
    CLERK_JWKS_URI: string;
    CLERK_ISSUER: string;
    AI_MODEL_WHISPER?: string;
}

// Cloudflare Workers runtime types for scheduled functions
declare global {
    interface ScheduledController {
        scheduledTime: number;
        cron: string;
    }

    interface ExecutionContext {
        waitUntil(promise: Promise<any>): void;
        passThroughOnException(): void;
    }

    interface D1Database {
        prepare(query: string): D1PreparedStatement;
    }

    interface D1PreparedStatement {
        bind(...values: any[]): D1PreparedStatement;
        run(): Promise<D1Result>;
        all<T = unknown>(): Promise<D1Result<T>>;
        first<T = unknown>(colName?: string): Promise<T | null>;
    }

    interface D1Result<T = unknown> {
        results: T[];
        success: boolean;
        meta: D1Meta;
    }

    interface D1Meta {
        duration: number;
        size_after: number;
        rows_read: number;
        rows_written: number;
    }

    interface R2Bucket {
        put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>;
        get(key: string): Promise<R2Object | null>;
        delete(keys: string | string[]): Promise<void>;
        list(options?: R2ListOptions): Promise<R2Objects>;
        getSignedUrl(key: string, options?: R2GetSignedUrlOptions): Promise<string>;
    }

    interface R2GetSignedUrlOptions {
        method?: string;
        expiresIn?: number;
        contentType?: string;
    }

    interface R2Object {
        key: string;
        size: number;
        etag: string;
        httpEtag: string;
        checksums: R2Checksums;
        uploaded: Date;
        httpMetadata?: R2HTTPMetadata;
        customMetadata?: Record<string, string>;
        body: ReadableStream;
        bodyUsed: boolean;
        text(): Promise<string>;
        json<T = unknown>(): Promise<T>;
        arrayBuffer(): Promise<ArrayBuffer>;
        blob(): Promise<Blob>;
    }

    interface R2PutOptions {
        httpMetadata?: R2HTTPMetadata;
        customMetadata?: Record<string, string>;
        checksums?: R2Checksums;
    }

    interface R2HTTPMetadata {
        contentType?: string;
        contentLanguage?: string;
        contentDisposition?: string;
        contentEncoding?: string;
        cacheControl?: string;
        cacheExpiry?: Date;
    }

    interface R2Checksums {
        md5?: string;
        sha1?: string;
        sha256?: string;
        sha384?: string;
        sha512?: string;
    }

    interface R2ListOptions {
        limit?: number;
        prefix?: string;
        cursor?: string;
        delimiter?: string;
        startAfter?: string;
    }

    interface R2Objects {
        objects: R2Object[];
        truncated: boolean;
        cursor?: string;
        delimitedPrefixes?: string[];
    }
}