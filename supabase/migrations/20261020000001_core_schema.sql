-- SwizzRizz core schema
-- Every tenant-owned table carries organization_id, is covered by Row Level Security,
-- and uses composite foreign keys (id, organization_id) so a row can never point at
-- another organization's data, even through a buggy server query.

-- gen_random_uuid() is built into Postgres 13+, no extension needed.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'operator', 'viewer');
create type public.message_sender as enum ('fan', 'creator', 'unknown');
create type public.emoji_frequency as enum ('none', 'low', 'medium', 'high');
create type public.message_length as enum ('short', 'medium', 'long');
create type public.sales_style as enum ('soft', 'balanced', 'direct');
create type public.ai_mode as enum ('live', 'mock');
create type public.suggestion_kind as enum ('best', 'playful', 'warm');
create type public.suggestion_feedback as enum ('used', 'edited', 'rejected');
create type public.purchase_source as enum ('manual', 'verified_import');
create type public.event_type as enum (
  'analysis_run', 'reply_generated', 'reply_copied',
  'offer_recommended', 'offer_presented', 'purchase_confirmed', 'conversation_saved'
);
-- observed: the app saw it happen. manual: an operator typed it in.
-- verified: reconciled against a platform export. prediction: AI output, never a fact.
create type public.event_evidence as enum ('observed', 'manual', 'verified', 'prediction');

-- ---------------------------------------------------------------------------
-- Shared trigger for updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizations and users
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  screenshot_retention_hours integer not null default 24
    check (screenshot_retention_hours between 0 and 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Profile row mirroring auth.users. Holds only what the app needs.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  adult_attested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.member_role not null default 'operator',
  -- Set when the member confirms they are authorized to process these conversations.
  authorization_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

-- ---------------------------------------------------------------------------
-- Authorization helpers (security definer so policies don't recurse into RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(org uuid, roles public.member_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Creators and voices
-- ---------------------------------------------------------------------------
create table public.creators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index creators_org_idx on public.creators (organization_id);

create table public.creator_voices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  creator_id uuid,
  name text not null check (char_length(name) between 1 and 120),
  brand_description text not null default '',
  tone text not null default '',
  vocabulary text not null default '',
  emoji_frequency public.emoji_frequency not null default 'low',
  typical_length public.message_length not null default 'short',
  approved_phrases text[] not null default '{}',
  prohibited_phrases text[] not null default '{}',
  content_boundaries text[] not null default '{}',
  example_messages text[] not null default '{}',
  default_sales_style public.sales_style not null default 'soft',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (creator_id, organization_id)
    references public.creators (id, organization_id) on delete cascade
);
create index creator_voices_org_idx on public.creator_voices (organization_id);

-- ---------------------------------------------------------------------------
-- Fans
-- ---------------------------------------------------------------------------
create table public.fans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  creator_id uuid not null,
  alias text not null check (char_length(alias) between 1 and 80),
  -- Optional platform identifier, stored only as a keyed hash (see lib/crypto.ts).
  external_id_hash text,
  first_interaction_at timestamptz,
  last_interaction_at timestamptz,
  segment text not null default 'new',
  approved_notes text not null default '',
  content_preferences text[] not null default '{}',
  communication_boundaries text[] not null default '{}',
  follow_up_status text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, creator_id, alias),
  foreign key (creator_id, organization_id)
    references public.creators (id, organization_id) on delete cascade
);
create index fans_org_creator_idx on public.fans (organization_id, creator_id);

-- ---------------------------------------------------------------------------
-- Conversations, messages, screenshots
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  creator_id uuid not null,
  fan_id uuid,
  operator_id uuid references public.users (id) on delete set null,
  title text not null default '',
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (creator_id, organization_id)
    references public.creators (id, organization_id) on delete cascade,
  foreign key (fan_id, organization_id)
    references public.fans (id, organization_id) on delete set null (fan_id)
);
create index conversations_org_created_idx on public.conversations (organization_id, created_at desc);
create index conversations_fan_idx on public.conversations (fan_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  position integer not null check (position >= 0),
  sender public.message_sender not null default 'unknown',
  body text not null check (char_length(body) <= 4000),
  sent_at_label text,
  is_uncertain boolean not null default false,
  edited boolean not null default false,
  created_at timestamptz not null default now(),
  unique (conversation_id, position),
  foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete cascade
);
create index messages_org_idx on public.messages (organization_id);

create table public.screenshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid,
  uploaded_by uuid references public.users (id) on delete set null,
  storage_path text not null,
  sha256 text not null check (char_length(sha256) = 64),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size integer not null check (byte_size > 0),
  position integer not null default 0,
  expires_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete cascade
);
create index screenshots_expiry_idx on public.screenshots (expires_at) where deleted_at is null;
create index screenshots_org_hash_idx on public.screenshots (organization_id, sha256);

-- ---------------------------------------------------------------------------
-- Offers and purchases
-- ---------------------------------------------------------------------------
create table public.ppv_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  creator_id uuid not null,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  currency char(3) not null default 'USD',
  category text not null default 'general',
  included_content text not null default '',
  preview_reference text,
  is_active boolean not null default true,
  available_from timestamptz,
  available_until timestamptz,
  -- e.g. {"segments": ["returning","vip"], "min_prior_purchases": 1}
  eligibility jsonb not null default '{}'::jsonb,
  bundle_offer_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (creator_id, organization_id)
    references public.creators (id, organization_id) on delete cascade
);
create index ppv_offers_org_creator_active_idx on public.ppv_offers (organization_id, creator_id, is_active);

create table public.purchase_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  fan_id uuid not null,
  offer_id uuid,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'USD',
  purchased_at timestamptz not null default now(),
  source public.purchase_source not null default 'manual',
  verified boolean not null default false,
  notes text not null default '',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (fan_id, organization_id)
    references public.fans (id, organization_id) on delete cascade,
  foreign key (offer_id, organization_id)
    references public.ppv_offers (id, organization_id) on delete set null (offer_id)
);
create index purchase_records_org_fan_idx on public.purchase_records (organization_id, fan_id);

-- ---------------------------------------------------------------------------
-- AI analyses and suggestions
-- ---------------------------------------------------------------------------
create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  model text not null,
  mode public.ai_mode not null,
  fan_segment text not null,
  buying_intent text not null,
  conversation_stage text not null,
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  recommended_action text not null,
  recommended_offer_id uuid,
  reasoning text not null default '',
  next_step text not null default '',
  -- Validated structured output only. Never the screenshot or the raw prompt.
  output jsonb not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete cascade,
  foreign key (recommended_offer_id, organization_id)
    references public.ppv_offers (id, organization_id) on delete set null (recommended_offer_id)
);
create index ai_analyses_conversation_idx on public.ai_analyses (conversation_id);

create table public.reply_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  analysis_id uuid not null,
  kind public.suggestion_kind not null,
  body text not null,
  edited_body text,
  copied_at timestamptz,
  feedback public.suggestion_feedback,
  created_at timestamptz not null default now(),
  foreign key (analysis_id, organization_id)
    references public.ai_analyses (id, organization_id) on delete cascade
);
create index reply_suggestions_analysis_idx on public.reply_suggestions (analysis_id);

-- ---------------------------------------------------------------------------
-- Events and audit
-- ---------------------------------------------------------------------------
create table public.sales_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type public.event_type not null,
  evidence public.event_evidence not null,
  conversation_id uuid,
  fan_id uuid,
  offer_id uuid,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency char(3),
  actor_id uuid references public.users (id) on delete set null,
  occurred_at timestamptz not null default now(),
  -- Counters and ids only. Never message text or image data.
  metadata jsonb not null default '{}'::jsonb,
  -- A copied reply is observed activity, never a sale.
  check (event_type <> 'purchase_confirmed' or evidence in ('manual', 'verified')),
  check (event_type <> 'reply_copied' or evidence = 'observed'),
  foreign key (conversation_id, organization_id)
    references public.conversations (id, organization_id) on delete cascade,
  foreign key (fan_id, organization_id)
    references public.fans (id, organization_id) on delete cascade
);
create index sales_events_org_time_idx on public.sales_events (organization_id, occurred_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.users (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_time_idx on public.audit_logs (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();
create trigger users_touch before update on public.users
  for each row execute function public.touch_updated_at();
create trigger creators_touch before update on public.creators
  for each row execute function public.touch_updated_at();
create trigger creator_voices_touch before update on public.creator_voices
  for each row execute function public.touch_updated_at();
create trigger fans_touch before update on public.fans
  for each row execute function public.touch_updated_at();
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();
create trigger ppv_offers_touch before update on public.ppv_offers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.organization_members enable row level security;
alter table public.creators enable row level security;
alter table public.creator_voices enable row level security;
alter table public.fans enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.screenshots enable row level security;
alter table public.ppv_offers enable row level security;
alter table public.purchase_records enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.reply_suggestions enable row level security;
alter table public.sales_events enable row level security;
alter table public.audit_logs enable row level security;

-- organizations
create policy org_select on public.organizations for select
  using (public.is_org_member(id));
create policy org_update on public.organizations for update
  using (public.has_org_role(id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_org_role(id, array['owner', 'admin']::public.member_role[]));
create policy org_delete on public.organizations for delete
  using (public.has_org_role(id, array['owner']::public.member_role[]));
-- Inserts go through public.create_organization() only.

-- users: a person sees and edits only their own profile
create policy users_self_select on public.users for select using (id = auth.uid());
create policy users_self_update on public.users for update
  using (id = auth.uid()) with check (id = auth.uid());

-- organization_members
create policy members_select on public.organization_members for select
  using (public.is_org_member(organization_id));
create policy members_admin_write on public.organization_members for all
  using (public.has_org_role(organization_id, array['owner', 'admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner', 'admin']::public.member_role[]));
-- Members never update their own row directly (that would allow role escalation).
-- Authorization confirmation goes through public.confirm_authorization().

-- Read access for every member; config writes for owner/admin; operational writes for operators.
do $$
declare
  t text;
begin
  foreach t in array array['creators', 'creator_voices', 'ppv_offers'] loop
    execute format('create policy %1$s_select on public.%1$s for select using (public.is_org_member(organization_id))', t);
    execute format($p$create policy %1$s_write on public.%1$s for all
      using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
      with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))$p$, t);
  end loop;

  foreach t in array array['fans', 'conversations', 'messages', 'screenshots', 'purchase_records',
                           'ai_analyses', 'reply_suggestions'] loop
    execute format('create policy %1$s_select on public.%1$s for select using (public.is_org_member(organization_id))', t);
    execute format($p$create policy %1$s_write on public.%1$s for all
      using (public.has_org_role(organization_id, array['owner','admin','operator']::public.member_role[]))
      with check (public.has_org_role(organization_id, array['owner','admin','operator']::public.member_role[]))$p$, t);
  end loop;
end;
$$;

-- sales_events: append-only for operators, readable by members
create policy sales_events_select on public.sales_events for select
  using (public.is_org_member(organization_id));
create policy sales_events_insert on public.sales_events for insert
  with check (
    public.has_org_role(organization_id, array['owner', 'admin', 'operator']::public.member_role[])
    and actor_id = auth.uid()
  );
create policy sales_events_admin_delete on public.sales_events for delete
  using (public.has_org_role(organization_id, array['owner', 'admin']::public.member_role[]));

-- audit_logs: append-only, readable by owner/admin, never editable
create policy audit_select on public.audit_logs for select
  using (public.has_org_role(organization_id, array['owner', 'admin']::public.member_role[]));
create policy audit_insert on public.audit_logs for insert
  with check (public.is_org_member(organization_id) and actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Bootstrap: profile on sign-up, organization creation
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Creates an organization with the caller as owner, a first creator and the default voice.
create or replace function public.create_organization(org_name text, creator_name text default 'My Creator')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_org uuid;
  new_creator uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.users (id) values (uid) on conflict (id) do nothing;

  insert into public.organizations (name) values (org_name) returning id into new_org;
  insert into public.organization_members (organization_id, user_id, role)
    values (new_org, uid, 'owner');
  insert into public.creators (organization_id, name)
    values (new_org, creator_name) returning id into new_creator;

  insert into public.creator_voices (
    organization_id, creator_id, name, brand_description, tone, vocabulary,
    emoji_frequency, typical_length, approved_phrases, prohibited_phrases,
    content_boundaries, example_messages, default_sales_style, is_default
  ) values (
    new_org, new_creator, 'Playful Creator',
    'Warm, confident creator who keeps things light and fun.',
    'Flirty, playful, teasing, warm, confident',
    'casual, natural lowercase, short sentences',
    'low', 'short',
    array['haha', 'tell me more', 'you''re sweet'],
    array['buy now', 'limited time only', 'last chance', 'only for you'],
    array['no meetups', 'no personal contact details', 'no promises of exclusivity'],
    array['haha you''re trouble 😏 what are you up to tonight?', 'okay that made me smile. tell me more'],
    'soft', true
  );

  return new_org;
end;
$$;

revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;

-- Records that the caller confirmed they are authorized to process this organization's
-- conversations and that every participant is an adult. Touches nothing else.
create or replace function public.confirm_authorization(org uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.organization_members
     set authorization_confirmed_at = now()
   where organization_id = org and user_id = auth.uid();
  if not found then
    raise exception 'not a member';
  end if;
  update public.users set adult_attested_at = now() where id = auth.uid();
end;
$$;

revoke all on function public.confirm_authorization(uuid) from public;
grant execute on function public.confirm_authorization(uuid) to authenticated;

-- Permanently removes all conversation data for an organization (owner/admin only).
create or replace function public.delete_organization_data(org uuid)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if not public.has_org_role(org, array['owner', 'admin']::public.member_role[]) then
    raise exception 'forbidden';
  end if;
  delete from public.sales_events where organization_id = org;
  delete from public.conversations where organization_id = org;
  delete from public.screenshots where organization_id = org;
  delete from public.purchase_records where organization_id = org;
  delete from public.fans where organization_id = org;
end;
$$;
