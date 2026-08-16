# Cartr API

Backend for Cartr — a multi-tenant Nigerian storefront-builder platform (merchant storefronts,
merchant dashboard, platform admin console). NestJS + Drizzle + PostgreSQL + Redis, independent
from the frontend (a separate repo).

## Architecture

- **Multi-tenancy**: row-level, enforced in the repository layer. Every tenant-owned table has a
  `tenant_id` column; `TenantScopedRepository` (`src/common/tenant/`) injects the tenant filter
  automatically via `AsyncLocalStorage` — there's no code path that can accidentally issue an
  unscoped query against a tenant-owned table. Tenant context is seeded two ways: from the JWT
  payload for authenticated requests (`TenantContextInterceptor`), or from the `:slug` route param
  / custom domain for public storefront requests (`TenantContextMiddleware`).
- **Auth**: custom, Passport-based. Access tokens (15m) + rotating refresh tokens (7d, hashed in
  the `refresh_tokens` table). Reuse of an already-rotated refresh token is treated as a theft
  signal and revokes the whole token family. Access tokens carry a `jti` checked against a Redis
  denylist on every request, so logout takes effect immediately rather than waiting out the
  token's natural expiry.
- **Errors**: domain error hierarchy (`src/common/errors/`) → `GlobalExceptionFilter` maps every
  error to a consistent `{status: "error", message, code}` envelope and the right HTTP status.
  Every successful response is wrapped as `{status: "success", data}`.
- **Users**: one `users` table for both platform admins (`tenantId: null`) and merchant
  owners/staff (`tenantId` set). Email is globally unique by design — no store-picker at login.
- **Payments (Flutterwave)**: `src/modules/flutterwave/` is an isolated HTTP adapter (no domain
  knowledge); merchant payout accounts get a real Flutterwave subaccount on creation
  (`PaymentAccountsService.create`); checkout (`OrdersService.checkout`) blocks on a ready payout
  account and an assigned plan, computes the platform's cut from `plans.transactionFeePercent`,
  and initializes a split payment. Order confirmation happens asynchronously via
  `POST /webhooks/flutterwave`, which never trusts the webhook payload alone — it always
  re-verifies the transaction against Flutterwave directly before marking anything settled (the
  `verif-hash` header is a shared secret, not a cryptographic signature over the payload).
- **Domain events**: `src/common/events/` — an in-process event bus (`@nestjs/event-emitter`, not
  a message broker) so side effects of a state transition don't pile into the service method that
  caused it. Currently emitted: `order.confirmed` and `order.payment_received_after_cancelled`
  (webhook handler), `merchant.suspended` / `merchant.reactivated` (`AdminService`). One listener
  today (`DomainEventsListener`, structured logging) — add more independently as real consumers
  show up (notifications, etc.); don't reach for a real broker until there's an actual second
  deployed service to justify it.
- **Stock reservation**: stock is reserved (atomically decremented, gated on `stock >= qty`) at
  order-creation time, inside the same DB transaction as the order + order_items insert
  (`OrdersRepository.createWithItems`) — not at payment confirmation. Postgres row-locks each
  product row on that `UPDATE`, so two concurrent checkouts for the last unit are serialized; the
  loser's gate fails and the whole order rolls back with `InsufficientStockError` (409). A
  reservation is released (stock added back, order cancelled) either immediately on explicit
  payment failure, or by a scheduled task (`ExpireReservationsTask`, `@nestjs/schedule`, every 5
  minutes) after `ORDER_RESERVATION_TIMEOUT_MINUTES` (default 30) if payment never completes. Both
  the webhook's order-confirm and the task's order-cancel use a conditional
  `UPDATE ... WHERE status = 'pending'` so whichever gets to a given order first wins atomically —
  see `TransactionsRepository.markSuccessAndConfirmOrder` and `OrdersRepository.releaseReservation`.
  The one edge case this can't fully automate: a payment that succeeds moments after its
  reservation timed out and was released (possibly resold). The transaction is still marked
  `success` — money received must never be silently dropped — but the order is left alone rather
  than guessed at, and `PAYMENT_RECEIVED_AFTER_ORDER_CANCELLED` fires for manual follow-up.

## Prerequisites

- Node 22+, pnpm
- PostgreSQL 16+, Redis 7+ (local dev: point `DATABASE_URL`/`REDIS_URL` at whatever you already
  have running — no bundled docker-compose, since most dev setups already have a shared
  Postgres/Redis instance)

## Local setup

```bash
cp .env.example .env
# fill in DATABASE_URL, REDIS_URL, and generate real JWT secrets:
#   openssl rand -base64 48

pnpm install
pnpm migrate          # applies all pending migrations
pnpm seed:admin        # creates the first platform admin (needs ADMIN_SEED_EMAIL/PASSWORD in .env)
pnpm start:dev
```

## Schema changes

```bash
# 1. edit files under src/db/schema/
# 2. generate a migration:
pnpm db:generate
# 3. apply it:
pnpm migrate
```

Migrations are plain SQL files under `migrations/`, generated by `drizzle-kit`. Never hand-edit a
migration that's already been applied to a shared environment — write a new one instead.

## Testing

```bash
pnpm test          # unit tests
pnpm test:e2e       # e2e tests
```

## Deployment (Coolify)

The `Dockerfile` builds a runtime image with full `node_modules` (dev deps included, deliberately
not pruned) so `pnpm migrate` and `pnpm seed:admin` can be run directly against the deployed
container — e.g. as a Coolify pre-deploy command, or via a one-off `docker exec`. Migrations are
**not** run automatically on container start; run `pnpm migrate` explicitly before traffic hits a
new deploy.

Required environment variables in Coolify: everything in `.env.example` except the seed-admin
pair, which you only need once.

## Flutterwave — not yet verified against a live account

The Flutterwave integration (`FlutterwaveService`, subaccount creation, checkout, webhooks) was
built against their documented v3 API but **has never been called with real credentials** — no
sandbox keys were available at build time. `.env` currently has placeholder
`FLUTTERWAVE_SECRET_KEY`/`FLUTTERWAVE_PUBLIC_KEY` values that will fail against the real API (this
was confirmed deliberately — see the `SERVICE_UNAVAILABLE`/401 behavior it produces). Before this
is production-usable:

1. Swap in real `FLWSECK_TEST_...`/`FLWPUBK_TEST_...` keys and a real `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
   (set under Settings → Webhooks in the Flutterwave dashboard, and register the webhook URL there).
2. Actually exercise `POST /payment-accounts` (creates a real subaccount), a full checkout, and a
   real webhook delivery — none of the request/response shapes for the live API calls have been
   confirmed against a real server, only against their documentation.
3. Revisit the one genuinely uncertain assumption: `kycStatus` is set to `'verified'` immediately
   on subaccount creation because the docs show no separate async verification step — worth
   confirming Flutterwave doesn't do a compliance review out-of-band that this doesn't see.
4. **Confirm who absorbs Flutterwave's own processing fee.** Confirmed from their docs:
   `transaction_charge_type: "percentage"` means the main account (us) collects that percentage
   and the subaccount (merchant) gets the rest — that direction is implemented correctly. What's
   **not** documented anywhere findable: whether Flutterwave's own fee comes out of our cut, the
   merchant's cut, or the gross before the split is applied. `transactions.platformFee` is the
   *gross* service charge we configured, not a confirmed net figure — either ask Flutterwave
   support directly or observe a real sandbox transaction once keys are available.

## Subscription billing

Merchants pay Cartr a monthly plan fee (`plans.monthlyPrice`), separate from the per-transaction
take-rate. `merchants.subscriptionStatus` (`trialing|active|past_due|cancelled`) drives it, with
`trialEndsAt`/`currentPeriodEnd`/`nextRenewalAt` (one field the cron trusts for both "next charge"
and "next retry")/`billingRetryCount`/`pendingPlanId` supporting the state machine.

- **Trial**: 14 days (`SUBSCRIPTION_TRIAL_DAYS`), no card required — storefront and dashboard fully
  work.
- **First charge / self-service recovery**: same code path (`POST /subscriptions/checkout`) — a
  hosted Flutterwave checkout with no subaccount split (Cartr collecting from the merchant, not a
  storefront sale). On success, the card is tokenized into `payment_methods` for future off-session
  renewals.
- **Renewal**: `RenewSubscriptionsTask` (`@Cron(EVERY_HOUR)`, same in-process pattern as
  `ExpireReservationsTask`) charges the stored card token via `POST /tokenized-charges`. Success
  resets the retry counter and applies any `pendingPlanId` (plan changes are not prorated — they
  take effect at the next successful renewal, by design). Failure starts dunning: `past_due`,
  retried every `SUBSCRIPTION_RENEWAL_RETRY_INTERVAL_DAYS` (default 2), hard cutoff to `cancelled`
  once `SUBSCRIPTION_GRACE_PERIOD_DAYS` (default 7) have elapsed since the first failure.
- **Storefront cutoff**: `TenantContextMiddleware` rejects `subscriptionStatus === 'cancelled'`
  with 403, same as an admin-suspended store — but this is a distinct, independent gate, not the
  same flag. The authenticated dashboard path is deliberately **not** gated the same way, since a
  `past_due`/`cancelled` merchant must still be able to log in and pay to recover.
- Verified end-to-end (no live Flutterwave credentials needed for this part): the full dunning
  progression from trial → past_due → hard cutoff via `processDueRenewals()` against a real
  database, `handleChargeWebhook`'s unknown-reference passthrough, and the storefront/dashboard
  gating split via real HTTP requests against the booted app.

**Not yet verified against a live account** (same constraint as the rest of the Flutterwave
integration — `.env` has placeholder keys):

- `FlutterwaveService.tokenizedCharge()` — the actual `POST /tokenized-charges` call. The exact
  field name Flutterwave uses for a 3DS redirect URL on *this specific* endpoint's response wasn't
  confirmed in their docs; the code checks two plausible field paths defensively.
- Tokenized (off-session) charges default to requiring 3D Secure — an OTP only the cardholder can
  complete, which defeats a truly unattended renewal. A NOAUTH bypass exists but needs case-by-case
  approval from Flutterwave support (undocumented process/timeline) — this needs a conversation with
  Flutterwave independently of the code. If a renewal comes back `pending` (3DS in flight), the
  charge is left unresolved rather than treated as failed; it resolves later via the webhook
  fallthrough if the cardholder completes the challenge, or ages into the next dunning attempt.
- No email/notification infrastructure exists in this codebase yet, so a merchant whose renewal is
  stuck in a 3DS challenge or has entered `past_due` is not proactively notified — this is logged
  clearly server-side and surfaced via the existing domain-event pattern
  (`SUBSCRIPTION_PAST_DUE`/`SUBSCRIPTION_CANCELLED`), which is the intended extension point for a
  future notification consumer, not something faked here.
- Whether card expiry is present on Flutterwave's verify response wasn't confirmed — the schema
  omits expiry fields until that's checked against a real response.
- Known, accepted semantic looseness: `subscriptionStatus = 'cancelled'` is reused for "hard cutoff
  on non-payment." If voluntary merchant-initiated cancellation is ever built, it should probably
  get its own distinct value or a reason column — not needed now since that feature doesn't exist.

## Storefront theme selection & public product browsing

Merchants pick one of the seeded `themes` rows (`themes.key/name/previewImageUrl/isPremium`) via
`PATCH /merchants/me { themeId }`. The backend's job stops at selection + exposure — a theme is
just a bundle key the frontend swaps in (no per-merchant color/config customization, by design),
so nothing here does server-side rendering. `GET /merchants/public/storefront/:slug` includes
`theme: { key, name } | null` so the frontend knows which bundle to load.

**Premium theme gating**: `isPremium: true` themes require the merchant's plan to include
`'premium_themes'` in `plans.features` (a `jsonb string[]` column that existed but had zero
readers/writers before this). No plan currently has it set — `plans` has no write endpoint at all
(`PlansController` is read-only), so today this means setting `features` directly in the database.
An admin/plan-management UI to toggle this is a real gap, not built here. Selecting a premium theme
without an eligible plan throws `ThemeNotAllowedError` (403).

**Public product browsing** (previously missing entirely — only checkout submission existed, no
way to browse first): `GET /products/public/storefront/:slug` (list) and
`GET /products/public/storefront/:slug/:productId` (detail), both `@Public()`, both scoped by
`TenantContextMiddleware` off `:slug` same as the other public routes. Only `status: 'active'`
products are visible; `draft`/`archived` 404 on the detail route even though they exist. Images
come from the previously-unused `product_images` table, batched (not N+1) and ordered by
`sortOrder`. Neither endpoint paginates — this matches every other list endpoint in this codebase
today (none of them paginate yet), but it's now public and unauthenticated rather than
staff-only, which is a meaningfully different trust/scale boundary worth revisiting if catalogs
grow large. Not fixed here since fixing it on just this one endpoint would be inconsistent with
the rest of the API.

**Also surfaced, not addressed here**: there is no merchant signup/onboarding flow anywhere in
this codebase — merchants are created out-of-band (direct DB insert). Every merchant/plan
interaction (subscriptions, theme gating) already tolerates `planId`/`themeId` being null, but
nothing actually creates a merchant row through the API yet.

## Custom domain verification

Merchants can point a domain they own at their storefront, but the platform needs proof of control
before routing traffic there — otherwise anyone could claim `customDomain: "someoneelses.com"` and
nothing would stop it. Verification is via a DNS TXT record, not CNAME — this codebase has no
platform subdomain scheme (no `{slug}.cartr.app` or equivalent; tenant resolution is path-based
`:slug`, not host-based) for a CNAME target to point at, and TXT verification is self-contained.

- `PATCH /merchants/me { customDomain }` — setting a *new* domain (or changing to a different one)
  generates a random verification token, resets `customDomainVerified` to `false`, and stamps
  `customDomainRequestedAt`. Resubmitting the *same* domain is a no-op on the verification
  fields — doesn't reset progress. The dashboard should read the token back off `GET /merchants/me`
  and show the merchant instructions to create a TXT record named `_cartr-challenge.{their-domain}`
  with that token as the value.
- `POST /merchants/me/custom-domain/verify` — on-demand check. Never errors for "not verified yet"
  (that's an expected, ordinary outcome of a status check) — only errors if there's no domain set
  at all. Idempotent once verified (no repeat DNS lookup).
- Background cron (`VerifyDomainsTask`, every 10 minutes, same in-process pattern as the other two
  crons) retries automatically for `CUSTOM_DOMAIN_VERIFICATION_TIMEOUT_DAYS` (default 7) after
  `customDomainRequestedAt`, so the merchant doesn't have to keep clicking "check now" while DNS
  propagates. Past that window the cron stops auto-retrying that merchant — an on-demand check
  always still works regardless.
- Domain collisions are caught at the database level (existing unique index on
  `merchants.customDomain`), not via an application-level check-then-act — `MerchantsRepository`
  translates the raw Postgres unique-violation into `DomainAlreadyInUseError` (409).
- **Closed a real pre-existing gap**: `TenantContextMiddleware`'s custom-domain lookup previously
  had no `customDomainVerified` check at all — any merchant with a non-null `customDomain` in the
  DB was immediately routable, verified or not. `MerchantsRepository.findByCustomDomain` now only
  ever resolves verified domains; an unverified or unclaimed domain both 404 identically (no
  "someone owns this, just not verified yet" signal leaked to an anonymous prober).
- Not addressed here: there is still no platform subdomain scheme for merchants who don't bring
  their own domain — this feature only handles verifying a domain a merchant supplies.

## Refund handling

Admin-only for v1 (not merchant self-service) — full refunds only, no partial-amount support.
`POST /admin/orders/:id/refund` (`@Roles('admin')`) reverses a `confirmed`/`shipped`/`delivered`
order's payment via Flutterwave's refund endpoint and flips both the transaction and order to
`refunded`. The generic merchant-facing `PATCH /orders/:id/status` deliberately cannot set
`'refunded'` — the only path to that status is the dedicated refund flow, so a refund always means
money actually moved, never just a relabeled order.

- **Deliberately no automatic stock restoration on refund.** Different from stock-reservation
  release (which fires before any fulfillment happened): a refund on an already-shipped/delivered
  order doesn't necessarily mean the item came back — auto-restocking would misrepresent inventory
  for goodwill refunds, wrong-item cases, etc. Merchants can already adjust stock manually via
  `PATCH /products/:id`.
- **Real, unresolved risk, not a code problem**: Flutterwave's docs say nothing about what happens
  to a merchant's subaccount share when a *split* transaction is refunded — whether it's
  automatically clawed back or only Cartr's own cut is reversed while the merchant keeps their
  share. This directly affects whether a refund actually returns the customer's full money.
  Confirm with Flutterwave support before relying on this in production.
- Refund webhooks are **disabled by default** on Flutterwave accounts (needs a support request to
  enable) — this feature doesn't depend on one arriving. It records the outcome of Flutterwave's
  synchronous refund-initiation response directly; even a `"completed"`-looking response there
  means "accepted for processing," not "funds settled" — actual settlement (1–15 days depending on
  rail) happens entirely outside this system's visibility either way.
- `FlutterwaveService.refund()` is deliberately not wrapped in the retry helper used elsewhere
  (`verifyTransaction`) — a refund is a mutating, non-idempotent call; auto-retrying risks
  initiating a second real refund if the first response was merely lost in transit.
- Known, accepted race, not engineered around: two admins refunding the same order at nearly the
  same instant could both pass the pre-refund guard before either finishes and both call
  Flutterwave. Low-probability (manual, admin-only action, not an automated concurrent writer) —
  the DB-side write still can't double-record it on our end, but a duplicate Flutterwave-side call
  isn't fully guarded against.
- Not yet verified against a live account, same standing constraint as the rest of this project's
  Flutterwave work — the refund call itself has never been made with real credentials.

## What's not built yet

- Admin/plan-management UI to set `plans.features` (needed to actually unlock premium themes for
  a plan without writing to the database directly).
- Merchant signup/onboarding flow (see above).
- Platform subdomain scheme (e.g. `{slug}.cartr.app`) for merchants without a custom domain — see
  the custom-domain-verification section above.
- The reservation-expiry, subscription-renewal, and domain-verification crons are all single
  in-process `@Cron` jobs — fine for one Coolify instance, but if this ever runs multi-instance
  each needs a distributed lock (or a move to a proper job queue) so the same batch isn't processed
  redundantly by every instance. Not needed yet.
