export class StorageConfigurationError extends Error {
    constructor() {
        super("Document storage is not configured correctly. Your report remains saved; retry files after the administrator configures storage.");
    }
}
export function storageConfiguration(env: Record<string, string | undefined>) {
    const keys = ["B2_ENDPOINT", "B2_REGION", "B2_KEY_ID", "B2_APP_KEY", "B2_BUCKET_NAME"] as const;
    if (keys.some((key) => !env[key]?.trim()))
        throw new StorageConfigurationError();
    let endpoint: URL;
    try {
        endpoint = new URL(env.B2_ENDPOINT!);
    }
    catch {
        throw new StorageConfigurationError();
    }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
    const b2Region = /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/.exec(endpoint.hostname)?.[1];
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== "/" ||
        (!local && (endpoint.protocol !== "https:" || !b2Region || b2Region !== env.B2_REGION)) ||
        (local && !["http:", "https:"].includes(endpoint.protocol)) ||
        !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(env.B2_BUCKET_NAME!) ||
        (env.B2_FORCE_PATH_STYLE !== undefined && !["true", "false"].includes(env.B2_FORCE_PATH_STYLE)))
        throw new StorageConfigurationError();
    return {
        endpoint: endpoint.origin, region: env.B2_REGION!, bucket: env.B2_BUCKET_NAME!,
        forcePathStyle: env.B2_FORCE_PATH_STYLE === "true",
        credentials: { accessKeyId: env.B2_KEY_ID!, secretAccessKey: env.B2_APP_KEY! },
        requestChecksumCalculation: "WHEN_REQUIRED" as const,
        responseChecksumValidation: "WHEN_REQUIRED" as const,
    };
}
