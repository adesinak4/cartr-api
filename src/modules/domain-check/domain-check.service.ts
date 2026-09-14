import { Injectable, Logger } from '@nestjs/common';
import { slugify } from '../../common/utils/slugify';

export interface DomainCheckResult {
  domain: string;
  // true = free to register, false = already registered, null = could not
  // verify right now (RDAP unreachable/erroring) — never silently guessed
  // as either available or unavailable.
  available: boolean | null;
}

const RDAP_BASE = 'https://rdap.nic.net.ng/domain/';
const CHECK_TIMEOUT_MS = 5000;
const TLD = '.com.ng';

/**
 * Free-tier domain availability checking against NIRA's public RDAP service
 * — deliberately not Truehost's reseller API, which has no documented
 * availability-check endpoint and costs nothing to call here regardless
 * (actual registration is a separate, manual, ops-driven step — see the
 * onboarding plan). RDAP is the modern JSON-over-HTTPS replacement for WHOIS
 * and .ng is one of the ccTLDs that actually implements it.
 */
@Injectable()
export class DomainCheckService {
  private readonly logger = new Logger(DomainCheckService.name);

  /** `domain` must include the TLD, e.g. "zaracollections.com.ng". */
  async check(domain: string): Promise<DomainCheckResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(`${RDAP_BASE}${encodeURIComponent(domain)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/rdap+json' },
      });

      // RFC 7482: a 404 on a domain lookup means no matching registration —
      // i.e. available. Any 2xx means a real record exists — taken.
      if (response.status === 404) {
        return { domain, available: true };
      }
      if (response.ok) {
        return { domain, available: false };
      }

      this.logger.warn(`Unexpected RDAP status ${response.status} for ${domain}`);
      return { domain, available: null };
    } catch (err) {
      this.logger.warn(`RDAP check failed for ${domain}: ${(err as Error).message}`);
      return { domain, available: null };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * The business-name-derived primary candidate, plus a handful of variants
   * checked only if the primary is actually taken (saves RDAP calls on the
   * common case where the first choice is free).
   */
  async suggest(businessName: string): Promise<DomainCheckResult[]> {
    const base = slugify(businessName);
    const primary = `${base}${TLD}`;
    const primaryResult = await this.check(primary);

    if (primaryResult.available !== false) {
      return [primaryResult];
    }

    const alternates = [`shop${base}`, `${base}ng`, `get${base}`, `${base}store`].map(
      (candidate) => `${candidate}${TLD}`,
    );
    const alternateResults = await Promise.all(alternates.map((d) => this.check(d)));

    return [primaryResult, ...alternateResults];
  }
}
