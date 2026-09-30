-- =========================================================================
-- DISTROPLUS ERP: DUAL GOOGLE DRIVE & SUPABASE BILLING STORAGE SCHEMA
-- =========================================================================
-- Instructions: Copy and run this script in the Supabase SQL Editor
-- (https://supabase.com -> Project -> SQL Editor -> New Query -> Run)
-- =========================================================================

-- Enable UUID extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. Table: drive_accounts
-- Tracks up to 2 linked Google Drive accounts (15 GB + 15 GB = 30 GB total)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drive_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name TEXT NOT NULL DEFAULT 'Google Drive Account',
    email TEXT UNIQUE NOT NULL,
    refresh_token TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority_order INT NOT NULL DEFAULT 1, -- 1 = Primary (first 15GB), 2 = Fallback (second 15GB)
    storage_used_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for instant priority lookup
CREATE INDEX IF NOT EXISTS idx_drive_accounts_priority 
ON public.drive_accounts (priority_order ASC) 
WHERE is_active = true;

-- -------------------------------------------------------------------------
-- 2. Table: bills
-- Stores all invoice metadata in Supabase PostgreSQL (500 MB free quota),
-- while offloading the heavy PDF binary to Google Drive.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_gstin TEXT,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
    items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    drive_account_id UUID REFERENCES public.drive_accounts(id) ON DELETE SET NULL,
    drive_file_id TEXT, -- Google Drive file ID (e.g., 1A2b3C4d5E...)
    drive_web_link TEXT, -- Viewable Google Drive preview URL
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_bills_invoice_number ON public.bills (invoice_number);
CREATE INDEX IF NOT EXISTS idx_bills_bill_date ON public.bills (bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_drive_account_id ON public.bills (drive_account_id);
CREATE INDEX IF NOT EXISTS idx_bills_drive_file_id ON public.bills (drive_file_id);

-- -------------------------------------------------------------------------
-- 3. Row Level Security (RLS) Setup
-- Enables secure public/anon REST API access for the billing application
-- -------------------------------------------------------------------------
ALTER TABLE public.drive_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated / anon service operations on bills
DROP POLICY IF EXISTS "Allow all access to bills" ON public.bills;
CREATE POLICY "Allow all access to bills" 
ON public.bills 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Allow all operations on drive_accounts for app server / admin
DROP POLICY IF EXISTS "Allow all access to drive_accounts" ON public.drive_accounts;
CREATE POLICY "Allow all access to drive_accounts" 
ON public.drive_accounts 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- -------------------------------------------------------------------------
-- 4. Automatic updated_at Trigger
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_updated_at_bills ON public.bills;
CREATE TRIGGER trigger_set_updated_at_bills
BEFORE UPDATE ON public.bills
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_set_updated_at_drive_accounts ON public.drive_accounts;
CREATE TRIGGER trigger_set_updated_at_drive_accounts
BEFORE UPDATE ON public.drive_accounts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
