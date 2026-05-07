export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://opendrop.onrender.com";

export const API_ENDPOINTS = {
  UPLOAD_BATCH: `${API_BASE_URL}/upload-batch`,
} as const;
