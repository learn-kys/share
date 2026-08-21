export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://aliceblue-rook-124259.hostingersite.com";

export const API_ENDPOINTS = {
  UPLOAD_BATCH: `${API_BASE_URL}/upload-batch`,
  SHARE_CODE_FILE: `${API_BASE_URL}/share-code/file`,
  SHARE_CODE_TEXT: `${API_BASE_URL}/share-code/text`,
  SHARE_CODE_LOOKUP: `${API_BASE_URL}/share-code`,
} as const;


