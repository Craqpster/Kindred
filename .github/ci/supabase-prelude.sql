-- The objects Supabase provides that this repo's migrations assume already exist.
--
-- Running the migration chain against a bare Postgres is the only way to prove the repo
-- can still rebuild its own schema. `migrate deploy` never re-runs an applied migration,
-- so a migration file can rot into invalid SQL and nothing notices - which is exactly what
-- happened to 20260722000000 between a9461db and #24.
--
-- This is deliberately the MINIMAL set: the whole chain references only auth.uid (x5),
-- auth.users (x1), realtime.messages (x1) and the supabase_realtime publication (x2, and
-- those two are already IF EXISTS-guarded). Nothing here is a model of Supabase; it is the
-- smallest thing the SQL in prisma/migrations/ needs in order to parse and apply.
--
-- CI only. Supabase owns all of this in every real environment.

-- Roles. Several migrations GRANT to `authenticated`, which only requires that the role
-- exist. The membership grant to `postgres` is what lets a session SET ROLE, which
-- scripts/verify-chat-schema.ts needs if it is ever added to this job.
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
GRANT anon, authenticated, service_role TO postgres;

-- Supabase Auth. `profiles.id` is a foreign key to auth.users(id), and the RLS policies
-- call auth.uid(). Only the id column is referenced by anything in the chain.
CREATE SCHEMA auth;

CREATE TABLE auth.users (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email      text UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
$$;

-- Supabase Realtime. Broadcast and presence have no table of their own, so Supabase
-- authorizes them with RLS on realtime.messages checked against the topic - see
-- 20260728000000_authorize_conversation_channels, which creates policies on this table
-- and calls realtime.topic().
CREATE SCHEMA realtime;

CREATE TABLE realtime.messages (
    id        bigserial PRIMARY KEY,
    topic     text NOT NULL,
    extension text NOT NULL
);

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$
    SELECT current_setting('realtime.topic', true);
$$;
