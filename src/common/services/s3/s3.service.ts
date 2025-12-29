import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl?: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.must('S3_ENDPOINT'); // https://is3.cloudhost.id
    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    const forcePathStyle =
      this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true';

    this.bucket = this.must('S3_BUCKET');
    this.publicBaseUrl =
      this.config.get<string>('S3_PUBLIC_BASE_URL') ?? undefined;

    this.s3 = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId: this.must('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.must('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  async uploadBuffer(params: {
    key: string;
    buffer: Buffer;
    contentType?: string;
    cacheControl?: string;
  }) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
        CacheControl: params.cacheControl,
        ACL: 'public-read',
      }),
    );

    return {
      key: params.key,
      url: this.getPublicUrl(params.key), // kalau bucket/object public
    };
  }

  async delete(key: string) {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return { key };
  }

  async exists(key: string) {
    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  signedUploadUrl(params: {
    key: string;
    contentType?: string;
    expiresInSec?: number;
  }) {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
    });
    return getSignedUrl(this.s3, cmd, { expiresIn: params.expiresInSec ?? 60 });
  }

  signedDownloadUrl(params: { key: string; expiresInSec?: number }) {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: params.key });
    return getSignedUrl(this.s3, cmd, { expiresIn: params.expiresInSec ?? 60 });
  }

  getPublicUrl(key: string) {
    if (!this.publicBaseUrl) return undefined;
    const base = this.publicBaseUrl.replace(/\/$/, '');
    return `${base}/${encodeURIComponent(key).replaceAll(/%2F/g, '/')}`;
  }

  private must(name: string) {
    const v = this.config.get<string>(name);
    if (!v) throw new Error(`${name} is required`);
    return v;
  }
}
