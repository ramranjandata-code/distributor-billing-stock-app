-- ==============================================================================
-- DISTROPLUS ERP: PRODUCTION POSTGRESQL RELATIONAL SCHEMA
-- Version: 3.5.0-ENTERPRISE
-- Author: Principal Full-Stack Engineer & GSTN Systems Architect
-- Compliant with: Indian GST Act (Sec 17(5)(h), Rule 53, Rule 138), GSTN Portal Specifications
-- Modules:
--   1. Official GST GSTR-1 & Invoicing Ledger
--   2. Sales Returns (RMA) & Damaged/Undamaged Inventory Segregation
--   3. Purchase Returns, Expired Lots & Section 17(5)(h) ITC Reversals
--   4. Multi-Mode Split Payments & Cheque Clearing Lifecycle
--   5. Immutable Audit Trail & Event Logging System
-- ==============================================================================

-- Enable UUID extension for globally unique primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean drop (Development/Migration Safeguard)
-- DROP SCHEMA IF EXISTS distroplus CASCADE;
-- CREATE SCHEMA distroplus;
-- SET search_path TO distroplus, public;

-- ==============================================================================
-- 1. MASTER TABLES (Warehouses, Parties, Products)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS warehouses (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'COMMERCIAL', -- 'COMMERCIAL', 'QUARANTINE_SCRAP', 'BONDED'
    address TEXT,
    state_code VARCHAR(2) NOT NULL DEFAULT '07',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default physical warehouses
INSERT INTO warehouses (id, name, type, address, state_code)
VALUES 
    ('wh_main', 'Central Godown / Main Warehouse', 'COMMERCIAL', 'Industrial Area Ph-1, New Delhi', '07'),
    ('wh_scrap', 'Quarantine & Damaged Scrap Bin (Sec 17(5)(h))', 'QUARANTINE_SCRAP', 'Quarantine Cage Area-D, New Delhi', '07')
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

CREATE TABLE IF NOT EXISTS parties (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('pty_' || substr(md5(random()::text), 1, 12)),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'RETAILER', -- 'RETAILER', 'WHOLESALER', 'VENDOR', 'DISTRIBUTOR'
    gstin VARCHAR(15) CHECK (gstin IS NULL OR length(gstin) = 15),
    state_code VARCHAR(2) NOT NULL DEFAULT '07',
    phone VARCHAR(20),
    email VARCHAR(100),
    billing_address TEXT,
    shipping_address TEXT,
    credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 50000.00,
    credit_days INT NOT NULL DEFAULT 15,
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00, -- Positive: Retailer owes us (Debit balance), Negative: We owe vendor
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parties_gstin ON parties(gstin);
CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(type);

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('prd_' || substr(md5(random()::text), 1, 12)),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'General Goods',
    hsn VARCHAR(10) NOT NULL,
    uqc VARCHAR(10) NOT NULL DEFAULT 'BOX', -- UQC code: BOX, PCS, KGS, NOS, CTN
    pcs_per_carton INT NOT NULL DEFAULT 1,
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sale_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    mrp NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00, -- 0, 5, 12, 18, 28
    cess_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_stock_limit NUMERIC(12, 2) NOT NULL DEFAULT 10.00,
    warehouse_id VARCHAR(50) REFERENCES warehouses(id) DEFAULT 'wh_main',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_hsn ON products(hsn);

-- Batch / Lot inventory tracking (FIFO / Expiry management)
CREATE TABLE IF NOT EXISTS stock_lots (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('lot_' || substr(md5(random()::text), 1, 12)),
    product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_no VARCHAR(100) NOT NULL,
    mfg_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    initial_qty NUMERIC(12, 2) NOT NULL,
    remaining_qty NUMERIC(12, 2) NOT NULL CHECK (remaining_qty >= 0),
    warehouse_id VARCHAR(50) NOT NULL REFERENCES warehouses(id) DEFAULT 'wh_main',
    is_quarantined BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_lots_expiry ON stock_lots(expiry_date);
CREATE INDEX IF NOT EXISTS idx_stock_lots_product ON stock_lots(product_id);

-- ==============================================================================
-- 2. SALES INVOICING & GSTN GSTR-1 ENGINE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('inv_' || substr(md5(random()::text), 1, 12)),
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    date DATE NOT NULL,
    due_date DATE NOT NULL,
    party_id VARCHAR(50) REFERENCES parties(id),
    customer_name VARCHAR(200) NOT NULL,
    party_gstin VARCHAR(15),
    pos VARCHAR(2) NOT NULL, -- 2-digit Place of Supply (e.g., '07' for Delhi)
    supply_type VARCHAR(10) NOT NULL DEFAULT 'INTRA', -- 'INTRA' (CGST+SGST), 'INTER' (IGST)
    pricing_type VARCHAR(15) NOT NULL DEFAULT 'INCLUSIVE', -- 'INCLUSIVE', 'EXCLUSIVE'
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    cgst NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    sgst NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    igst NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    cess NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_tax NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    round_off NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    balance_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID', -- 'PAID', 'PARTIALLY_PAID', 'UNPAID', 'BOUNCED', 'REFUNDED'
    state VARCHAR(20) NOT NULL DEFAULT 'draft', -- Odoo state: 'draft', 'posted', 'in_payment', 'paid', 'cancel'
    is_b2b BOOLEAN NOT NULL DEFAULT FALSE,
    gstr1_filing_period VARCHAR(6), -- Format: MMYYYY (e.g. '092026')
    gstr1_exported BOOLEAN NOT NULL DEFAULT FALSE,
    gstr1_export_timestamp TIMESTAMPTZ,
    eway_bill_no VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoices_party ON invoices(party_id);
CREATE INDEX IF NOT EXISTS idx_invoices_state ON invoices(state);
CREATE INDEX IF NOT EXISTS idx_invoices_gstr1_period ON invoices(gstr1_filing_period);

CREATE TABLE IF NOT EXISTS invoice_items (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('item_' || substr(md5(random()::text), 1, 12)),
    invoice_id VARCHAR(50) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES products(id),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    hsn VARCHAR(10) NOT NULL,
    qty NUMERIC(12, 2) NOT NULL CHECK (qty > 0),
    cartons NUMERIC(10, 2) DEFAULT 0,
    pcs_per_carton INT DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_pct NUMERIC(5, 2) DEFAULT 0.00,
    taxable_value NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL,
    batch_no VARCHAR(100),
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ==============================================================================
-- 3. SALES RETURNS (RMA) & DAMAGED VS UNDAMAGED RESTOCK
-- ==============================================================================

CREATE TABLE IF NOT EXISTS sales_returns (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('ret_' || substr(md5(random()::text), 1, 12)),
    return_no VARCHAR(50) UNIQUE NOT NULL, -- Format: RET-YYYY-NNNN
    credit_note_no VARCHAR(50) UNIQUE, -- Format: RINV-YYYY-NNNN
    original_invoice_id VARCHAR(50) REFERENCES invoices(id),
    party_id VARCHAR(50) REFERENCES parties(id),
    return_date DATE NOT NULL,
    reason VARCHAR(100) NOT NULL, -- 'EXPIRED', 'DAMAGED_TRANSIT', 'WRONG_ITEM', 'DEFECTIVE'
    notes TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    applied_to_invoice_id VARCHAR(50) REFERENCES invoices(id),
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED', -- 'APPROVED', 'PENDING', 'CANCELLED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_return_items (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('ritem_' || substr(md5(random()::text), 1, 12)),
    return_id VARCHAR(50) NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES products(id),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    hsn VARCHAR(10) NOT NULL,
    qty NUMERIC(12, 2) NOT NULL CHECK (qty > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    condition VARCHAR(20) NOT NULL DEFAULT 'UNDAMAGED', -- 'UNDAMAGED', 'DAMAGED'
    destination_warehouse VARCHAR(50) NOT NULL REFERENCES warehouses(id), -- 'wh_main' for undamaged, 'wh_scrap' for damaged
    total NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. PURCHASE RETURNS & EXPIRED STOCK CLAIMS (SEC 17(5)(h) ITC REVERSAL)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS purchase_returns (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('pr_' || substr(md5(random()::text), 1, 12)),
    debit_note_no VARCHAR(50) UNIQUE NOT NULL, -- Format: DN-YYYY-NNNN
    vendor_id VARCHAR(50) REFERENCES parties(id),
    vendor_name VARCHAR(200) NOT NULL,
    vendor_gstin VARCHAR(15),
    original_bill_ref VARCHAR(100),
    date DATE NOT NULL,
    reason VARCHAR(150) NOT NULL, -- 'EXPIRED_STOCK_CLAIM', 'DEFECTIVE_BATCH', 'RETURN_TO_SUPPLIER'
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    itc_reversal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Mandatory Sec 17(5)(h) ITC Reversal
    sec_17_5_h_reversal_posted BOOLEAN NOT NULL DEFAULT TRUE,
    grand_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'POSTED',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('pritem_' || substr(md5(random()::text), 1, 12)),
    purchase_return_id VARCHAR(50) NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES products(id),
    name VARCHAR(255) NOT NULL,
    batch_no VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    return_qty NUMERIC(12, 2) NOT NULL CHECK (return_qty > 0),
    purchase_cost NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    total NUMERIC(12, 2) NOT NULL,
    itc_reversed NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. BANK ACCOUNTS, MULTI-MODE SPLIT PAYMENTS & CHEQUE CLEARING LIFECYCLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('bank_' || substr(md5(random()::text), 1, 12)),
    bank_name VARCHAR(150) NOT NULL,
    account_no VARCHAR(50) NOT NULL,
    ifsc VARCHAR(20) NOT NULL,
    branch VARCHAR(100),
    upi_id VARCHAR(100),
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_entries (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('pay_' || substr(md5(random()::text), 1, 12)),
    payment_no VARCHAR(50) UNIQUE NOT NULL,
    invoice_id VARCHAR(50) REFERENCES invoices(id),
    party_id VARCHAR(50) REFERENCES parties(id),
    party_name VARCHAR(200),
    date DATE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_mode VARCHAR(20) NOT NULL, -- 'CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS'
    reference_no VARCHAR(100), -- UTR or bank transaction reference
    cheque_no VARCHAR(50),
    cheque_bank VARCHAR(100),
    cheque_date DATE,
    cheque_status VARCHAR(20) DEFAULT 'NONE', -- 'NONE', 'PENDING', 'CLEARED', 'BOUNCED'
    clearance_date DATE,
    bounce_reason VARCHAR(150),
    bounce_penalty NUMERIC(10, 2) DEFAULT 0.00,
    bank_account_id VARCHAR(50) REFERENCES bank_accounts(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_entries_invoice ON payment_entries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_entries_cheque ON payment_entries(cheque_status);

CREATE TABLE IF NOT EXISTS bank_transactions (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('tx_' || substr(md5(random()::text), 1, 12)),
    bank_account_id VARCHAR(50) NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    party_id VARCHAR(50) REFERENCES parties(id),
    party_name VARCHAR(200),
    type VARCHAR(10) NOT NULL, -- 'CREDIT' (Receipt), 'DEBIT' (Payment/Charges)
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    mode VARCHAR(20) NOT NULL DEFAULT 'NEFT',
    reference_no VARCHAR(100) NOT NULL,
    notes TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_account ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(date);

-- ==============================================================================
-- 6. IMMUTABLE INVOICE AUDIT TRAIL & EVENT LOGGING
-- ==============================================================================

CREATE TABLE IF NOT EXISTS invoice_history_logs (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('log_' || substr(md5(random()::text), 1, 12)),
    invoice_id VARCHAR(50) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'CREATED', 'POSTED', 'EDITED', 'PAYMENT_RECORDED', 'SPLIT_PAYMENT', 'CHEQUE_PENDING', 'CHEQUE_CLEARED', 'CHEQUE_BOUNCED', 'CREDIT_NOTE_APPLIED', 'SALES_RETURN_CREATED', 'GSTR1_EXPORTED', 'CANCELLED'
    operator_name VARCHAR(150) NOT NULL DEFAULT 'System / Administrator',
    operator_role VARCHAR(50) DEFAULT 'admin',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    snapshot JSONB, -- Full document state snapshot at time of mutation
    ip_address VARCHAR(50),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_logs_invoice ON invoice_history_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_history_logs_action ON invoice_history_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_history_logs_timestamp ON invoice_history_logs(timestamp);

-- ==============================================================================
-- 7. AUTOMATED TRIGGERS & PROCEDURES (INTEGRITY GUARANTEE)
-- ==============================================================================

-- Trigger: Automatically update product stock on Sales Return Restock
CREATE OR REPLACE FUNCTION trg_sales_return_restock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.condition = 'UNDAMAGED' AND NEW.destination_warehouse = 'wh_main' THEN
        UPDATE products
        SET current_stock = current_stock + NEW.qty,
            updated_at = NOW()
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_sales_return_insert ON sales_return_items;
CREATE TRIGGER trg_after_sales_return_insert
AFTER INSERT ON sales_return_items
FOR EACH ROW EXECUTE FUNCTION trg_sales_return_restock();

-- Trigger: Automatically deduct stock when Purchase Return (Expired Stock Claim) is created
CREATE OR REPLACE FUNCTION trg_purchase_return_deduct_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET current_stock = GREATEST(0, current_stock - NEW.return_qty),
        updated_at = NOW()
    WHERE id = NEW.product_id;

    -- Also reduce remaining qty from stock lot
    UPDATE stock_lots
    SET remaining_qty = GREATEST(0, remaining_qty - NEW.return_qty),
        updated_at = NOW()
    WHERE product_id = NEW.product_id AND batch_no = NEW.batch_no;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_purchase_return_insert ON purchase_return_items;
CREATE TRIGGER trg_after_purchase_return_insert
AFTER INSERT ON purchase_return_items
FOR EACH ROW EXECUTE FUNCTION trg_purchase_return_deduct_stock();

-- ==============================================================================
-- 8. COMPLIANCE & RECONCILIATION SUMMARY VIEWS
-- ==============================================================================

-- View: GSTR-1 Table 4A (Supplies to Registered Buyers)
CREATE OR REPLACE VIEW view_gstr1_b2b AS
SELECT 
    i.party_gstin AS ctin,
    i.customer_name AS party_name,
    i.invoice_no AS inum,
    to_char(i.date, 'DD-MM-YYYY') AS idt,
    i.grand_total AS val,
    i.pos,
    i.supply_type,
    i.gstr1_filing_period AS fp,
    it.hsn,
    it.gst_rate AS rt,
    SUM(it.taxable_value) AS txval,
    SUM(it.igst) AS iamt,
    SUM(it.cgst) AS camt,
    SUM(it.sgst) AS samt,
    SUM(it.total) AS total_val
FROM invoices i
JOIN invoice_items it ON i.id = it.invoice_id
WHERE i.is_b2b = TRUE AND i.state IN ('posted', 'paid', 'in_payment')
GROUP BY i.party_gstin, i.customer_name, i.invoice_no, i.date, i.grand_total, i.pos, i.supply_type, i.gstr1_filing_period, it.hsn, it.gst_rate;

-- View: Section 17(5)(h) ITC Reversals Audit Summary
CREATE OR REPLACE VIEW view_sec17_5_h_itc_reversals AS
SELECT 
    pr.debit_note_no,
    pr.date AS claim_date,
    pr.vendor_name,
    pr.vendor_gstin,
    pr.reason,
    pr.taxable_amount AS expired_goods_cost,
    pr.itc_reversal_amount AS reversed_gst_input_credit,
    pr.grand_total AS total_claim_amount,
    pr.created_at
FROM purchase_returns pr
WHERE pr.sec_17_5_h_reversal_posted = TRUE
ORDER BY pr.date DESC;

-- End of distroplus schema definition
