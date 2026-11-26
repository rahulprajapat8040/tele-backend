import { MediaStatus, MediaType } from '../enum';

export interface UploadedMedia {
  id: string;
  originalName: string;
  mimeType: string;
  size: string;
  mediaType: MediaType;
  status: MediaStatus;
  createdAt: string;
  width: number | null;
  height: number | null;
  duration: number | null;
}
