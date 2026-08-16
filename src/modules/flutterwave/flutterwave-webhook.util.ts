import * as crypto from 'node:crypto';

/**
 * Flutterwave webhook "signature" is a static secret hash configured in the
 * dashboard, echoed back verbatim in the `verif-hash` header — a plain
 * shared-secret comparison, not an HMAC over the payload. Still worth a
 * timing-safe compare (costs nothing, avoids a timing side-channel on the
 * secret even though Flutterwave's own mechanism doesn't require it).
 */
export function verifyWebhookSignature(
  headerValue: string | undefined,
  configuredSecret: string,
): boolean {
  if (!headerValue) return false;

  const provided = Buffer.from(headerValue);
  const expected = Buffer.from(configuredSecret);

  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}
