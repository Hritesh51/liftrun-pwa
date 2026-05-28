# Cloud sync setup (optional, free)

LiftRun works fully offline. If you want your profiles to **back up and sync across devices**,
connect your own free [Supabase](https://supabase.com) project. Your data stays in *your* project —
there is no LiftRun server.

> Beta: sync is rev-based last-write-wins and biased to safety (conflicts keep the on-device copy,
> and a snapshot is taken before any overwrite). Verify with a throwaway account before trusting it
> with your only copy — and keep using **Settings → Backup & restore** as your hard safety net.

## 1. Create a project
1. Sign up at <https://supabase.com> (free tier is plenty).
2. Create a new project. Wait for it to finish provisioning.

## 2. Get your keys
In **Project Settings → API**, copy:
- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** key — a long `eyJ…` string (this is a *public* key; row-level security protects the data)

## 3. Create the table + security
Open **SQL Editor**, paste this, and run it:

```sql
create table if not exists liftrun_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  name text,
  state jsonb not null,
  rev bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);
alter table liftrun_state enable row level security;
create policy "own rows only" on liftrun_state
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Row-level security means each signed-in account can only read/write **its own** rows.

## 4. (Optional) instant sign-up
**Authentication → Providers → Email**: turn **off** "Confirm email" so new accounts work
immediately. Leave it on if you prefer email verification (you'll confirm via a link, then sign in).

## 5. Connect in the app
**Settings → Cloud sync (beta)** → paste the Project URL + anon key → **Save connection** →
create an account or sign in → **Sync now**. Turn on **Auto-sync** to push changes automatically.

On a second device, install the app, enter the same URL + key, sign in with the same account, and
**Sync now** — your profiles download automatically.

## How conflicts are handled
Each profile has a revision number. On sync:
- A profile that exists only in the cloud is **restored** to this device.
- A cloud copy that's newer than this device (and you haven't edited locally) is **applied**.
- If both changed, the **on-device copy wins** and is pushed up (the cloud copy is superseded, not lost to you).

A full snapshot is written to `localStorage` before any overwrite, so a bad sync is recoverable.
