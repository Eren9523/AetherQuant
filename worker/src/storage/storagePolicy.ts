export const STORAGE_POLICY = {
  MAX_D1_METADATA_PAYLOAD_BYTES: 256 * 1024, // 256KB
  MAX_DATASET_METADATA_BYTES: 64 * 1024, // 64KB
  MAX_UPLOAD_SIZE_BYTES: 500 * 1024 * 1024, // 500MB
};

export function checkD1Budget(payloadStr: string, limitBytes = STORAGE_POLICY.MAX_DATASET_METADATA_BYTES) {
  const bytes = new TextEncoder().encode(payloadStr).length;
  if (bytes > limitBytes) {
    throw new Error(`D1_PAYLOAD_TOO_LARGE: Payload size ${bytes} bytes exceeds limit of ${limitBytes} bytes.`);
  }
}
