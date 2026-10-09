import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  saveProduct, 
  deleteProduct, 
  updateProductStock, 
  formatCartonStock, 
  fetchWarehouses, 
  fetchSuppliers,
  saveSupplier,
  savePurchase,
  fetchPurchases,
  deletePurchase,
  transferStockBetweenWarehouses, 
  getProductStockValuation,
  fetchStockLots,
  isPurchaseBillEditable,
  getPurchaseBillRemainingEditTime,
  recalculateAndNormalizeAllPurchaseBills,
  formatDateDDMMYY,
  logAuditAction,
  normalizeProductName,
  isProductMatch
} from '../utils/storage';
import { 
  Package, 
  Plus, 
  PlusCircle, 
  Search, 
  Edit3, 
  Trash2, 
  ArrowDownCircle, 
  Filter, 
  AlertTriangle, 
  Boxes, 
  X, 
  Save, 
  Tag,
  ArrowLeftRight,
  FileSpreadsheet,
  Calendar,
  Building2,
  Clock,
  ShieldAlert,
  UploadCloud,
  CheckCircle,
  Sparkles,
  Layers,
  ShoppingBag,
  ChevronDown,
  FileText,
  Eye,
  Printer,
  Receipt
} from 'lucide-react';

export default function Inventory({ products, refreshAllData, defaultSubTab = 'stock' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [expiryFilter, setExpiryFilter] = useState('ALL'); // 'ALL', 'EXPIRING_SOON', 'EXPIRED'
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [selectedLotProduct, setSelectedLotProduct] = useState(null);

  // Dynamic Multi-rate Stock Valuation
  const totalCatalogValuation = useMemo(() => getProductStockValuation(), [products]);

  // Warehouses & Purchase Parties (Suppliers)
  const warehouses = fetchWarehouses();
  const [suppliers, setSuppliers] = useState(fetchSuppliers());
  const [quickSupplierModalOpen, setQuickSupplierModalOpen] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({ name: '', gstin: '', phone: '', city: '' });

  // Supplier Search Dropdown in Add New Purchase
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [highlightedSupplierIndex, setHighlightedSupplierIndex] = useState(0);
  const [selectedSupplierObj, setSelectedSupplierObj] = useState(null);
  const supplierDropdownRef = useRef(null);

  // Top Product Search Bar inside Add Purchase Modal
  const [purchaseProdSearchTerm, setPurchaseProdSearchTerm] = useState('');
  const [showPurchaseProdSuggestions, setShowPurchaseProdSuggestions] = useState(false);
  const [highlightedPurchaseProdIndex, setHighlightedPurchaseProdIndex] = useState(0);
  const purchaseProdSearchRef = useRef(null);

  // Product Search Dropdown inside Purchase Table Row
  const [activeProductRowId, setActiveProductRowId] = useState(null);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const [quickProductModalOpen, setQuickProductModalOpen] = useState(false);
  const [targetRowIndexForProduct, setTargetRowIndexForProduct] = useState(null);
  const initialQuickProductState = {
    name: '',
    brand: '',
    category: 'General',
    hsn: '1905',
    mrp: '',
    salePrice: '',
    purchasePrice: '',
    gstRate: 5,
    pcsPerCarton: 24
  };
  const [quickProductData, setQuickProductData] = useState(initialQuickProductState);
  const productDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target)) {
        setShowSupplierSuggestions(false);
      }
      if (purchaseProdSearchRef.current && !purchaseProdSearchRef.current.contains(event.target)) {
        setShowPurchaseProdSuggestions(false);
      }
      if (!event.target.closest('.purchase-row-product-cell')) {
        setActiveProductRowId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  const [stockInModalOpen, setStockInModalOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState(null);
  const [stockInCartons, setStockInCartons] = useState('');
  const [stockInLoosePcs, setStockInLoosePcs] = useState('');
  const [stockInReason, setStockInReason] = useState('Purchase Receipt');

  // Add New Purchase Modal State
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [purchaseHeader, setPurchaseHeader] = useState({
    partyName: '',
    partyGst: '',
    date: new Date().toISOString().split('T')[0],
    billNo: '',
    warehouseId: warehouses[0]?.id || 'wh_main'
  });

  const emptyPurchaseRow = () => ({
    id: 'prow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    productId: '',
    name: '',
    mrp: '',
    hsn: '',
    batchNo: '',
    mfgDate: '',
    expiryDate: '',
    salePrice: '',
    gstRate: 5,
    qty: 1,
    purchasePrice: '', // per-unit without GST
    totalExGst: '', // total without GST
    purchasePriceWithGst: '', // per-unit with GST
    totalWithGst: '' // total with GST
  });

  const [purchaseRows, setPurchaseRows] = useState([emptyPurchaseRow()]);

  // Sub-Tab Switching (Stock vs Purchases)
  const [inventorySubTab, setInventorySubTab] = useState(defaultSubTab || 'stock');
  const [purchases, setPurchases] = useState(() => fetchPurchases());
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');
  const [purchaseSortOrder, setPurchaseSortOrder] = useState('desc'); // 'desc' (newest date first) | 'asc' (oldest date first)
  const [viewingPurchaseBill, setViewingPurchaseBill] = useState(null);

  useEffect(() => {
    setPurchases(fetchPurchases());
    const handleDataChanged = () => {
      setPurchases(fetchPurchases());
      setSuppliers(fetchSuppliers());
    };
    window.addEventListener('distro_data_changed', handleDataChanged);
    return () => window.removeEventListener('distro_data_changed', handleDataChanged);
  }, []);

  useEffect(() => {
    if (defaultSubTab) {
      setInventorySubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  // Inter-Warehouse Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    productId: '',
    fromWarehouseId: warehouses[0]?.id || 'wh_main',
    toWarehouseId: warehouses[1]?.id || 'wh_store',
    qty: '',
    reason: 'Stock Replenishment'
  });

  // Photo-to-Purchase & Excel/CSV Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [parsedImportItems, setParsedImportItems] = useState([]);
  const [importFileName, setImportFileName] = useState('');

  // Product Form Initial State
  const initialForm = {
    name: '',
    category: 'Staples & Grocery',
    brand: '',
    sku: '',
    hsn: '19053100',
    batchNo: '',
    expiryDate: '',
    mfgDate: '',
    warehouseId: warehouses[0]?.id || 'wh_main',
    mrp: '',
    salePrice: '',
    purchasePrice: '',
    gstRate: 5,
    pcsPerCarton: 24,
    packsPerCarton: '',
    pcsPerBox: '',
    cartonsStock: '',
    boxesStock: '',
    loosePcsStock: '',
    currentStock: 0,
    unit: 'Pcs',
    minStockLimit: 15
  };
  const [formData, setFormData] = useState(initialForm);

  // Categories extraction
  const categories = ['ALL', ...new Set(products.map(p => p.category))];

  // Helper: check expiry status
  const getExpiryStatus = (expDate) => {
    if (!expDate) return { status: 'HEALTHY', daysLeft: 999 };
    const exp = new Date(expDate);
    if (isNaN(exp.getTime())) return { status: 'HEALTHY', daysLeft: 999 };
    const now = new Date();
    const diffTime = exp.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'EXPIRED', daysLeft: diffDays };
    if (diffDays <= 45) return { status: 'EXPIRING_SOON', daysLeft: diffDays };
    return { status: 'HEALTHY', daysLeft: diffDays };
  };

  // Filtering
  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ((p.sku || '').toLowerCase().includes(searchTerm.toLowerCase())) ||
                          ((p.brand || '').toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (p.batchNo && p.batchNo.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesWarehouse = warehouseFilter === 'ALL' || (p.warehouseId || 'wh_main') === warehouseFilter;
    const matchesLowStock = !showLowStockOnly || p.currentStock <= (p.minStockLimit || 10);
    
    const expInfo = getExpiryStatus(p.expiryDate);
    let matchesExpiry = true;
    if (expiryFilter === 'EXPIRING_SOON') matchesExpiry = expInfo.status === 'EXPIRING_SOON';
    if (expiryFilter === 'EXPIRED') matchesExpiry = expInfo.status === 'EXPIRED';

    return matchesSearch && matchesCategory && matchesWarehouse && matchesLowStock && matchesExpiry;
  });

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      ...initialForm,
      cartonsStock: 0,
      boxesStock: 0,
      loosePcsStock: 0,
      currentStock: 0
    });
    setProductModalOpen(true);
  };

  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod);
    const pcsPerCtn = Number(prod.pcsPerCarton) || 24;
    const isBoxOrPack = prod.unit === 'Box' || prod.unit === 'Pack' || prod.unit === 'Chain Pouch';
    const pcsPerBox = prod.pcsPerBox !== undefined && prod.pcsPerBox !== '' ? prod.pcsPerBox : (isBoxOrPack ? 1 : '');
    const packsPerCtn = prod.packsPerCarton !== undefined && prod.packsPerCarton !== '' 
      ? prod.packsPerCarton 
      : (isBoxOrPack && Number(pcsPerBox) > 0 ? Math.floor(pcsPerCtn / Number(pcsPerBox)) || 1 : '');

    const stock = Number(prod.currentStock) || 0;
    const ctn = Math.floor(stock / pcsPerCtn);
    let remStock = stock % pcsPerCtn;
    let boxes = 0;
    let loose = remStock;
    if (isBoxOrPack && Number(pcsPerBox) > 1) {
      boxes = Math.floor(remStock / Number(pcsPerBox));
      loose = remStock % Number(pcsPerBox);
    }

    setFormData({
      ...prod,
      pcsPerCarton: pcsPerCtn,
      packsPerCarton: packsPerCtn,
      pcsPerBox: pcsPerBox,
      cartonsStock: ctn,
      boxesStock: boxes > 0 ? boxes : '',
      loosePcsStock: loose,
      currentStock: stock
    });
    setProductModalOpen(true);
  };

  const handleSaveProductForm = (e) => {
    e.preventDefault();
    const isBoxOrPack = formData.unit === 'Box' || formData.unit === 'Pack' || formData.unit === 'Chain Pouch';
    const pcsPerBoxNum = Number(formData.pcsPerBox) || 1;
    const packsPerCtnNum = Number(formData.packsPerCarton) || 1;
    
    // If Box/Pack, total pcs in carton is packsPerCarton * pcsPerBox
    const pcsPerCtn = isBoxOrPack && Number(formData.pcsPerBox) > 0 && Number(formData.packsPerCarton) > 0
      ? (packsPerCtnNum * pcsPerBoxNum)
      : (Number(formData.pcsPerCarton) || 24);

    const ctn = Number(formData.cartonsStock) || 0;
    const boxes = isBoxOrPack ? (Number(formData.boxesStock) || 0) : 0;
    const loose = Number(formData.loosePcsStock) || 0;
    const calculatedTotalStock = (ctn * pcsPerCtn) + (boxes * (isBoxOrPack ? pcsPerBoxNum : 0)) + loose;

    // Auto-generate SKU if empty or missing
    let finalSku = (formData.sku || '').trim();
    if (!finalSku) {
      const cleanName = (formData.name || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const prefix = cleanName.length >= 3 ? cleanName.substring(0, 3) : 'SKU';
      finalSku = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const payload = {
      ...formData,
      sku: finalSku,
      pcsPerCarton: pcsPerCtn,
      packsPerCarton: isBoxOrPack ? (formData.packsPerCarton || packsPerCtnNum) : '',
      pcsPerBox: isBoxOrPack ? (formData.pcsPerBox || pcsPerBoxNum) : '',
      mrp: Number(formData.mrp) || 0,
      salePrice: Number(formData.salePrice) || 0,
      purchasePrice: Number(formData.purchasePrice) || 0,
      gstRate: Number(formData.gstRate) || 0,
      currentStock: calculatedTotalStock > 0 ? calculatedTotalStock : (Number(formData.currentStock) || 0),
      minStockLimit: Number(formData.minStockLimit) || 10
    };

    saveProduct(payload);
    refreshAllData();
    setProductModalOpen(false);
    setEditingProduct(null);
    setFormData({
      ...initialForm,
      cartonsStock: 0,
      boxesStock: 0,
      loosePcsStock: 0,
      currentStock: 0
    });
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete '${name}'?`)) {
      deleteProduct(id);
      refreshAllData();
    }
  };

  const handleOpenStockIn = (prod) => {
    setSelectedProductForStock(prod);
    setStockInCartons('');
    setStockInLoosePcs('');
    setStockInModalOpen(true);
  };

  const handleSaveStockIn = (e) => {
    e.preventDefault();
    if (!selectedProductForStock) return;
    const pcsPerCtn = Number(selectedProductForStock.pcsPerCarton) || 24;
    const ctnToAdd = Number(stockInCartons) || 0;
    const looseToAdd = Number(stockInLoosePcs) || 0;
    const totalPcsToAdd = (ctnToAdd * pcsPerCtn) + looseToAdd;

    if (totalPcsToAdd <= 0) return;

    updateProductStock(selectedProductForStock.id, totalPcsToAdd, stockInReason);
    refreshAllData();
    setStockInModalOpen(false);
  };

  // Inter-Warehouse Transfer Handler
  const handleTransferStock = (e) => {
    e.preventDefault();
    if (!transferForm.productId || !transferForm.qty || Number(transferForm.qty) <= 0) {
      alert('Please select a product and enter a valid quantity.');
      return;
    }
    if (transferForm.fromWarehouseId === transferForm.toWarehouseId) {
      alert('Origin and destination warehouses must be different.');
      return;
    }
    const res = transferStockBetweenWarehouses(
      transferForm.productId,
      transferForm.fromWarehouseId,
      transferForm.toWarehouseId,
      Number(transferForm.qty),
      transferForm.reason
    );
    alert(res.message);
    if (res.success) {
      refreshAllData();
      setTransferModalOpen(false);
      setTransferForm({
        productId: '',
        fromWarehouseId: warehouses[0]?.id || 'wh_main',
        toWarehouseId: warehouses[1]?.id || 'wh_store',
        qty: '',
        reason: 'Stock Replenishment'
      });
    }
  };

  // Add New Purchase Modal Handlers
  const handleOpenPurchaseModal = () => {
    const latestSuppliers = fetchSuppliers();
    setSuppliers(latestSuppliers);
    setEditingPurchaseId(null);
    setPurchaseHeader({
      partyName: '',
      partyGst: '',
      date: new Date().toISOString().split('T')[0],
      billNo: '',
      warehouseId: warehouses[0]?.id || 'wh_main'
    });
    setSupplierSearchTerm('');
    setSelectedSupplierObj(null);
    setShowSupplierSuggestions(false);
    setPurchaseProdSearchTerm('');
    setShowPurchaseProdSuggestions(false);
    setPurchaseRows([emptyPurchaseRow()]);
    setPurchaseModalOpen(true);
  };

  const handleOpenEditPurchase = (bill) => {
    if (!bill) return;
    const latestSuppliers = fetchSuppliers();
    setSuppliers(latestSuppliers);
    setEditingPurchaseId(bill.id);
    setPurchaseHeader({
      partyName: bill.partyName || '',
      partyGst: bill.partyGst || '',
      date: bill.date || new Date().toISOString().split('T')[0],
      billNo: bill.billNo || '',
      warehouseId: bill.warehouseId || warehouses[0]?.id || 'wh_main'
    });
    setSupplierSearchTerm(bill.partyName || '');
    const matchedSupp = latestSuppliers.find(s => s.name?.toLowerCase() === (bill.partyName || '').toLowerCase());
    setSelectedSupplierObj(matchedSupp || null);
    setShowSupplierSuggestions(false);
    setPurchaseProdSearchTerm('');
    setShowPurchaseProdSuggestions(false);

    const rows = (bill.items || []).map((it, idx) => {
      const q = it.qty || 1;
      const rate = it.gstRate !== undefined && it.gstRate !== null ? Number(it.gstRate) : 5;
      const pEx = it.purchasePrice !== undefined && it.purchasePrice !== null ? it.purchasePrice : '';
      const pWith = it.purchasePriceWithGst !== undefined && it.purchasePriceWithGst !== null ? it.purchasePriceWithGst : '';
      const tEx = (pEx !== '' && !isNaN(pEx)) ? Number((Number(q) * Number(pEx)).toFixed(2)) : (it.totalExGst || '');
      const tWith = (tEx !== '' && !isNaN(tEx)) ? Number((Number(tEx) * (1 + rate / 100)).toFixed(2)) : (it.totalWithGst || '');

      return {
        id: 'prow_' + Date.now() + '_' + idx,
        productId: it.productId || '',
        name: it.name || '',
        mrp: it.mrp !== undefined && it.mrp !== null ? it.mrp : '',
        hsn: it.hsn || '',
        salePrice: it.salePrice !== undefined && it.salePrice !== null ? it.salePrice : '',
        gstRate: rate,
        qty: q,
        purchasePrice: pEx,
        totalExGst: tEx,
        purchasePriceWithGst: pWith,
        totalWithGst: tWith,
        pcsPerCarton: it.pcsPerCarton || 24,
        batchNo: it.batchNo || '',
        expiryDate: it.expiryDate || ''
      };
    });

    setPurchaseRows(rows.length > 0 ? rows : [emptyPurchaseRow()]);
    setPurchaseModalOpen(true);
  };

  const filteredSuppliersForPurchase = useMemo(() => {
    const list = suppliers || [];
    if (!supplierSearchTerm.trim()) return list;
    const q = supplierSearchTerm.toLowerCase();
    return list.filter(s => 
      (s.name || '').toLowerCase().includes(q) ||
      (s.gstin || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.city || '').toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearchTerm]);

  const handleSelectSupplierFromList = (supplier) => {
    if (supplier) {
      setSelectedSupplierObj(supplier);
      setPurchaseHeader(prev => ({
        ...prev,
        partyName: supplier.name,
        partyGst: supplier.gstin || ''
      }));
      setSupplierSearchTerm('');
    } else {
      setSelectedSupplierObj(null);
      setPurchaseHeader(prev => ({
        ...prev,
        partyName: '',
        partyGst: ''
      }));
      setSupplierSearchTerm('');
    }
  };

  const handleOpenQuickSupplierFromDropdown = () => {
    const typed = (supplierSearchTerm || purchaseHeader.partyName || '').trim();
    setNewSupplierData({
      name: typed,
      gstin: '',
      phone: '',
      city: ''
    });
    setShowSupplierSuggestions(false);
    setQuickSupplierModalOpen(true);
  };

  // Top Product Search Filter for Add Purchase Modal
  const filteredProductsForPurchase = useMemo(() => {
    const term = (purchaseProdSearchTerm || '').trim().toLowerCase();
    if (!term) return products;
    return products.filter(p => 
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.sku && p.sku.toLowerCase().includes(term)) ||
      (p.barcode && p.barcode.toLowerCase().includes(term)) ||
      (p.hsn && p.hsn.toLowerCase().includes(term)) ||
      (p.brand && p.brand.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  }, [products, purchaseProdSearchTerm]);

  const handleSelectProductToPurchase = (prod) => {
    if (!prod) return;
    const exGst = Number(prod.purchasePrice) || 0;
    const rate = Number(prod.gstRate) || 0;
    const withGst = Number((exGst * (1 + rate / 100)).toFixed(2));

    setPurchaseRows(prev => {
      const emptyIdx = prev.findIndex(r => !r.name && !r.productId);
      const newRowData = {
        id: 'prow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        productId: prod.id,
        name: prod.name,
        sku: prod.sku || '',
        brand: prod.brand || '',
        category: prod.category || '',
        batchNo: prod.batchNo || '',
        mfgDate: prod.mfgDate || '',
        expiryDate: prod.expiryDate || '',
        mrp: prod.mrp || '',
        hsn: prod.hsn || '',
        salePrice: prod.salePrice || '',
        gstRate: rate,
        purchasePrice: exGst || '',
        purchasePriceWithGst: withGst || '',
        qty: 1,
        pcsPerCarton: prod.pcsPerCarton || 24
      };

      if (emptyIdx !== -1) {
        const copy = [...prev];
        copy[emptyIdx] = { ...copy[emptyIdx], ...newRowData };
        return copy;
      } else {
        return [...prev, newRowData];
      }
    });

    setPurchaseProdSearchTerm('');
    setShowPurchaseProdSuggestions(false);
  };

  const handlePurchaseProdSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredProductsForPurchase.length > 0) {
        setHighlightedPurchaseProdIndex(prev => (prev + 1) % filteredProductsForPurchase.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredProductsForPurchase.length > 0) {
        setHighlightedPurchaseProdIndex(prev => (prev - 1 + filteredProductsForPurchase.length) % filteredProductsForPurchase.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showPurchaseProdSuggestions && filteredProductsForPurchase.length > 0 && filteredProductsForPurchase[highlightedPurchaseProdIndex]) {
        handleSelectProductToPurchase(filteredProductsForPurchase[highlightedPurchaseProdIndex]);
      } else if (purchaseProdSearchTerm && purchaseProdSearchTerm.trim()) {
        handleOpenQuickProductModal(null, purchaseProdSearchTerm.trim());
      }
    } else if (e.key === 'Escape') {
      setShowPurchaseProdSuggestions(false);
    }
  };

  const handleOpenQuickProductModal = (rowIndex, initialName = '') => {
    setTargetRowIndexForProduct(rowIndex);
    setQuickProductData({
      ...initialQuickProductState,
      name: (initialName || '').trim()
    });
    setActiveProductRowId(null);
    setShowPurchaseProdSuggestions(false);
    setQuickProductModalOpen(true);
  };

  const handleSaveQuickProduct = (e) => {
    e.preventDefault();
    if (!quickProductData.name.trim()) {
      alert('Please enter product name.');
      return;
    }
    const mrp = Number(quickProductData.mrp) || 0;
    const sale = Number(quickProductData.salePrice) || mrp;
    const pur = Number(quickProductData.purchasePrice) || 0;
    const rate = Number(quickProductData.gstRate) || 0;
    const pcsPerCtn = Number(quickProductData.pcsPerCarton) || 24;

    const payload = {
      name: quickProductData.name.trim(),
      brand: quickProductData.brand ? quickProductData.brand.trim() : 'General',
      category: quickProductData.category || 'General',
      hsn: (quickProductData.hsn || '').trim() || '1905',
      mrp: mrp,
      salePrice: sale,
      purchasePrice: pur,
      gstRate: rate,
      pcsPerCarton: pcsPerCtn,
      currentStock: 0,
      unit: 'Pcs',
      minStockLimit: 10
    };

    const res = saveProduct(payload);
    refreshAllData();
    const savedProd = Array.isArray(res) ? res[0] : res;
    const withGst = Number((pur * (1 + rate / 100)).toFixed(2));

    if (targetRowIndexForProduct !== null) {
      const idx = targetRowIndexForProduct;
      setPurchaseRows(prev => {
        const updated = [...prev];
        if (updated[idx]) {
          updated[idx] = {
            ...updated[idx],
            productId: savedProd.id,
            name: savedProd.name,
            sku: savedProd.sku || '',
            brand: savedProd.brand || '',
            category: savedProd.category || '',
            mrp: savedProd.mrp || '',
            hsn: savedProd.hsn || '',
            salePrice: savedProd.salePrice || '',
            gstRate: rate,
            purchasePrice: pur || '',
            purchasePriceWithGst: withGst || '',
            qty: updated[idx].qty || 1,
            pcsPerCarton: pcsPerCtn
          };
        }
        return updated;
      });
    } else {
      const newRowData = {
        id: 'prow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        productId: savedProd.id,
        name: savedProd.name,
        sku: savedProd.sku || '',
        brand: savedProd.brand || '',
        category: savedProd.category || '',
        mrp: savedProd.mrp || '',
        hsn: savedProd.hsn || '',
        salePrice: savedProd.salePrice || '',
        gstRate: rate,
        purchasePrice: pur || '',
        purchasePriceWithGst: withGst || '',
        qty: 1,
        pcsPerCarton: pcsPerCtn
      };
      setPurchaseRows(prev => {
        const emptyIdx = prev.findIndex(r => !r.name && !r.productId);
        if (emptyIdx !== -1) {
          const copy = [...prev];
          copy[emptyIdx] = { ...copy[emptyIdx], ...newRowData };
          return copy;
        } else {
          return [...prev, newRowData];
        }
      });
      setPurchaseProdSearchTerm('');
      setShowPurchaseProdSuggestions(false);
    }

    setQuickProductModalOpen(false);
    setQuickProductData(initialQuickProductState);
  };

  const handleAddPurchaseRow = () => {
    setPurchaseRows(prev => [...prev, emptyPurchaseRow()]);
  };

  const handleRemovePurchaseRow = (index) => {
    if (purchaseRows.length <= 1) {
      setPurchaseRows([emptyPurchaseRow()]);
    } else {
      setPurchaseRows(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleProductSelect = (index, productId) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const exGst = Number(prod.purchasePrice) || 0;
    const rate = Number(prod.gstRate !== undefined ? prod.gstRate : 5);
    const withGst = Number((exGst * (1 + rate / 100)).toFixed(2));
    const currentQty = Number(purchaseRows[index]?.qty) || 1;
    const totEx = Number((currentQty * exGst).toFixed(2));
    const totWith = Number((totEx * (1 + rate / 100)).toFixed(2));

    setPurchaseRows(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        brand: prod.brand,
        category: prod.category,
        batchNo: updated[index]?.batchNo || prod.batchNo || '',
        mfgDate: updated[index]?.mfgDate || prod.mfgDate || '',
        expiryDate: updated[index]?.expiryDate || prod.expiryDate || '',
        mrp: prod.mrp || '',
        hsn: prod.hsn || '',
        salePrice: prod.salePrice || '',
        gstRate: rate,
        qty: currentQty,
        purchasePrice: exGst || '',
        totalExGst: totEx || '',
        purchasePriceWithGst: withGst || '',
        totalWithGst: totWith || '',
        pcsPerCarton: prod.pcsPerCarton || 24
      };
      return updated;
    });
  };

  const handleRowFieldChange = (index, field, value) => {
    setPurchaseRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };
      const qty = parseFloat(row.qty) || 0;
      const rate = Number(row.gstRate !== undefined ? row.gstRate : 5);

      if (field === 'purchasePrice') {
        const exGst = parseFloat(value);
        if (value === '' || isNaN(exGst)) {
          row.purchasePriceWithGst = '';
          row.totalExGst = '';
          row.totalWithGst = '';
        } else {
          row.purchasePriceWithGst = Number((exGst * (1 + rate / 100)).toFixed(2));
          if (qty > 0) {
            row.totalExGst = Number((qty * exGst).toFixed(2));
            row.totalWithGst = Number((row.totalExGst * (1 + rate / 100)).toFixed(2));
          }
        }
      } else if (field === 'totalExGst') {
        // User entered Total Without GST (Taxable Amount)
        const totEx = parseFloat(value);
        if (value === '' || isNaN(totEx)) {
          row.totalWithGst = '';
        } else {
          row.totalWithGst = Number((totEx * (1 + rate / 100)).toFixed(2));
          if (qty > 0) {
            row.purchasePrice = Number((totEx / qty).toFixed(2));
            row.purchasePriceWithGst = Number((row.purchasePrice * (1 + rate / 100)).toFixed(2));
          }
        }
      } else if (field === 'purchasePriceWithGst') {
        const withGst = parseFloat(value);
        if (value === '' || isNaN(withGst)) {
          row.purchasePrice = '';
          row.totalExGst = '';
          row.totalWithGst = '';
        } else {
          row.purchasePrice = Number((withGst / (1 + rate / 100)).toFixed(2));
          if (qty > 0) {
            row.totalExGst = Number((qty * row.purchasePrice).toFixed(2));
            row.totalWithGst = Number((qty * withGst).toFixed(2));
          }
        }
      } else if (field === 'totalWithGst') {
        // User entered Total With GST (Gross Line Total)
        const totWith = parseFloat(value);
        if (value === '' || isNaN(totWith)) {
          row.totalExGst = '';
        } else {
          row.totalExGst = Number((totWith / (1 + rate / 100)).toFixed(2));
          if (qty > 0) {
            row.purchasePriceWithGst = Number((totWith / qty).toFixed(2));
            row.purchasePrice = Number((row.totalExGst / qty).toFixed(2));
          }
        }
      } else if (field === 'qty') {
        const newQty = parseFloat(value) || 0;
        const exGst = parseFloat(row.purchasePrice);
        if (!isNaN(exGst) && row.purchasePrice !== '') {
          row.totalExGst = Number((newQty * exGst).toFixed(2));
          row.totalWithGst = Number((row.totalExGst * (1 + rate / 100)).toFixed(2));
        } else if (row.totalExGst && newQty > 0) {
          row.purchasePrice = Number((parseFloat(row.totalExGst) / newQty).toFixed(2));
          row.purchasePriceWithGst = Number((row.purchasePrice * (1 + rate / 100)).toFixed(2));
        }
      } else if (field === 'gstRate') {
        const newRate = Number(value) || 0;
        const exGst = parseFloat(row.purchasePrice);
        if (!isNaN(exGst) && row.purchasePrice !== '') {
          row.purchasePriceWithGst = Number((exGst * (1 + newRate / 100)).toFixed(2));
          if (qty > 0) {
            row.totalExGst = Number((qty * exGst).toFixed(2));
            row.totalWithGst = Number((row.totalExGst * (1 + newRate / 100)).toFixed(2));
          }
        }
      }

      updated[index] = row;
      return updated;
    });
  };

  // Quick Action: Apply a uniform GST rate to all rows in the purchase bill
  const handleApplyGstRateToAllRows = (targetRate) => {
    const rate = Number(targetRate);
    setPurchaseRows(prev => prev.map(row => {
      const exGst = parseFloat(row.purchasePrice);
      const qty = parseFloat(row.qty) || 0;
      const newWithGst = (!isNaN(exGst) && row.purchasePrice !== '') 
        ? Number((exGst * (1 + rate / 100)).toFixed(2)) 
        : row.purchasePriceWithGst;
      const newTotEx = (!isNaN(exGst) && qty > 0) ? Number((qty * exGst).toFixed(2)) : row.totalExGst;
      const newTotWith = (newTotEx !== '' && !isNaN(newTotEx)) ? Number((newTotEx * (1 + rate / 100)).toFixed(2)) : row.totalWithGst;

      return {
        ...row,
        gstRate: rate,
        purchasePriceWithGst: newWithGst,
        totalExGst: newTotEx,
        totalWithGst: newTotWith
      };
    }));
  };

  // Standard Slab-wise GST Calculation conforming to Indian Tax Invoicing (GSTR-1 / GSTR-2B)
  const computePurchaseBillTotals = (rows) => {
    const slabs = {};
    let totalExGst = 0;

    rows.forEach(r => {
      const qty = Number(r.qty) || 0;
      const ex = Number(r.purchasePrice) || (qty > 0 ? (Number(r.totalExGst) || 0) / qty : 0);
      const rate = Number(r.gstRate !== undefined ? r.gstRate : 5);
      const taxable = Number(r.totalExGst) || (qty * ex);
      totalExGst += taxable;

      if (!slabs[rate]) slabs[rate] = { taxable: 0, gst: 0, count: 0 };
      slabs[rate].taxable += taxable;
      if (qty > 0 && r.name) slabs[rate].count += 1;
    });

    let totalGst = 0;
    Object.keys(slabs).forEach(rateKey => {
      const rate = Number(rateKey);
      const slabGst = Number((slabs[rateKey].taxable * rate / 100).toFixed(2));
      slabs[rateKey].gst = slabGst;
      totalGst += slabGst;
    });

    totalExGst = Number(totalExGst.toFixed(2));
    totalGst = Number(totalGst.toFixed(2));
    const grandTotal = Number((totalExGst + totalGst).toFixed(2));
    const totalQty = rows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
    const totalItems = rows.filter(r => r.name && r.name.trim()).length;

    return {
      totalExGst,
      totalGst,
      grandTotal,
      totalQty,
      totalItems,
      slabs
    };
  };

  const handlePartySelectOrChange = (value) => {
    const currentSupps = fetchSuppliers();
    const matched = currentSupps.find(s => s.name.toLowerCase() === value.trim().toLowerCase());
    setPurchaseHeader(prev => ({
      ...prev,
      partyName: value,
      partyGst: matched?.gstin ? matched.gstin : prev.partyGst
    }));
  };

  const handleQuickAddSupplier = (e) => {
    e.preventDefault();
    if (!newSupplierData.name.trim()) {
      alert('Please enter Purchase Party / Supplier name.');
      return;
    }
    const created = saveSupplier({
      name: newSupplierData.name.trim(),
      gstin: newSupplierData.gstin.trim().toUpperCase(),
      phone: newSupplierData.phone.trim(),
      city: newSupplierData.city.trim()
    });
    const updatedSupps = fetchSuppliers();
    setSuppliers(updatedSupps);
    setSelectedSupplierObj(created);
    setPurchaseHeader(prev => ({
      ...prev,
      partyName: created.name,
      partyGst: created.gstin || ''
    }));
    setSupplierSearchTerm('');
    setNewSupplierData({ name: '', gstin: '', phone: '', city: '' });
    setQuickSupplierModalOpen(false);
  };

  const handleSavePurchaseBill = (e) => {
    if (e) e.preventDefault();
    if (!purchaseHeader.partyName.trim()) {
      alert('Please enter Party / Supplier name.');
      return;
    }
    if (!purchaseHeader.date) {
      alert('Please select purchase date.');
      return;
    }

    const validItems = purchaseRows.filter(r => r.name && r.name.trim() && (Number(r.qty) > 0));
    if (validItems.length === 0) {
      alert('Please add at least one product with name and quantity > 0.');
      return;
    }

    const billTotals = computePurchaseBillTotals(validItems);

    const purchasePayload = {
      id: editingPurchaseId || undefined,
      partyName: purchaseHeader.partyName.trim(),
      partyGst: purchaseHeader.partyGst.trim(),
      date: purchaseHeader.date,
      billNo: purchaseHeader.billNo.trim(),
      warehouseId: purchaseHeader.warehouseId,
      items: validItems.map(it => {
        const q = Number(it.qty) || 0;
        const ex = Number(it.purchasePrice) || (q > 0 ? (Number(it.totalExGst) || 0) / q : 0);
        const r = Number(it.gstRate !== undefined ? it.gstRate : 5);
        const tEx = Number(it.totalExGst) || Number((q * ex).toFixed(2));
        const tWith = Number(it.totalWithGst) || Number((tEx * (1 + r / 100)).toFixed(2));
        const pWith = Number(it.purchasePriceWithGst) || Number((ex * (1 + r / 100)).toFixed(2));
        return {
          ...it,
          purchasePrice: Number(ex.toFixed(2)),
          purchasePriceWithGst: Number(pWith.toFixed(2)),
          totalExGst: Number(tEx.toFixed(2)),
          totalWithGst: Number(tWith.toFixed(2))
        };
      }),
      totalAmountExGst: billTotals.totalExGst,
      totalGst: billTotals.totalGst,
      grandTotal: billTotals.grandTotal
    };

    savePurchase(purchasePayload);
    setPurchases(fetchPurchases());
    refreshAllData();
    alert(editingPurchaseId 
      ? `✅ Purchase bill #${purchaseHeader.billNo || ''} updated successfully! Stock and inward lots reconciled.`
      : `✅ Purchase bill recorded successfully! Stock inventory updated for ${validItems.length} products.`
    );
    setEditingPurchaseId(null);
    setPurchaseModalOpen(false);
    setInventorySubTab('purchases');
  };

  // Photo-to-Purchase & Excel/CSV Parsing Handler
  const handleParseImport = () => {
    if (!importRawText.trim()) {
      alert('Please enter or paste CSV/spreadsheet lines.');
      return;
    }

    const lines = importRawText.trim().split('\n');
    const parsed = [];

    lines.forEach((line, idx) => {
      if (!line.trim()) return;
      const parts = line.includes(',') ? line.split(',') : line.split('\t');
      if (parts.length >= 2) {
        const name = parts[0]?.trim();
        // Skip header row
        if (idx === 0 && (name.toLowerCase().includes('item') || name.toLowerCase().includes('name') || name.toLowerCase().includes('product'))) {
          return;
        }
        const qty = parseInt(parts[1]) || 12;
        const rate = parseFloat(parts[2]) || 120;
        const mrp = parseFloat(parts[3]) || (rate * 1.25);
        const batch = parts[4]?.trim() || ('LOT-' + Math.floor(1000 + Math.random() * 9000));
        const exp = parts[5]?.trim() || '';

        parsed.push({
          id: 'imp_' + idx + '_' + Date.now(),
          name,
          qty,
          purchasePrice: rate,
          salePrice: Math.round(rate * 1.15),
          mrp: Math.round(mrp),
          batchNo: batch,
          expiryDate: exp,
          gstRate: 5,
          pcsPerCarton: 24
        });
      }
    });

    if (parsed.length === 0) {
      alert('Could not detect product rows. Expected format: Item Name, Quantity, Purchase Rate, MRP, Batch, Expiry');
      return;
    }

    setParsedImportItems(parsed);
  };

  // Sample CSV generator for testing
  const loadSampleCsvData = () => {
    const sample = `Item Name, Quantity, Purchase Rate, MRP, Batch, Expiry
Britannia Good Day Butter 100g, 48, 22.50, 30.00, LOT-GD-2026, 2027-02-28
Parle-G Gold Biscuits 200g, 60, 18.00, 25.00, LOT-PG-2026, 2026-11-30
Tata Salt Vacuum Evaporated 1kg, 30, 20.00, 28.00, LOT-TS-2026, 2028-06-30
Fortune Sunlite Refined Oil 1L, 24, 115.00, 140.00, LOT-FO-2026, 2027-05-15`;
    setImportRawText(sample);
  };

  const handleCommitImport = () => {
    if (parsedImportItems.length === 0) return;

    parsedImportItems.forEach(item => {
      const existing = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
      if (existing) {
        updateProductStock(existing.id, item.qty, 'Bulk Purchase Bill Import');
      } else {
        saveProduct({
          ...initialForm,
          name: item.name,
          sku: 'SKU-' + item.name.substring(0, 3).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900),
          brand: 'Standard',
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
          mrp: item.mrp,
          currentStock: item.qty,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          gstRate: item.gstRate || 5
        });
      }
    });

    logAuditAction('PURCHASE_BILL_IMPORT', 'Inventory & Stock', `Bulk imported ${parsedImportItems.length} products from purchase bill / spreadsheet`);
    refreshAllData();
    alert(`✅ Successfully imported ${parsedImportItems.length} items into inventory!`);
    setImportModalOpen(false);
    setParsedImportItems([]);
    setImportRawText('');
  };

  // Purchases History Filtering, Date Sorting & KPIs
  const filteredPurchases = useMemo(() => {
    const list = purchases.filter(p => {
      const q = purchaseSearchTerm.toLowerCase().trim();
      if (!q) return true;
      return (
        (p.billNo && p.billNo.toLowerCase().includes(q)) ||
        (p.partyName && p.partyName.toLowerCase().includes(q)) ||
        (p.partyGst && p.partyGst.toLowerCase().includes(q)) ||
        (p.items && p.items.some(it => it.name && it.name.toLowerCase().includes(q)))
      );
    });

    return [...list].sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      if (purchaseSortOrder === 'asc') {
        if (da !== db) return da.localeCompare(db);
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      } else {
        if (db !== da) return db.localeCompare(da);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
    });
  }, [purchases, purchaseSearchTerm, purchaseSortOrder]);

  const purchaseKpis = useMemo(() => {
    const totalBills = purchases.length;
    const totalInwardValue = purchases.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0);
    const uniqueSuppliers = new Set(purchases.map(p => p.partyName?.trim().toLowerCase()).filter(Boolean)).size;
    const totalItemsInwarded = purchases.reduce((sum, p) => sum + (p.items?.reduce((s, it) => s + (Number(it.qty) || 0), 0) || 0), 0);
    return { totalBills, totalInwardValue, uniqueSuppliers, totalItemsInwarded };
  }, [purchases]);

  const handleDeletePurchase = (e, purchaseId, billNo) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete purchase bill #${billNo || purchaseId}? This action cannot be undone.`)) {
      const updated = deletePurchase(purchaseId);
      setPurchases(updated);
      refreshAllData();
    }
  };

  const handleRecalculateAllBills = () => {
    const res = recalculateAndNormalizeAllPurchaseBills();
    const updated = fetchPurchases();
    setPurchases(updated);
    refreshAllData();
    if (res.updated) {
      alert(`✅ Successfully recalculated & normalized ${res.recalculatedCount} purchase bill(s) to standard 5% GST! All totals, line items, and stock valuations have been updated.`);
    } else {
      alert(`✅ All ${res.totalBills} purchase bills are already fully verified and accurate with standard GST!`);
    }
  };

  const handlePrintPurchaseBill = (bill) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the purchase bill.');
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Bill - ${bill.billNo || bill.id}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: bold; color: #0f172a; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background: #f1f5f9; font-weight: 600; color: #334155; }
          .text-right { text-align: right; }
          .totals-table { width: 320px; margin-left: auto; margin-top: 16px; font-size: 13px; }
          .totals-table td { border: none; padding: 5px 8px; }
          .totals-table tr.grand { font-weight: bold; font-size: 15px; border-top: 2px solid #0f172a; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">PURCHASE / INWARD BILL</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Record ID: ${bill.id}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: bold; color: #0f172a;">Bill #: ${bill.billNo || 'N/A'}</div>
            <div style="font-size: 13px; color: #475569; margin-top: 2px;">Date: ${formatDateDDMMYY(bill.date)}</div>
          </div>
        </div>

        <div class="info-grid">
          <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; letter-spacing: 0.5px;">Supplier / Vendor Details</div>
            <div style="font-weight: bold; font-size: 15px; color: #0f172a;">${bill.partyName || 'Unknown Vendor'}</div>
            ${bill.partyGst ? `<div style="font-size: 12px; margin-top: 3px; color: #334155;">GSTIN: <strong>${bill.partyGst}</strong></div>` : ''}
            ${bill.partyPhone ? `<div style="font-size: 12px; margin-top: 2px; color: #475569;">Phone: ${bill.partyPhone}</div>` : ''}
            ${bill.partyAddress ? `<div style="font-size: 12px; margin-top: 2px; color: #475569;">Address: ${bill.partyAddress}</div>` : ''}
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; letter-spacing: 0.5px;">Destination Warehouse & Status</div>
            <div style="font-weight: bold; font-size: 14px; color: #0f172a;">${bill.warehouseId ? (bill.warehouseId === 'wh_main' ? 'Main Warehouse (Bhiwandi Central)' : (bill.warehouseId === 'wh_store' ? 'Store Front Display Rack' : bill.warehouseId)) : 'Default Warehouse'}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Total Items: <strong>${bill.items?.length || 0} Products</strong></div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Recorded On: ${bill.createdAt ? new Date(bill.createdAt).toLocaleString('en-IN') : 'N/A'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px;">#</th>
              <th>Product Description</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Rate (Ex-GST)</th>
              <th class="text-right">GST %</th>
              <th class="text-right">Rate (With GST)</th>
              <th class="text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(bill.items || []).map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>
                  <strong>${item.name || 'Item'}</strong>
                  ${item.hsn ? `<span style="font-size: 10px; color: #64748b; display: block;">HSN: ${item.hsn}</span>` : ''}
                </td>
                <td class="text-right" style="font-weight: 600;">${item.qty}</td>
                <td class="text-right">₹${Number(item.purchasePrice || 0).toFixed(2)}</td>
                <td class="text-right">${item.gstRate || 0}%</td>
                <td class="text-right">₹${Number(item.purchasePriceWithGst || 0).toFixed(2)}</td>
                <td class="text-right" style="font-weight: 700;">₹${Number(item.total || (Number(item.qty || 0) * Number(item.purchasePriceWithGst || item.purchasePrice || 0))).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <table class="totals-table">
          <tr>
            <td style="color: #64748b;">Subtotal (Ex-GST):</td>
            <td class="text-right" style="font-weight: 600;">₹${Number(bill.totalAmountExGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Total GST:</td>
            <td class="text-right" style="font-weight: 600;">₹${Number(bill.totalGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr class="grand">
            <td>Grand Total:</td>
            <td class="text-right" style="color: #047857;">₹${Number(bill.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        </table>

        <div style="margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
          Generated from DistroPlus ERP &bull; Purchase Inward Register &bull; ${new Date().toLocaleString('en-IN')}
        </div>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Sub-Tab Navigation Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--surface-color)',
        padding: '8px 12px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setInventorySubTab('stock')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '8px',
              border: inventorySubTab === 'stock' ? '1px solid var(--primary)' : '1px solid transparent',
              fontWeight: '600',
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
              background: inventorySubTab === 'stock' ? 'var(--primary)' : 'transparent',
              color: inventorySubTab === 'stock' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Boxes size={18} />
            <span>Products & Stock Inventory</span>
            <span style={{
              background: inventorySubTab === 'stock' ? 'rgba(255,255,255,0.25)' : 'var(--bg-color)',
              color: inventorySubTab === 'stock' ? '#ffffff' : 'var(--text-muted)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.74rem',
              fontWeight: '700'
            }}>
              {products.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setInventorySubTab('purchases')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '8px',
              border: inventorySubTab === 'purchases' ? '1px solid var(--primary)' : '1px solid transparent',
              fontWeight: '600',
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
              background: inventorySubTab === 'purchases' ? 'var(--primary)' : 'transparent',
              color: inventorySubTab === 'purchases' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            <Receipt size={18} />
            <span>Purchase Bills & Inward Records</span>
            <span style={{
              background: inventorySubTab === 'purchases' ? 'rgba(255,255,255,0.25)' : 'var(--bg-color)',
              color: inventorySubTab === 'purchases' ? '#ffffff' : 'var(--text-muted)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.74rem',
              fontWeight: '700'
            }}>
              {purchases.length}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleOpenPurchaseModal}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            fontSize: '0.84rem',
            fontWeight: '600',
            background: '#059669',
            borderColor: '#059669'
          }}
        >
          <Plus size={16} />
          <span>+ Add New Purchase</span>
        </button>
      </div>

      {inventorySubTab === 'stock' && (
        <>
          {/* Top Filter & Action Bar */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text"
                className="input-field"
                placeholder="Search product name, SKU or brand..."
                style={{ paddingLeft: '38px' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select 
              className="input-field select-field" 
              style={{ width: 'auto' }}
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            {/* Warehouse Filter */}
            <select 
              className="input-field select-field" 
              style={{ width: 'auto' }}
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>

            {/* Expiry Filter */}
            <select 
              className="input-field select-field" 
              style={{ width: 'auto' }}
              value={expiryFilter}
              onChange={e => setExpiryFilter(e.target.value)}
            >
              <option value="ALL">All Expiry</option>
              <option value="EXPIRING_SOON">⚠️ Expiring Soon (≤ 45 Days)</option>
              <option value="EXPIRED">❌ Expired Stock Only</option>
            </select>

            <button 
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`btn ${showLowStockOnly ? 'btn-danger' : 'btn-secondary'}`}
              style={{ gap: '6px' }}
            >
              <AlertTriangle size={16} />
              <span>{showLowStockOnly ? 'Show All' : 'Low Stock'}</span>
            </button>

            <button 
              onClick={() => setTransferModalOpen(true)}
              className="btn btn-secondary"
              style={{ gap: '6px', fontWeight: '700' }}
            >
              <ArrowLeftRight size={16} color="#2563eb" />
              <span>Stock Transfer</span>
            </button>

            <button 
              onClick={() => setImportModalOpen(true)}
              className="btn btn-secondary"
              style={{ gap: '6px', fontWeight: '700', borderColor: '#059669', color: '#059669' }}
            >
              <FileSpreadsheet size={16} />
              <span>Import Bill (Excel/CSV/Photo)</span>
            </button>

            <button 
              onClick={handleOpenPurchaseModal}
              className="btn btn-primary"
              style={{ gap: '6px', fontWeight: '700', background: 'linear-gradient(135deg, #059669, #10b981)', borderColor: '#059669' }}
            >
              <ShoppingBag size={18} />
              <span>+ Add New Purchase</span>
            </button>

            <button 
              onClick={handleOpenAddModal}
              className="btn btn-secondary"
              style={{ gap: '6px', fontWeight: '700' }}
            >
              <Plus size={18} />
              <span>New Product (+)</span>
            </button>
          </div>

        </div>
      </div>

      {/* Inventory Table Card */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>
            Stock Inventory ({filteredProducts.length} Items)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Total Stock Valuation (Cost Ex-GST): <strong style={{ color: 'var(--text-main)' }}>₹{totalCatalogValuation.totalExGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
            </span>
            <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: '700' }}>
              Valuation (With GST): ₹{totalCatalogValuation.totalWithGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                <th style={{ padding: '7px 8px', width: '38px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '7px 8px' }}>Product Details</th>
                <th style={{ padding: '7px 8px' }}>Brand</th>
                <th style={{ padding: '7px 8px' }}>HSN Code</th>
                <th style={{ padding: '7px 8px' }}>Batch & Expiry</th>
                <th style={{ padding: '7px 8px' }}>Warehouse</th>
                <th style={{ padding: '7px 8px' }}>MRP</th>
                <th style={{ padding: '7px 8px' }}>Sale Price</th>
                <th style={{ padding: '7px 8px' }}>Cost Price (WAC)</th>
                <th style={{ padding: '7px 8px' }}>GST %</th>
                <th style={{ padding: '7px 8px', color: '#047857', fontWeight: '700' }}>Purchase Price (w/ GST)</th>
                <th style={{ padding: '7px 8px' }}>Current Stock</th>
                <th style={{ padding: '7px 8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod, idx) => {
                  const isLow = prod.currentStock <= (prod.minStockLimit || 10);
                  const expInfo = getExpiryStatus(prod.expiryDate);
                  const whObj = warehouses.find(w => w.id === prod.warehouseId) || warehouses[0];
                  
                  const prodVal = getProductStockValuation(prod.id);
                  const pPrice = prodVal.avgUnitCostExGst > 0 ? prodVal.avgUnitCostExGst : (Number(prod.purchasePrice) || 0);
                  const gRate = Number(prod.gstRate) || 0;
                  const purchaseWithGst = prodVal.avgUnitCostWithGst > 0 ? prodVal.avgUnitCostWithGst : (pPrice * (1 + gRate / 100));

                  return (
                    <tr key={prod.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* S.No */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: '700', color: 'var(--primary)', fontSize: '0.78rem' }}>
                        {idx + 1}
                      </td>

                      {/* 1. Product Details */}
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.82rem', lineHeight: '1.2' }}>{prod.name}</div>
                        <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                          SKU: <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{prod.sku}</span>
                        </div>
                      </td>

                      {/* 2. Brand Column */}
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.78rem' }}>
                          {prod.brand || 'General'}
                        </span>
                      </td>

                      {/* 3. HSN Code Column */}
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ 
                          fontWeight: '700', 
                          color: '#334155', 
                          fontSize: '0.73rem', 
                          background: '#f1f5f9', 
                          padding: '1px 5px', 
                          borderRadius: '4px', 
                          border: '1px solid #cbd5e1' 
                        }}>
                          {prod.hsn || prod.hsnCode || '1905'}
                        </span>
                      </td>

                      {/* 4. Batch & Expiry */}
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.74rem' }}>{prod.batchNo || 'LOT-MAIN'}</div>
                        {prod.expiryDate ? (
                          <div style={{ marginTop: '2px' }}>
                            <span className={`badge ${expInfo.status === 'EXPIRED' ? 'badge-danger' : expInfo.status === 'EXPIRING_SOON' ? 'badge-warning' : 'badge-secondary'}`} style={{ fontSize: '0.64rem', padding: '1px 5px' }}>
                              {expInfo.status === 'EXPIRED' ? `Expired (${prod.expiryDate})` : expInfo.status === 'EXPIRING_SOON' ? `Exp in ${expInfo.daysLeft}d` : `Exp: ${prod.expiryDate}`}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>N/A</span>
                        )}
                      </td>

                      {/* 5. Warehouse */}
                      <td style={{ padding: '6px 8px' }}>
                        <span className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '2px 5px' }}>
                          {whObj?.name || 'Main Godown'}
                        </span>
                      </td>

                      {/* 6. MRP */}
                      <td style={{ padding: '6px 8px', fontWeight: '600', fontSize: '0.78rem' }}>₹{prod.mrp}</td>

                      {/* 7. Sale Price */}
                      <td style={{ padding: '6px 8px', fontWeight: '700', color: 'var(--primary)', fontSize: '0.80rem' }}>₹{prod.salePrice}</td>

                      {/* 8. Cost Price (WAC) */}
                      <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.78rem' }}>₹{pPrice.toFixed(2)}</div>
                        <div style={{ fontSize: '0.67rem' }}>
                          {prodVal.lots.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => setSelectedLotProduct(prod)}
                              style={{ 
                                background: '#fef3c7', 
                                color: '#b45309', 
                                border: '1px solid #fde68a',
                                borderRadius: '4px',
                                padding: '1px 4px',
                                fontSize: '0.64rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                marginTop: '1px'
                              }}
                              title="Click to view inward lots with varying purchase rates"
                            >
                              ⚡ {prodVal.lots.length} Lots
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Ex-GST</span>
                          )}
                        </div>
                      </td>

                      {/* 9. GST % */}
                      <td style={{ padding: '6px 8px', fontSize: '0.78rem' }}>{prod.gstRate}%</td>

                      {/* 10. Purchase Price (w/ GST) */}
                      <td style={{ padding: '6px 8px', fontWeight: '700', color: '#047857' }}>
                        <div style={{ fontSize: '0.78rem' }}>₹{purchaseWithGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                          Val: ₹{prodVal.totalWithGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* 11. Current Stock */}
                      <td style={{ padding: '6px 8px' }}>
                        <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.70rem', padding: '2px 5px' }}>
                          {formatCartonStock(prod.currentStock, prod.pcsPerCarton, prod.pcsPerBox, prod.unit)}
                        </span>
                        {(() => {
                          const isChain = prod.unit === 'Chain Pouch' || prod.unit === 'C. Pouch' || prod.unit === 'c. pouch';
                          const isSub = isChain || prod.unit === 'Box' || prod.unit === 'Pack';
                          const subPcs = Number(prod.pcsPerBox) > 1 ? Number(prod.pcsPerBox) : (isChain ? 12 : 1);
                          const subName = isChain ? 'Chain Pouch' : (prod.unit || 'Pcs');
                          const cStock = Number(prod.currentStock) || 0;

                          if (isSub && subPcs > 1) {
                            const subCount = Math.floor(cStock / subPcs);
                            const remPcs = cStock % subPcs;
                            const subDisplay = remPcs > 0 ? `${subCount} ${subName} + ${remPcs} Pcs` : `${subCount} ${subName}`;
                            return (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                Total: <strong style={{ color: 'var(--text-main)', fontWeight: '700' }}>{subDisplay}</strong> ({cStock} Pcs • {prod.pcsPerCarton || 24} Pcs/Ctn • {subPcs} Pcs/{subName})
                              </div>
                            );
                          }

                          return (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                              Total: {cStock} {prod.unit || 'Pcs'} ({prod.pcsPerCarton || 24} Pcs/Ctn)
                            </div>
                          );
                        })()}
                        {isLow && (
                          <div style={{ fontSize: '0.66rem', color: '#f87171', marginTop: '1px', fontWeight: '700' }}>Low Warning</div>
                        )}
                      </td>

                      {/* 12. Actions */}
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button 
                            type="button"
                            onClick={() => setSelectedLotProduct(prod)}
                            className="btn btn-secondary btn-sm"
                            title="View Inward Lots & Purchase Rates"
                            style={{ background: '#f8fafc', color: '#4f46e5', borderColor: '#e0e7ff', fontWeight: '700', padding: '3px 6px', fontSize: '0.72rem' }}
                          >
                            <Layers size={13} />
                            <span>Lots</span>
                          </button>

                          <button 
                            onClick={() => handleOpenStockIn(prod)}
                            className="btn btn-secondary btn-sm"
                            title="Add Stock (Stock In)"
                            style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', fontWeight: '700', padding: '3px 6px', fontSize: '0.72rem' }}
                          >
                            <ArrowDownCircle size={13} />
                            <span>+ Stock</span>
                          </button>

                          <button 
                            onClick={() => handleOpenEditModal(prod)}
                            className="btn btn-secondary btn-sm"
                            title="Edit"
                            style={{ padding: '3px 6px' }}
                          >
                            <Edit3 size={13} />
                          </button>

                          <button 
                            onClick={() => handleDelete(prod.id, prod.name)}
                            className="btn btn-danger btn-sm"
                            title="Delete"
                            style={{ padding: '3px 6px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Purchase Bills & Inward Records Tab View */}
      {inventorySubTab === 'purchases' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Purchase KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb'
              }}>
                <Receipt size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                  Total Purchase Bills
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                  {purchaseKpis.totalBills}
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669'
              }}>
                <ShoppingBag size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                  Total Inward Value
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#059669', marginTop: '2px' }}>
                  ₹{purchaseKpis.totalInwardValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'rgba(139, 92, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7c3aed'
              }}>
                <Building2 size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                  Vendors / Suppliers
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                  {purchaseKpis.uniqueSuppliers}
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d97706'
              }}>
                <Boxes size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                  Total Units Inwarded
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                  {purchaseKpis.totalItemsInwarded.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar & Action Header */}
          <div className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '280px', maxWidth: '520px' }}>
                <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search by Bill No, Supplier Name, GSTIN, or Product..."
                  style={{ paddingLeft: '38px', width: '100%' }}
                  value={purchaseSearchTerm}
                  onChange={e => setPurchaseSearchTerm(e.target.value)}
                />
                {purchaseSearchTerm && (
                  <button
                    onClick={() => setPurchaseSearchTerm('')}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleRecalculateAllBills}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', borderColor: '#86efac', background: '#ecfdf5', fontWeight: '700', fontSize: '0.84rem' }}
                  title="Recalculate and normalize all old purchase bills to standard 5% GST"
                >
                  <Sparkles size={16} color="#059669" />
                  <span>Recalculate Old Bills</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPurchaseModal}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#059669', borderColor: '#059669' }}
                >
                  <Plus size={16} />
                  <span>+ Record New Purchase</span>
                </button>
              </div>
            </div>
          </div>

          {/* Purchase Bills Table */}
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th 
                      style={{ padding: '14px 16px', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => setPurchaseSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      title="Click to toggle Date Sort Order (Newest First / Oldest First)"
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span>Bill # & Date</span>
                        <span style={{ 
                          fontSize: '0.68rem', 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          background: '#ecfdf5', 
                          color: '#047857', 
                          border: '1px solid #a7f3d0',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          {purchaseSortOrder === 'desc' ? '▼ Newest First' : '▲ Oldest First'}
                        </span>
                      </div>
                    </th>
                    <th style={{ padding: '14px 16px' }}>Supplier / Vendor</th>
                    <th style={{ padding: '14px 16px' }}>Warehouse</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Items</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>Subtotal (Ex-GST)</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>Total GST</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>Grand Total</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <Receipt size={42} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                          <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>
                            {purchases.length === 0 ? 'No purchase bills recorded yet' : 'No matching purchase bills found'}
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', maxWidth: '420px', margin: 0 }}>
                            {purchases.length === 0 
                              ? 'Record your purchase inward bills to automatically add stock into your warehouse and maintain an auditable ledger.'
                              : `No bill matches "${purchaseSearchTerm}". Try clearing your search term.`}
                          </p>
                          {purchases.length === 0 ? (
                            <button
                              type="button"
                              onClick={handleOpenPurchaseModal}
                              className="btn btn-primary"
                              style={{ marginTop: '8px', background: '#059669', borderColor: '#059669' }}
                            >
                              <Plus size={16} /> Record First Purchase Bill
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPurchaseSearchTerm('')}
                              className="btn btn-secondary"
                              style={{ marginTop: '6px' }}
                            >
                              Clear Search
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((bill) => {
                      const totalUnits = (bill.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
                      return (
                        <tr 
                          key={bill.id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Receipt size={14} />
                              <span>{bill.billNo || bill.id.substring(0, 10)}</span>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px', fontWeight: '600' }}>
                              {formatDateDDMMYY(bill.date)}
                            </div>
                          </td>

                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                              {bill.partyName || 'Supplier'}
                            </div>
                            {bill.partyGst && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                                GST: {bill.partyGst}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: '600',
                              background: 'rgba(59, 130, 246, 0.1)',
                              color: '#3b82f6',
                              border: '1px solid rgba(59, 130, 246, 0.2)'
                            }}>
                              {bill.warehouseId === 'wh_store' ? 'Store Front' : 'Main Warehouse'}
                            </span>
                          </td>

                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 9px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              background: 'var(--surface-color)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-main)'
                            }}>
                              {bill.items?.length || 0} items ({totalUnits} pcs)
                            </span>
                          </td>

                          <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            ₹{Number(bill.totalAmountExGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            ₹{Number(bill.totalGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <span style={{ fontWeight: '800', color: '#059669', fontSize: '0.94rem' }}>
                              ₹{Number(bill.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => setViewingPurchaseBill(bill)}
                                className="btn btn-secondary btn-sm"
                                title="View Complete Bill"
                                style={{ padding: '5px 8px' }}
                              >
                                <Eye size={15} color="var(--primary)" />
                              </button>

                              {isPurchaseBillEditable(bill) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditPurchase(bill)}
                                  className="btn btn-secondary btn-sm"
                                  title={`Edit Bill (${getPurchaseBillRemainingEditTime(bill)})`}
                                  style={{ padding: '5px 8px', color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' }}
                                >
                                  <Edit3 size={15} />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handlePrintPurchaseBill(bill)}
                                className="btn btn-secondary btn-sm"
                                title="Print Bill"
                                style={{ padding: '5px 8px' }}
                              >
                                <Printer size={15} color="var(--text-muted)" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleDeletePurchase(e, bill.id, bill.billNo)}
                                className="btn btn-danger btn-sm"
                                title="Delete Bill Record"
                                style={{ padding: '5px 8px' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Add / Edit Product Modal */}
      {productModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>
                {editingProduct ? '✏️ Edit Product' : '📦 Add New Product'}
              </h3>
              <button 
                onClick={() => setProductModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProductForm}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Product Name *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="e.g. Parle-G Biscuit 100g Box"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Brand Name</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. Parle, Britannia, Tata"
                    value={formData.brand}
                    onChange={e => setFormData({...formData, brand: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="e.g. Biscuits, Edible Oils, Grocery"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      SKU / Barcode <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const randomCode = Math.floor(1000 + Math.random() * 9000);
                        const cleanName = (formData.name || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        const prefix = cleanName.length >= 3 ? cleanName.substring(0, 3) : 'SKU';
                        setFormData(prev => ({ ...prev, sku: `${prefix}-${randomCode}` }));
                      }}
                      style={{
                        background: 'rgba(5, 150, 105, 0.08)',
                        border: '1px solid rgba(5, 150, 105, 0.25)',
                        borderRadius: '4px',
                        color: 'var(--primary)',
                        fontSize: '0.70rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        padding: '2px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Click to automatically generate a unique SKU"
                    >
                      <Sparkles size={11} />
                      <span>Auto Generate</span>
                    </button>
                  </div>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. PRL-G-100G (Leave empty to auto-generate)"
                    value={formData.sku || ''}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                  />
                  <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Optional &bull; System will automatically generate one if left blank
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">HSN Code *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="e.g. 19053100"
                    value={formData.hsn}
                    onChange={e => setFormData({...formData, hsn: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">MRP (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    required
                    value={formData.mrp}
                    onChange={e => setFormData({...formData, mrp: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Wholesale Sale Price (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    required
                    value={formData.salePrice}
                    onChange={e => setFormData({...formData, salePrice: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cost Price / Purchase Rate (Ex-GST) (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    required
                    value={formData.purchasePrice}
                    onChange={e => setFormData({...formData, purchasePrice: e.target.value})}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Basic purchase rate excluding GST
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">GST Rate (%) *</label>
                  <select 
                    className="input-field select-field"
                    value={formData.gstRate}
                    onChange={e => setFormData({...formData, gstRate: e.target.value})}
                  >
                    <option value={0}>0% (Tax Free)</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ color: '#047857', fontWeight: '700' }}>
                    Purchase Price with GST (₹)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="number" 
                      step="0.01"
                      className="input-field"
                      style={{ background: '#f0fdf4', fontWeight: '700', color: '#047857', borderColor: '#86efac' }}
                      value={
                        formData.purchasePrice !== '' && !isNaN(formData.purchasePrice)
                          ? Number((Number(formData.purchasePrice) * (1 + (Number(formData.gstRate) || 0) / 100)).toFixed(2))
                          : ''
                      }
                      onChange={e => {
                        const withGst = parseFloat(e.target.value);
                        if (isNaN(withGst) || withGst < 0) {
                          setFormData({ ...formData, purchasePrice: '' });
                        } else {
                          const rate = Number(formData.gstRate) || 0;
                          const exGst = withGst / (1 + rate / 100);
                          setFormData({ ...formData, purchasePrice: Number(exGst.toFixed(2)) });
                        }
                      }}
                      placeholder="Auto-calculated (or type to back-calc)"
                    />
                    <span style={{ fontSize: '0.8rem', color: '#047857', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      (Incl. {formData.gstRate || 0}% GST)
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '3px' }}>
                    💡 2-Way Sync: Enter Cost Price (Ex-GST) or Purchase Price (With GST) — the other updates automatically.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Unit of Measure *</label>
                  <select 
                    className="input-field select-field"
                    value={formData.unit}
                    onChange={e => {
                      const newUnit = e.target.value;
                      const isBoxOrPack = newUnit === 'Box' || newUnit === 'Pack' || newUnit === 'Chain Pouch';
                      setFormData(prev => {
                        const currentPcs = Number(prev.pcsPerCarton) || 24;
                        const pcsPerBox = isBoxOrPack ? (prev.pcsPerBox || 1) : '';
                        const packsPerCtn = isBoxOrPack ? (prev.packsPerCarton || currentPcs) : '';
                        const ctn = Number(prev.cartonsStock) || 0;
                        const boxes = Number(prev.boxesStock) || 0;
                        const loose = Number(prev.loosePcsStock) || 0;
                        const totalPcsPerCtn = isBoxOrPack && Number(packsPerCtn) > 0 && Number(pcsPerBox) > 0 
                          ? Number(packsPerCtn) * Number(pcsPerBox) 
                          : currentPcs;
                        const newTotalStock = (ctn * totalPcsPerCtn) + (boxes * (Number(pcsPerBox) || 1)) + loose;
                        return {
                          ...prev,
                          unit: newUnit,
                          pcsPerBox: pcsPerBox,
                          packsPerCarton: packsPerCtn,
                          pcsPerCarton: totalPcsPerCtn,
                          currentStock: newTotalStock
                        };
                      });
                    }}
                  >
                    <option value="Pcs">Pcs (Pieces)</option>
                    <option value="Pack">Pack</option>
                    <option value="Box">Box</option>
                    <option value="Chain Pouch">Chain Pouch</option>
                    <option value="Carton">Carton</option>
                    <option value="Kg">Kg</option>
                    <option value="Litre">Litre</option>
                  </select>
                </div>

                {/* Packaging Setup: Single Box if Pcs, or Multi-Box hierarchy if Box / Pack */}
                {formData.unit === 'Box' || formData.unit === 'Pack' || formData.unit === 'Chain Pouch' ? (
                  <div className="form-group" style={{ gridColumn: '1 / -1', background: '#f0fdf4', padding: '12px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontWeight: '700', fontSize: '0.82rem', color: '#166534' }}>
                        📦 Packaging Configuration ({formData.unit} & Master Carton Hierarchy)
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: '600' }}>
                        1 Master Carton = {Number(formData.packsPerCarton) || 0} {formData.unit}s × {Number(formData.pcsPerBox) || 0} Pcs = {((Number(formData.packsPerCarton) || 0) * (Number(formData.pcsPerBox) || 0))} Total Base Pcs
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.76rem', color: '#166534', fontWeight: '600', marginBottom: '3px' }}>
                          {formData.unit}s Per Carton *
                        </label>
                        <input 
                          type="number" 
                          min="1"
                          className="input-field"
                          required
                          style={{ borderColor: '#86efac', background: '#ffffff', height: '34px', fontSize: '0.82rem' }}
                          placeholder={`No. of ${formData.unit}s in 1 Carton`}
                          value={formData.packsPerCarton}
                          onChange={e => {
                            const val = e.target.value;
                            const packsNum = Number(val) || 0;
                            const pcsPerBoxNum = Number(formData.pcsPerBox) || 1;
                            const newTotalPcsPerCtn = packsNum * pcsPerBoxNum;
                            const ctn = Number(formData.cartonsStock) || 0;
                            const boxes = Number(formData.boxesStock) || 0;
                            const loose = Number(formData.loosePcsStock) || 0;
                            setFormData({
                              ...formData,
                              packsPerCarton: val,
                              pcsPerCarton: newTotalPcsPerCtn > 0 ? newTotalPcsPerCtn : (Number(formData.pcsPerCarton) || 24),
                              currentStock: (ctn * newTotalPcsPerCtn) + (boxes * pcsPerBoxNum) + loose
                            });
                          }}
                        />
                        <div style={{ fontSize: '0.68rem', color: '#15803d', marginTop: '2px' }}>
                          Carton contains {formData.packsPerCarton || 0} {formData.unit}s
                        </div>
                      </div>

                      {/* THE EXTRA BOX: Total Pcs in Box or Pack */}
                      <div>
                        <label className="form-label" style={{ fontSize: '0.76rem', color: '#166534', fontWeight: '600', marginBottom: '3px' }}>
                          Total Pcs Per {formData.unit} *
                        </label>
                        <input 
                          type="number" 
                          min="1"
                          className="input-field"
                          required
                          style={{ borderColor: '#86efac', background: '#ffffff', height: '34px', fontSize: '0.82rem' }}
                          placeholder={`Pcs in 1 ${formData.unit}`}
                          value={formData.pcsPerBox}
                          onChange={e => {
                            const val = e.target.value;
                            const pcsPerBoxNum = Number(val) || 0;
                            const packsNum = Number(formData.packsPerCarton) || 1;
                            const newTotalPcsPerCtn = packsNum * pcsPerBoxNum;
                            const ctn = Number(formData.cartonsStock) || 0;
                            const boxes = Number(formData.boxesStock) || 0;
                            const loose = Number(formData.loosePcsStock) || 0;
                            setFormData({
                              ...formData,
                              pcsPerBox: val,
                              pcsPerCarton: newTotalPcsPerCtn > 0 ? newTotalPcsPerCtn : (Number(formData.pcsPerCarton) || 24),
                              currentStock: (ctn * newTotalPcsPerCtn) + (boxes * pcsPerBoxNum) + loose
                            });
                          }}
                        />
                        <div style={{ fontSize: '0.68rem', color: '#15803d', marginTop: '2px' }}>
                          Each {formData.unit} contains {formData.pcsPerBox || 0} pieces
                        </div>
                      </div>

                      {/* Total No. of Pcs in Carton */}
                      <div>
                        <label className="form-label" style={{ fontSize: '0.76rem', color: '#166534', fontWeight: '600', marginBottom: '3px' }}>
                          Total Pcs in Carton (Auto)
                        </label>
                        <input 
                          type="number" 
                          className="input-field"
                          readOnly
                          style={{ background: '#dcfce7', fontWeight: '800', color: '#166534', borderColor: '#86efac', height: '34px', fontSize: '0.82rem' }}
                          value={((Number(formData.packsPerCarton) || 0) * (Number(formData.pcsPerBox) || 0)) || formData.pcsPerCarton || 0}
                        />
                        <div style={{ fontSize: '0.68rem', color: '#15803d', marginTop: '2px' }}>
                          Total base pieces per master carton
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Pcs Per Carton/Box *</label>
                    <input 
                      type="number" 
                      min="1"
                      className="input-field"
                      required
                      placeholder="e.g. 24"
                      value={formData.pcsPerCarton}
                      onChange={e => {
                        const val = e.target.value;
                        const pcs = val === '' ? '' : val;
                        const pcsNum = Number(val) || 0;
                        const ctn = Number(formData.cartonsStock) || 0;
                        const loose = Number(formData.loosePcsStock) || 0;
                        setFormData({
                          ...formData,
                          pcsPerCarton: pcs,
                          currentStock: (ctn * pcsNum) + loose
                        });
                      }}
                    />
                    <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Base units per master carton
                    </div>
                  </div>
                )}

                {/* Carton & Loose Pieces Stock Input Section */}
                <div className="form-group" style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label className="form-label" style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                    📦 Initial Stock Details ({formData.unit === 'Box' || formData.unit === 'Pack' || formData.unit === 'Chain Pouch' ? `Carton, ${formData.unit} & Loose Pieces` : 'Carton & Loose Pieces'})
                  </label>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: formData.unit === 'Box' || formData.unit === 'Pack' || formData.unit === 'Chain Pouch' ? 'repeat(auto-fit, minmax(130px, 1fr))' : '1fr 1fr 1fr', 
                    gap: '12px', 
                    marginTop: '8px' 
                  }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cartons Count</label>
                      <input 
                        type="number" 
                        min="0"
                        className="input-field"
                        placeholder="0"
                        value={formData.cartonsStock}
                        onChange={e => {
                          const val = e.target.value;
                          const ctn = val === '' ? '' : val;
                          const ctnNum = Number(val) || 0;
                          const isBoxOrPack = formData.unit === 'Box' || formData.unit === 'Pack' || formData.unit === 'Chain Pouch';
                          const pcsPerBoxNum = Number(formData.pcsPerBox) || 1;
                          const totalPcsPerCtn = isBoxOrPack && Number(formData.packsPerCarton) > 0 && Number(formData.pcsPerBox) > 0
                            ? (Number(formData.packsPerCarton) * pcsPerBoxNum)
                            : (Number(formData.pcsPerCarton) || 24);
                          const boxes = Number(formData.boxesStock) || 0;
                          const loose = Number(formData.loosePcsStock) || 0;
                          setFormData({
                            ...formData,
                            cartonsStock: ctn,
                            currentStock: (ctnNum * totalPcsPerCtn) + (boxes * (isBoxOrPack ? pcsPerBoxNum : 0)) + loose
                          });
                        }}
                      />
                    </div>

                    {/* EXTRA STOCK BOX FOR BOX / PACK */}
                    {(formData.unit === 'Box' || formData.unit === 'Pack' || formData.unit === 'Chain Pouch') && (
                      <div>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formData.unit}s Count (Loose)</label>
                        <input 
                          type="number" 
                          min="0"
                          className="input-field"
                          placeholder="0"
                          value={formData.boxesStock}
                          onChange={e => {
                            const val = e.target.value;
                            const boxes = val === '' ? '' : val;
                            const boxesNum = Number(val) || 0;
                            const pcsPerBoxNum = Number(formData.pcsPerBox) || 1;
                            const totalPcsPerCtn = Number(formData.packsPerCarton) > 0 && Number(formData.pcsPerBox) > 0
                              ? (Number(formData.packsPerCarton) * pcsPerBoxNum)
                              : (Number(formData.pcsPerCarton) || 24);
                            const ctn = Number(formData.cartonsStock) || 0;
                            const loose = Number(formData.loosePcsStock) || 0;
                            setFormData({
                              ...formData,
                              boxesStock: boxes,
                              currentStock: (ctn * totalPcsPerCtn) + (boxesNum * pcsPerBoxNum) + loose
                            });
                          }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Loose Pieces</label>
                      <input 
                        type="number" 
                        min="0"
                        className="input-field"
                        placeholder="0"
                        value={formData.loosePcsStock}
                        onChange={e => {
                          const val = e.target.value;
                          const loose = val === '' ? '' : val;
                          const looseNum = Number(val) || 0;
                          const isBoxOrPack = formData.unit === 'Box' || formData.unit === 'Pack' || formData.unit === 'Chain Pouch';
                          const pcsPerBoxNum = Number(formData.pcsPerBox) || 1;
                          const totalPcsPerCtn = isBoxOrPack && Number(formData.packsPerCarton) > 0 && Number(formData.pcsPerBox) > 0
                            ? (Number(formData.packsPerCarton) * pcsPerBoxNum)
                            : (Number(formData.pcsPerCarton) || 24);
                          const ctn = Number(formData.cartonsStock) || 0;
                          const boxes = Number(formData.boxesStock) || 0;
                          setFormData({
                            ...formData,
                            loosePcsStock: loose,
                            currentStock: (ctn * totalPcsPerCtn) + (boxes * (isBoxOrPack ? pcsPerBoxNum : 0)) + looseNum
                          });
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total Base Pcs</label>
                      <input 
                        type="number" 
                        className="input-field"
                        readOnly
                        style={{ background: 'rgba(255,255,255,0.06)', fontWeight: '800', color: 'var(--primary)' }}
                        value={formData.currentStock}
                      />
                    </div>
                  </div>
                </div>

                {/* Batch No & Expiry Management */}
                <div className="form-group">
                  <label className="form-label">Batch / Lot No.</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. LOT-2026-B1"
                    value={formData.batchNo}
                    onChange={e => setFormData({...formData, batchNo: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Warehouse Location</label>
                  <select 
                    className="input-field select-field"
                    value={formData.warehouseId}
                    onChange={e => setFormData({...formData, warehouseId: e.target.value})}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Mfg Date</label>
                  <input 
                    type="date" 
                    className="input-field"
                    value={formData.mfgDate}
                    onChange={e => setFormData({...formData, mfgDate: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input 
                    type="date" 
                    className="input-field"
                    value={formData.expiryDate}
                    onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Reorder / Min Stock Limit</label>
                  <input 
                    type="number" 
                    className="input-field"
                    value={formData.minStockLimit}
                    onChange={e => setFormData({...formData, minStockLimit: e.target.value})}
                  />
                </div>

              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setProductModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '6px' }}>
                  <Save size={16} />
                  <span>Save Product</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Stock In / Purchase Receipt Entry Modal */}
      {stockInModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                📥 Stock In Entry
              </h3>
              <button 
                onClick={() => setStockInModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStockIn}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                  <p style={{ fontWeight: '700', color: 'var(--text-main)' }}>{selectedProductForStock?.name}</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--primary)', marginTop: '4px', fontWeight: '600' }}>
                    Current Stock: {formatCartonStock(selectedProductForStock?.currentStock, selectedProductForStock?.pcsPerCarton)} ({selectedProductForStock?.currentStock} Pcs)
                  </p>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Pack Size: {selectedProductForStock?.pcsPerCarton || 24} Pcs/Carton
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Cartons to Add</label>
                    <input 
                      type="number" 
                      min="0"
                      className="input-field"
                      placeholder="e.g. 5 Cartons"
                      value={stockInCartons}
                      onChange={e => setStockInCartons(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Loose Pcs to Add</label>
                    <input 
                      type="number" 
                      min="0"
                      className="input-field"
                      placeholder="e.g. 6 Pcs"
                      value={stockInLoosePcs}
                      onChange={e => setStockInLoosePcs(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Stock Notes / Invoice Ref</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. Factory Depot Supply Bill #889"
                    value={stockInReason}
                    onChange={e => setStockInReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setStockInModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Stock (+{((Number(stockInCartons) || 0) * (Number(selectedProductForStock?.pcsPerCarton) || 24)) + (Number(stockInLoosePcs) || 0)} Pcs)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Inter-Warehouse Stock Transfer */}
      {transferModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '520px', padding: '24px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowLeftRight size={20} color="#2563eb" />
                <span>Inter-Warehouse Depot Stock Transfer</span>
              </h3>
              <button 
                onClick={() => setTransferModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleTransferStock} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
              <div className="form-group">
                <label className="form-label">Select Product to Transfer *</label>
                <select 
                  className="input-field select-field"
                  value={transferForm.productId}
                  onChange={e => setTransferForm({ ...transferForm, productId: e.target.value })}
                  required
                >
                  <option value="">-- Choose Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Total Stock: {p.currentStock} {p.unit || 'Pcs'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">From Origin Warehouse *</label>
                  <select 
                    className="input-field select-field"
                    value={transferForm.fromWarehouseId}
                    onChange={e => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}
                    required
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">To Destination Warehouse *</label>
                  <select 
                    className="input-field select-field"
                    value={transferForm.toWarehouseId}
                    onChange={e => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}
                    required
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Transfer Qty (Pcs) *</label>
                  <input 
                    type="number"
                    min="1"
                    className="input-field"
                    placeholder="e.g. 50"
                    value={transferForm.qty}
                    onChange={e => setTransferForm({ ...transferForm, qty: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Transfer Reason / Gate Pass Ref</label>
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="e.g. Counter demand / Gate Pass #102"
                    value={transferForm.reason}
                    onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setTransferModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: '700' }}>
                  Execute Stock Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Photo-to-Purchase & Excel/CSV Importer */}
      {importModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '780px', padding: '24px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <FileSpreadsheet size={22} color="#059669" />
                  <span>Photo-to-Purchase & Excel/CSV Bill Importer</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Eliminate manual typing: Paste invoice text, drop CSV/Excel files, or load invoice scan lines.
                </p>
              </div>
              <button 
                onClick={() => setImportModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>Input Purchase Invoice Lines or CSV:</span>
                <button 
                  type="button" 
                  onClick={loadSampleCsvData}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '0.74rem', padding: '4px 8px', color: '#059669', borderColor: '#10b981' }}
                >
                  Load Sample FMCG Bill
                </button>
              </div>

              <textarea 
                className="input-field"
                rows={5}
                placeholder="Paste CSV lines: Item Name, Quantity, Purchase Rate, MRP, Batch, Expiry&#10;e.g. Britannia 50-50 Biscuits, 48, 22.50, 30.00, LOT-5050, 2027-01-31"
                value={importRawText}
                onChange={e => setImportRawText(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Accepted format: comma or tab separated (Item, Qty, Rate, MRP, Batch, Exp)
                </div>
                <button 
                  onClick={handleParseImport}
                  className="btn btn-primary"
                  style={{ padding: '6px 16px', fontWeight: '700', fontSize: '0.84rem' }}
                >
                  Parse & Preview Items
                </button>
              </div>

              {/* Parsed Items Preview Table */}
              {parsedImportItems.length > 0 && (
                <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: '800', fontSize: '0.88rem', color: '#059669' }}>
                      ✅ Ready to Import: {parsedImportItems.length} Products
                    </span>
                    <button 
                      onClick={handleCommitImport}
                      className="btn btn-primary"
                      style={{ padding: '6px 16px', fontWeight: '800', fontSize: '0.86rem', gap: '6px' }}
                    >
                      <CheckCircle size={16} />
                      <span>Commit & Add to Inventory</span>
                    </button>
                  </div>

                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '6px' }}>Item Name</th>
                          <th style={{ padding: '6px', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>Cost (Ex-GST)</th>
                          <th style={{ padding: '6px', textAlign: 'right', color: '#047857' }}>Cost (+GST)</th>
                          <th style={{ padding: '6px', textAlign: 'right' }}>MRP</th>
                          <th style={{ padding: '6px' }}>Batch</th>
                          <th style={{ padding: '6px' }}>Expiry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedImportItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px', fontWeight: '700' }}>{item.name}</td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>{item.qty} Pcs</td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>₹{item.purchasePrice}</td>
                            <td style={{ padding: '6px', textAlign: 'right', fontWeight: '700', color: '#047857' }}>
                              ₹{(Number(item.purchasePrice || 0) * (1 + (Number(item.gstRate || 5) / 100))).toFixed(2)}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right' }}>₹{item.mrp}</td>
                            <td style={{ padding: '6px' }}>{item.batchNo}</td>
                            <td style={{ padding: '6px' }}>{item.expiryDate || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button 
                type="button" 
                onClick={() => setImportModalOpen(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add New Purchase Bill */}
      {purchaseModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '1240px', width: '96vw', padding: '16px 20px', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header */}
            <div className="modal-header" style={{ paddingBottom: '10px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <ShoppingBag size={18} color="#059669" />
                  <span>{editingPurchaseId ? `Edit Purchase Inward Bill #${purchaseHeader.billNo || ''}` : 'Add New Purchase (Inward Stock Entry)'}</span>
                  {editingPurchaseId && (
                    <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                      24h Edit Window Active
                    </span>
                  )}
                </h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  {editingPurchaseId 
                    ? 'Update bill details, quantities, or purchase rates. Changes will automatically reconcile inventory stock and inward lots.' 
                    : 'Record vendor purchase invoice, auto-calculate purchase price with GST, and increment inventory stock.'}
                </p>
              </div>
              <button 
                onClick={() => setPurchaseModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Header Fields: Party, GST, Date, Bill No, Warehouse */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                
                <div className="form-group" style={{ margin: 0, position: 'relative' }} ref={supplierDropdownRef}>
                  <label className="form-label" style={{ fontWeight: '700', marginBottom: '3px', color: '#047857', fontSize: '0.74rem' }}>
                    Purchase Party / Supplier Name *
                  </label>

                  {/* Input Search Container matching user screenshot */}
                  <div
                    style={{
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      background: '#ffffff',
                      borderRadius: '6px',
                      border: showSupplierSuggestions ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      boxShadow: showSupplierSuggestions ? '0 0 0 2px rgba(37, 99, 235, 0.12)' : 'none',
                      overflow: 'hidden',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input 
                      type="text"
                      placeholder="Select or add a customer"
                      style={{ 
                        flex: 1,
                        height: '100%',
                        paddingLeft: '8px', 
                        paddingRight: '4px',
                        fontSize: '0.76rem', 
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: 'var(--text-main, #0f172a)',
                        cursor: 'text'
                      }}
                      value={
                        selectedSupplierObj 
                          ? (supplierSearchTerm !== '' ? supplierSearchTerm : selectedSupplierObj.name)
                          : (supplierSearchTerm || purchaseHeader.partyName || '')
                      }
                      onClick={() => {
                        setShowSupplierSuggestions(true);
                        setHighlightedSupplierIndex(0);
                      }}
                      onFocus={() => {
                        setShowSupplierSuggestions(true);
                        setHighlightedSupplierIndex(0);
                      }}
                      onChange={e => {
                        const val = e.target.value;
                        setSupplierSearchTerm(val);
                        setPurchaseHeader(prev => ({ ...prev, partyName: val }));
                        setSelectedSupplierObj(null);
                        setShowSupplierSuggestions(true);
                        setHighlightedSupplierIndex(0);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          if (filteredSuppliersForPurchase.length > 0) {
                            setHighlightedSupplierIndex(prev => (prev + 1) % filteredSuppliersForPurchase.length);
                          }
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          if (filteredSuppliersForPurchase.length > 0) {
                            setHighlightedSupplierIndex(prev => (prev - 1 + filteredSuppliersForPurchase.length) % filteredSuppliersForPurchase.length);
                          }
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filteredSuppliersForPurchase.length > 0 && filteredSuppliersForPurchase[highlightedSupplierIndex]) {
                            handleSelectSupplierFromList(filteredSuppliersForPurchase[highlightedSupplierIndex]);
                            setShowSupplierSuggestions(false);
                          } else if (supplierSearchTerm.trim()) {
                            setPurchaseHeader(prev => ({ ...prev, partyName: supplierSearchTerm.trim() }));
                            setShowSupplierSuggestions(false);
                          }
                        } else if (e.key === 'Escape') {
                          setShowSupplierSuggestions(false);
                        }
                      }}
                    />

                    {/* Clear ✕ button if text or supplier selected */}
                    {(selectedSupplierObj || purchaseHeader.partyName || supplierSearchTerm) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSupplierFromList(null);
                          setShowSupplierSuggestions(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          padding: '2px 5px',
                          lineHeight: 1
                        }}
                        title="Clear Supplier"
                      >
                        ✕
                      </button>
                    )}

                    {/* Down Chevron icon */}
                    <div 
                      onClick={() => setShowSupplierSuggestions(!showSupplierSuggestions)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 6px 0 2px',
                        cursor: 'pointer',
                        color: '#64748b'
                      }}
                      title="Open Supplier List"
                    >
                      <ChevronDown size={14} color="#64748b" />
                    </div>
                  </div>

                  {/* Dropdown Popup matching exact user screenshot */}
                  {showSupplierSuggestions && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        zIndex: 1200,
                        background: '#ffffff',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        border: '1px solid #e2e8f0',
                        padding: '5px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Scrollable list of suppliers */}
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {filteredSuppliersForPurchase.length === 0 ? (
                          <div style={{ padding: '10px', fontSize: '0.74rem', color: '#64748b', textAlign: 'center' }}>
                            No supplier found for "{supplierSearchTerm || purchaseHeader.partyName}"
                          </div>
                        ) : (
                          filteredSuppliersForPurchase.map((s, idx) => {
                            const isHighlighted = (highlightedSupplierIndex === idx);
                            const initial = s.name ? s.name.trim().charAt(0).toUpperCase() : 'S';

                            return (
                              <div 
                                key={s.id || idx}
                                onClick={() => {
                                  handleSelectSupplierFromList(s);
                                  setShowSupplierSuggestions(false);
                                }}
                                onMouseEnter={() => setHighlightedSupplierIndex(idx)}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '5px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  cursor: 'pointer',
                                  background: isHighlighted ? '#2563eb' : 'transparent',
                                  color: isHighlighted ? '#ffffff' : '#0f172a',
                                  transition: 'background 0.1s ease, color 0.1s ease',
                                  marginBottom: '2px'
                                }}
                              >
                                {/* Round Avatar Circle with Initial */}
                                <div style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  background: isHighlighted ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0',
                                  color: isHighlighted ? '#ffffff' : '#475569',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: '800',
                                  fontSize: '0.72rem',
                                  flexShrink: 0
                                }}>
                                  {initial}
                                </div>

                                {/* Supplier Details */}
                                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                  <div style={{
                                    fontWeight: '700',
                                    fontSize: '0.76rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    color: isHighlighted ? '#ffffff' : '#0f172a'
                                  }}>
                                    {s.name}
                                  </div>
                                  <div style={{
                                    fontSize: '0.66rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    marginTop: '1px',
                                    color: isHighlighted ? 'rgba(255, 255, 255, 0.9)' : '#64748b'
                                  }}>
                                    <FileText size={10} style={{ flexShrink: 0 }} />
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {s.name} {s.gstin ? `• ${s.gstin}` : ''} {s.phone ? `• ${s.phone}` : ''} {s.city ? `• ${s.city}` : ''}
                                    </span>
                                  </div>
                                </div>

                                {/* GST Tag */}
                                {s.gstin && (
                                  <div style={{
                                    flexShrink: 0,
                                    fontSize: '0.62rem',
                                    fontWeight: '700',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    background: isHighlighted ? 'rgba(255, 255, 255, 0.2)' : '#ecfdf5',
                                    color: isHighlighted ? '#ffffff' : '#047857'
                                  }}>
                                    GST
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Bottom Row: ⊕ New Customer / New Supplier */}
                      <div 
                        onClick={handleOpenQuickSupplierFromDropdown}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 8px',
                          cursor: 'pointer',
                          color: '#2563eb',
                          fontWeight: '700',
                          fontSize: '0.74rem',
                          borderTop: '1px solid #f1f5f9',
                          borderRadius: '0 0 6px 6px',
                          transition: 'background 0.15s ease',
                          marginTop: '2px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <PlusCircle size={13} color="#2563eb" />
                        <span>New Customer</span>
                      </div>
                    </div>
                  )}

                  {/* Selected Supplier summary badge */}
                  {selectedSupplierObj && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 6px', borderRadius: '5px', marginTop: '3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                      <span style={{ color: '#166534', fontWeight: '700' }}>
                        ✓ {selectedSupplierObj.name} {selectedSupplierObj.gstin ? `(${selectedSupplierObj.gstin})` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectSupplierFromList(null)}
                        style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '0.74rem', marginBottom: '3px' }}>Party GST Number</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ fontSize: '0.76rem', padding: '4px 8px', height: '30px' }}
                    placeholder="e.g. 24AAAAA0000A1Z5"
                    value={purchaseHeader.partyGst}
                    onChange={e => setPurchaseHeader({ ...purchaseHeader, partyGst: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '0.74rem', marginBottom: '3px' }}>Purchase Date *</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    style={{ fontSize: '0.76rem', padding: '4px 8px', height: '30px' }}
                    value={purchaseHeader.date}
                    onChange={e => setPurchaseHeader({ ...purchaseHeader, date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px' }}>Supplier Bill / Invoice No.</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ fontSize: '0.76rem', padding: '4px 8px', height: '30px' }}
                    placeholder="e.g. BILL-4091"
                    value={purchaseHeader.billNo}
                    onChange={e => setPurchaseHeader({ ...purchaseHeader, billNo: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px' }}>Receive In Warehouse</label>
                  <select 
                    className="input-field select-field" 
                    style={{ fontSize: '0.76rem', padding: '4px 8px', height: '30px' }}
                    value={purchaseHeader.warehouseId}
                    onChange={e => setPurchaseHeader({ ...purchaseHeader, warehouseId: e.target.value })}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Product Search & Add Bar matching exact Billing format */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ShoppingBag size={14} color="#2563eb" />
                    <span>Search & Add Product to Purchase</span>
                  </label>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Type product name, SKU or brand to quickly add items</span>
                </div>
                <div ref={purchaseProdSearchRef} style={{ position: 'relative' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search 
                      size={14} 
                      color={showPurchaseProdSuggestions ? '#2563eb' : '#94a3b8'} 
                      style={{ 
                        position: 'absolute', 
                        left: '10px', 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        pointerEvents: 'none',
                        transition: 'color 0.15s ease'
                      }} 
                    />
                    <input 
                      type="text"
                      className="input-field"
                      placeholder="Search products..."
                      style={{ 
                        width: '100%',
                        height: '32px',
                        paddingLeft: '32px', 
                        paddingRight: purchaseProdSearchTerm ? '30px' : '10px', 
                        fontSize: '0.80rem',
                        borderRadius: '6px',
                        border: showPurchaseProdSuggestions ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
                        boxShadow: showPurchaseProdSuggestions ? '0 0 0 2px rgba(37, 99, 235, 0.12)' : 'none',
                        background: 'var(--bg-input, #ffffff)',
                        color: 'var(--text-main, #0f172a)',
                        outline: 'none',
                        transition: 'all 0.15s ease'
                      }}
                      value={purchaseProdSearchTerm}
                      onClick={() => {
                        setShowPurchaseProdSuggestions(true);
                        setHighlightedPurchaseProdIndex(0);
                      }}
                      onFocus={() => {
                        setShowPurchaseProdSuggestions(true);
                        setHighlightedPurchaseProdIndex(0);
                      }}
                      onChange={e => {
                        setPurchaseProdSearchTerm(e.target.value);
                        setShowPurchaseProdSuggestions(true);
                        setHighlightedPurchaseProdIndex(0);
                      }}
                      onKeyDown={handlePurchaseProdSearchKeyDown}
                    />
                    {purchaseProdSearchTerm && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPurchaseProdSearchTerm('');
                          setShowPurchaseProdSuggestions(true);
                        }}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8',
                          fontSize: '15px',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '50%',
                          lineHeight: 1
                        }}
                        title="Clear Product Search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Dropdown Popup matching exact Billing/Image format */}
                  {showPurchaseProdSuggestions && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        zIndex: 1100,
                        background: '#ffffff',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                        border: '1px solid #e2e8f0',
                        padding: '6px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Scrollable list of products */}
                      <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        {filteredProductsForPurchase.length === 0 ? (
                          <div style={{ padding: '16px 12px', fontSize: '0.80rem', color: '#64748b', textAlign: 'center' }}>
                            No product found for "{purchaseProdSearchTerm}"
                          </div>
                        ) : (
                          filteredProductsForPurchase.map((p, idx) => {
                            const isHighlighted = (highlightedPurchaseProdIndex === idx);

                            return (
                              <div 
                                key={p.id}
                                onClick={() => handleSelectProductToPurchase(p)}
                                onMouseEnter={() => setHighlightedPurchaseProdIndex(idx)}
                                style={{
                                  padding: '7px 12px',
                                  borderRadius: '5px',
                                  cursor: 'pointer',
                                  background: isHighlighted ? '#2563eb' : 'transparent',
                                  color: isHighlighted ? '#ffffff' : '#0f172a',
                                  fontWeight: isHighlighted ? '700' : '500',
                                  fontSize: '0.80rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  transition: 'background 0.1s ease, color 0.1s ease',
                                  marginBottom: '2px'
                                }}
                              >
                                {p.name}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Bottom Row: + New Product */}
                      <div 
                        onClick={() => {
                          handleOpenQuickProductModal(null, purchaseProdSearchTerm);
                          setShowPurchaseProdSuggestions(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 8px',
                          cursor: 'pointer',
                          color: '#2563eb',
                          fontWeight: '600',
                          fontSize: '0.76rem',
                          borderTop: '1px solid #f1f5f9',
                          borderRadius: '0 0 6px 6px',
                          transition: 'background 0.15s ease',
                          marginTop: '2px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <PlusCircle size={14} color="#2563eb" />
                        <span>New Product</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    📦 Purchase Item Lines ({purchaseRows.length} {purchaseRows.length === 1 ? 'row' : 'rows'})
                  </span>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Quick Bill GST Setter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                      <span style={{ fontSize: '0.68rem', color: '#047857', fontWeight: '700' }}>Bill GST:</span>
                      <button
                        type="button"
                        onClick={() => handleApplyGstRateToAllRows(5)}
                        className="btn btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.68rem', color: '#ffffff', background: '#059669', borderColor: '#059669', fontWeight: '800', cursor: 'pointer', borderRadius: '4px' }}
                        title="Apply 5% GST to all rows in this bill"
                      >
                        Set All to 5% GST
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyGstRateToAllRows(12)}
                        className="btn btn-sm btn-secondary"
                        style={{ padding: '2px 6px', fontSize: '0.68rem', color: '#475569', fontWeight: '600' }}
                        title="Apply 12% GST to all rows in this bill"
                      >
                        12%
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyGstRateToAllRows(18)}
                        className="btn btn-sm btn-secondary"
                        style={{ padding: '2px 6px', fontSize: '0.68rem', color: '#475569', fontWeight: '600' }}
                        title="Apply 18% GST to all rows in this bill"
                      >
                        18%
                      </button>
                    </div>

                    <button 
                      type="button" 
                      onClick={handleAddPurchaseRow}
                      className="btn btn-sm btn-secondary"
                      style={{ gap: '4px', fontWeight: '700', borderColor: '#2563eb', color: '#2563eb', padding: '3px 10px', fontSize: '0.72rem' }}
                    >
                      <Plus size={13} />
                      <span>+ Add Row</span>
                    </button>
                  </div>
                </div>

                <div style={{ 
                  overflow: 'visible', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px',
                  minHeight: activeProductRowId ? '320px' : 'auto',
                  paddingBottom: activeProductRowId ? '220px' : '0px',
                  transition: 'padding-bottom 0.2s ease, min-height 0.2s ease',
                  position: 'relative'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.68rem', letterSpacing: '0.3px' }}>
                        <th style={{ padding: '6px 4px', width: '26px', textAlign: 'center' }}>#</th>
                        <th style={{ padding: '6px 5px', minWidth: '150px' }}>PRODUCT *</th>
                        <th style={{ padding: '6px 4px', width: '55px' }}>MRP (₹)</th>
                        <th style={{ padding: '6px 4px', width: '55px' }}>HSN</th>
                        <th style={{ padding: '6px 4px', width: '75px' }}>BATCH NO</th>
                        <th style={{ padding: '6px 4px', width: '90px' }}>MFG DATE</th>
                        <th style={{ padding: '6px 4px', width: '90px' }}>EXPIRY DATE</th>
                        <th style={{ padding: '6px 4px', width: '60px' }}>SELLING (₹)</th>
                        <th style={{ padding: '6px 4px', width: '55px' }}>RATE OF GST</th>
                        <th style={{ padding: '6px 4px', width: '55px' }}>QUANTITY</th>
                        <th style={{ padding: '6px 5px', width: '90px' }}>PURCHASE PRICE W/O GST</th>
                        <th style={{ padding: '6px 5px', width: '90px', color: '#0369a1', fontWeight: '700' }}>TOTAL W/O GST</th>
                        <th style={{ padding: '6px 5px', width: '90px', color: '#047857', fontWeight: '700' }}>PURCHASE PRICE WITH GST</th>
                        <th style={{ padding: '6px 5px', width: '95px', color: '#059669', fontWeight: '800', textAlign: 'right' }}>TOTAL WITH GST</th>
                        <th style={{ padding: '6px 2px', width: '26px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseRows.map((row, idx) => {
                        const lineEx = (Number(row.qty) || 0) * (Number(row.purchasePrice) || 0);
                        const lineGst = lineEx * ((Number(row.gstRate) || 0) / 100);
                        const lineTotal = lineEx + lineGst;

                        return (
                          <tr 
                            key={row.id} 
                            style={{ 
                              borderBottom: '1px solid #e2e8f0', 
                              background: idx % 2 === 0 ? '#fff' : '#f8fafc',
                              position: activeProductRowId === row.id ? 'relative' : 'static',
                              zIndex: activeProductRowId === row.id ? 200 : 1
                            }}
                          >
                            <td style={{ padding: '4px 4px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.70rem' }}>{idx + 1}</td>
                            
                            {/* Product */}
                            <td 
                              className="purchase-row-product-cell" 
                              style={{ 
                                padding: '4px 3px', 
                                position: 'relative',
                                zIndex: activeProductRowId === row.id ? 200 : 1
                              }}
                            >
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input 
                                  type="text" 
                                  className="input-field" 
                                  placeholder="Choose or type product..."
                                  value={row.name}
                                  onClick={() => {
                                    setActiveProductRowId(row.id);
                                    setHighlightedProductIndex(0);
                                  }}
                                  onFocus={() => {
                                    setActiveProductRowId(row.id);
                                    setHighlightedProductIndex(0);
                                  }}
                                  onChange={e => {
                                    const val = e.target.value;
                                    handleRowFieldChange(idx, 'name', val);
                                    const matched = products.find(p => isProductMatch(p, { name: val, sku: val }));
                                    if (matched) {
                                      handleProductSelect(idx, matched.id);
                                    }
                                    setActiveProductRowId(row.id);
                                    setHighlightedProductIndex(0);
                                  }}
                                  onKeyDown={e => {
                                    const query = (row.name || '').trim().toLowerCase();
                                    const normQuery = normalizeProductName(row.name);
                                    const matching = products.filter(p => 
                                      !query || 
                                      (p.name && normalizeProductName(p.name).includes(normQuery)) || 
                                      (p.brand && p.brand.toLowerCase().includes(query)) || 
                                      (p.sku && p.sku.toLowerCase().includes(query)) || 
                                      (p.hsn && p.hsn.toLowerCase().includes(query))
                                    );
                                    if (e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      if (matching.length > 0) {
                                        setHighlightedProductIndex(prev => (prev + 1) % matching.length);
                                      }
                                    } else if (e.key === 'ArrowUp') {
                                      e.preventDefault();
                                      if (matching.length > 0) {
                                        setHighlightedProductIndex(prev => (prev - 1 + matching.length) % matching.length);
                                      }
                                    } else if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (matching.length > 0 && matching[highlightedProductIndex]) {
                                        handleProductSelect(idx, matching[highlightedProductIndex].id);
                                        setActiveProductRowId(null);
                                      } else if (row.name && row.name.trim()) {
                                        handleOpenQuickProductModal(idx, row.name);
                                      }
                                    } else if (e.key === 'Escape') {
                                      setActiveProductRowId(null);
                                    }
                                  }}
                                  style={{ 
                                    fontSize: '0.74rem', 
                                    padding: '3px 26px 3px 6px', 
                                    height: '28px', 
                                    width: '100%',
                                    borderColor: activeProductRowId === row.id ? '#2563eb' : undefined,
                                    boxShadow: activeProductRowId === row.id ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : undefined
                                  }}
                                  required
                                />

                                {/* Clear or Chevron button on the right */}
                                <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  {row.name ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRowFieldChange(idx, 'name', '');
                                        handleRowFieldChange(idx, 'productId', '');
                                        setActiveProductRowId(row.id);
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#94a3b8',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        padding: '1px 3px',
                                        lineHeight: 1
                                      }}
                                      title="Clear Product"
                                    >
                                      ✕
                                    </button>
                                  ) : null}
                                  <div 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveProductRowId(activeProductRowId === row.id ? null : row.id);
                                      setHighlightedProductIndex(0);
                                    }}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '1px' }}
                                    title="Toggle product list"
                                  >
                                    <ChevronDown size={13} color="#64748b" />
                                  </div>
                                </div>

                                {/* Custom Dropdown with + Add New Product option matching exact Billing format */}
                                {activeProductRowId === row.id && (
                                  <div 
                                    style={{
                                      position: 'absolute',
                                      top: 'calc(100% + 4px)',
                                      left: 0,
                                      width: '320px',
                                      maxWidth: '90vw',
                                      zIndex: 99999,
                                      background: '#ffffff',
                                      borderRadius: '8px',
                                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.22), 0 4px 10px rgba(0, 0, 0, 0.08)',
                                      border: '1.5px solid #2563eb',
                                      padding: '6px',
                                      overflow: 'hidden',
                                      textAlign: 'left'
                                    }}
                                  >
                                    {/* Mini header showing count */}
                                    <div style={{ 
                                      padding: '3px 8px 5px', 
                                      fontSize: '0.68rem', 
                                      fontWeight: '700', 
                                      color: '#64748b', 
                                      borderBottom: '1px solid #f1f5f9',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}>
                                      <span>📦 Products ({products.length} available)</span>
                                      <span style={{ fontSize: '0.64rem', color: '#94a3b8' }}>Type to filter</span>
                                    </div>

                                    <div style={{ maxHeight: '230px', overflowY: 'auto', paddingTop: '4px' }}>
                                      {(() => {
                                        const query = (row.name || '').trim().toLowerCase();
                                        const matching = products.filter(p => 
                                          !query || 
                                          (p.name && p.name.toLowerCase().includes(query)) || 
                                          (p.brand && p.brand.toLowerCase().includes(query)) || 
                                          (p.sku && p.sku.toLowerCase().includes(query)) || 
                                          (p.hsn && p.hsn.toLowerCase().includes(query))
                                        );

                                        if (matching.length === 0) {
                                          return (
                                            <div style={{ padding: '14px 10px', fontSize: '0.74rem', color: '#64748b', textAlign: 'center' }}>
                                              No product found matching "{row.name}"
                                            </div>
                                          );
                                        }

                                        return matching.map((p, pIdx) => {
                                          const isHigh = (highlightedProductIndex === pIdx);
                                          return (
                                            <div
                                              key={p.id || pIdx}
                                              onClick={() => {
                                                handleProductSelect(idx, p.id);
                                                setActiveProductRowId(null);
                                              }}
                                              onMouseEnter={() => setHighlightedProductIndex(pIdx)}
                                              style={{
                                                padding: '7px 12px',
                                                borderRadius: '5px',
                                                cursor: 'pointer',
                                                background: isHigh ? '#2563eb' : 'transparent',
                                                color: isHigh ? '#ffffff' : '#0f172a',
                                                fontWeight: isHigh ? '700' : '500',
                                                fontSize: '0.80rem',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                transition: 'background 0.1s ease, color 0.1s ease',
                                                marginBottom: '2px'
                                              }}
                                            >
                                              {p.name}
                                            </div>
                                          );
                                        });
                                      })()}
                                    </div>

                                    {/* ⊕ Add New Product button at bottom */}
                                    <div
                                      onClick={() => handleOpenQuickProductModal(idx, row.name)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 8px',
                                        cursor: 'pointer',
                                        color: '#2563eb',
                                        fontWeight: '600',
                                        fontSize: '0.76rem',
                                        borderTop: '1px solid #f1f5f9',
                                        borderRadius: '0 0 6px 6px',
                                        transition: 'background 0.15s ease',
                                        marginTop: '2px'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <PlusCircle size={14} color="#2563eb" />
                                      <span>New Product</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* MRP */}
                            <td style={{ padding: '4px 3px' }}>
                              <input 
                                type="number" 
                                step="0.01" 
                                className="input-field" 
                                placeholder="0.00"
                                value={row.mrp}
                                onChange={e => handleRowFieldChange(idx, 'mrp', e.target.value)}
                                style={{ fontSize: '0.72rem', padding: '3px 5px', height: '27px' }}
                              />
                            </td>

                            {/* HSN */}
                            <td style={{ padding: '4px 3px' }}>
                              <input 
                                type="text" 
                                className="input-field" 
                                placeholder="HSN"
                                value={row.hsn}
                                onChange={e => handleRowFieldChange(idx, 'hsn', e.target.value)}
                                style={{ fontSize: '0.72rem', padding: '3px 5px', height: '27px' }}
                              />
                            </td>

                            {/* Batch No */}
                            <td style={{ padding: '4px 3px' }}>
                              <input 
                                type="text" 
                                className="input-field" 
                                placeholder="Batch"
                                value={row.batchNo || ''}
                                onChange={e => handleRowFieldChange(idx, 'batchNo', e.target.value)}
                                style={{ fontSize: '0.72rem', padding: '3px 4px', height: '27px', fontFamily: 'monospace' }}
                                title="Batch Number"
                              />
                            </td>

                            {/* MFG Date */}
                            <td style={{ padding: '4px 3px' }}>
                              <input 
                                type="date" 
                                className="input-field" 
                                value={row.mfgDate || ''}
                                onChange={e => handleRowFieldChange(idx, 'mfgDate', e.target.value)}
                                style={{ fontSize: '0.68rem', padding: '2px 3px', height: '27px' }}
                                title="Manufacturing Date"
                              />
                            </td>

                            {/* Expiry Date */}
                            <td style={{ padding: '4px 3px' }}>
                              <input 
                                type="date" 
                                className="input-field" 
                                value={row.expiryDate || ''}
                                onChange={e => handleRowFieldChange(idx, 'expiryDate', e.target.value)}
                                style={{ fontSize: '0.68rem', padding: '2px 3px', height: '27px', borderColor: row.expiryDate ? '#fca5a5' : undefined }}
                                title="Expiry Date"
                              />
                            </td>

                            {/* Selling Price */}
                            <td style={{ padding: '4px 3px' }}>
                              <input 
                                type="number" 
                                step="0.01" 
                                className="input-field" 
                                placeholder="0.00"
                                value={row.salePrice}
                                onChange={e => handleRowFieldChange(idx, 'salePrice', e.target.value)}
                                style={{ fontSize: '0.72rem', padding: '3px 5px', height: '27px' }}
                              />
                            </td>

                            {/* Rate of GST */}
                            <td style={{ padding: '4px 3px' }}>
                              <select 
                                className="input-field select-field"
                                value={row.gstRate}
                                onChange={e => handleRowFieldChange(idx, 'gstRate', e.target.value)}
                                style={{ 
                                  fontSize: '0.72rem', 
                                  padding: '2px 3px', 
                                  height: '27px',
                                  borderColor: Number(row.gstRate) !== 5 ? '#f59e0b' : undefined,
                                  background: Number(row.gstRate) !== 5 ? '#fffbeb' : undefined,
                                  fontWeight: Number(row.gstRate) !== 5 ? '800' : 'normal',
                                  color: Number(row.gstRate) !== 5 ? '#b45309' : undefined
                                }}
                                title={Number(row.gstRate) !== 5 ? `Non-standard ${row.gstRate}% GST rate on this item` : '5% GST'}
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </td>

                            {/* Quantity */}
                            <td style={{ padding: '4px 3px' }}>
                              <input 
                                type="number" 
                                min="1" 
                                className="input-field" 
                                placeholder="Qty"
                                value={row.qty}
                                onChange={e => handleRowFieldChange(idx, 'qty', e.target.value)}
                                style={{ fontSize: '0.72rem', padding: '3px 5px', height: '27px', fontWeight: '700' }}
                                required
                              />
                            </td>

                            {/* Purchase Price Without GST */}
                            <td style={{ padding: '4px 3px' }}>
                              <input 
                                type="number" 
                                step="0.01" 
                                className="input-field" 
                                placeholder="0.00"
                                value={row.purchasePrice}
                                onChange={e => handleRowFieldChange(idx, 'purchasePrice', e.target.value)}
                                style={{ fontSize: '0.72rem', padding: '3px 5px', height: '27px' }}
                                title="Unit Purchase Price Without GST"
                              />
                            </td>

                            {/* Total Without GST */}
                            <td style={{ padding: '4px 3px' }}>
                              <input 
                                type="number" 
                                step="0.01" 
                                className="input-field" 
                                placeholder="0.00"
                                value={row.totalExGst !== undefined && row.totalExGst !== '' ? row.totalExGst : ((row.qty && row.purchasePrice) ? (Number(row.qty) * Number(row.purchasePrice)).toFixed(2) : '')}
                                onChange={e => handleRowFieldChange(idx, 'totalExGst', e.target.value)}
                                style={{ fontSize: '0.72rem', padding: '3px 5px', height: '27px', background: '#f0f9ff', color: '#0369a1', fontWeight: '700', borderColor: '#bae6fd' }}
                                title="Total Without GST (Taxable Value = Qty × Unit Price W/O GST)"
                              />
                            </td>

                            {/* Purchase Price With GST */}
                            <td style={{ padding: '4px 3px' }}>
                              <input 
                                type="number" 
                                step="0.01" 
                                className="input-field" 
                                placeholder="0.00"
                                value={row.purchasePriceWithGst}
                                onChange={e => handleRowFieldChange(idx, 'purchasePriceWithGst', e.target.value)}
                                style={{ fontSize: '0.72rem', padding: '3px 5px', height: '27px', background: '#f0fdf4', color: '#047857', fontWeight: '700', borderColor: '#86efac' }}
                                title="Unit Purchase Price With GST"
                              />
                            </td>

                            {/* Total With GST */}
                            <td style={{ padding: '4px 3px' }}>
                              <input 
                                type="number" 
                                step="0.01" 
                                className="input-field" 
                                placeholder="0.00"
                                value={row.totalWithGst !== undefined && row.totalWithGst !== '' ? row.totalWithGst : (lineTotal ? lineTotal.toFixed(2) : '')}
                                onChange={e => handleRowFieldChange(idx, 'totalWithGst', e.target.value)}
                                style={{ fontSize: '0.72rem', padding: '3px 5px', height: '27px', background: '#ecfdf5', color: '#059669', fontWeight: '800', borderColor: '#a7f3d0', textAlign: 'right' }}
                                title="Total With GST (Gross Line Total = Total W/O GST + GST)"
                              />
                            </td>

                            {/* Delete Action */}
                            <td style={{ padding: '4px 2px', textAlign: 'center' }}>
                              <button 
                                type="button"
                                onClick={() => handleRemovePurchaseRow(idx)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                title="Remove row"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <button 
                    type="button" 
                    onClick={handleAddPurchaseRow}
                    className="btn btn-sm btn-secondary"
                    style={{ gap: '4px', fontWeight: '700', borderColor: '#2563eb', color: '#2563eb', padding: '3px 10px', fontSize: '0.72rem' }}
                  >
                    <Plus size={13} />
                    <span>+ Add Row</span>
                  </button>
                </div>

              </div>

              {/* Bottom Totals Summary Card */}
              {(() => {
                const totals = computePurchaseBillTotals(purchaseRows);
                const distinctRates = Object.keys(totals.slabs).filter(k => totals.slabs[k].taxable > 0);
                const hasMultipleRates = distinctRates.length > 1;

                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL ITEMS</span>
                        <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>{totals.totalItems} Products</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL QUANTITY</span>
                        <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>{totals.totalQty} Pcs</strong>
                      </div>
                      {hasMultipleRates && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fffbeb', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: '700' }}>
                            ⚠️ Multiple GST Rates: {distinctRates.map(r => `${r}% (₹${totals.slabs[r].gst.toFixed(2)})`).join(', ')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleApplyGstRateToAllRows(5)}
                            style={{ background: '#059669', border: 'none', color: '#ffffff', borderRadius: '4px', fontSize: '0.64rem', padding: '2px 8px', fontWeight: '800', cursor: 'pointer' }}
                            title="Make all items 5% GST to fix rate discrepancy"
                          >
                            Set All to 5% GST
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL (EX-GST)</span>
                        <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>₹{totals.totalExGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>
                          TOTAL GST {distinctRates.length === 1 ? `(${distinctRates[0]}%)` : ''}
                        </span>
                        <strong style={{ fontSize: '0.84rem', color: '#0284c7' }}>₹{totals.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{ paddingLeft: '12px', borderLeft: '2px solid #cbd5e1' }}>
                        <span style={{ fontSize: '0.66rem', color: '#047857', display: 'block', fontWeight: '700' }}>GRAND TOTAL (WITH GST)</span>
                        <strong style={{ fontSize: '0.98rem', color: '#059669', fontWeight: '800' }}>₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button 
                type="button" 
                onClick={() => setPurchaseModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '5px 14px', fontSize: '0.76rem' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSavePurchaseBill}
                className="btn btn-primary"
                style={{ padding: '5px 18px', fontWeight: '800', background: 'linear-gradient(135deg, #059669, #10b981)', borderColor: '#059669', gap: '6px', fontSize: '0.76rem' }}
              >
                <CheckCircle size={15} />
                <span>{editingPurchaseId ? 'Update Purchase & Sync Stock' : 'Save Purchase & Update Stock'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Quick Add Purchase Party / Supplier */}
      {quickSupplierModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '24px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#047857' }}>
                <Building2 size={20} color="#059669" />
                <span>Add Purchase Party (Supplier)</span>
              </h3>
              <button 
                onClick={() => setQuickSupplierModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleQuickAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Purchase Party / Company Name *</label>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="e.g. Beyond Snacks Pvt Ltd / Parle Agro"
                  value={newSupplierData.name}
                  onChange={e => setNewSupplierData({ ...newSupplierData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">GSTIN / Tax ID</label>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="e.g. 07BAPPG4321A1Z2"
                  value={newSupplierData.gstin}
                  onChange={e => setNewSupplierData({ ...newSupplierData, gstin: e.target.value.toUpperCase() })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Phone / Mobile</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. 9811002200"
                    value={newSupplierData.phone}
                    onChange={e => setNewSupplierData({ ...newSupplierData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">City / Location</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. Delhi / Mumbai"
                    value={newSupplierData.city}
                    onChange={e => setNewSupplierData({ ...newSupplierData, city: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setQuickSupplierModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ background: '#059669', borderColor: '#059669', fontWeight: '700' }}
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Quick Add Product from Purchase Table */}
      {quickProductModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '20px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#059669' }}>
                <Package size={18} color="#059669" />
                <span>Add New Product to Inventory</span>
              </h3>
              <button 
                onClick={() => setQuickProductModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickProduct} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '0.74rem', marginBottom: '3px' }}>Product Name *</label>
                <input 
                  type="text" 
                  className="input-field"
                  style={{ fontSize: '0.78rem', height: '30px', padding: '4px 8px' }}
                  placeholder="e.g. Parle-G Gold 100g / Fortune Refined Oil 1L"
                  value={quickProductData.name}
                  onChange={e => setQuickProductData({ ...quickProductData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px' }}>MRP (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    style={{ fontSize: '0.78rem', height: '30px', padding: '4px 8px' }}
                    placeholder="0.00"
                    value={quickProductData.mrp}
                    onChange={e => setQuickProductData({ ...quickProductData, mrp: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px' }}>HSN Code</label>
                  <input 
                    type="text" 
                    className="input-field"
                    style={{ fontSize: '0.78rem', height: '30px', padding: '4px 8px' }}
                    placeholder="e.g. 1905"
                    value={quickProductData.hsn}
                    onChange={e => setQuickProductData({ ...quickProductData, hsn: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px' }}>Selling Price (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    style={{ fontSize: '0.78rem', height: '30px', padding: '4px 8px' }}
                    placeholder="0.00"
                    value={quickProductData.salePrice}
                    onChange={e => setQuickProductData({ ...quickProductData, salePrice: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px' }}>GST Rate (%)</label>
                  <select 
                    className="input-field select-field"
                    style={{ fontSize: '0.78rem', height: '30px', padding: '2px 6px' }}
                    value={quickProductData.gstRate}
                    onChange={e => setQuickProductData({ ...quickProductData, gstRate: Number(e.target.value) })}
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px' }}>Purchase Price (Ex-GST)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field"
                    style={{ fontSize: '0.78rem', height: '30px', padding: '4px 8px' }}
                    placeholder="0.00"
                    value={quickProductData.purchasePrice}
                    onChange={e => setQuickProductData({ ...quickProductData, purchasePrice: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '3px' }}>Pcs Per Carton</label>
                  <input 
                    type="number" 
                    className="input-field"
                    style={{ fontSize: '0.78rem', height: '30px', padding: '4px 8px' }}
                    placeholder="24"
                    value={quickProductData.pcsPerCarton}
                    onChange={e => setQuickProductData({ ...quickProductData, pcsPerCarton: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setQuickProductModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '5px 14px', fontSize: '0.76rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ background: '#059669', borderColor: '#059669', fontWeight: '700', padding: '5px 16px', fontSize: '0.76rem' }}
                >
                  Save & Add to Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Purchase Bill Details Modal */}
      {viewingPurchaseBill && (
        <div className="modal-overlay" style={{ zIndex: 1100, padding: '16px', alignItems: 'flex-start', overflowY: 'auto' }}>
          <div 
            className="modal-content" 
            style={{ 
              maxWidth: '960px', 
              width: '96%', 
              maxHeight: 'calc(100vh - 32px)', 
              margin: '16px auto',
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden' 
            }}
          >
            {/* Modal Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderBottom: '1px solid var(--border-color)', 
              padding: '10px 18px',
              background: '#f8fafc',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(5, 150, 105, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <Receipt size={17} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                    Purchase Inward Bill #{viewingPurchaseBill.billNo || viewingPurchaseBill.id}
                  </h3>
                  <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                    Recorded on {viewingPurchaseBill.createdAt ? new Date(viewingPurchaseBill.createdAt).toLocaleString('en-IN') : formatDateDDMMYY(viewingPurchaseBill.date)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingPurchaseBill(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px', 
              padding: '12px 18px',
              flex: '1 1 auto',
              overflowY: 'auto',
              minHeight: 0
            }}>
              {/* Supplier & Warehouse Metadata Grid - Compact */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                <div style={{ background: 'var(--surface-color)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '2px' }}>
                    Supplier / Party Details
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    {viewingPurchaseBill.partyName || 'Unknown Supplier'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {viewingPurchaseBill.partyGst && (
                      <span>GSTIN: <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{viewingPurchaseBill.partyGst}</strong></span>
                    )}
                    {viewingPurchaseBill.partyPhone && (
                      <span>Phone: <strong style={{ color: 'var(--text-main)' }}>{viewingPurchaseBill.partyPhone}</strong></span>
                    )}
                    {viewingPurchaseBill.partyAddress && (
                      <span>Address: <span style={{ color: 'var(--text-main)' }}>{viewingPurchaseBill.partyAddress}</span></span>
                    )}
                  </div>
                </div>

                <div style={{ background: 'var(--surface-color)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '2px' }}>
                    Bill & Warehouse Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px', fontSize: '0.74rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Bill Date: </span>
                      <strong style={{ color: 'var(--text-main)' }}>{formatDateDDMMYY(viewingPurchaseBill.date)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Bill Number: </span>
                      <strong style={{ color: 'var(--text-main)' }}>{viewingPurchaseBill.billNo || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Destination: </span>
                      <strong style={{ color: 'var(--text-main)' }}>
                        {viewingPurchaseBill.warehouseId === 'wh_store' ? 'Store Front Display' : 'Main Warehouse'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Total Products: </span>
                      <strong style={{ color: '#059669' }}>
                        {viewingPurchaseBill.items?.length || 0} Lines
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table with Dedicated Scroll Bar & Sticky Header */}
              <div style={{ 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 auto',
                minHeight: '180px',
                background: '#ffffff'
              }}>
                <div style={{ 
                  background: 'var(--surface-color)', 
                  padding: '6px 12px', 
                  borderBottom: '1px solid var(--border-color)', 
                  fontWeight: '700', 
                  fontSize: '0.75rem', 
                  color: 'var(--text-main)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0
                }}>
                  <span>Inward Products Breakdown</span>
                  <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                    Showing all {viewingPurchaseBill.items?.length || 0} items &bull; Scroll below to view all lines &darr;
                  </span>
                </div>
                
                {/* Scrollable Table Area with Visible Scrollbar */}
                <div style={{ 
                  overflowY: 'auto', 
                  overflowX: 'auto',
                  flex: '1 1 auto',
                  maxHeight: '380px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#94a3b8 #f1f5f9'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'center', width: '28px' }}>#</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', minWidth: '160px' }}>Product Name</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', width: '45px' }}>Qty</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', width: '65px' }}>MRP</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', width: '70px' }}>Sale Price</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center', width: '45px' }}>GST %</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', width: '80px' }}>Rate (Ex-GST)</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', width: '85px', color: '#0369a1' }}>Total (Ex-GST)</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', width: '80px' }}>Rate (+GST)</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', width: '85px', color: '#059669' }}>Total (+GST)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewingPurchaseBill.items || []).map((item, idx) => {
                        const q = Number(item.qty) || 0;
                        const ex = Number(item.purchasePrice) || 0;
                        const r = Number(item.gstRate !== undefined ? item.gstRate : 5);
                        const tEx = Number(item.totalExGst !== undefined ? item.totalExGst : (q * ex));
                        const withGstUnit = Number(item.purchasePriceWithGst || (ex * (1 + r / 100)));
                        const tWith = Number(item.totalWithGst !== undefined ? item.totalWithGst : (tEx * (1 + r / 100)));
                        return (
                          <tr 
                            key={idx} 
                            style={{ 
                              borderBottom: '1px solid var(--border-color)',
                              background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd'
                            }}
                          >
                            <td style={{ padding: '5px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '5px 8px' }}>
                              <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.74rem' }}>{item.name}</div>
                              {item.hsn && <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>HSN: {item.hsn}</div>}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: '700', color: 'var(--text-main)' }}>{q}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                              {item.mrp ? `₹${Number(item.mrp).toFixed(2)}` : '-'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>
                              {item.salePrice ? `₹${Number(item.salePrice).toFixed(2)}` : '-'}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>{r}%</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right' }}>₹{ex.toFixed(2)}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '600', color: '#0369a1' }}>
                              ₹{tEx.toFixed(2)}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right' }}>₹{withGstUnit.toFixed(2)}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>
                              ₹{tWith.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary - Compact */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                <div style={{ 
                  width: '260px', 
                  background: 'var(--surface-color)', 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border-color)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '4px' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    <span>Subtotal (Ex-GST):</span>
                    <strong style={{ color: 'var(--text-main)' }}>₹{Number(viewingPurchaseBill.totalAmountExGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    <span>Total GST Amount:</span>
                    <strong style={{ color: 'var(--text-main)' }}>₹{Number(viewingPurchaseBill.totalGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: '800', borderTop: '1px solid var(--border-color)', paddingTop: '4px', marginTop: '2px' }}>
                    <span style={{ color: 'var(--text-main)' }}>Grand Total:</span>
                    <span style={{ color: '#059669' }}>₹{Number(viewingPurchaseBill.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ 
              borderTop: '1px solid var(--border-color)', 
              padding: '10px 18px', 
              background: '#f8fafc',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handlePrintPurchaseBill(viewingPurchaseBill)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', padding: '6px 14px' }}
                >
                  <Printer size={15} />
                  <span>Print Bill</span>
                </button>

                {isPurchaseBillEditable(viewingPurchaseBill) && (
                  <button
                    type="button"
                    onClick={() => {
                      const b = viewingPurchaseBill;
                      setViewingPurchaseBill(null);
                      handleOpenEditPurchase(b);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      fontSize: '0.76rem', 
                      padding: '6px 14px', 
                      color: '#2563eb', 
                      borderColor: '#bfdbfe', 
                      background: '#eff6ff', 
                      fontWeight: '700' 
                    }}
                    title={getPurchaseBillRemainingEditTime(viewingPurchaseBill)}
                  >
                    <Edit3 size={15} />
                    <span>Edit Bill ({getPurchaseBillRemainingEditTime(viewingPurchaseBill)})</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setViewingPurchaseBill(null)}
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.76rem', padding: '6px 18px', background: '#059669', borderColor: '#059669' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inward Stock Lots & Multi-Purchase Rates Modal */}
      {selectedLotProduct && (() => {
        const prodVal = getProductStockValuation(selectedLotProduct.id);
        const activeLots = prodVal.lots || [];
        let allLots = (prodVal.allLots && prodVal.allLots.length > 0) ? prodVal.allLots : activeLots;

        // Direct fallback: check purchases list directly to guarantee NO inward purchase is missed
        if (allLots.length === 0) {
          const directBills = (purchases || []).filter(p => 
            Array.isArray(p.items) && p.items.some(it => isProductMatch(selectedLotProduct, it))
          );
          if (directBills.length > 0) {
            allLots = [];
            directBills.forEach(p => {
              (p.items || []).filter(it => isProductMatch(selectedLotProduct, it)).forEach((it, idx) => {
                const q = Number(it.qty) || 0;
                const pEx = Number(it.purchasePrice) || 0;
                const r = Number(it.gstRate !== undefined ? it.gstRate : (selectedLotProduct.gstRate || 5));
                const pWith = Number(it.purchasePriceWithGst) || (pEx * (1 + r / 100));
                allLots.push({
                  id: `lot_purch_${p.id}_${it.id || idx}`,
                  productId: selectedLotProduct.id,
                  productName: selectedLotProduct.name,
                  sku: selectedLotProduct.sku || '',
                  billNo: p.billNo || 'INWARD',
                  supplierName: p.partyName || 'Supplier',
                  date: p.date,
                  batchNo: it.batchNo || p.billNo || 'LOT-INWARD',
                  purchasePrice: pEx,
                  purchasePriceWithGst: pWith,
                  qtyReceived: q,
                  qtyRemaining: q,
                  gstRate: r
                });
              });
            });
          }
        }

        return (
          <div className="modal-overlay" style={{ zIndex: 1150, padding: '16px', alignItems: 'center', justifyContent: 'center' }}>
            <div 
              className="modal-content" 
              style={{ 
                maxWidth: '860px', 
                width: '100%', 
                maxHeight: '90vh', 
                display: 'flex', 
                flexDirection: 'column', 
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
              }}
            >
              {/* Header */}
              <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid var(--border-color)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)' 
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={20} color="#4f46e5" />
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
                      Inward Stock Lots & Original Purchase Rates
                    </h3>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Item: <strong style={{ color: 'var(--text-main)' }}>{selectedLotProduct.name}</strong> • SKU: <span style={{ color: '#4f46e5', fontWeight: '700' }}>{selectedLotProduct.sku}</span> • Total Stock: <strong>{selectedLotProduct.currentStock} {selectedLotProduct.unit || 'Pcs'}</strong>
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedLotProduct(null)} 
                  className="btn btn-secondary btn-sm"
                  style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* KPI Bar */}
              <div style={{ padding: '14px 20px', background: '#ffffff', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>WEIGHTED AVG COST (EX-GST)</span>
                  <strong style={{ fontSize: '1.15rem', color: '#1e293b' }}>₹{prodVal.avgUnitCostExGst.toFixed(2)}</strong>
                </div>
                <div style={{ background: '#ecfdf5', padding: '10px 12px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                  <span style={{ fontSize: '0.72rem', color: '#047857', display: 'block', fontWeight: '600' }}>WAC COST (WITH GST)</span>
                  <strong style={{ fontSize: '1.15rem', color: '#065f46' }}>₹{prodVal.avgUnitCostWithGst.toFixed(2)}</strong>
                </div>
                <div style={{ background: '#eff6ff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <span style={{ fontSize: '0.72rem', color: '#1d4ed8', display: 'block', fontWeight: '600' }}>TOTAL STOCK VALUATION</span>
                  <strong style={{ fontSize: '1.15rem', color: '#1e40af' }}>₹{prodVal.totalExGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ background: '#fef3c7', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <span style={{ fontSize: '0.72rem', color: '#b45309', display: 'block', fontWeight: '600' }}>INWARD BILLS / LOTS</span>
                  <strong style={{ fontSize: '1.15rem', color: '#92400e' }}>
                    {activeLots.length > 0 ? `${activeLots.length} Active Lots` : `${allLots.length} Inward Bills`}
                  </strong>
                  <div style={{ fontSize: '0.66rem', color: '#b45309', marginTop: '2px' }}>
                    {allLots.length} Total Recorded Bills
                  </div>
                </div>
              </div>

              {/* Table Body */}
              <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    Detailed Inward Batches & FIFO Consumption Queue
                  </h4>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    * Oldest lots are consumed first during sales (FIFO)
                  </span>
                </div>

                {allLots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '8px' }}>
                    No specific purchase bill lots recorded yet for this product. Valuing from catalog standard purchase price.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '10px 12px' }}>Date</th>
                          <th style={{ padding: '10px 12px' }}>Bill # / Ref</th>
                          <th style={{ padding: '10px 12px' }}>Supplier / Inward</th>
                          <th style={{ padding: '10px 12px' }}>Batch No</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Orig. Cost (Ex-GST)</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Cost (w/ GST)</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Inward Qty</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Remaining Qty</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Lot Valuation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allLots.map((lot, idx) => {
                          const lotVal = (Number(lot.qtyRemaining) || 0) * (Number(lot.purchasePrice) || 0);
                          const isExhausted = Number(lot.qtyRemaining) <= 0;

                          return (
                            <tr key={lot.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx === 0 && !isExhausted ? 'rgba(79, 70, 229, 0.03)' : '#ffffff' }}>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: '600' }}>{formatDateDDMMYY(lot.date)}</div>
                                {idx === 0 && !isExhausted && <span className="badge badge-primary" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>Next in Line (FIFO)</span>}
                                {isExhausted && <span className="badge badge-secondary" style={{ fontSize: '0.62rem', padding: '1px 5px', background: '#94a3b8', color: '#fff' }}>Consumed</span>}
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--primary)' }}>
                                {lot.billNo || 'INWARD'}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <div>{lot.supplierName || 'Opening Stock'}</div>
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                                {lot.batchNo || 'N/A'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#1e293b' }}>
                                ₹{Number(lot.purchasePrice || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669', fontWeight: '600' }}>
                                ₹{Number(lot.purchasePriceWithGst || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                {lot.qtyReceived}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: isExhausted ? '#94a3b8' : '#2563eb' }}>
                                {isExhausted ? `0 ${selectedLotProduct.unit || 'Pcs'}` : `${lot.qtyRemaining} ${selectedLotProduct.unit || 'Pcs'}`}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: isExhausted ? '#94a3b8' : '#0f172a' }}>
                                {isExhausted ? '₹0.00 (Consumed)' : `₹${lotVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeLots.length === 0 && allLots.length > 0 && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fef3c7', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '0.76rem', color: '#92400e' }}>
                    ℹ️ Note: Previous purchase bill quantities were fully allocated & consumed in sales (FIFO). Current closing stock is valued based on the product standard catalog purchase rate.
                  </div>
                )}

                <div style={{ marginTop: '14px', padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#1e40af' }}>
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Exact Purchase Cost Rule:</strong> Whenever a sale is generated, stock is consumed from these lots in chronological order (FIFO). If a product was bought at ₹100 in Bill #1 and ₹120 in Bill #2, your Profit & Loss, Balance Sheet, and Gross Margin are computed directly from these original purchase rates!
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setSelectedLotProduct(null)} 
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px 20px', fontWeight: '700' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
