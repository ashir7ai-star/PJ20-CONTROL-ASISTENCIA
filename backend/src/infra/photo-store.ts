/**
 * Selfie storage (CLAUDE.md §2B.6, §3.2). The bucket is never exposed to the
 * internet: photos go in and come out only through the API, which checks an
 * admin session on every read (decision 0004).
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';

export interface PhotoStore {
  put(key: string, jpeg: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

export function createPhotoStore(client: S3Client, bucket: string): PhotoStore {
  return {
    async put(key, jpeg) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: jpeg, ContentType: 'image/jpeg' }),
      );
    },
    async get(key) {
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!object.Body) throw new Error(`Selfie sin contenido: ${key}`);
      return object.Body.transformToByteArray();
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
