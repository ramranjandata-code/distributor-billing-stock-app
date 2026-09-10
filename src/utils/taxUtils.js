/**
 * Tax & GST Calculation Engine for DistroPulse ERP
 * Handles Tax-Inclusive and Tax-Exclusive pricing,
 * Auto-detects Intra-State (CGST+SGST) vs Inter-State (IGST) by GSTIN state code,
 * Proportionally allocates discounts, and calculates auto round-offs.
 */

/**
 * Extracts 2-digit state code from GSTIN (e.g. '07' from '07AAACG1234F1Z8')
 */
export const getGstinStateCode = (gstin) => {
  if (!gstin || typeof gstin !== 'string') return null;
  const clean = gstin.trim();
  if (clean.length < 2) return null;
  const code = clean.substring(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
};

/**
 * Automatically detects whether a transaction is Intra-State or Inter-State
 * by comparing Seller GSTIN and Buyer GSTIN state codes.
 */
export const detectSupplyType = (sellerGstin, buyerGstin) => {
  const sellerCode = getGstinStateCode(sellerGstin);
  const buyerCode = getGstinStateCode(buyerGstin);

  if (!buyerCode || !sellerCode) {
    // Default to Intra-State if unregistered buyer (B2C) or no GSTIN
    return 'INTRA';
  }

  return sellerCode === buyerCode ? 'INTRA' : 'INTER';
};

/**
 * Computes line-item level taxation
 * @param {Object} item - cart item
 * @param {string} taxType - 'EXCLUSIVE' (Rate + GST on top) or 'INCLUSIVE' (MRP/Rate includes GST)
 * @param {string} supplyType - 'INTRA' (CGST+SGST), 'INTER' (IGST), or 'EXEMPT' (0%)
 */
export const calculateItemTax = (item, taxType = 'INCLUSIVE', supplyType = 'INTRA') => {
  const price = Number(item.price) || 0;
  const qty = Number(item.qty) || 1;
  const grossAmount = price * qty;

  // Item discount calculation
  let itemDiscountAmount = 0;
  const discVal = Number(item.itemDiscountVal || item.discVal) || 0;
  const discType = item.itemDiscountType || 'AMOUNT'; // 'AMOUNT' (₹ per unit) or 'PERCENT' (%)

  if (discType === 'PERCENT') {
    itemDiscountAmount = (grossAmount * discVal) / 100;
  } else {
    itemDiscountAmount = discVal * qty;
  }
  itemDiscountAmount = Math.min(grossAmount, Math.max(0, itemDiscountAmount));

  const netAmount = Math.max(0, grossAmount - itemDiscountAmount);
  const rawGstRate = supplyType === 'EXEMPT' ? 0 : (Number(item.gstRate) || 0);

  let taxableAmount = 0;
  let gstAmount = 0;
  let lineTotal = 0;

  if (taxType === 'EXCLUSIVE') {
    // Tax is added on top of the rate
    taxableAmount = netAmount;
    gstAmount = (taxableAmount * rawGstRate) / 100;
    lineTotal = taxableAmount + gstAmount;
  } else {
    // Tax is already included in the rate (standard MRP)
    if (rawGstRate > 0) {
      taxableAmount = netAmount / (1 + rawGstRate / 100);
      gstAmount = netAmount - taxableAmount;
    } else {
      taxableAmount = netAmount;
      gstAmount = 0;
    }
    lineTotal = netAmount;
  }

  // Split into CGST / SGST / IGST
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (supplyType === 'INTRA') {
    cgstAmount = gstAmount / 2;
    sgstAmount = gstAmount / 2;
  } else if (supplyType === 'INTER') {
    igstAmount = gstAmount;
  }

  return {
    grossAmount,
    itemDiscountAmount,
    netAmount,
    taxableAmount,
    gstRate: rawGstRate,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    lineTotal
  };
};

/**
 * Calculates complete bill totals with overall discount, GST allocation and auto round-off
 */
export const calculateBillTotals = ({
  cartItems = [],
  taxType = 'INCLUSIVE',
  supplyType = 'INTRA',
  overallDiscountVal = 0,
  overallDiscountType = 'AMOUNT', // 'AMOUNT' or 'PERCENT'
  roundOffEnabled = true
}) => {
  let grossSubtotal = 0;
  let itemDiscountsTotal = 0;
  let totalTaxableAmount = 0;
  let totalGstAmount = 0;
  let totalCgstAmount = 0;
  let totalSgstAmount = 0;
  let totalIgstAmount = 0;
  let subtotalBeforeOverallDiscount = 0;

  const processedItems = cartItems.map(item => {
    const calc = calculateItemTax(item, taxType, supplyType);
    grossSubtotal += calc.grossAmount;
    itemDiscountsTotal += calc.itemDiscountAmount;
    subtotalBeforeOverallDiscount += calc.lineTotal;

    return {
      ...item,
      grossTotal: calc.grossAmount,
      discAmount: calc.itemDiscountAmount,
      taxableAmount: calc.taxableAmount,
      taxableVal: calc.taxableAmount, // Alias for compatibility
      itemGstAmount: calc.gstAmount,
      gstVal: calc.gstAmount, // Alias for compatibility
      cgstAmount: calc.cgstAmount,
      sgstAmount: calc.sgstAmount,
      igstAmount: calc.igstAmount,
      total: calc.lineTotal,
      finalItemTotal: calc.lineTotal
    };
  });

  // Calculate Overall Bill Discount
  let billDiscountAmount = 0;
  const dVal = Number(overallDiscountVal) || 0;
  if (overallDiscountType === 'PERCENT') {
    billDiscountAmount = (subtotalBeforeOverallDiscount * dVal) / 100;
  } else {
    billDiscountAmount = dVal;
  }
  billDiscountAmount = Math.min(subtotalBeforeOverallDiscount, Math.max(0, billDiscountAmount));

  // If overall discount exists, distribute proportionally to taxable and GST
  if (billDiscountAmount > 0 && subtotalBeforeOverallDiscount > 0) {
    const discountRatio = 1 - (billDiscountAmount / subtotalBeforeOverallDiscount);
    processedItems.forEach(item => {
      item.taxableAmount = item.taxableAmount * discountRatio;
      item.taxableVal = item.taxableAmount;
      item.itemGstAmount = item.itemGstAmount * discountRatio;
      item.gstVal = item.itemGstAmount;
      item.cgstAmount = item.cgstAmount * discountRatio;
      item.sgstAmount = item.sgstAmount * discountRatio;
      item.igstAmount = item.igstAmount * discountRatio;
      item.total = item.total * discountRatio;
      item.finalItemTotal = item.total;
    });
  }

  // Sum up all items
  processedItems.forEach(item => {
    totalTaxableAmount += item.taxableAmount;
    totalGstAmount += item.itemGstAmount;
    totalCgstAmount += item.cgstAmount;
    totalSgstAmount += item.sgstAmount;
    totalIgstAmount += item.igstAmount;
  });

  const netTotalBeforeRound = totalTaxableAmount + totalGstAmount;

  let grandTotal = netTotalBeforeRound;
  let roundOff = 0;

  if (roundOffEnabled) {
    grandTotal = Math.round(netTotalBeforeRound);
    roundOff = grandTotal - netTotalBeforeRound;
  }

  return {
    processedItems,
    grossSubtotal,
    itemDiscountsTotal,
    totalDiscounts: itemDiscountsTotal + billDiscountAmount,
    billDiscountAmount,
    totalTaxableAmount,
    taxableSubtotal: totalTaxableAmount,
    totalGstAmount,
    taxTotal: totalGstAmount,
    cgst: totalCgstAmount,
    sgst: totalSgstAmount,
    igst: totalIgstAmount,
    netTotalBeforeRound,
    roundOff,
    grandTotal
  };
};
