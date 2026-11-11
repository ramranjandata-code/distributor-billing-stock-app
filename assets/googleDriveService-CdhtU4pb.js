import{aq as S,aa as w,ar as O}from"./index-BI0yGjWn.js";const I="distro_gdrive_config",b="distro_gdrive_pending_queue",v={enabled:!0,webhookUrl:"",folderName:"DistroPlus Invoices & Bills",autoUploadOnBill:!0,uploadFormat:"PDF",localServerUrl:"http://localhost:3000",lastSyncTime:null},D=()=>{try{const t=localStorage.getItem(I);if(t)return{...v,...JSON.parse(t)}}catch{}return v},E=t=>{const e={...D(),...t};return localStorage.setItem(I,JSON.stringify(e)),typeof window<"u"&&window.dispatchEvent(new CustomEvent("distro_gdrive_config_changed",{detail:e})),e},$=(t,a=null)=>{const e=a||S()||{},r=t.customerName||t.partyName||"Cash Customer",l=t.partyAddress||"Local Market",d=t.partyGstin||"",n=t.partyPhone||"",p=t.invoiceNo||"INV-001",m=t.date?t.date.split("T")[0]:new Date().toISOString().split("T")[0],s=Array.isArray(t.items)?t.items:[],f=Number(t.grandTotal||0),c=Number(t.taxTotal||0),o=Number(t.taxableSubtotal||t.subtotal||f-c),g=t.paymentStatus==="PAID"||t.state==="paid";let u="";return s.forEach((i,T)=>{if(i.isSection||i.isNote)return;const x=Number(i.qty||1),h=Number(i.price||0),U=Number(i.total||x*h),A=Number(i.gstRate||0);Number(i.itemGstAmount||i.gstVal||0),u+=`
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px 6px; text-align: center; color: #64748b;">${T+1}</td>
        <td style="padding: 8px 6px; font-weight: 600; color: #0f172a;">
          ${i.name||"Item"}
          ${i.brand&&i.brand!=="General"?`<br/><span style="font-size: 9px; color: #64748b; font-weight: normal;">Brand: ${i.brand}</span>`:""}
        </td>
        <td style="padding: 8px 6px; text-align: center; color: #64748b;">${i.hsn||"-"}</td>
        <td style="padding: 8px 6px; text-align: center; font-weight: 700;">${x} ${i.unit||"Pcs"}</td>
        <td style="padding: 8px 6px; text-align: right;">₹${h.toFixed(2)}</td>
        <td style="padding: 8px 6px; text-align: center; color: #64748b;">${A}%</td>
        <td style="padding: 8px 6px; text-align: right; font-weight: 700; color: #0f172a;">₹${U.toFixed(2)}</td>
      </tr>
    `}),`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Invoice #${p} - ${r}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #ffffff; }
    .invoice-card { max-width: 800px; margin: 0 auto; border: 1.5px solid #000000; padding: 20px; box-sizing: border-box; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000000; padding-bottom: 12px; margin-bottom: 14px; }
    .firm-title { font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .firm-sub { font-size: 11px; color: #334155; margin: 3px 0 0 0; }
    .doc-type { text-align: right; }
    .doc-badge { display: inline-block; padding: 4px 12px; background: #000000; color: #ffffff; font-weight: 900; font-size: 12px; letter-spacing: 1px; border-radius: 3px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; font-size: 11px; }
    .box { border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #f8fafc; }
    .box-title { font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #0f172a; color: #ffffff; padding: 8px 6px; font-size: 10.5px; text-transform: uppercase; }
    .totals-area { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px; padding-top: 10px; border-top: 2px solid #000000; }
    .grand-total-box { background: #f1f5f9; border: 1.5px solid #0f172a; padding: 12px 18px; border-radius: 6px; text-align: right; min-width: 220px; }
    .paid-stamp { display: inline-block; padding: 3px 10px; background: #dcfce7; color: #15803d; font-weight: 900; font-size: 12px; border: 1px solid #86efac; border-radius: 4px; margin-top: 6px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <h1 class="firm-title">${e.name||"JAI MAA SHARDEY ENTERPRISES"}</h1>
        <p class="firm-sub">${e.address||"Uttam Nagar, New Delhi - 110059"}</p>
        <p class="firm-sub"><strong>GSTIN:</strong> ${e.gstin||"07GHQPD6817P1ZI"} | <strong>Phone:</strong> ${e.phone||"9999999999"}</p>
      </div>
      <div class="doc-type">
        <div class="doc-badge">TAX INVOICE</div>
        <div style="font-size: 11px; margin-top: 6px; font-weight: 700;">ORIGINAL FOR RECIPIENT</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="box">
        <div class="box-title">Invoice Information</div>
        <div><strong>Invoice No:</strong> #${p}</div>
        <div><strong>Date:</strong> ${m}</div>
        <div><strong>Place of Supply:</strong> ${t.placeOfSupply||"Delhi (07)"}</div>
        <div><strong>Payment Terms:</strong> ${t.paymentTerms||"Immediate"}</div>
      </div>
      <div class="box">
        <div class="box-title">Billed To (Customer Details)</div>
        <div style="font-weight: 800; font-size: 12px; color: #0f172a;">${r}</div>
        <div>${l}</div>
        ${d?`<div><strong>GSTIN:</strong> ${d}</div>`:""}
        ${n?`<div><strong>Phone:</strong> ${n}</div>`:""}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Item Description</th>
          <th style="width: 70px;">HSN</th>
          <th style="width: 80px;">Qty</th>
          <th style="width: 80px; text-align: right;">Rate</th>
          <th style="width: 50px;">GST%</th>
          <th style="width: 90px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${u}
      </tbody>
    </table>

    <div class="totals-area">
      <div style="max-width: 480px; font-size: 11px;">
        <div><strong>Bank Details:</strong> ${e.bankName||"State Bank of India"}</div>
        <div><strong>Account No:</strong> ${e.bankAccountNo||"XXXXXXXXXXXX"} | <strong>IFSC:</strong> ${e.bankIfsc||"SBIN0000000"}</div>
        <div style="margin-top: 8px; color: #64748b; font-style: italic;">Thank you for your business! This is a computer-generated tax invoice.</div>
      </div>
      <div class="grand-total-box">
        <div style="font-size: 11px; color: #475569;">Taxable Amount: <strong>₹${o.toFixed(2)}</strong></div>
        <div style="font-size: 11px; color: #475569;">Total GST: <strong>₹${c.toFixed(2)}</strong></div>
        <div style="font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 4px; border-top: 1px solid #cbd5e1; padding-top: 4px;">
          ₹${f.toFixed(2)}
        </div>
        ${g?'<div class="paid-stamp">✓ FULLY PAID</div>':'<div style="color: #dc2626; font-size: 10px; font-weight: 800; margin-top: 4px;">UNPAID / POSTED</div>'}
      </div>
    </div>

    <div class="footer">
      <div>Issued By: ${t.operator||"DistroPulse Operator"}</div>
      <div>Archived to Google Drive Cloud: ${new Date().toLocaleString("en-IN")}</div>
      <div style="font-weight: 700;">Authorised Signatory</div>
    </div>
  </div>
</body>
</html>`},_=async(t,a=null)=>{const e=Date.now(),r=D(),l=a||S();if(!t||!t.invoiceNo)return{success:!1,error:"Invalid invoice data"};const d=$(t,l),n=(t.customerName||t.partyName||"Customer").replace(/[^a-zA-Z0-9_-]/g,"_"),p=`Bill_${t.invoiceNo}_${n}_${t.date?t.date.split("T")[0]:Date.now()}`;if(r.webhookUrl&&r.webhookUrl.trim().startsWith("https://script.google.com"))try{const s={action:"UPLOAD_BILL",invoiceNo:String(t.invoiceNo),customerName:t.customerName||t.partyName||"Customer",date:t.date,grandTotal:t.grandTotal,folderName:r.folderName||"DistroPlus Invoices & Bills",fileName:p,html:d,invoiceData:t},f=await fetch(r.webhookUrl.trim(),{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(s)}),c=Date.now()-e;let o=null;try{o=await f.json()}catch{o={success:!0,message:"Google Drive accepted upload"}}if(o&&(o.success||o.fileUrl||o.fileId))return y(t.id,{driveFileUrl:o.fileUrl||"",driveFileId:o.fileId||"",driveFileName:o.fileName||p+".pdf",driveUploadedAt:Date.now()}),N({invoiceNo:t.invoiceNo,customerName:t.customerName||t.partyName,durationMs:c,fileUrl:o.fileUrl,success:!0}),{success:!0,durationMs:c,fileUrl:o.fileUrl,fileId:o.fileId,fileName:o.fileName||p+".pdf",folderUrl:o.folderUrl}}catch(s){console.warn("[GoogleDriveService] Webhook upload error:",s)}if(r.localServerUrl)try{const s=new FormData,f=new Blob([d],{type:"text/html"});s.append("file",f,`${p}.html`),s.append("invoice_number",String(t.invoiceNo)),s.append("customer_name",t.customerName||t.partyName||"Customer"),s.append("total_amount",String(t.grandTotal||0)),s.append("bill_date",t.date?t.date.split("T")[0]:""),s.append("items_json",JSON.stringify(t.items||[]));const c=await fetch(`${r.localServerUrl.replace(/\/+$/,"")}/api/bills/upload`,{method:"POST",body:s});if(c.ok){const o=await c.json(),g=Date.now()-e;if(o.success)return y(t.id,{driveFileUrl:o.fileUrl||"",driveFileId:o.fileId||"",driveFileName:p+".pdf",driveUploadedAt:Date.now()}),N({invoiceNo:t.invoiceNo,customerName:t.customerName||t.partyName,durationMs:g,fileUrl:o.fileUrl,success:!0}),{success:!0,durationMs:g,...o}}}catch{}return P(t),{success:!1,queued:!0,durationMs:Date.now()-e,error:r.webhookUrl?"Upload temporarily delayed, queued for auto-retry":"Google Drive webhook not configured yet"}};function y(t,a){try{const e=w(),r=e.findIndex(l=>l.id===t);r!==-1&&(e[r]={...e[r],...a},O("distro_invoices",e))}catch(e){console.warn("Failed to record drive meta on invoice:",e)}}function N(t){typeof window<"u"&&window.dispatchEvent(new CustomEvent("distro_drive_upload_completed",{detail:t}))}const P=t=>{try{const a=localStorage.getItem(b),e=a?JSON.parse(a):[];e.some(r=>r.id===t.id||String(r.invoiceNo)===String(t.invoiceNo))||(e.push({id:t.id,invoiceNo:t.invoiceNo,customerName:t.customerName||t.partyName,grandTotal:t.grandTotal,date:t.date,queuedAt:Date.now()}),localStorage.setItem(b,JSON.stringify(e)))}catch{}},F=async(t=null)=>{const a=w().filter(l=>l&&l.state!=="draft");let e=0,r=0;for(let l=0;l<a.length;l++){const d=a[l];t&&t(l+1,a.length,d);try{(await _(d)).success?e++:r++}catch{r++}await new Promise(n=>setTimeout(n,200))}return{total:a.length,successCount:e,errorCount:r}},G=`// ====================================================================
// DISTROPULSE ERP: OFFICIAL GOOGLE DRIVE AUTO-BACKUP WEBHOOK SCRIPT
// Paste this in https://script.google.com and deploy as Web App
// ====================================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // 1. Target Folder in Google Drive (created automatically if missing)
    var folderName = data.folderName || "DistroPlus Invoices & Bills";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    
    // 2. Clean File Name
    var invNo = (data.invoiceNo || "Invoice").replace(/[^a-zA-Z0-9_-]/g, "_");
    var custName = (data.customerName || "Customer").replace(/[^a-zA-Z0-9_-]/g, "_");
    var fileName = "Bill_" + invNo + "_" + custName;
    
    // 3. Convert HTML to High-Res Vector PDF natively in Google Drive!
    var htmlContent = data.html;
    var htmlBlob = Utilities.newBlob(htmlContent, 'text/html', fileName + '.html');
    var pdfBlob = htmlBlob.getAs('application/pdf').setName(fileName + '.pdf');
    
    // 4. Update existing bill file or create fresh
    var existingFiles = folder.getFilesByName(fileName + '.pdf');
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }
    
    var file = folder.createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      fileName: file.getName(),
      folderUrl: folder.getUrl(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    service: "DistroPlus Google Drive Auto-Backup Webhook",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
`;export{G,F as b,D as g,E as s,_ as u};
