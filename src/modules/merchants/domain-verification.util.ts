import * as crypto from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';

const TXT_RECORD_PREFIX = '_cartr-challenge.';

export function generateVerificationToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Pure — no DNS I/O. Each TXT record can be split into multiple string
 * chunks by the resolver; a record only matches once its chunks are
 * rejoined and compared as a whole.
 */
export function recordsIncludeToken(records: string[][], token: string): boolean {
  return records.some((chunks) => chunks.join('').trim() === token);
}

/**
 * Never throws — a missing record (DNS not propagated yet, or never set)
 * is an expected, ordinary "not verified" outcome, not an application error.
 */
export async function checkCustomDomainTxtRecord(domain: string, token: string): Promise<boolean> {
  try {
    const records = await resolveTxt(`${TXT_RECORD_PREFIX}${domain}`);
    return recordsIncludeToken(records, token);
  } catch {
    return false;
  }
}
