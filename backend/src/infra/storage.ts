import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';

interface StorageOptions {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

/** S3-compatible client (RustFS locally and in Easypanel); path-style addressing. */
export function createStorageClient(options: StorageOptions): S3Client {
  return new S3Client({
    endpoint: options.endpoint,
    region: options.region,
    forcePathStyle: true,
    credentials: { accessKeyId: options.accessKey, secretAccessKey: options.secretKey },
    maxAttempts: 2,
  });
}

export async function checkStorage(client: S3Client, bucket: string): Promise<void> {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
}

/** Creates the private bucket on first boot. Buckets are private by default in S3. */
export async function ensureBucket(
  client: S3Client,
  bucket: string,
): Promise<'exists' | 'created'> {
  try {
    await checkStorage(client, bucket);
    return 'exists';
  } catch (error) {
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      return 'created';
    }
    throw error;
  }
}
