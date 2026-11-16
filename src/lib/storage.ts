import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const FILE_ROUTE = "/api/files/";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export function isSafeKey(key: string): boolean {
  return /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.[a-z0-9]+$/.test(key);
}

export function fileUrl(key: string): string {
  return FILE_ROUTE + key;
}

export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith(FILE_ROUTE)) return null;
  const key = url.slice(FILE_ROUTE.length);
  return isSafeKey(key) ? key : null;
}

interface Store {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

// S3_* settings win; otherwise the AWS-standard vars that `neon env pull` writes for Neon Object Storage.
function s3Store(bucket: string): Store {
  const endpoint = process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3 || undefined;
  const client = new S3Client({
    region: process.env.S3_REGION || process.env.AWS_REGION || "auto",
    endpoint,
    // Neon only supports path-style addressing.
    forcePathStyle:
      process.env.S3_FORCE_PATH_STYLE === "true" ||
      (!process.env.S3_ENDPOINT && Boolean(process.env.AWS_ENDPOINT_URL_S3)),
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined, // AWS SDK default chain: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
  });
  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },
    async get(key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!res.Body) return null;
        return Buffer.from(await res.Body.transformToByteArray());
      } catch (err) {
        if ((err as { name?: string }).name === "NoSuchKey") return null;
        throw err;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

function localStore(dir: string): Store {
  const resolve = (key: string) => path.join(dir, ...key.split("/"));
  return {
    async put(key, body) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async get(key) {
      try {
        return await readFile(resolve(key));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
  };
}

let store: Store | undefined;

function getStore(): Store {
  store ??= process.env.S3_BUCKET
    ? s3Store(process.env.S3_BUCKET)
    : localStore(path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "uploads"));
  return store;
}

function assertKey(key: string) {
  if (!isSafeKey(key)) throw new Error(`Invalid storage key: ${key}`);
}

export async function putFile(key: string, body: Buffer): Promise<string> {
  assertKey(key);
  await getStore().put(key, body, contentTypeFor(key));
  return fileUrl(key);
}

export async function getFile(key: string): Promise<Buffer | null> {
  assertKey(key);
  return getStore().get(key);
}

export async function deleteFileByUrl(url: string | null | undefined): Promise<void> {
  const key = keyFromUrl(url);
  if (key) await getStore().delete(key).catch(() => undefined);
}
