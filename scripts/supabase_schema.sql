-- ===================================================================
-- Supabase Schema: Chat History for Canvas Gemini AI Assistant
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ===================================================================

-- ==========================================================
-- 1. TABLE DEFINITIONS
-- ==========================================================

-- Table 1: Bot Users & Configuration
CREATE TABLE IF NOT EXISTS public.bot_users (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    telegram_chat_id BIGINT UNIQUE NOT NULL,
    telegram_user_id BIGINT,
    canvas_user_id BIGINT,
    canvas_user_name TEXT,
    timezone TEXT DEFAULT 'Asia/Manila',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Table 2: Seen Items Tracking (Deduplication)
CREATE TABLE IF NOT EXISTS public.seen_items (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    item_type TEXT NOT NULL CHECK (item_type IN ('assignment', 'announcement', 'discussion')),
    canvas_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_seen_item UNIQUE (item_type, canvas_id)
);
-- Table 3: Notification & Reminder Logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    item_type TEXT NOT NULL CHECK (item_type IN ('assignment', 'announcement', 'discussion')),
    canvas_id BIGINT NOT NULL,
    notification_type TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_notification_log UNIQUE (item_type, canvas_id, notification_type)
);
-- Table 4: System Sync State
CREATE TABLE IF NOT EXISTS public.system_sync_state (
    id INT PRIMARY KEY DEFAULT 1,
    last_sync_at TIMESTAMPTZ,
    courses_count INT DEFAULT 0,
    CONSTRAINT single_sync_row CHECK (id = 1)
);
-- Initialize default sync row
INSERT INTO public.system_sync_state (id, last_sync_at, courses_count)
VALUES (1, NOW(), 0)
ON CONFLICT (id) DO NOTHING;

-- 4. Create chat_history table
CREATE TABLE IF NOT EXISTS chat_history (
    id BIGSERIAL PRIMARY KEY,
    telegram_chat_id BIGINT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'model', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Index for rapid lookup of recent conversation turns
CREATE INDEX IF NOT EXISTS idx_chat_history_chat_id_created 
ON chat_history (telegram_chat_id, created_at DESC);

-- ==========================================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================================
ALTER TABLE public.bot_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seen_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- 3. RLS POLICIES (Backend Service Role Full Access + Zero Public Exposure)
-- ==========================================================
-- Policies for bot_users
DROP POLICY IF EXISTS "Service role has full access to bot_users" ON public.bot_users;
CREATE POLICY "Service role has full access to bot_users"
    ON public.bot_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
-- Policies for seen_items
DROP POLICY IF EXISTS "Service role has full access to seen_items" ON public.seen_items;
CREATE POLICY "Service role has full access to seen_items"
    ON public.seen_items
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
-- Policies for notification_logs
DROP POLICY IF EXISTS "Service role has full access to notification_logs" ON public.notification_logs;
CREATE POLICY "Service role has full access to notification_logs"
    ON public.notification_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
-- Policies for system_sync_state
DROP POLICY IF EXISTS "Service role has full access to system_sync_state" ON public.system_sync_state;
CREATE POLICY "Service role has full access to system_sync_state"
    ON public.system_sync_state
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
-- Policies for chat_history
DROP POLICY IF EXISTS "Allow service_role full access on chat_history" ON chat_history;

CREATE POLICY "Allow service_role full access on chat_history"
ON chat_history
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
