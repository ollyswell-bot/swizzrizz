# SwizzRizz security and privacy

Screenshots and fan conversations are confidential customer data. This document describes how SwizzRizz protects them and what must be checked before production use.

## Pre-production checklist

Work through this before any real conversation is processed.

**Provider and policy**
- [ ] Read the AI provider's usage policy and confirm it permits processing these screenshots and drafting these replies.
- [ ] Confirm the provider's data retention and training terms for API traffic meet your obligations. Use a zero-retention or commercial agreement if available.
- [ ] Confirm the creators you work for have authorized this processing in writing, and that your use complies with the platform's terms of service.
- [ ] Publish a privacy notice to your operators describing what's processed, where, and for how long.

**Supabase**
- [ ] Both migrations applied; the `screenshots` bucket shows as **Private**.
- [ ] Email confirmation on, minimum password length 10 or more, leaked-password protection on where available.
- [ ] Site URL and redirect URLs set to your production domain only.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` stored only in Netlify's environment variables, never in a `NEXT_PUBLIC_` variable.
- [ ] Point-in-time recovery or backups configured, and a deletion process for backups agreed.

**Netlify**
- [ ] `CRON_SECRET` set; the `purge-screenshots` scheduled function shows hourly runs under Logs → Functions.
- [ ] `DEMO_SESSION_SECRET` set if demo mode is ever used in production.
- [ ] Production domain uses HTTPS (Netlify default). HSTS is sent by the app.
- [ ] Deploy previews and branch deploys password-protected or turned off, so previews can't be reached publicly.

**Verification after first deploy**
- [ ] Two test accounts in two workspaces cannot see each other's conversations, fans, voices or screenshots.
- [ ] A viewer-role account can read but not create, edit or delete.
- [ ] "Delete everything" in Settings removes conversations, fans and stored screenshot files.
- [ ] A screenshot uploaded with retention set to 1 day is gone from Storage after the next purge.
- [ ] Rate limiting moved to a shared store before more than one operator uses the app concurrently at volume.

## Controls in the code

| Control | Where |
| --- | --- |
| Authentication | Supabase Auth (email and password); signed, httpOnly, SameSite=Lax cookies; demo sessions are HMAC-signed and expire after 12 hours |
| Authorization | Every route handler calls `requireAuth()` with an access level (read, write, admin) and the consent requirement. Pages re-check on the server. The proxy redirect is a convenience, not a control |
| Roles | owner, admin, operator, viewer. Config (voices, offers, members) is owner/admin; conversation work is operator and above; viewers read only |
| Tenant isolation | Row Level Security on all 15 tables; every query also filters by the caller's organization; composite foreign keys `(id, organization_id)` stop rows pointing at another tenant's records; organization id is never read from the request |
| Role escalation | Members can't update their own membership row; confirmation goes through a narrow `confirm_authorization()` function |
| File storage | Private bucket, tenant id as the first path segment enforced by storage policies, 10 MB and MIME limits on the bucket, 60-second signed URLs, configurable retention with scheduled purge, option to never store images |
| Upload validation | Real type from magic bytes, declared type must match, dimension and pixel-count limits, size limit, markup/script polyglot rejection, max images per request, request size ceiling |
| Prompt injection | Screenshot text is wrapped in tagged data blocks and declared untrusted; tag characters and invisible Unicode are neutralised; instruction-like messages are flagged to the operator and the model; output is schema-validated; offers and prices are re-checked on the server, so a fooled model can't introduce a product, price or discount |
| Data minimisation | Only the selected creator, fan and offers are loaded for analysis; events store counts and ids only; analyses store validated output, never prompts or images; images in the browser stay as local object URLs and are never written to session storage |
| Logging | Errors are logged by type only. Request bodies, transcripts, images and provider responses are never logged |
| Audit | Consent, extraction, saves, deletions, voice and settings changes are written to `audit_logs` (append-only, readable by owner/admin) |
| Secrets | AI and service-role keys are read only in server modules guarded by `server-only`; nothing secret uses a `NEXT_PUBLIC_` prefix |
| Headers | HSTS, X-Frame-Options DENY, nosniff, strict referrer policy, restrictive Permissions-Policy, no `x-powered-by`; pages are `noindex` |
| Rate limits | Extract 20/min, analyze 30/min, events 120/min per user; demo login 10/min per IP |
| Minors | Operators confirm all participants are adults; the extraction model flags possible minors and the request is refused; the reply model escalates instead of drafting flirtatious or sales content |
| Honest analytics | Database constraints make a copied reply always "observed" and a confirmed purchase always "manual" or "verified", never an AI prediction |

## Reporting a problem

If you find a vulnerability, contact the workspace owner privately and include steps to reproduce. Don't test against other people's workspaces.
