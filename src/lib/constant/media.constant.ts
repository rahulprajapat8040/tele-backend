export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
];

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
];

export const ALLOWED_MEDIA_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
];

export const MEDIA_BUCKET = process.env.RUSTFS_BUCKET || 'telegram-media';

export const MEDIA_MAX_SIZE = 100 * 1024 * 1024; // 100 MB

export const IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export const VIDEO_MAX_SIZE = 100 * 1024 * 1024; // 100 MB

export const AUDIO_MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export const DOCUMENT_MAX_SIZE = 50 * 1024 * 1024; // 50 MB
