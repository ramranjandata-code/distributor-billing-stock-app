-- DistroPulse Supabase Database SQL Schema
-- Copy and run this script in Supabase SQL Editor (https://supabase.com -> SQL Editor)

-- 1. Business Info Table
CREATE TABLE IF NOT EXISTS business_info (
  id TEXT PRIMARY KEY DEFAULT 'default_business',
  name TEXT NOT NULL,
  tagline TEXT,
  proprietor TEXT,
  gstin TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  bank_name TEXT,
  account_no TEXT,
  ifsc TEXT,
  invoice_prefix TEXT,
  terms TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Products Table (Inventory & Stock)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  sku TEXT,
  hsn TEXT,
  mrp NUMERIC DEFAULT 0,
  sale_price NUMERIC DEFAULT 0,
  purchase_price NUMERIC DEFAULT 0,
  gst_rate NUMERIC DEFAULT 0,
  pcs_per_carton NUMERIC DEFAULT 1,
  current_stock NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'Pcs',
  min_stock_limit NUMERIC DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Parties Table (Retailers & Customers Khata)
CREATE TABLE IF NOT EXISTS parties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  city TEXT,
  address TEXT,
  gstin TEXT,
  credit_limit NUMERIC DEFAULT 50000,
  balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Invoices Table (Billing Records)
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_no TEXT UNIQUE NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  party_id TEXT,
  party_name TEXT,
  party_phone TEXT,
  party_gstin TEXT,
  party_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  sub_total NUMERIC DEFAULT 0,
  tax_total NUMERIC DEFAULT 0,
  cgst NUMERIC DEFAULT 0,
  sgst NUMERIC DEFAULT 0,
  igst NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'UNPAID',
  paid_amount NUMERIC DEFAULT 0,
  balance_amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) and Allow Public Access
ALTER TABLE business_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for business_info" ON business_info FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for parties" ON parties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
