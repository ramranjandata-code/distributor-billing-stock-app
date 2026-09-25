import React, { useState, useEffect, useRef } from 'react';
import { saveInvoice, saveParty, saveProduct, formatCartonStock, fetchWarehouses, getCurrentOperator, calculateDueDate } from '../utils/storage';
import { generateUpiQrDataUrl, buildInvoiceShareText, buildWhatsAppUrl } from '../utils/qrUtils';
import { calculateBillTotals, detectSupplyType } from '../utils/taxUtils';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Receipt, 
  User, 
  UserPlus, 
  X, 
  Save, 
  CheckCircle, 
  IndianRupee, 
  ShoppingBag, 
  CreditCard, 
  Building, 
  Printer, 
  Percent, 
  Tag, 
  Barcode, 
  Truck, 
  QrCode, 
  Send, 
  Zap, 
  LayoutGrid, 
  Layers, 
  Sparkles,
  Calculator,
  ShieldCheck,
  FileText,
  PlusCircle,
  ChevronDown
} from 'lucide-react';

export default function Billing({ products, parties, business, refreshAllData, handlePrintInvoice, setActiveTab, onRegisterNavigationGuard }) {
  // Check for saved active billing draft in progress so navigation or reload doesn't wipe work
  const getInitialDraft = () => {
    try {
      const raw = localStorage.getItem('distro_active_billing_draft');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.cart) && parsed.cart.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn('Error reading active billing draft:', e);
    }
    return null;
  };

  const initialDraft = getInitialDraft();

  const [cart, setCart] = useState(() => initialDraft?.rawCart || initialDraft?.cart || []);
  const [selectedPartyId, setSelectedPartyId] = useState(() => initialDraft?.selectedPartyId || '');
  const [customerName, setCustomerName] = useState(() => initialDraft?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(() => initialDraft?.customerPhone || '');
  const [pricingType, setPricingType] = useState(() => initialDraft?.pricingType || 'INCLUSIVE'); // 'EXCLUSIVE' (Rate + GST Extra) or 'INCLUSIVE' (MRP)
  const [taxMode, setTaxMode] = useState(() => initialDraft?.taxMode || 'INTRA'); // 'INTRA' (CGST + SGST), 'INTER' (IGST), 'NONE' (0%)
  const [roundOffEnabled, setRoundOffEnabled] = useState(() => initialDraft?.roundOffEnabled !== undefined ? initialDraft.roundOffEnabled : true);

  // Enterprise POS & Barcode State
  const [posMode, setPosMode] = useState('STANDARD'); // 'STANDARD' or 'FAST_TOUCH'
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeScanAlert, setBarcodeScanAlert] = useState(null);
  const barcodeInputRef = useRef(null);

  // Multi-Warehouse Source
  const warehouses = fetchWarehouses();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(() => initialDraft?.selectedWarehouseId || warehouses[0]?.id || 'wh_main');

  // Payment Terms & Due Date
  const [paymentTerms, setPaymentTerms] = useState(() => initialDraft?.paymentTerms || 'immediate');
  const invoiceDate = new Date().toISOString().split('T')[0];
  const computedDueDate = calculateDueDate(invoiceDate, paymentTerms);

  // e-Way Bill & Transport State
  const [ewayBillOpen, setEwayBillOpen] = useState(() => !!initialDraft?.ewayBillOpen);
  const [ewayBillData, setEwayBillData] = useState(() => initialDraft?.ewayBillData || {
    transporterName: '',
    vehicleNo: '',
    distanceKm: '',
    ewayBillNo: ''
  });

  // Track draft invoice reference so saving updates instead of duplicating
  const [activeDraftId, setActiveDraftId] = useState(() => initialDraft?.draftInvoiceId || null);
  const [activeDraftNo, setActiveDraftNo] = useState(() => initialDraft?.draftInvoiceNo || null);
  const [showDraftNotice, setShowDraftNotice] = useState(() => !!(initialDraft && initialDraft.cart?.length > 0));

  // Digital Payments & Instant Share Modal
  const [checkoutModal, setCheckoutModal] = useState(null); // holds { invoice, upiQrUrl }
  
  // Party Search & Add Party Modal State
  const [partySearchTerm, setPartySearchTerm] = useState('');
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);
  const [upperPartySearchTerm, setUpperPartySearchTerm] = useState(() => initialDraft?.upperPartySearchTerm || '');
  const [showUpperPartySuggestions, setShowUpperPartySuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const customerSearchContainerRef = useRef(null);
  const [partyModalOpen, setPartyModalOpen] = useState(false);

  // Product Search Dropdown & Quick Add Product Modal State
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const productSearchContainerRef = useRef(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const initialNewProductState = {
    name: '',
    sku: '',
    barcode: '',
    brand: '',
    category: 'General',
    unit: 'Pcs',
    pcsPerCarton: 24,
    salePrice: '',
    mrp: '',
    purchasePrice: '',
    gstRate: 18,
    currentStock: 100
  };
  const [newProductData, setNewProductData] = useState(initialNewProductState);
  const initialNewPartyState = {
    name: '',
    contactPerson: '',
    phone: '',
    city: '',
    address: '',
    gstin: '',
    creditLimit: 50000,
    balance: 0
  };
  const [newPartyData, setNewPartyData] = useState(initialNewPartyState);

  // Overall Bill Discount
  const [discountType, setDiscountType] = useState(() => initialDraft?.discountType || 'AMOUNT'); // 'AMOUNT' (₹) or 'PERCENT' (%)
  const [discountValue, setDiscountValue] = useState(() => initialDraft?.discountValue || 0);

  const [paymentStatus, setPaymentStatus] = useState(() => initialDraft?.paymentStatus || 'PAID'); // PAID, UNPAID, PARTIAL
  const [paidAmount, setPaidAmount] = useState(() => initialDraft?.paidAmount || '');
  const [paymentMode, setPaymentMode] = useState(() => initialDraft?.paymentMode || 'CASH'); // CASH, UPI, NEFT, CHEQUE
  const [notes, setNotes] = useState(() => initialDraft?.notes || '');

  const [searchTerm, setSearchTerm] = useState('');

  // Selected party object
  const selectedParty = parties.find(p => p.id === selectedPartyId);

  // Auto-detect supply type (Intra vs Inter) based on Seller and Buyer GSTIN state codes
  useEffect(() => {
    if (selectedParty && selectedParty.gstin && business?.gstin) {
      const autoSupply = detectSupplyType(business.gstin, selectedParty.gstin);
      setTaxMode(autoSupply);
    }
  }, [selectedPartyId, business]);

  // Auto-focus barcode input when switching to Fast POS mode
  useEffect(() => {
    if (posMode === 'FAST_TOUCH' && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [posMode]);

  // Auto-close customer & product dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerSearchContainerRef.current && !customerSearchContainerRef.current.contains(event.target)) {
        setShowUpperPartySuggestions(false);
      }
      if (productSearchContainerRef.current && !productSearchContainerRef.current.contains(event.target)) {
        setShowProductSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick Barcode Scanning Handler
  const handleBarcodeScan = (e) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const matchedProduct = products.find(p => 
      (p.sku && p.sku.toLowerCase() === code.toLowerCase()) ||
      (p.id && p.id.toLowerCase() === code.toLowerCase()) ||
      (p.name && p.name.toLowerCase() === code.toLowerCase())
    );

    if (matchedProduct) {
      handleAddToCart(matchedProduct);
      setBarcodeScanAlert(`✅ Added: ${matchedProduct.name}`);
      setTimeout(() => setBarcodeScanAlert(null), 2000);
      setBarcodeInput('');
    } else {
      setBarcodeScanAlert(`❌ No item found for code: "${code}"`);
      setTimeout(() => setBarcodeScanAlert(null), 2500);
      setBarcodeInput('');
    }
  };

  // 1-Click Walk-in Counter Sale filler
  const handleWalkInCounterSale = () => {
    setSelectedPartyId('');
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
    setPartySearchTerm('');
    setUpperPartySearchTerm('Walk-in Customer');
    setShowPartySuggestions(false);
    setShowUpperPartySuggestions(false);
    setPaymentStatus('PAID');
    setPaymentMode('CASH');
  };

  // Filter parties for live search suggestions inside Customer Name input
  const filteredParties = parties.filter(p => {
    const term = (partySearchTerm || customerName).toLowerCase();
    if (!term) return true;
    return (
      p.name.toLowerCase().includes(term) ||
      (p.phone && p.phone.includes(term)) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(term)) ||
      (p.address && p.address.toLowerCase().includes(term)) ||
      (p.city && p.city.toLowerCase().includes(term))
    );
  });

  // Filter parties for upper customer search bar
  const filteredPartiesForUpper = parties.filter(p => {
    const term = (upperPartySearchTerm || '').trim().toLowerCase();
    if (!term) return true;
    return (
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.phone && p.phone.includes(term)) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(term)) ||
      (p.city && p.city.toLowerCase().includes(term)) ||
      (p.address && p.address.toLowerCase().includes(term)) ||
      (p.gstin && p.gstin.toLowerCase().includes(term))
    );
  });

  const handleSelectPartyFromList = (p) => {
    if (p) {
      setSelectedPartyId(p.id);
      setCustomerName(p.name);
      setCustomerPhone(p.phone || '');
      setPartySearchTerm(p.name);
      setUpperPartySearchTerm(p.name);
    } else {
      setSelectedPartyId('');
      setCustomerName('');
      setCustomerPhone('');
      setPartySearchTerm('');
      setUpperPartySearchTerm('');
    }
    setShowPartySuggestions(false);
    setShowUpperPartySuggestions(false);
  };

  const handleSaveNewParty = (e) => {
    e.preventDefault();
    if (!newPartyData.name || !newPartyData.phone) {
      alert('⚠️ Please enter retailer/store name and mobile number!');
      return;
    }

    const payload = {
      ...newPartyData,
      creditLimit: Number(newPartyData.creditLimit) || 0,
      balance: Number(newPartyData.balance) || 0
    };

    const savedParty = saveParty(payload);
    refreshAllData();

    if (savedParty && savedParty.id) {
      handleSelectPartyFromList(savedParty);
    }

    setPartyModalOpen(false);
    setNewPartyData(initialNewPartyState);
  };

  // Filter products for quick search & dropdown suggestions
  const filteredProducts = products.filter(p => {
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return true;
    return (
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.sku && p.sku.toLowerCase().includes(term)) ||
      (p.barcode && p.barcode.toLowerCase().includes(term)) ||
      (p.brand && p.brand.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  });

  const handleAddToCart = (product) => {
    if (product.currentStock <= 0) {
      alert(`⚠️ '${product.name}' is out of stock!`);
      return;
    }

    const pcsPerCtn = Number(product.pcsPerCarton) || 24;
    const existingIndex = cart.findIndex(item => item.productId === product.id);

    if (existingIndex > -1) {
      const existing = cart[existingIndex];
      const newQty = existing.qty + 1;
      if (newQty > product.currentStock) {
        alert(`⚠️ Maximum stock limit (${formatCartonStock(product.currentStock, pcsPerCtn)}) reached!`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].qty = newQty;
      updated[existingIndex].cartonQty = Math.floor(newQty / pcsPerCtn);
      updated[existingIndex].looseQty = newQty % pcsPerCtn;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          hsn: product.hsn,
          pcsPerCarton: pcsPerCtn,
          cartonQty: 0,
          looseQty: 1,
          qty: 1,
          unit: product.unit,
          price: product.salePrice,
          mrp: product.mrp,
          gstRate: product.gstRate,
          maxStock: product.currentStock,
          itemDiscountType: 'AMOUNT', // 'AMOUNT' (₹ per item) or 'PERCENT' (%)
          itemDiscountVal: 0
        }
      ]);
    }
  };

  // Product Search Bar keyboard navigation (Arrow keys, Enter, Escape) and Barcode Scan handler
  const handleProductSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredProducts.length > 0) {
        setHighlightedProductIndex(prev => (prev + 1) % filteredProducts.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredProducts.length > 0) {
        setHighlightedProductIndex(prev => (prev - 1 + filteredProducts.length) % filteredProducts.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showProductSuggestions && filteredProducts.length > 0 && filteredProducts[highlightedProductIndex]) {
        const prod = filteredProducts[highlightedProductIndex];
        if (prod.currentStock <= 0) {
          alert(`⚠️ '${prod.name}' is out of stock!`);
          return;
        }
        handleAddToCart(prod);
        setBarcodeScanAlert(`✅ Added: ${prod.name}`);
        setTimeout(() => setBarcodeScanAlert(null), 2500);
        setShowProductSuggestions(false);
      } else {
        const code = searchTerm.trim();
        if (!code) return;

        const matchedProduct = products.find(p => 
          (p.sku && p.sku.toLowerCase() === code.toLowerCase()) ||
          (p.barcode && p.barcode.toLowerCase() === code.toLowerCase()) ||
          (p.id && p.id.toLowerCase() === code.toLowerCase()) ||
          (p.name && p.name.toLowerCase() === code.toLowerCase())
        );

        if (matchedProduct) {
          handleAddToCart(matchedProduct);
          setBarcodeScanAlert(`✅ Added: ${matchedProduct.name}`);
          setTimeout(() => setBarcodeScanAlert(null), 2500);
          setSearchTerm('');
          setShowProductSuggestions(false);
        } else {
          setBarcodeScanAlert(`❌ No item found matching: "${code}"`);
          setTimeout(() => setBarcodeScanAlert(null), 2500);
        }
      }
    } else if (e.key === 'Escape') {
      setShowProductSuggestions(false);
    }
  };

  // Quick Save New Product handler
  const handleSaveNewProduct = (e) => {
    e.preventDefault();
    if (!newProductData.name) {
      alert('⚠️ Please enter product name!');
      return;
    }

    const saleRate = Number(newProductData.salePrice) || 0;
    const mrpRate = Number(newProductData.mrp) || saleRate;
    const purchaseRate = Number(newProductData.purchasePrice) || (saleRate * 0.8);
    const stockQty = Number(newProductData.currentStock) || 0;
    const pcsPerCtn = Number(newProductData.pcsPerCarton) || 24;

    const payload = {
      ...newProductData,
      salePrice: saleRate,
      mrp: mrpRate,
      purchasePrice: purchaseRate,
      currentStock: stockQty,
      pcsPerCarton: pcsPerCtn
    };

    const res = saveProduct(payload);
    if (refreshAllData) refreshAllData();

    const savedProd = Array.isArray(res) ? res[0] : res;
    if (savedProd && savedProd.name) {
      handleAddToCart(savedProd);
      setBarcodeScanAlert(`✅ Created & Added: ${savedProd.name}`);
      setTimeout(() => setBarcodeScanAlert(null), 2500);
    }

    setProductModalOpen(false);
    setNewProductData(initialNewProductState);
    setShowProductSuggestions(false);
  };

  const handleUpdateQty = (index, delta) => {
    const updated = [...cart];
    const item = updated[index];
    const pcsPerCtn = Number(item.pcsPerCarton) || 24;
    const newQty = item.qty + delta;

    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    if (newQty > item.maxStock) {
      alert(`⚠️ Maximum available stock is ${formatCartonStock(item.maxStock, pcsPerCtn)} (${item.maxStock} Pcs)!`);
      return;
    }

    item.qty = newQty;
    item.cartonQty = Math.floor(newQty / pcsPerCtn);
    item.looseQty = newQty % pcsPerCtn;
    setCart(updated);
  };

  const handleCartonQtyChange = (index, cartonVal) => {
    const updated = [...cart];
    const item = updated[index];
    const ctn = Math.max(0, parseInt(cartonVal) || 0);
    const pcsPerCtn = Number(item.pcsPerCarton) || 24;
    const loose = Number(item.looseQty) || 0;
    const newTotal = (ctn * pcsPerCtn) + loose;

    if (newTotal > item.maxStock) {
      alert(`⚠️ Maximum available stock is ${formatCartonStock(item.maxStock, pcsPerCtn)} (${item.maxStock} Pcs)!`);
      return;
    }

    item.cartonQty = ctn;
    item.qty = newTotal;
    setCart(updated);
  };

  const handleLooseQtyChange = (index, looseVal) => {
    const updated = [...cart];
    const item = updated[index];
    const loose = Math.max(0, parseInt(looseVal) || 0);
    const pcsPerCtn = Number(item.pcsPerCarton) || 24;
    const ctn = Number(item.cartonQty) || 0;
    const newTotal = (ctn * pcsPerCtn) + loose;

    if (newTotal > item.maxStock) {
      alert(`⚠️ Maximum available stock is ${formatCartonStock(item.maxStock, pcsPerCtn)} (${item.maxStock} Pcs)!`);
      return;
    }

    item.looseQty = loose;
    item.qty = newTotal;
    setCart(updated);
  };

  const handleItemPriceChange = (index, newPrice) => {
    const updated = [...cart];
    updated[index].price = Number(newPrice) || 0;
    setCart(updated);
  };

  const handleItemDiscountChange = (index, newDiscountVal) => {
    const updated = [...cart];
    updated[index].itemDiscountVal = Number(newDiscountVal) || 0;
    setCart(updated);
  };

  const handleToggleItemDiscountType = (index) => {
    const updated = [...cart];
    updated[index].itemDiscountType = updated[index].itemDiscountType === 'AMOUNT' ? 'PERCENT' : 'AMOUNT';
    setCart(updated);
  };

  const handleRemoveItem = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Centralized GST & Billing Calculations Engine
  const billCalc = calculateBillTotals({
    cartItems: cart,
    taxType: pricingType, // 'EXCLUSIVE' (Wholesale: Rate + GST on top) or 'INCLUSIVE' (MRP includes GST)
    supplyType: taxMode === 'NONE' ? 'EXEMPT' : taxMode,
    overallDiscountVal: discountValue,
    overallDiscountType: discountType,
    roundOffEnabled: roundOffEnabled
  });

  const processedCartItems = billCalc.processedItems;
  const grossSubTotal = billCalc.grossSubtotal;
  const itemDiscountsTotal = billCalc.itemDiscountsTotal;
  const overallDiscountAmt = billCalc.billDiscountAmount;
  const taxableSubtotal = billCalc.taxableSubtotal;
  const taxTotal = billCalc.taxTotal;
  const cgst = billCalc.cgst;
  const sgst = billCalc.sgst;
  const igst = billCalc.igst;
  const roundOff = billCalc.roundOff;
  const grandTotal = billCalc.grandTotal;

  // Compatibility helper for rendering individual row totals
  const getItemDetails = (item) => {
    const found = processedCartItems.find(p => p.productId === item.productId);
    if (found) {
      return {
        grossTotal: found.grossTotal,
        itemDiscAmount: found.discAmount,
        netInclusiveTotal: found.total,
        netTaxable: found.taxableAmount,
        gstVal: found.itemGstAmount,
        finalItemTotal: found.total
      };
    }
    return {
      grossTotal: 0,
      itemDiscAmount: 0,
      netInclusiveTotal: 0,
      netTaxable: 0,
      gstVal: 0,
      finalItemTotal: 0
    };
  };

  const handlePartySelect = (e) => {
    const pId = e.target.value;
    setSelectedPartyId(pId);
    if (pId) {
      const p = parties.find(pt => pt.id === pId);
      if (p) {
        setCustomerName(p.name);
        setCustomerPhone(p.phone);
      }
    } else {
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  const handleSaveAndPrintBill = (asDraft = false, silent = false) => {
    if (cart.length === 0) {
      if (!silent) alert('⚠️ Please add at least 1 product to the bill!');
      return null;
    }

    const partyNameFinal = selectedParty ? selectedParty.name : (customerName || 'Cash Customer');
    const partyPhoneFinal = selectedParty ? selectedParty.phone : customerPhone;
    const partyGstinFinal = selectedParty ? selectedParty.gstin : '';
    const partyAddressFinal = selectedParty ? (selectedParty.address || selectedParty.city || '') : '';

    let actualPaid = grandTotal;
    let balanceAmt = 0;

    if (asDraft) {
      actualPaid = 0;
      balanceAmt = grandTotal;
    } else if (paymentStatus === 'UNPAID') {
      actualPaid = 0;
      balanceAmt = grandTotal;
    } else if (paymentStatus === 'PARTIAL') {
      actualPaid = Number(paidAmount) || 0;
      balanceAmt = Math.max(0, grandTotal - actualPaid);
    }

    const totalDiscountCombined = itemDiscountsTotal + overallDiscountAmt;

    const invoicePayload = {
      id: activeDraftId || undefined,
      invoiceNo: activeDraftNo || undefined,
      partyId: selectedPartyId || null,
      partyName: partyNameFinal,
      partyPhone: partyPhoneFinal,
      partyGstin: partyGstinFinal,
      partyAddress: partyAddressFinal,
      items: processedCartItems,
      pricingType,
      taxMode,
      supplyType: taxMode === 'NONE' ? 'EXEMPT' : taxMode,
      subTotal: grossSubTotal,
      subtotal: grossSubTotal,
      taxableAmount: taxableSubtotal,
      taxableSubtotal: taxableSubtotal,
      taxTotal,
      cgst,
      sgst,
      igst,
      discount: totalDiscountCombined,
      roundOff,
      grandTotal,
      paymentStatus: asDraft ? 'UNPAID' : paymentStatus,
      paidAmount: actualPaid,
      balanceAmount: balanceAmt,
      paymentMode,
      paymentTerms,
      dueDate: computedDueDate,
      state: asDraft ? 'draft' : 'posted',
      warehouseId: selectedWarehouseId,
      ewayBill: ewayBillOpen ? ewayBillData : null,
      notes: notes || (asDraft ? 'Draft invoice saved' : '')
    };

    const savedInv = saveInvoice(invoicePayload);
    refreshAllData();

    if (asDraft) {
      // Save draft state to localStorage so it is NOT wiped when returning to Invoicing
      const draftState = {
        cart,
        rawCart: cart,
        selectedPartyId,
        customerName,
        customerPhone,
        upperPartySearchTerm,
        pricingType,
        taxMode,
        discountValue,
        discountType,
        roundOffEnabled,
        paymentStatus,
        paidAmount,
        paymentMode,
        paymentTerms,
        notes,
        selectedWarehouseId,
        ewayBillOpen,
        ewayBillData,
        draftInvoiceId: savedInv.id,
        draftInvoiceNo: savedInv.invoiceNo,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('distro_active_billing_draft', JSON.stringify(draftState));
      setActiveDraftId(savedInv.id);
      setActiveDraftNo(savedInv.invoiceNo);
      setShowDraftNotice(true);

      if (!silent) {
        alert(`📝 Draft Invoice #${savedInv.invoiceNo} saved successfully! Stock has NOT been deducted yet. You can confirm or continue editing anytime.`);
      }
      return savedInv;
    }

    // Generate dynamic UPI QR code for instant payment
    generateUpiQrDataUrl(business?.upiId, business?.name, grandTotal, savedInv.invoiceNo).then(qrUrl => {
      setCheckoutModal({
        invoice: savedInv,
        upiQrUrl: qrUrl
      });
    });
    
    // Clear bill state and remove draft on successful post
    localStorage.removeItem('distro_active_billing_draft');
    setCart([]);
    setSelectedPartyId('');
    setCustomerName('');
    setCustomerPhone('');
    setUpperPartySearchTerm('');
    setDiscountValue(0);
    setPaymentStatus('PAID');
    setPaidAmount('');
    setNotes('');
    setEwayBillOpen(false);
    setActiveDraftId(null);
    setActiveDraftNo(null);
    setShowDraftNotice(false);
  };

  const handleDiscardBill = () => {
    localStorage.removeItem('distro_active_billing_draft');
    setCart([]);
    setSelectedPartyId('');
    setCustomerName('');
    setCustomerPhone('');
    setUpperPartySearchTerm('');
    setDiscountValue(0);
    setPaymentStatus('PAID');
    setPaidAmount('');
    setNotes('');
    setEwayBillOpen(false);
    setActiveDraftId(null);
    setActiveDraftNo(null);
    setShowDraftNotice(false);
  };

  // Auto-persist active draft in progress so navigation or reload never wipes work
  useEffect(() => {
    if (cart.length > 0) {
      const draftState = {
        cart,
        rawCart: cart,
        selectedPartyId,
        customerName,
        customerPhone,
        upperPartySearchTerm,
        pricingType,
        taxMode,
        discountValue,
        discountType,
        roundOffEnabled,
        paymentStatus,
        paidAmount,
        paymentMode,
        paymentTerms,
        notes,
        selectedWarehouseId,
        ewayBillOpen,
        ewayBillData,
        draftInvoiceId: activeDraftId,
        draftInvoiceNo: activeDraftNo,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('distro_active_billing_draft', JSON.stringify(draftState));
    }
  }, [
    cart, 
    selectedPartyId, 
    customerName, 
    customerPhone, 
    upperPartySearchTerm, 
    pricingType, 
    taxMode, 
    discountValue, 
    discountType, 
    roundOffEnabled, 
    paymentStatus, 
    paidAmount, 
    paymentMode, 
    paymentTerms, 
    notes, 
    selectedWarehouseId, 
    ewayBillOpen, 
    ewayBillData, 
    activeDraftId, 
    activeDraftNo
  ]);

  // Register navigation guard with parent App
  useEffect(() => {
    if (onRegisterNavigationGuard) {
      onRegisterNavigationGuard({
        isDirty: cart.length > 0,
        itemCount: cart.length,
        saveDraft: () => handleSaveAndPrintBill(true, true),
        discard: handleDiscardBill
      });
    }
  }, [
    cart, 
    processedCartItems, 
    selectedPartyId, 
    customerName, 
    customerPhone, 
    pricingType, 
    taxMode, 
    discountValue, 
    discountType, 
    roundOffEnabled, 
    paymentStatus, 
    paidAmount, 
    notes, 
    selectedWarehouseId, 
    ewayBillOpen, 
    ewayBillData
  ]);

  // Clean up navigation guard when unmounting
  useEffect(() => {
    return () => {
      if (onRegisterNavigationGuard) {
        onRegisterNavigationGuard(null);
      }
    };
  }, []);

  // Catch accidental browser reload or tab close when cart has items
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (cart.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in your invoice. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cart]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {showDraftNotice && cart.length > 0 && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: '10px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '34px', 
              height: '34px', 
              borderRadius: '8px', 
              background: '#d1fae5', 
              color: '#059669', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ fontWeight: '800', color: '#065f46', fontSize: '0.92rem' }}>
                Saved Draft Active {activeDraftNo ? `(#${activeDraftNo})` : ''}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#047857' }}>
                Your invoice with <strong>{cart.length} item(s)</strong> has been preserved. You can continue editing, add products, or confirm the bill.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDiscardBill}
              className="btn btn-secondary btn-sm"
              style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#ffffff', fontWeight: '700', fontSize: '0.78rem', padding: '6px 12px' }}
              title="Discard this draft invoice and start fresh"
            >
              Discard & Start Fresh
            </button>
            <button
              type="button"
              onClick={() => setShowDraftNotice(false)}
              style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', padding: '4px' }}
              title="Dismiss banner"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(440px, 1.4fr)', gap: '20px' }}>
      
      {/* LEFT COLUMN: Product Catalog & Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={18} color="var(--primary)" />
              <span>Search & Add Products</span>
            </h3>
          </div>

          {/* Product Search Bar matching exact Customer Search Bar open format */}
          <div ref={productSearchContainerRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search 
                size={16} 
                color={showProductSuggestions ? '#2563eb' : '#94a3b8'} 
                style={{ 
                  position: 'absolute', 
                  left: '12px', 
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
                  height: '42px',
                  paddingLeft: '38px', 
                  paddingRight: searchTerm ? '34px' : '14px', 
                  fontSize: '0.92rem',
                  borderRadius: '8px',
                  border: showProductSuggestions ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
                  boxShadow: showProductSuggestions ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                  background: 'var(--bg-input, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  outline: 'none',
                  transition: 'all 0.15s ease'
                }}
                value={searchTerm}
                onClick={() => {
                  setShowProductSuggestions(true);
                  setHighlightedProductIndex(0);
                }}
                onFocus={() => {
                  setShowProductSuggestions(true);
                  setHighlightedProductIndex(0);
                }}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setShowProductSuggestions(true);
                  setHighlightedProductIndex(0);
                }}
                onKeyDown={handleProductSearchKeyDown}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm('');
                    setShowProductSuggestions(true);
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

            {/* Dropdown Popup matching exact Customer format */}
            {showProductSuggestions && (
              <div 
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  background: '#ffffff',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                  border: '1px solid #e2e8f0',
                  padding: '6px',
                  overflow: 'hidden'
                }}
              >
                {/* Scrollable list of products */}
                <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                  {filteredProducts.length === 0 ? (
                    <div style={{ padding: '16px 12px', fontSize: '0.86rem', color: '#64748b', textAlign: 'center' }}>
                      No product found for "{searchTerm}"
                    </div>
                  ) : (
                    filteredProducts.map((p, idx) => {
                      const isHighlighted = (highlightedProductIndex === idx);
                      const initial = p.name ? p.name.trim().charAt(0).toUpperCase() : 'P';
                      const isOutOfStock = (p.currentStock || 0) <= 0;

                      return (
                        <div 
                          key={p.id}
                          onClick={() => {
                            if (isOutOfStock) {
                              alert(`⚠️ '${p.name}' is out of stock!`);
                              return;
                            }
                            handleAddToCart(p);
                            setBarcodeScanAlert(`✅ Added: ${p.name}`);
                            setTimeout(() => setBarcodeScanAlert(null), 2500);
                            setShowProductSuggestions(false);
                          }}
                          onMouseEnter={() => setHighlightedProductIndex(idx)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                            background: isHighlighted ? '#2563eb' : 'transparent',
                            color: isHighlighted ? '#ffffff' : '#0f172a',
                            opacity: isOutOfStock ? 0.6 : 1,
                            transition: 'background 0.1s ease, color 0.1s ease',
                            marginBottom: '4px'
                          }}
                        >
                          {/* Round Avatar Circle with Initial */}
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: '#e2e8f0',
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '1rem',
                            flexShrink: 0
                          }}>
                            {initial}
                          </div>

                          {/* Product Details */}
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <div style={{
                              fontWeight: '600',
                              fontSize: '0.92rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: isHighlighted ? '#ffffff' : '#0f172a'
                            }}>
                              {p.name}
                            </div>
                            <div style={{
                              fontSize: '0.78rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginTop: '2px',
                              color: isHighlighted ? 'rgba(255, 255, 255, 0.9)' : '#64748b'
                            }}>
                              <Tag size={13} style={{ flexShrink: 0 }} />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.sku ? `SKU: ${p.sku}` : ''}{p.brand ? ` • ${p.brand}` : ''}{p.mrp ? ` • MRP: ₹${p.mrp}` : ''}
                              </span>
                            </div>
                          </div>

                          {/* Price & Stock status */}
                          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <div style={{
                              fontWeight: '700',
                              fontSize: '0.92rem',
                              color: isHighlighted ? '#ffffff' : '#059669'
                            }}>
                              ₹{p.salePrice}
                            </div>
                            <div style={{
                              fontSize: '0.72rem',
                              fontWeight: '600',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isHighlighted 
                                ? 'rgba(255, 255, 255, 0.2)' 
                                : (isOutOfStock ? '#fee2e2' : '#f1f5f9'),
                              color: isHighlighted 
                                ? '#ffffff' 
                                : (isOutOfStock ? '#dc2626' : '#475569')
                            }}>
                              {isOutOfStock ? 'Out of Stock' : `Stock: ${p.currentStock} ${p.unit || 'Pcs'}`}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Row: + New Product */}
                <div 
                  onClick={() => {
                    setNewProductData({ 
                      ...initialNewProductState, 
                      name: (searchTerm || '').trim(),
                      sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000)
                    });
                    setShowProductSuggestions(false);
                    setProductModalOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    color: '#2563eb',
                    fontWeight: '600',
                    fontSize: '0.88rem',
                    borderTop: '1px solid #f1f5f9',
                    borderRadius: '0 0 6px 6px',
                    transition: 'background 0.15s ease',
                    marginTop: '2px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <PlusCircle size={18} color="#2563eb" />
                  <span>New Product</span>
                </div>
              </div>
            )}
          </div>

          {barcodeScanAlert && (
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: barcodeScanAlert.startsWith('✅') ? '#059669' : '#dc2626', marginTop: '6px' }}>
              {barcodeScanAlert}
            </div>
          )}
        </div>

        {/* Product Quick Add List (Horizontal Row or Fast Touch Tiles) */}
        <div style={{ 
          display: posMode === 'FAST_TOUCH' ? 'grid' : 'flex',
          gridTemplateColumns: posMode === 'FAST_TOUCH' ? 'repeat(auto-fill, minmax(130px, 1fr))' : undefined,
          flexDirection: posMode === 'FAST_TOUCH' ? undefined : 'column',
          gap: '8px', 
          maxHeight: '600px', 
          overflowY: 'auto',
          paddingRight: '4px' 
        }}>
          {filteredProducts.map(product => {
            const isOutOfStock = product.currentStock <= 0;
            return (
              <div 
                key={product.id}
                onClick={() => !isOutOfStock && handleAddToCart(product)}
                className="glass-card glass-card-interactive"
                style={{ 
                  padding: '10px 14px', 
                  cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                  opacity: isOutOfStock ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  borderRadius: '10px'
                }}
              >
                {/* Left Info: Product Name & SKU / Pack Size */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {product.name}
                  </h4>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Pack: {product.pcsPerCarton || 24} Pcs/Ctn • SKU: {product.sku}
                  </div>
                </div>

                {/* Right Info: Price */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--primary)' }}>
                    ₹{product.salePrice}
                  </span>
                  {product.mrp > product.salePrice && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textDecoration: 'line-through', marginLeft: '6px' }}>
                      ₹{product.mrp}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* RIGHT COLUMN: Active Cart & GST Billing Summary */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        <div>
          {/* Header & Party Selector */}
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Current Invoice</h3>
              </div>
            </div>

            {/* Customer Search Bar (matching reference UI in user image) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div ref={customerSearchContainerRef} style={{ position: 'relative' }}>
                <div 
                  style={{ 
                    position: 'relative', 
                    width: '100%',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    background: '#ffffff',
                    borderRadius: '6px',
                    border: showUpperPartySuggestions ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    boxShadow: showUpperPartySuggestions ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none',
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
                      paddingLeft: '14px', 
                      paddingRight: '8px',
                      fontSize: '0.92rem', 
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: 'var(--text-main, #0f172a)',
                      cursor: 'text'
                    }}
                    value={
                      selectedParty 
                        ? (upperPartySearchTerm !== '' ? upperPartySearchTerm : selectedParty.name)
                        : (upperPartySearchTerm || customerName || '')
                    }
                    onClick={() => {
                      setShowUpperPartySuggestions(true);
                      setHighlightedIndex(0);
                    }}
                    onFocus={() => {
                      setShowUpperPartySuggestions(true);
                      setHighlightedIndex(0);
                    }}
                    onChange={e => {
                      const val = e.target.value;
                      setUpperPartySearchTerm(val);
                      setCustomerName(val);
                      setSelectedPartyId('');
                      setShowUpperPartySuggestions(true);
                      setHighlightedIndex(0);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (filteredPartiesForUpper.length > 0) {
                          setHighlightedIndex(prev => (prev + 1) % filteredPartiesForUpper.length);
                        }
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (filteredPartiesForUpper.length > 0) {
                          setHighlightedIndex(prev => (prev - 1 + filteredPartiesForUpper.length) % filteredPartiesForUpper.length);
                        }
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredPartiesForUpper.length > 0 && filteredPartiesForUpper[highlightedIndex]) {
                          handleSelectPartyFromList(filteredPartiesForUpper[highlightedIndex]);
                          setShowUpperPartySuggestions(false);
                        } else if (upperPartySearchTerm.trim()) {
                          setCustomerName(upperPartySearchTerm.trim());
                          setShowUpperPartySuggestions(false);
                        }
                      } else if (e.key === 'Escape') {
                        setShowUpperPartySuggestions(false);
                      }
                    }}
                  />

                  {/* Clear ✕ button if text or party selected */}
                  {(selectedParty || customerName || upperPartySearchTerm) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPartyFromList(null);
                        setUpperPartySearchTerm('');
                        setShowUpperPartySuggestions(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        padding: '4px 6px',
                        lineHeight: 1
                      }}
                      title="Clear Customer"
                    >
                      ✕
                    </button>
                  )}

                  {/* Down Chevron icon */}
                  <div 
                    onClick={() => setShowUpperPartySuggestions(!showUpperPartySuggestions)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 8px 0 4px',
                      cursor: 'pointer',
                      color: '#64748b'
                    }}
                    title="Open Customer List"
                  >
                    <ChevronDown size={18} color="#64748b" />
                  </div>

                  {/* Attached Blue Search Button */}
                  <button
                    type="button"
                    onClick={() => setShowUpperPartySuggestions(!showUpperPartySuggestions)}
                    style={{
                      width: '44px',
                      height: '100%',
                      background: '#3b82f6',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
                    onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
                    title="Search Customer"
                  >
                    <Search size={18} color="#ffffff" />
                  </button>
                </div>

                {/* Dropdown Popup matching exact user screenshot */}
                {showUpperPartySuggestions && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      background: '#ffffff',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                      border: '1px solid #e2e8f0',
                      padding: '6px',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Scrollable list of customers */}
                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      {filteredPartiesForUpper.length === 0 ? (
                        <div style={{ padding: '16px 12px', fontSize: '0.86rem', color: '#64748b', textAlign: 'center' }}>
                          No customer found for "{upperPartySearchTerm || customerName}"
                        </div>
                      ) : (
                        filteredPartiesForUpper.map((p, idx) => {
                          const isHighlighted = (highlightedIndex === idx);
                          const initial = p.name ? p.name.trim().charAt(0).toUpperCase() : 'C';

                          return (
                            <div 
                              key={p.id}
                              onClick={() => {
                                handleSelectPartyFromList(p);
                                setShowUpperPartySuggestions(false);
                              }}
                              onMouseEnter={() => setHighlightedIndex(idx)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                background: isHighlighted ? '#2563eb' : 'transparent',
                                color: isHighlighted ? '#ffffff' : '#0f172a',
                                transition: 'background 0.1s ease, color 0.1s ease',
                                marginBottom: '4px'
                              }}
                            >
                              {/* Round Avatar Circle with Initial */}
                              <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                background: '#e2e8f0',
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '700',
                                fontSize: '1rem',
                                flexShrink: 0
                              }}>
                                {initial}
                              </div>

                              {/* Customer Details */}
                              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                <div style={{
                                  fontWeight: '600',
                                  fontSize: '0.92rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  color: isHighlighted ? '#ffffff' : '#0f172a'
                                }}>
                                  {p.name}
                                </div>
                                <div style={{
                                  fontSize: '0.78rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginTop: '2px',
                                  color: isHighlighted ? 'rgba(255, 255, 255, 0.9)' : '#64748b'
                                }}>
                                  <FileText size={13} style={{ flexShrink: 0 }} />
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {p.name} {p.phone ? `• ${p.phone}` : ''} {p.city ? `• ${p.city}` : ''}
                                  </span>
                                </div>
                              </div>

                              {/* Balance Due Tag */}
                              {p.balance > 0 && (
                                <div style={{
                                  flexShrink: 0,
                                  fontSize: '0.74rem',
                                  fontWeight: '700',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: isHighlighted ? 'rgba(255, 255, 255, 0.2)' : '#fff7ed',
                                  color: isHighlighted ? '#ffffff' : '#c2410c'
                                }}>
                                  Due: ₹{p.balance}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Bottom Row: + New Customer */}
                    <div 
                      onClick={() => {
                        setNewPartyData({ ...initialNewPartyState, name: (upperPartySearchTerm || '').trim() });
                        setShowUpperPartySuggestions(false);
                        setPartyModalOpen(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        color: '#2563eb',
                        fontWeight: '600',
                        fontSize: '0.88rem',
                        borderTop: '1px solid #f1f5f9',
                        borderRadius: '0 0 6px 6px',
                        transition: 'background 0.15s ease',
                        marginTop: '2px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <PlusCircle size={18} color="#2563eb" />
                      <span>New Customer</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Party Summary Card with Reset Button */}
              {selectedParty && (
                <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                  <div>
                    <div style={{ fontWeight: '800', color: 'var(--primary)', marginBottom: '2px' }}>
                      {selectedParty.name}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                      📍 Address: {selectedParty.address || selectedParty.city || 'N/A'} {selectedParty.phone ? `| 📞 ${selectedParty.phone}` : ''}
                    </p>
                    <p style={{ fontSize: '0.8rem', fontWeight: '800', color: selectedParty.balance > 0 ? '#c2410c' : '#10b981', marginTop: '2px', margin: 0 }}>
                      Current Outstanding Due: ₹{selectedParty.balance || 0}
                    </p>
                  </div>

                  <button 
                    type="button"
                    onClick={() => handleSelectPartyFromList(null)}
                    className="btn btn-sm btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#c2410c' }}
                    title="Reset party selection"
                  >
                    ✕ Change
                  </button>
                </div>
              )}

            </div>

          </div>

          {/* Cart Items Table */}
          <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                <ShoppingBag size={40} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
                <p style={{ fontWeight: '600' }}>Bill cart is empty!</p>
                <p style={{ fontSize: '0.8rem' }}>Click on products from the left panel to add them to the bill.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 4px' }}>Item</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Quantity</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center' }}>Disc</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '8px 2px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, index) => {
                    const calc = getItemDetails(item);

                    return (
                      <tr key={item.productId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 4px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.84rem' }}>{item.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            Pack: {item.pcsPerCarton || 24} Pcs/Ctn • GST: {item.gstRate}%
                          </div>
                        </td>
                        
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              
                              {/* Carton input */}
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <input 
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  title="Cartons"
                                  style={{ width: '56px', padding: '5px 6px', textAlign: 'center', fontSize: '0.88rem', fontWeight: '800', borderRadius: '6px' }}
                                  className="input-field"
                                  value={item.cartonQty !== undefined ? item.cartonQty : Math.floor(item.qty / (item.pcsPerCarton || 24))}
                                  onChange={e => handleCartonQtyChange(index, e.target.value)}
                                />
                                <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '800' }}>Ctn</span>
                              </div>

                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>+</span>

                              {/* Loose Pcs input */}
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <input 
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  title="Loose Pcs"
                                  style={{ width: '56px', padding: '5px 6px', textAlign: 'center', fontSize: '0.88rem', fontWeight: '800', borderRadius: '6px' }}
                                  className="input-field"
                                  value={item.looseQty !== undefined ? item.looseQty : item.qty % (item.pcsPerCarton || 24)}
                                  onChange={e => handleLooseQtyChange(index, e.target.value)}
                                />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '700' }}>Pcs</span>
                              </div>

                            </div>

                            {/* Total base pcs text */}
                            <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: '800' }}>
                              = {item.qty} Pcs Total
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                          <input 
                            type="number"
                            step="0.01"
                            style={{ width: '72px', padding: '5px 6px', textAlign: 'right', fontSize: '0.86rem', fontWeight: '700' }}
                            className="input-field"
                            value={item.price}
                            onChange={e => handleItemPriceChange(index, e.target.value)}
                          />
                        </td>

                        {/* Item-wise Discount (% / ₹ Toggle) */}
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <input 
                              type="number"
                              step="0.01"
                              style={{ width: '60px', padding: '5px 6px', textAlign: 'right', fontSize: '0.86rem', fontWeight: '700' }}
                              className="input-field"
                              placeholder="0"
                              value={item.itemDiscountVal || ''}
                              onChange={e => handleItemDiscountChange(index, e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => handleToggleItemDiscountType(index)}
                              title={item.itemDiscountType === 'PERCENT' ? 'Percentage (%) Discount' : 'Rupees (₹) Discount per unit'}
                              style={{ 
                                padding: '2px 5px', 
                                fontSize: '0.72rem', 
                                fontWeight: '700',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                background: item.itemDiscountType === 'PERCENT' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                                color: item.itemDiscountType === 'PERCENT' ? '#818cf8' : '#34d399',
                                cursor: 'pointer'
                              }}
                            >
                              {item.itemDiscountType === 'PERCENT' ? '%' : '₹'}
                            </button>
                          </div>
                        </td>

                        <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                          ₹{calc.netInclusiveTotal.toFixed(2)}
                        </td>

                        <td style={{ padding: '8px 2px', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleRemoveItem(index)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Calculation Summary Footer */}
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          
          {/* Taxation & Pricing Controls */}
          <div style={{ background: '#f1f5f9', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)' }}>
                Pricing Mode:
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setPricingType('EXCLUSIVE')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: pricingType === 'EXCLUSIVE' ? 'var(--primary)' : '#fff',
                    color: pricingType === 'EXCLUSIVE' ? '#fff' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  Wholesale (Rate + GST Extra)
                </button>
                <button
                  type="button"
                  onClick={() => setPricingType('INCLUSIVE')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: pricingType === 'INCLUSIVE' ? 'var(--primary)' : '#fff',
                    color: pricingType === 'INCLUSIVE' ? '#fff' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  MRP / Tax Incl.
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Supply Region:
                {selectedParty?.gstin && (
                  <span style={{ fontSize: '0.68rem', color: '#059669', background: '#d1fae5', padding: '1px 5px', borderRadius: '4px' }}>
                    Auto GSTIN
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setTaxMode('INTRA')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: taxMode === 'INTRA' ? '#2563eb' : '#fff',
                    color: taxMode === 'INTRA' ? '#fff' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  Intra (CGST+SGST)
                </button>
                <button
                  type="button"
                  onClick={() => setTaxMode('INTER')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: taxMode === 'INTER' ? '#7c3aed' : '#fff',
                    color: taxMode === 'INTER' ? '#fff' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  Inter (IGST)
                </button>
                <button
                  type="button"
                  onClick={() => setTaxMode('NONE')}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: taxMode === 'NONE' ? '#475569' : '#fff',
                    color: taxMode === 'NONE' ? '#fff' : 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                >
                  Non-GST (0%)
                </button>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', marginBottom: '12px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Gross Subtotal:</span>
              <span>₹{grossSubTotal.toFixed(2)}</span>
            </div>

            {itemDiscountsTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                <span>Item Discounts:</span>
                <span>- ₹{itemDiscountsTotal.toFixed(2)}</span>
              </div>
            )}

            {/* Overall Bill Discount (% vs ₹) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Overall Bill Discount:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  type="number" 
                  step="0.01"
                  style={{ width: '75px', padding: '3px 6px', textAlign: 'right' }}
                  className="input-field"
                  placeholder="0"
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setDiscountType(discountType === 'PERCENT' ? 'AMOUNT' : 'PERCENT')}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '0.8rem', 
                    fontWeight: '800',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: discountType === 'PERCENT' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: discountType === 'PERCENT' ? '#4f46e5' : '#059669',
                    cursor: 'pointer'
                  }}
                  title="Toggle overall discount between % and ₹"
                >
                  {discountType === 'PERCENT' ? '%' : '₹'}
                </button>
              </div>
            </div>

            {/* Taxable Amount */}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontWeight: '600' }}>
              <span>Taxable Amount:</span>
              <span>₹{taxableSubtotal.toFixed(2)}</span>
            </div>

            {taxMode === 'NONE' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: '700' }}>
                <span>GST Tax:</span>
                <span>Non-GST / Exempt (0%)</span>
              </div>
            ) : taxMode === 'INTRA' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <span>CGST {pricingType === 'EXCLUSIVE' ? '(Extra on rate)' : '(Included in rate)'}:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{cgst.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <span>SGST {pricingType === 'EXCLUSIVE' ? '(Extra on rate)' : '(Included in rate)'}:</span>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{sgst.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <span>IGST {pricingType === 'EXCLUSIVE' ? '(Extra on rate)' : '(Included in rate)'}:</span>
                <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>₹{igst.toFixed(2)}</span>
              </div>
            )}

            {/* Round Off Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={roundOffEnabled} 
                  onChange={e => setRoundOffEnabled(e.target.checked)} 
                />
                <span>Auto Round Off:</span>
              </label>
              <span>{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>Grand Total:</span>
            <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)' }}>
              ₹{grandTotal.toFixed(2)}
            </span>
          </div>

          {/* Payment Status Switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <button 
              type="button"
              onClick={() => setPaymentStatus('PAID')}
              className={`btn btn-sm ${paymentStatus === 'PAID' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Cash / Paid
            </button>
            <button 
              type="button"
              onClick={() => setPaymentStatus('UNPAID')}
              className={`btn btn-sm ${paymentStatus === 'UNPAID' ? 'btn-danger' : 'btn-secondary'}`}
            >
              Credit (Unpaid)
            </button>
            <button 
              type="button"
              onClick={() => setPaymentStatus('PARTIAL')}
              className={`btn btn-sm ${paymentStatus === 'PARTIAL' ? 'badge-warning' : 'btn-secondary'}`}
            >
              Partial Payment
            </button>
          </div>


          {/* Warehouse Source & e-Way Bill Accordion */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)' }}>Warehouse / Depot:</span>
              <select 
                className="input-field select-field" 
                style={{ fontSize: '0.76rem', padding: '4px 20px 4px 8px', width: 'auto' }}
                value={selectedWarehouseId}
                onChange={e => setSelectedWarehouseId(e.target.value)}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            {/* e-Way Bill Toggle */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 10px', background: '#ffffff' }}>
              <div 
                onClick={() => setEwayBillOpen(!ewayBillOpen)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', color: '#2563eb' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Truck size={14} />
                  <span>e-Way Bill & Transport Details {ewayBillOpen ? '▲' : '▼'}</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {ewayBillOpen ? 'Hide' : '(Optional for Interstate / >₹50k)'}
                </span>
              </div>

              {ewayBillOpen && (
                <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.76rem' }}>
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="Transporter Name"
                    style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                    value={ewayBillData.transporterName}
                    onChange={e => setEwayBillData({ ...ewayBillData, transporterName: e.target.value })}
                  />
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="Vehicle No (e.g. DL01AA1234)"
                    style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                    value={ewayBillData.vehicleNo}
                    onChange={e => setEwayBillData({ ...ewayBillData, vehicleNo: e.target.value })}
                  />
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="Distance (KM)"
                    style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                    value={ewayBillData.distanceKm}
                    onChange={e => setEwayBillData({ ...ewayBillData, distanceKm: e.target.value })}
                  />
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="e-Way Bill No. (if generated)"
                    style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                    value={ewayBillData.ewayBillNo}
                    onChange={e => setEwayBillData({ ...ewayBillData, ewayBillNo: e.target.value })}
                  />
                </div>
              )}
            </div>

            {/* Odoo Payment Terms & Due Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  Payment Terms:
                </label>
                <select 
                  className="input-field select-field" 
                  style={{ fontSize: '0.76rem', padding: '4px 8px' }}
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                >
                  <option value="immediate">Immediate Payment</option>
                  <option value="15_days">15 Days</option>
                  <option value="30_days">30 Days</option>
                  <option value="45_days">45 Days</option>
                  <option value="end_of_month">End of Following Month</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                  Due Date:
                </label>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1e293b', padding: '5px 8px', background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  📅 {computedDueDate}
                </div>
              </div>
            </div>

          </div>

          {/* Action Buttons: Confirm & Post vs Save as Draft */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '8px' }}>
              <button 
                onClick={() => handleSaveAndPrintBill(false)}
                disabled={cart.length === 0}
                className="btn btn-primary"
                style={{ padding: '12px', gap: '8px', opacity: cart.length === 0 ? 0.5 : 1, fontWeight: '800', fontSize: '0.9rem' }}
              >
                <Zap size={18} />
                <span>Confirm & Post Invoice</span>
              </button>
              <button 
                onClick={() => handleSaveAndPrintBill(true)}
                disabled={cart.length === 0}
                className="btn btn-secondary"
                style={{ padding: '12px', gap: '6px', opacity: cart.length === 0 ? 0.5 : 1, fontWeight: '700', fontSize: '0.82rem', background: '#f1f5f9' }}
                title="Save as Draft without deducting stock or updating ledger yet"
              >
                <FileText size={16} />
                <span>Save Draft</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Add New Retailer Modal inside Billing */}
      {partyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="var(--primary)" />
                <span>👥 Add New Retailer / Customer</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setPartyModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNewParty}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Shop / Retailer Name *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    required
                    placeholder="e.g. Gupta Kirana & General Store"
                    value={newPartyData.name}
                    onChange={e => setNewPartyData({...newPartyData, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Ramakant Gupta"
                    value={newPartyData.contactPerson}
                    onChange={e => setNewPartyData({...newPartyData, contactPerson: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Number *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    required
                    placeholder="e.g. 9811223344"
                    value={newPartyData.phone}
                    onChange={e => setNewPartyData({...newPartyData, phone: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">City / Area</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Rohini, Delhi"
                    value={newPartyData.city}
                    onChange={e => setNewPartyData({...newPartyData, city: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GSTIN Number (if available)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. 07BAPPG4321A1Z2"
                    value={newPartyData.gstin}
                    onChange={e => setNewPartyData({...newPartyData, gstin: e.target.value})}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Complete Shop Address</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Shop No. 4, Main Market, Rohini Sector 7"
                    value={newPartyData.address}
                    onChange={e => setNewPartyData({...newPartyData, address: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Credit Limit (₹)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={newPartyData.creditLimit}
                    onChange={e => setNewPartyData({...newPartyData, creditLimit: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Opening Due / Balance (₹)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={newPartyData.balance}
                    onChange={e => setNewPartyData({...newPartyData, balance: e.target.value})}
                  />
                </div>

              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setPartyModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ gap: '6px' }}>
                  <Save size={16} />
                  <span>Save Party Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal inside Billing */}
      {productModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingBag size={20} color="var(--primary)" />
                <span>Add New Product</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setProductModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNewProduct}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Product / Item Name *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    required
                    placeholder="e.g. Parle-G Gold 100g"
                    value={newProductData.name}
                    onChange={e => setNewProductData({...newProductData, name: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SKU / Item Code</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. SKU-5042"
                    value={newProductData.sku}
                    onChange={e => setNewProductData({...newProductData, sku: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Barcode / EAN</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. 8901234567890"
                    value={newProductData.barcode}
                    onChange={e => setNewProductData({...newProductData, barcode: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Brand / Company</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Parle, Nestle, Britannia"
                    value={newProductData.brand}
                    onChange={e => setNewProductData({...newProductData, brand: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. Biscuits & Snacks"
                    value={newProductData.category}
                    onChange={e => setNewProductData({...newProductData, category: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <select 
                    className="input-field select-field"
                    value={newProductData.unit}
                    onChange={e => setNewProductData({...newProductData, unit: e.target.value})}
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Box">Box</option>
                    <option value="Kg">Kg</option>
                    <option value="Gm">Gm</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Ml">Ml</option>
                    <option value="Pack">Pack</option>
                    <option value="Carton">Carton</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Pieces per Carton / Case</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={newProductData.pcsPerCarton}
                    onChange={e => setNewProductData({...newProductData, pcsPerCarton: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Sale Price / Rate (₹) *</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    required
                    placeholder="e.g. 100"
                    value={newProductData.salePrice}
                    onChange={e => setNewProductData({...newProductData, salePrice: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">MRP (₹)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="e.g. 120"
                    value={newProductData.mrp}
                    onChange={e => setNewProductData({...newProductData, mrp: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Purchase / Cost Price (₹)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="e.g. 80"
                    value={newProductData.purchasePrice}
                    onChange={e => setNewProductData({...newProductData, purchasePrice: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GST Rate %</label>
                  <select 
                    className="input-field select-field"
                    value={newProductData.gstRate}
                    onChange={e => setNewProductData({...newProductData, gstRate: Number(e.target.value)})}
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Opening / Current Stock Qty</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={newProductData.currentStock}
                    onChange={e => setNewProductData({...newProductData, currentStock: e.target.value})}
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
                  <span>Save Product & Add to Bill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic UPI Checkout & Instant Sharing Modal */}
      {checkoutModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '24px', textAlign: 'center' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <CheckCircle size={30} />
            </div>

            <h3 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>
              Invoice #{checkoutModal.invoice.invoiceNo} Generated!
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 16px 0' }}>
              Billed to: <strong>{checkoutModal.invoice.customerName || 'Cash Customer'}</strong>
            </p>

            {/* Dynamic UPI QR Code Card */}
            <div style={{
              background: '#f8fafc',
              border: '2px dashed #059669',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: '800', color: '#059669' }}>
                <QrCode size={16} />
                <span>SCAN TO PAY VIA ANY UPI APP (MargPay)</span>
              </div>

              {checkoutModal.upiQrUrl ? (
                <img 
                  src={checkoutModal.upiQrUrl} 
                  alt="UPI QR" 
                  style={{ width: '180px', height: '180px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '4px' }}
                />
              ) : (
                <div style={{ width: '180px', height: '180px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Generating QR...
                </div>
              )}

              <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#059669' }}>
                ₹{Number(checkoutModal.invoice.grandTotal || 0).toLocaleString('en-IN')}
              </div>
              {business?.upiId && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  VPA: <strong>{business.upiId}</strong>{business?.name ? ` • ${business.name}` : ''}
                </span>
              )}
            </div>

            {/* Instant Sharing Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => {
                  const shareText = buildInvoiceShareText(checkoutModal.invoice, business);
                  const waUrl = buildWhatsAppUrl(checkoutModal.invoice.customerPhone, shareText);
                  window.open(waUrl, '_blank');
                }}
                className="btn"
                style={{ 
                  background: '#25D366', 
                  color: '#ffffff', 
                  border: 'none', 
                  padding: '11px', 
                  fontWeight: '700', 
                  fontSize: '0.9rem',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px' 
                }}
              >
                <Send size={18} />
                <span>Instant Share on WhatsApp</span>
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button 
                  onClick={() => {
                    handlePrintInvoice(checkoutModal.invoice);
                    setCheckoutModal(null);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '10px', fontWeight: '700', fontSize: '0.85rem', gap: '6px' }}
                >
                  <Printer size={16} />
                  <span>Print Bill (A4/A5/Thermal)</span>
                </button>

                <button 
                  onClick={() => setCheckoutModal(null)}
                  className="btn btn-secondary"
                  style={{ padding: '10px', fontWeight: '700', fontSize: '0.85rem' }}
                >
                  Done / Next Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
