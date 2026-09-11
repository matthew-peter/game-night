/**
 * Absolute base URL for links embedded in push notifications.
 *
 * Server-side only. Previously both call sites hardcoded a fallback domain that
 * is no longer controlled by this project — it now serves an unrelated site, so
 * any notification sent without NEXT_PUBLIC_APP_URL set deep-linked users to a
 * third party. Prefer Vercel's own deployment env vars over any hardcoded host.
 */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  // Stable production domain for the project (set automatically by Vercel).
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;

  // Per-deployment URL — correct for previews.
  const deployment = process.env.VERCEL_URL;
  if (deployment) return `https://${deployment}`;

  return 'http://localhost:3000';
}
