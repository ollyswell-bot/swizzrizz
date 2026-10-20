# SwizzRizz

A human-supervised conversation copilot for authorized creator account operators who use Infloww.

**Screenshot → transcript → analysis → suggested reply → human review → copy.**

SwizzRizz never sends messages, never connects to Infloww, and never scrapes or automates any platform. An operator pastes a screenshot, checks the transcript, reads the drafts, and copies the reply they choose.

This repository is **Phase 1** of the build plan: authentication, the dashboard shell, screenshot upload, AI extraction, the editable transcript, reply generation, copy buttons and creator voice settings. The full database schema for later phases is already in place.

---

## Contents

1. [What works today](#what-works-today)
2. [Run it with no setup (demo mode)](#run-it-with-no-setup-demo-mode)
3. [Deploy to Netlify without a terminal](#deploy-to-netlify-without-a-terminal)
4. [Connect Supabase](#connect-supabase)
5. [Connect the AI provider](#connect-the-ai-provider)
6. [Local development](#local-development)
7. [Tests](#tests)
8. [How the AI pipeline works](#how-the-ai-pipeline-works)
9. [Project structure](#project-structure)
10. [Known limitations](#known-limitations)
11. [Roadmap](#roadmap)

Security details live in [SECURITY.md](./SECURITY.md).

---

## What works today

| Area | Status |
| --- | --- |
| Demo mode with no keys (in-memory data, simulated AI, labelled sample data) | Working |
| Email and password accounts with Supabase Auth, workspace creation | Built, needs a Supabase project to run |
| Authorization, adults-only and AI-processing confirmation gate | Working, audit logged |
| Drag and drop, browse, and clipboard paste of PNG, JPEG and WebP | Working |
| Multiple screenshots per conversation, reorder, remove, duplicate warnings | Working |
| Byte-level file validation (real type, dimensions, size, polyglot rejection) | Working |
| Vision extraction, one call per screenshot, merged in order with overlap removal | Working with an Anthropic key; simulated in demo |
| Editable transcript: text, sender, order, add, delete, uncertainty and injection flags | Working |
| Fan alias selection and creation (never auto-matched) | Working |
| Analysis: segment, intent, stage, confidence, next action, signals, rationale | Working |
| Best reply plus playful and warm alternatives, tone selector, regenerate | Working |
| Offer matching against active, eligible catalog items only; "no sale" is a valid outcome | Working |
| Server guardrails: fabricated offers removed, wrong prices, scarcity and false-intimacy language flagged | Working |
| Edit and copy any draft, clipboard fallback, copy events recorded as observed activity | Working |
| Save, view and delete conversations | Working |
| Creator voice profiles: create, edit, delete, default | Working |
| Settings: retention window, delete all data, privacy disclosure | Working |
| Light and dark theme, phone and tablet layouts (copilot switches to tabs) | Working |
| Row Level Security on every table, verified against real Postgres in tests | Working |
| Fan profile editing, PPV catalog management, search | Phase 2 |
| Sales outcomes, revenue analytics, exports | Phase 3 |

---

## Run it with no setup (demo mode)

If no Supabase or AI keys are present, SwizzRizz starts in demo mode:

- Each "Enter demo workspace" click creates a private, temporary workspace.
- Sample fans and offers are seeded and marked **Sample**.
- The AI is simulated. Extraction returns a fixed sample transcript (the image isn't read) and replies come from deterministic templates. Every simulated result is labelled **Demo AI**.
- Data lives in server memory and is lost when the server restarts.

Don't put real customer conversations into demo mode.

---

## Deploy to Netlify without a terminal

You need free accounts on [GitHub](https://github.com) and [Netlify](https://netlify.com).

SwizzRizz has a server (sign-in, AI calls, uploads), so Netlify has to build it. Netlify's drag-and-drop "Deploy manually" box only hosts plain static sites and won't work here. Connecting a GitHub repository is the no-terminal route, and every later change you upload to GitHub redeploys automatically.

1. **Put the code on GitHub.** On GitHub, click **New repository**, name it `swizzrizz`, set it to **Private**, and create it. On the empty repository page, click **uploading an existing file**, drag in everything from the unzipped `swizzrizz` folder except the `src` folder, and click **Commit changes**. Then click **Add file → Upload files**, drag in the `src` folder, and commit again. (GitHub's web upload takes 100 files at a time.)
2. **Import it into Netlify.** In Netlify, click **Add new site → Import an existing project → GitHub**, authorize Netlify, and pick the `swizzrizz` repository. Netlify detects Next.js and reads the settings from `netlify.toml`, so leave the build settings as they are.
3. **Add environment variables** before deploying (on the import screen under **Add environment variables**, or later in **Site configuration → Environment variables**). For a demo deployment you only need:
   - `DEMO_SESSION_SECRET`: any 32+ character random string (a password generator works).
4. Click **Deploy swizzrizz**. When it finishes, open the site URL and click **Enter demo workspace**.

To make it real, follow the two sections below, add their variables in Netlify, then go to **Deploys → Trigger deploy → Deploy site**.

**Scheduled purge.** `netlify/functions/purge-screenshots.mts` is a Netlify scheduled function that runs hourly and deletes screenshots past their retention window. It needs `CRON_SECRET` set. You can see its runs under **Logs → Functions**.

**Time limits.** Netlify functions stop after 30 seconds. SwizzRizz sends each screenshot in its own request and caps each AI call at 25 seconds (`AI_TIMEOUT_MS`), so a slow call ends with a retry button instead of a hung page.

**Other hosts.** The app is a standard Next.js project, so it also deploys to Vercel. Replace the Netlify scheduled function with a Vercel cron job calling `/api/cron/purge` if you go that way.

---

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com). Pick a region close to your operators.
2. Open **SQL Editor → New query**, paste the full contents of `supabase/migrations/20261020000001_core_schema.sql`, and click **Run**.
3. Open another new query, paste `supabase/migrations/20261020000002_storage.sql`, and click **Run**. This creates the private `screenshots` bucket and its access rules.
4. In **Authentication → URL Configuration**, set **Site URL** to your Netlify URL and add `https://YOUR-SITE.netlify.app/api/auth/callback` to **Redirect URLs**.
5. In **Project Settings → API**, copy these into Netlify:
   - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public key)
   - `SUPABASE_SERVICE_ROLE_KEY` (service_role key; used only by the scheduled purge)
6. Add `CRON_SECRET` (32+ random characters) in Netlify. The hourly scheduled function uses it to call the purge.
7. Redeploy. The login page now shows email sign-in. The first person to sign up creates the workspace and becomes its owner.

Recommended Supabase settings: turn on email confirmation, set a minimum password length of 10 or more, and enable leaked-password protection if your plan has it.

**Adding offers before Phase 2:** use **Table Editor → ppv_offers → Insert row**. Fill `organization_id` and `creator_id` (copy them from the `organizations` and `creators` tables), a title, `price_cents` (for example `2500` for $25.00) and `is_active = true`. Only active offers inside their availability window are ever suggested.

**Adding teammates before Phase 4:** the teammate signs up, then an owner inserts a row in `organization_members` with the workspace's `organization_id`, the teammate's `user_id` (from the `users` table), and a role: `admin`, `operator` or `viewer`.

---

## Connect the AI provider

SwizzRizz ships with an Anthropic provider (`src/lib/ai/provider.ts`).

1. Create an API key in the [Anthropic Console](https://console.anthropic.com).
2. Add `ANTHROPIC_API_KEY` in Netlify. Optionally set `AI_MODEL` (default `claude-sonnet-5-5`).
3. Redeploy. The **Demo AI** badges disappear.

**Before processing real conversations, review the provider's usage policy and commercial data terms** and confirm they permit this use case and these screenshots. This is a deployment requirement, listed in the security checklist. The app doesn't try to work around provider restrictions: if the provider declines a request, the operator sees a clear message and nothing is fabricated.

To use another vision provider, implement the `AIProvider` interface (two methods: `extract` and `analyze`) and return it from `getAIProvider()`. All output still passes the same Zod schemas and guardrails.

---

## Local development

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local     # optional; leave empty for demo mode
npm run dev                    # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript in strict mode |
| `npm test` | Unit, API and database tests (Vitest) |
| `npm run test:e2e` | End-to-end browser tests (Playwright; run `npm run build` first) |
| `npm run check` | Lint, typecheck and unit tests together |

If Playwright's browser isn't installed, run `npx playwright install chromium`, or point `PW_CHROMIUM_PATH` at an existing Chromium binary.

---

## Tests

All tests use mocked or simulated AI responses, so they're deterministic and need no keys.

| Suite | Covers |
| --- | --- |
| `tests/db/rls.test.ts` | Runs the real migration on Postgres (PGlite) and checks tenant isolation, cross-tenant foreign keys, role escalation, viewer write blocking, copied-reply-is-not-a-sale constraints, and data deletion |
| `tests/unit/upload-validation` | Real file types, mismatched types, GIF/SVG/PDF rejection, size, dimensions, polyglots, truncated headers |
| `tests/unit/transcript` | Multi-image ordering, overlap removal, transcript correction |
| `tests/unit/pipeline` | Extraction retries, minors refusal, non-conversation images, reply generation, offer and no-offer paths, no-sale after a decline, escalation, voice application, provider failure without fabrication |
| `tests/unit/prompt-injection` | Detection, tag neutralisation, malicious voice fields, a "fooled" model that still can't push a fake offer or price |
| `tests/unit/guardrails` | Fabricated offers, price mismatches, scarcity, false intimacy, prohibited phrases |
| `tests/unit/ai-output-validation` | Output schema contract and JSON parsing |
| `tests/unit/auth` | Signed sessions, tampering, expiry, consent gate, role checks |
| `tests/unit/api-routes` | Full API workflow, upload rejection, duplicates, tenant isolation through the API, single and bulk deletion |
| `tests/unit/repository`, `clipboard` | Voice selection, fan alias de-duplication, clipboard API and fallback |
| `tests/e2e/copilot.spec.ts` | Browser: login redirect, upload, reorder, extract, edit, analyse, edit draft, copy to clipboard, save, paste from clipboard, reload persistence, phone tabs |

Results at handoff: lint clean, typecheck clean, 85 Vitest tests passing, 5 Playwright tests passing, production build succeeding.

---

## How the AI pipeline works

All AI calls happen on the server (`src/lib/ai`). Keys never reach the browser.

1. **Extraction.** Each screenshot is validated, then sent to the vision model separately with instructions to transcribe only visible text, mark uncertain parts, count unreadable sections, and flag possible minors or non-conversation images. Output is validated with Zod. Pages are merged in upload order and overlapping messages between consecutive screenshots are removed.
2. **Review.** The operator corrects the transcript. Only the reviewed transcript is used from here on.
3. **Context.** The server loads only the selected creator's voice, the selected fan (if any) and that creator's offers, all scoped to the operator's workspace.
4. **Offer matching.** Offers are filtered to active, in-window, eligible items the fan hasn't bought. Only these ids are shown to the model.
5. **Analysis and drafts.** The model returns the JSON contract below. It's validated, retried once if malformed, and never replaced with invented content on failure.
6. **Guardrails.** The server removes any offer id not in the eligible list, downgrades "present offer" when there's nothing eligible, and warns the operator about price mismatches, urgency or scarcity language, exclusivity or meet-up claims, and prohibited voice phrases.
7. **Human approval.** Drafts are editable. Copying records an observed event. Nothing is sent.

Output contract:

```json
{
  "fan_segment": "returning",
  "buying_intent": "unknown",
  "conversation_stage": "engagement",
  "confidence": 0.72,
  "recommended_action": "continue_conversation",
  "purchase_signals": [],
  "best_reply": "...",
  "alternatives": [
    { "tone": "playful", "message": "..." },
    { "tone": "warm", "message": "..." }
  ],
  "recommended_offer_id": null,
  "reasoning": "...",
  "next_step": "..."
}
```

---

## Project structure

```
src/
  app/
    (app)/            Signed-in pages: dashboard, copilot, conversations, fans, catalog, voices, analytics, settings
    api/              Route handlers (auth, consent, extract, analyze, voices, fans, conversations, events, settings, data, cron)
    login/ onboarding/
  components/
    copilot/          Live Copilot: workspace, fan context, screenshots, transcript editor, recommendations
    app/              Shell, consent gate, forms, editors
    ui/               shadcn-style primitives (button, card, input, badge, tabs)
  lib/
    ai/               Provider, prompts, pipeline, guardrails, injection defenses, demo mocks
    auth/             Session state, role and consent checks, demo session tokens
    data/             Repository interface, Supabase and demo implementations
    domain/           Zod schemas and types
    uploads/          Byte-level image validation
  proxy.ts            Session refresh and sign-in redirect (Next.js 16 "proxy", formerly middleware)
supabase/migrations/  Schema, RLS, functions, storage bucket and policies
tests/                db, unit, e2e, fixtures
```

Built with Next.js 16.4 (App Router), React 19.3, TypeScript 5.9 strict, Tailwind CSS 4.3, Radix primitives with shadcn-style components, Lucide icons, Supabase (Postgres, Auth, Storage), Zod 4, Vitest 5 and Playwright 1.64. Exact versions are pinned in `package.json`.

---

## Known limitations

These are honest gaps at the end of Phase 1. None are hidden by the UI.

- **Supabase mode hasn't been run against a live Supabase project yet.** The schema and RLS policies are tested on real Postgres, and the data layer type-checks, but the first deploy should be verified end to end (sign up, create workspace, extract, save, delete) before real use.
- **Live AI calls haven't been exercised in this build environment.** The provider is covered by schema validation and mocked tests; confirm with a few sample screenshots after adding your key.
- **Rate limiting is per server instance.** On Netlify, each function instance keeps its own counters. Move to a shared store (for example Upstash Redis) before scaling a team.
- **Screenshot purge runs hourly**, so a retention window is enforced within the hour after it ends.
- **Demo mode keeps data in memory** and resets on restart or whenever Netlify starts a new function instance, which happens often. Treat a Netlify demo as a quick walkthrough, not a place to keep work.
- **Fans, catalog and analytics pages are read-only** until Phases 2 and 3. Conversion rates and revenue are deliberately not shown yet.
- **Workspace switching** for users in several workspaces isn't in the UI (the first workspace is used). Team management comes in Phase 4.
- **The demo AI doesn't read images.** It returns a fixed sample so the flow can be tried safely.

---

## Roadmap

- **Phase 2:** fan profiles (edit, merge, export, delete), conversation memory, PPV catalog management, offer recommendations from history, search.
- **Phase 3:** sales outcome tracking (manual and verified, kept separate from AI predictions), revenue and AOV with labelled denominators, template comparisons, exports.
- **Phase 4:** multi-creator workspaces, team invites and permissions, operator performance reporting, shared rate limiting, advanced security.
