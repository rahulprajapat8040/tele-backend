export const storageConfig = {
  endpoint: process.env.RUSTFS_ENDPOINT!,
  region: process.env.RUSTFS_REGION,
  accessKeyId: process.env.RUSTFS_ACCESS_KEY,
  secretAccessKey: process.env.RUSTFS_SECRET_KEY,

  bucket: process.env.RUSTFS_BUCKET!,

  forcePathStyle: true,
};
