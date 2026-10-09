import{b as u}from"./vendor-qr-CjSdxGTc.js";const d=(t,n,e,o="")=>{const r=(t||"payee@upi").trim(),l=(n||"Distributor Agency").trim(),m=Number(e||0).toFixed(2),c=o?`Bill ${o}`:"Payment";return`upi://pay?pa=${encodeURIComponent(r)}&pn=${encodeURIComponent(l)}&am=${m}&cu=INR&tn=${encodeURIComponent(c)}`},I=async(t,n,e,o="")=>{const r=d(t,n,e,o);try{return await u.toDataURL(r,{width:360,margin:1,color:{dark:"#000000",light:"#ffffff"}})}catch(l){return console.error("Error generating UPI QR code:",l),null}},g=async(t,n)=>{const e=JSON.stringify({SellerGSTIN:n?.gstin||"07AAACG1234F1Z8",BuyerGSTIN:t?.partyGstin||"URP",DocNo:t?.invoiceNo||"INV",DocTyp:"INV",DocDt:(t?.date||new Date().toISOString()).split("T")[0],TotInvVal:Number(t?.grandTotal||0).toFixed(2),ItemCnt:(t?.items||[]).length,MainHsnCode:t?.items?.[0]?.hsn||"1905",Irn:t?.irn||"IRN-SIMULATED"});try{return await u.toDataURL(e,{width:220,margin:1,color:{dark:"#1e293b",light:"#ffffff"}})}catch(o){return console.error("Error generating e-Invoice QR:",o),null}},b=(t,n)=>{const e=t?.invoiceNo||"Bill",o=Number(t?.grandTotal||0).toLocaleString("en-IN"),r=Number(t?.paidAmount||0).toLocaleString("en-IN"),l=Number(t?.balanceAmount||0).toLocaleString("en-IN"),m=n?.name||"Distributor Agency",c=n?.upiId||n?.email||"";let a=`*INVOICE: ${e}*
`;return a+=`From: *${m}*
`,a+=`Date: ${new Date(t?.date||Date.now()).toLocaleDateString("en-IN")}

`,a+=`*Bill Amount:* ₹${o}
`,a+=`*Payment Received:* ₹${r}
`,Number(t?.balanceAmount)>0&&(a+=`*Due Balance:* ₹${l}
`),a+=`*Status:* ${t?.paymentStatus||"PAID"}

`,a+=`*Items Summary:*
`,(t?.items||[]).slice(0,5).forEach((s,i)=>{a+=`${i+1}. ${s.name} (${s.qty} ${s.unit||"Pcs"}) - ₹${Number(s.total||0).toLocaleString("en-IN")}
`}),(t?.items||[]).length>5&&(a+=`...and ${t.items.length-5} more items.
`),c&&Number(t?.balanceAmount)>0&&(a+=`
📲 *Pay via UPI:* ${c}
`),a+=`
Thank you for doing business with us!`,a},N=(t,n)=>{let e=(t||"").replace(/[^0-9]/g,"");return e.length===10&&(e="91"+e),`https://api.whatsapp.com/send?phone=${e}&text=${encodeURIComponent(n)}`},$=(t,n)=>`sms:${(t||"").replace(/[^0-9+]/g,"")}?body=${encodeURIComponent(n)}`,y=(t,n,e)=>`mailto:${t||""}?subject=${encodeURIComponent(n)}&body=${encodeURIComponent(e)}`;export{N as a,b,g as c,$ as d,y as e,I as g};
