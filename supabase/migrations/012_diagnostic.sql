-- ============================================================================
-- DIAGNOSTIC: Run this in Supabase SQL Editor to check database state.
-- Copy the entire output and share it.
-- ============================================================================

-- 1. Check games table columns (especially current_turn type)
SELECT '=== GAMES TABLE COLUMNS ===' as section;
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'games'
ORDER BY ordinal_position;

-- 2. Check ALL constraints on games table
SELECT '=== GAMES TABLE CONSTRAINTS ===' as section;
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.games'::regclass;

-- 3. Check game_players table exists and has right columns
SELECT '=== GAME_PLAYERS TABLE COLUMNS ===' as section;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'game_players'
ORDER BY ordinal_position;

-- 4. Check recent games (bypasses RLS since SQL Editor runs as postgres)
SELECT '=== RECENT GAMES ===' as section;
SELECT id, game_type, status, current_phase, current_turn, created_at
FROM public.games
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check game_players entries
SELECT '=== RECENT GAME_PLAYERS ===' as section;
SELECT gp.game_id, gp.user_id, gp.seat, g.status as game_status
FROM public.game_players gp
LEFT JOIN public.games g ON g.id = gp.game_id
ORDER BY gp.joined_at DESC
LIMIT 10;

-- 6. Check all policies
SELECT '=== ALL RLS POLICIES ===' as section;
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7. Check RLS is enabled on key tables
SELECT '=== RLS STATUS ===' as section;
SELECT c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('games', 'game_players', 'moves', 'chat_messages', 'users');

-- 8. Check grants
SELECT '=== GRANTS ===' as section;
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('games', 'game_players')
ORDER BY table_name, grantee, privilege_type;
