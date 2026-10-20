/**
 * Netlify scheduled function: once an hour, asks the app to delete screenshots whose
 * retention window has passed. The purge itself runs in /api/cron/purge, which checks
 * CRON_SECRET. URL is set by Netlify to the site's main address.
 */
export default async function purgeScreenshots() {
  const site = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) {
    console.warn("[swizzrizz] purge skipped: URL or CRON_SECRET is not set");
    return new Response("skipped", { status: 200 });
  }
  const res = await fetch(`${site}/api/cron/purge`, { headers: { authorization: `Bearer ${secret}` } });
  console.log(`[swizzrizz] purge finished with status ${res.status}`);
  return new Response(null, { status: res.ok ? 200 : 500 });
}

export const config = { schedule: "@hourly" };
