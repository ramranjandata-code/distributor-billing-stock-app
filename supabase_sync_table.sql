-- =========================================================================
-- DISTROPLUS ERP: 1-CLICK CLOUD SYNC DATABASE TABLES
-- =========================================================================
-- Instructions: Copy and run this script in your Supabase SQL Editor:
-- https://supabase.com -> Select your project -> SQL Editor -> New Query -> Run
-- =========================================================================

-- 1. Primary Cloud Storage Table
CREATE TABLE IF NOT EXISTS public.distro_cloud_store (
    id TEXT PRIMARY KEY,
    name TEXT,
    beat TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Secondary / Legacy Cloud Storage Table (for 100% compatibility)
CREATE TABLE IF NOT EXISTS public.fmcg_shops (
    id TEXT PRIMARY KEY,
    name TEXT,
    owner TEXT,
    area TEXT,
    beat TEXT,
    day TEXT,
    balance NUMERIC DEFAULT 0,
    status TEXT,
    phone TEXT,
    lat NUMERIC DEFAULT 0,
    lng NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security & Public Read-Write Policies
ALTER TABLE public.distro_cloud_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fmcg_shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all for distro_cloud_store" ON public.distro_cloud_store;
CREATE POLICY "Allow public all for distro_cloud_store" 
ON public.distro_cloud_store 
FOR ALL 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all for fmcg_shops" ON public.fmcg_shops;
CREATE POLICY "Allow public all for fmcg_shops" 
ON public.fmcg_shops 
FOR ALL 
USING (true) 
WITH CHECK (true);
