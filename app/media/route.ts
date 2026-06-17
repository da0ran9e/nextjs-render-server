import { spawn } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { NextRequest } from 'next/server';
import { mediaKind, mediaSettings } from '../media-settings';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

const RAW_CACHE = 'public, max-age=3600';
const RENDER_CACHE = 'public, max-age=31536000, immutable';
const SAFE_ORIGINAL_NAME_RE = /^[\w.\- ]+$/;

function storagePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function publicObjectUrl(base: string, bucket: string, path: string) {
  return `${base}/storage/v1/object/public/${bucket}/${storagePath(path)}`;
}

function uploadObjectUrl(base: string, bucket: string, path: string) {
  return `${base}/storage/v1/object/${bucket}/${storagePath(path)}`;
}

function cacheName(name: string, profile: string, ext: string) {
  const settings = mediaSettings();
  const stem = name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'media';
  const hash = createHash('sha1').update(name).digest('hex').slice(0, 12);
  return `${settings.cachePrefix}/${profile}/${stem}-${hash}.${ext}`;
}

async function fetchObject(base: string, bucket: string, path: string, accept: string) {
  return fetch(publicObjectUrl(base, bucket, path), {
    cache: 'no-store',
    headers: {
      Accept: accept,
      'User-Agent': 'Mozilla/5.0 (compatible; NextProxy/1.0)',
    },
  });
}

function mediaResponse(data: Buffer, contentType: string, cacheControl: string) {
  return new Response(data, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cacheControl,
      'Content-Length': String(data.byteLength),
      'Content-Type': contentType,
    },
  });
}

async function cachedDerivative(base: string, bucket: string, path: string, contentType: string) {
  const r = await fetchObject(base, bucket, path, contentType);
  if (!r.ok) return null;
  return mediaResponse(Buffer.from(await r.arrayBuffer()), contentType, RENDER_CACHE);
}

async function uploadDerivative(
  base: string,
  bucket: string,
  serviceKey: string | undefined,
  path: string,
  data: Buffer,
  contentType: string
) {
  if (!serviceKey) return;
  await fetch(uploadObjectUrl(base, bucket, path), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: data,
  }).catch(() => {});
}

async function originalResponse(base: string, bucket: string, name: string) {
  const r = await fetchObject(base, bucket, name, 'image/avif,image/webp,image/*,video/*,*/*');
  if (!r.ok) return new Response('upstream ' + r.status, { status: 502 });
  return mediaResponse(
    Buffer.from(await r.arrayBuffer()),
    r.headers.get('content-type') || 'application/octet-stream',
    RAW_CACHE
  );
}

async function optimizedImage(base: string, bucket: string, serviceKey: string | undefined, name: string) {
  const settings = mediaSettings();
  const path = cacheName(name, settings.imageProfile, 'webp');
  const cached = await cachedDerivative(base, bucket, path, 'image/webp');
  if (cached) return cached;

  const original = await fetchObject(base, bucket, name, 'image/avif,image/webp,image/*,*/*');
  if (!original.ok) return new Response('upstream ' + original.status, { status: 502 });
  const source = Buffer.from(await original.arrayBuffer());

  try {
    const sharp = (await import('sharp')).default;
    const out = await sharp(source, { failOn: 'none' })
      .rotate()
      .resize({
        fit: 'inside',
        height: settings.imageMaxEdge,
        width: settings.imageMaxEdge,
        withoutEnlargement: true,
      })
      .webp({ quality: settings.imageQuality })
      .toBuffer();
    await uploadDerivative(base, bucket, serviceKey, path, out, 'image/webp');
    return mediaResponse(out, 'image/webp', RENDER_CACHE);
  } catch {
    return mediaResponse(
      source,
      original.headers.get('content-type') || 'application/octet-stream',
      RAW_CACHE
    );
  }
}

function runFfmpeg(command: string, args: string[], timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let stderr = '';
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const timer = setTimeout(() => {
      if (!settled) child.kill('SIGKILL');
    }, timeoutMs);

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk).slice(0, 1000);
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr || `ffmpeg exited ${code}`));
    });
  });
}

async function optimizedVideo(base: string, bucket: string, serviceKey: string | undefined, name: string) {
  const settings = mediaSettings();
  const path = cacheName(name, settings.videoProfile, 'mp4');
  const cached = await cachedDerivative(base, bucket, path, 'video/mp4');
  if (cached) return cached;
  if (!serviceKey) return originalResponse(base, bucket, name);

  const ffmpegModule = await import('ffmpeg-static');
  const ffmpegPath = ffmpegModule.default;
  if (!ffmpegPath) return originalResponse(base, bucket, name);

  const original = await fetchObject(base, bucket, name, 'video/*,*/*');
  if (!original.ok) return new Response('upstream ' + original.status, { status: 502 });

  const workDir = join(tmpdir(), 'album-render');
  const id = randomUUID();
  const inputExt = (name.split('.').pop() || 'mp4').replace(/[^a-z0-9]/gi, '') || 'mp4';
  const inputPath = join(workDir, `${id}.${inputExt}`);
  const outputPath = join(workDir, `${id}.mp4`);

  try {
    await mkdir(workDir, { recursive: true });
    await writeFile(inputPath, Buffer.from(await original.arrayBuffer()));
    await runFfmpeg(
      ffmpegPath,
      [
        '-y',
        '-i',
        inputPath,
        '-vf',
        `scale=${settings.videoMaxWidth}:-2:force_original_aspect_ratio=decrease`,
        '-an',
        '-c:v',
        'libx264',
        '-preset',
        settings.videoPreset,
        '-crf',
        String(settings.videoCrf),
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        outputPath,
      ],
      settings.videoTimeoutMs
    );
    const out = await readFile(outputPath);
    await uploadDerivative(base, bucket, serviceKey, path, out, 'video/mp4');
    return mediaResponse(out, 'video/mp4', RENDER_CACHE);
  } catch {
    return originalResponse(base, bucket, name);
  } finally {
    await Promise.all([unlink(inputPath).catch(() => {}), unlink(outputPath).catch(() => {})]);
  }
}

// Proxy ảnh/video công khai từ Supabase Storage về cùng nguồn (same-origin),
// đồng thời trả bản nhẹ hơn để WebGL không phải tải file gốc.
export async function GET(req: NextRequest) {
  const base = process.env.SUPABASE_URL;
  const bucket = process.env.SUPABASE_BUCKET || 'album';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const name = req.nextUrl.searchParams.get('name');

  if (!base || !name) return new Response('bad request', { status: 400 });
  if (!SAFE_ORIGINAL_NAME_RE.test(name)) return new Response('bad name', { status: 400 });
  if (req.nextUrl.searchParams.get('raw') === '1') return originalResponse(base, bucket, name);

  const kind = mediaKind(name);
  try {
    if (kind === 'image') return optimizedImage(base, bucket, serviceKey, name);
    if (kind === 'video') return optimizedVideo(base, bucket, serviceKey, name);
    return originalResponse(base, bucket, name);
  } catch (e: any) {
    return new Response('error ' + (e?.message || ''), { status: 502 });
  }
}
