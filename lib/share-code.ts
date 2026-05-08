export const CODE_STORAGE_PREFIX = "opendrop_code_";
export const SHARE_CODE_LENGTH = 4;

const CODE_SPACE = 10 ** SHARE_CODE_LENGTH;

export function generateShareCode(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);

  return String(values[0] % CODE_SPACE).padStart(SHARE_CODE_LENGTH, "0");
}

export function getShareCodeKey(code: string): string {
  return CODE_STORAGE_PREFIX + code;
}
