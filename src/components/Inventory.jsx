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
  transferStockBetweenWarehouses, 
  logAuditAction 
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
  FileText
} from 'lucide-react';

export default function Inventory({ products, refreshAllData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [expiryFilter, setExpiryFilter] = useState('ALL'); // 'ALL', 'EXPIRING_SOON', 'EXPIRED'
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

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
    salePrice: '',
    gstRate: 5,
    purchasePrice: '', // without GST
    purchasePriceWithGst: '', // with GST
    qty: 1
  });

  const [purchaseRows, setPurchaseRows] = useState([emptyPurchaseRow()]);

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
    cartonsStock: '',
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
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      loosePcsStock: 0,
      currentStock: 0
    });
    setProductModalOpen(true);
  };

  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod);
    const pcsPerCtn = Number(prod.pcsPerCarton) || 24;
    const stock = Number(prod.currentStock) || 0;
    const ctn = Math.floor(stock / pcsPerCtn);
    const loose = stock % pcsPerCtn;

    setFormData({
      ...prod,
      pcsPerCarton: pcsPerCtn,
      cartonsStock: ctn,
      loosePcsStock: loose,
      currentStock: stock
    });
    setProductModalOpen(true);
  };

  const handleSaveProductForm = (e) => {
    e.preventDefault();
    const pcsPerCtn = Number(formData.pcsPerCarton) || 24;
    const ctn = Number(formData.cartonsStock) || 0;
    const loose = Number(formData.loosePcsStock) || 0;
    const calculatedTotalStock = (ctn * pcsPerCtn) + loose;

    const payload = {
      ...formData,
      mrp: Number(formData.mrp) || 0,
      salePrice: Number(formData.salePrice) || 0,
      purchasePrice: Number(formData.purchasePrice) || 0,
      gstRate: Number(formData.gstRate) || 0,
      pcsPerCarton: pcsPerCtn,
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
    const rate = Number(prod.gstRate) || 0;
    const withGst = Number((exGst * (1 + rate / 100)).toFixed(2));

    setPurchaseRows(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        brand: prod.brand,
        category: prod.category,
        mrp: prod.mrp || '',
        hsn: prod.hsn || '',
        salePrice: prod.salePrice || '',
        gstRate: rate,
        purchasePrice: exGst || '',
        purchasePriceWithGst: withGst || '',
        qty: updated[index].qty || 1,
        pcsPerCarton: prod.pcsPerCarton || 24
      };
      return updated;
    });
  };

  const handleRowFieldChange = (index, field, value) => {
    setPurchaseRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      if (field === 'purchasePrice') {
        const exGst = parseFloat(value);
        const rate = Number(row.gstRate) || 0;
        row.purchasePriceWithGst = (value === '' || isNaN(exGst)) ? '' : Number((exGst * (1 + rate / 100)).toFixed(2));
      } else if (field === 'purchasePriceWithGst') {
        const withGst = parseFloat(value);
        const rate = Number(row.gstRate) || 0;
        row.purchasePrice = (value === '' || isNaN(withGst)) ? '' : Number((withGst / (1 + rate / 100)).toFixed(2));
      } else if (field === 'gstRate') {
        const rate = Number(value) || 0;
        const exGst = parseFloat(row.purchasePrice);
        if (!isNaN(exGst) && row.purchasePrice !== '') {
          row.purchasePriceWithGst = Number((exGst * (1 + rate / 100)).toFixed(2));
        }
      }

      updated[index] = row;
      return updated;
    });
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

    const totalExGst = validItems.reduce((sum, r) => sum + ((Number(r.qty) || 0) * (Number(r.purchasePrice) || 0)), 0);
    const totalWithGst = validItems.reduce((sum, r) => sum + ((Number(r.qty) || 0) * (Number(r.purchasePriceWithGst) || 0)), 0);
    const totalGst = Math.max(0, totalWithGst - totalExGst);

    const purchasePayload = {
      partyName: purchaseHeader.partyName.trim(),
      partyGst: purchaseHeader.partyGst.trim(),
      date: purchaseHeader.date,
      billNo: purchaseHeader.billNo.trim(),
      warehouseId: purchaseHeader.warehouseId,
      items: validItems,
      totalAmountExGst: Number(totalExGst.toFixed(2)),
      totalGst: Number(totalGst.toFixed(2)),
      grandTotal: Number(totalWithGst.toFixed(2))
    };

    savePurchase(purchasePayload);
    refreshAllData();
    alert(`✅ Purchase bill recorded successfully! Stock inventory updated for ${validItems.length} products.`);
    setPurchaseModalOpen(false);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
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
              Total Stock Valuation (Cost Ex-GST): <strong style={{ color: 'var(--text-main)' }}>₹{filteredProducts.reduce((sum, p) => sum + ((Number(p.currentStock) || 0) * (Number(p.purchasePrice) || 0)), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
            </span>
            <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: '700' }}>
              Valuation (With GST): ₹{filteredProducts.reduce((sum, p) => sum + ((Number(p.currentStock) || 0) * ((Number(p.purchasePrice) || 0) * (1 + (Number(p.gstRate) || 0) / 100))), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 10px' }}>Product Details</th>
                <th style={{ padding: '12px 10px' }}>Batch & Expiry</th>
                <th style={{ padding: '12px 10px' }}>Warehouse</th>
                <th style={{ padding: '12px 10px' }}>MRP</th>
                <th style={{ padding: '12px 10px' }}>Sale Price</th>
                <th style={{ padding: '12px 10px' }}>Cost Price</th>
                <th style={{ padding: '12px 10px' }}>GST %</th>
                <th style={{ padding: '12px 10px', color: '#047857', fontWeight: '700' }}>Purchase Price (w/ GST)</th>
                <th style={{ padding: '12px 10px' }}>Current Stock</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(prod => {
                  const isLow = prod.currentStock <= (prod.minStockLimit || 10);
                  const expInfo = getExpiryStatus(prod.expiryDate);
                  const whObj = warehouses.find(w => w.id === prod.warehouseId) || warehouses[0];
                  const pPrice = Number(prod.purchasePrice) || 0;
                  const gRate = Number(prod.gstRate) || 0;
                  const purchaseWithGst = pPrice * (1 + gRate / 100);

                  return (
                    <tr key={prod.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{prod.name}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          Brand: {prod.brand || 'N/A'} • SKU: <span style={{ color: 'var(--primary)' }}>{prod.sku}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.78rem' }}>{prod.batchNo || 'LOT-MAIN'}</div>
                        {prod.expiryDate ? (
                          <div style={{ marginTop: '3px' }}>
                            <span className={`badge ${expInfo.status === 'EXPIRED' ? 'badge-danger' : expInfo.status === 'EXPIRING_SOON' ? 'badge-warning' : 'badge-secondary'}`} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                              {expInfo.status === 'EXPIRED' ? `Expired (${prod.expiryDate})` : expInfo.status === 'EXPIRING_SOON' ? `Exp in ${expInfo.daysLeft}d` : `Exp: ${prod.expiryDate}`}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>N/A</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                          {whObj?.name || 'Main Godown'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: '600' }}>₹{prod.mrp}</td>
                      <td style={{ padding: '12px 10px', fontWeight: '700', color: 'var(--primary)' }}>₹{prod.salePrice}</td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>
                        <div>₹{prod.purchasePrice}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ex-GST</div>
                      </td>
                      <td style={{ padding: '12px 10px' }}>{prod.gstRate}%</td>
                      <td style={{ padding: '12px 10px', fontWeight: '700', color: '#047857' }}>
                        <div>₹{purchaseWithGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.69rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                          +₹{((pPrice * gRate) / 100).toFixed(2)} tax
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                          {formatCartonStock(prod.currentStock, prod.pcsPerCarton)}
                        </span>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Total: {prod.currentStock} {prod.unit || 'Pcs'} ({prod.pcsPerCarton || 24} Pcs/Ctn)
                        </div>
                        {isLow && (
                          <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '2px', fontWeight: '700' }}>Low Warning</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button 
                            onClick={() => handleOpenStockIn(prod)}
                            className="btn btn-secondary btn-sm"
                            title="Add Stock (Stock In)"
                            style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', fontWeight: '700' }}
                          >
                            <ArrowDownCircle size={14} />
                            <span>+ Stock</span>
                          </button>

                          <button 
                            onClick={() => handleOpenEditModal(prod)}
                            className="btn btn-secondary btn-sm"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button 
                            onClick={() => handleDelete(prod.id, prod.name)}
                            className="btn btn-danger btn-sm"
                            title="Delete"
                          >
                            <Trash2 size={14} />
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
                  <label className="form-label">SKU / Barcode *</label>
                  <input 
                    type="text" 
                    className="input-field"
                    required
                    placeholder="e.g. PRL-G-100G"
                    value={formData.sku}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                  />
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
                </div>

                <div className="form-group">
                  <label className="form-label">Unit of Measure *</label>
                  <select 
                    className="input-field select-field"
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Box">Box</option>
                    <option value="Carton">Carton</option>
                    <option value="Pack">Pack</option>
                    <option value="Kg">Kg</option>
                    <option value="Litre">Litre</option>
                  </select>
                </div>

                {/* Carton & Loose Pieces Stock Input Section */}
                <div className="form-group" style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <label className="form-label" style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                    📦 Initial Stock Details (Carton & Loose Pieces Stock)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '8px' }}>
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
                          const pcsPerCtn = Number(formData.pcsPerCarton) || 24;
                          const loose = Number(formData.loosePcsStock) || 0;
                          setFormData({
                            ...formData,
                            cartonsStock: ctn,
                            currentStock: (ctnNum * pcsPerCtn) + loose
                          });
                        }}
                      />
                    </div>

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
                          const pcsPerCtn = Number(formData.pcsPerCarton) || 24;
                          const ctn = Number(formData.cartonsStock) || 0;
                          setFormData({
                            ...formData,
                            loosePcsStock: loose,
                            currentStock: (ctn * pcsPerCtn) + looseNum
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
                  <span>Add New Purchase (Inward Stock Entry)</span>
                </h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Record vendor purchase invoice, auto-calculate purchase price with GST, and increment inventory stock.
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    📦 Purchase Item Lines ({purchaseRows.length} {purchaseRows.length === 1 ? 'row' : 'rows'})
                  </span>
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
                        <th style={{ padding: '6px 4px', width: '28px', textAlign: 'center' }}>#</th>
                        <th style={{ padding: '6px 5px', minWidth: '190px' }}>PRODUCT *</th>
                        <th style={{ padding: '6px 5px', width: '80px' }}>MRP (₹)</th>
                        <th style={{ padding: '6px 5px', width: '75px' }}>HSN</th>
                        <th style={{ padding: '6px 5px', width: '90px' }}>SELLING PRICE (₹)</th>
                        <th style={{ padding: '6px 5px', width: '75px' }}>RATE OF GST</th>
                        <th style={{ padding: '6px 5px', width: '110px' }}>PURCHASE PRICE W/O GST</th>
                        <th style={{ padding: '6px 5px', width: '115px', color: '#047857', fontWeight: '700' }}>PURCHASE PRICE WITH GST</th>
                        <th style={{ padding: '6px 5px', width: '70px' }}>QUANTITY</th>
                        <th style={{ padding: '6px 6px', width: '90px', textAlign: 'right' }}>LINE TOTAL</th>
                        <th style={{ padding: '6px 2px', width: '30px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseRows.map((row, idx) => {
                        const lineTotal = (Number(row.qty) || 0) * (Number(row.purchasePriceWithGst) || 0);

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
                                    const matched = products.find(p => (p.name || '').toLowerCase() === val.toLowerCase());
                                    if (matched) {
                                      handleProductSelect(idx, matched.id);
                                    }
                                    setActiveProductRowId(row.id);
                                    setHighlightedProductIndex(0);
                                  }}
                                  onKeyDown={e => {
                                    const query = (row.name || '').trim().toLowerCase();
                                    const matching = products.filter(p => 
                                      !query || 
                                      (p.name && p.name.toLowerCase().includes(query)) || 
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
                                style={{ fontSize: '0.72rem', padding: '2px 3px', height: '27px' }}
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
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
                                required
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
                              />
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

                            {/* Line Total */}
                            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)', fontSize: '0.74rem' }}>
                              ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                const totalEx = purchaseRows.reduce((sum, r) => sum + ((Number(r.qty) || 0) * (Number(r.purchasePrice) || 0)), 0);
                const totalWith = purchaseRows.reduce((sum, r) => sum + ((Number(r.qty) || 0) * (Number(r.purchasePriceWithGst) || 0)), 0);
                const totalGstAmt = Math.max(0, totalWith - totalEx);
                const totalQtyPcs = purchaseRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);

                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div>
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL ITEMS</span>
                        <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>{purchaseRows.filter(r => r.name).length} Products</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL QUANTITY</span>
                        <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>{totalQtyPcs} Pcs</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL (EX-GST)</span>
                        <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>₹{totalEx.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL GST</span>
                        <strong style={{ fontSize: '0.84rem', color: '#0284c7' }}>₹{totalGstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{ paddingLeft: '12px', borderLeft: '2px solid #cbd5e1' }}>
                        <span style={{ fontSize: '0.66rem', color: '#047857', display: 'block', fontWeight: '700' }}>GRAND TOTAL (WITH GST)</span>
                        <strong style={{ fontSize: '0.98rem', color: '#059669', fontWeight: '800' }}>₹{totalWith.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
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
                <span>Save Purchase & Update Stock</span>
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

    </div>
  );
}
