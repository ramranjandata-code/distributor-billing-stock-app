// English-Only Translation Dictionary for DistroPulse

export const translations = {
  en: {
    // Navigation / Tabs
    dashboard: "Dashboard",
    billing: "Quick POS Billing",
    inventory: "Stock & Inventory",
    parties: "Parties & Khata",
    invoices: "Invoice History",
    reports: "Reports & Analytics",
    settings: "Firm Settings",
    new_bill_btn: "New Bill (+)",
    low_stock_alert: "Low Stock Alert",

    // Dashboard
    dashboard_title: "Dashboard & Overview",
    welcome: "Welcome",
    today_sales: "Today's Sales",
    invoices_cut: "invoices created",
    stock_value: "Stock Value",
    total_units: "Total units &",
    total_products: "products",
    khata_balance: "Total Market Udhar (Khata Balance)",
    due_on_retailers: "due across retailers",
    low_stock_items: "Low Stock Items",
    reorder_urgently: "Requires urgent reorder",
    quick_bill: "Quick Bill",
    update_stock: "Update Stock",
    low_stock_warning: "Low Stock Warnings",
    view_all: "View All",
    recent_bills: "Recent Bills",
    view_all_invoices: "View All Invoices",
    inv_no: "Invoice No",
    retailer: "Retailer (Party)",
    amount: "Amount",
    status: "Status",
    print: "Print",
    no_bills: "No invoices generated yet.",
    paid: "PAID",
    unpaid: "UNPAID",
    partial: "PARTIAL",

    // Billing
    create_bill: "Create Tax Invoice / POS Bill",
    select_retailer: "Select Retailer (Party)",
    add_new_party: "+ Add New Retailer",
    walk_in_customer: "Walk-in Retailer / Cash Sale",
    search_product: "Search product by name, brand, SKU or barcode...",
    item: "Item Details",
    stock: "Stock",
    mrp: "MRP",
    price: "Rate",
    qty: "Qty",
    gst: "GST",
    tax: "Tax Amt",
    total: "Total",
    action: "Action",
    no_items_added: "No products added to bill yet. Search & click + to add items.",
    subtotal: "Sub Total",
    gst_total: "Tax Total (CGST + SGST)",
    discount: "Discount (₹)",
    grand_total: "Grand Total",
    payment_mode: "Payment Status",
    paid_amount: "Paid Amount (₹)",
    balance_due: "Balance Due (Udhar)",
    save_print_bill: "Save & Print Invoice",
    saving: "Saving...",

    // Inventory
    inventory_title: "Stock & Inventory Management",
    add_product: "+ Add New Product",
    search_inventory: "Search inventory by name, category, brand, HSN...",
    product_name: "Product Name",
    category: "Category",
    brand: "Brand",
    hsn_sku: "HSN / SKU",
    prices: "Purchase / Sale Price",
    pcs_ctn: "Pcs / Carton",
    stock_status: "Current Stock",
    min_limit: "Min Limit",
    actions: "Actions",
    no_products: "No products in inventory. Click '+ Add New Product' to start.",
    edit: "Edit",
    delete: "Delete",
    stock_add: "+ Stock In",
    purchase_price: "Purchase Price",
    sale_price: "Sale Price",

    // Parties / Khata
    parties_title: "Retailers & Khata Book",
    add_party: "+ Add New Retailer",
    search_parties: "Search retailer by shop name, contact, city, GSTIN...",
    party_name: "Shop / Party Name",
    contact: "Contact Person & Phone",
    city_address: "City & Address",
    gstin: "GSTIN",
    credit_limit: "Credit Limit",
    khata_due: "Udhar Balance",
    receive_payment: "Collect Payment",
    clear_due: "Clear Balance",
    no_parties: "No retailer accounts created yet. Click '+ Add New Retailer' to start.",

    // Invoice History
    history_title: "Invoice History & Billed Records",
    search_invoices: "Search invoices by bill no, retailer name, status...",
    date: "Date & Time",
    payment_summary: "Payment Status",
    no_history: "No invoices recorded yet.",

    // Reports
    reports_title: "Sales & Profit Analytics Reports",
    total_revenue: "Total Revenue",
    total_profit: "Estimated Net Margin",
    total_invoices_count: "Total Invoices Issued",
    top_selling: "Top Selling Products",

    // Settings
    settings_title: "Firm & Business Settings",
    general_settings: "Business Info & GST",
    cloud_db_settings: "Cloud Database (Supabase)",
    app_language: "Application Language",
    select_language: "Select Preferred Language",
    lang_en: "English (Default)",
    lang_hinglish: "English",
    lang_hi: "English",
    save_settings: "Save Business Settings",
    firm_name: "Firm / Business Name",
    tagline: "Tagline / Subtitle",
    proprietor: "Owner / Proprietor",
    phone: "Phone Number",
    email: "Email Address",
    address: "Business Address",
    bank_name: "Bank Name",
    account_no: "Account Number",
    ifsc: "IFSC Code",
    invoice_prefix: "Invoice Prefix (e.g. SGA/26-27/)",
    terms: "Invoice Terms & Conditions",
    cloud_status_active: "Real-Time Cloud Sync Active",
    cloud_status_desc: "Changes automatically save to Supabase Cloud DB in real-time.",
    clear_sample_data: "Clear All Sample Data",
    upload_cloud: "Upload Local Data to Cloud DB",
    download_cloud: "Download Cloud DB Data",
    supabase_url: "Supabase Project URL",
    supabase_key: "Supabase Anon Key",
    save_cloud_credentials: "Save Cloud Credentials"
  }
};

translations.hinglish = translations.en;
translations.hi = translations.en;

export const getAppLanguage = () => {
  return 'en';
};

export const setAppLanguage = (lang) => {
  localStorage.setItem('distro_app_language', 'en');
};

export const t = (key, currentLang = null) => {
  return translations.en[key] || key;
};
