const catSearchEl = document.getElementById("catSearch");
const catDropdownEl = document.getElementById("catDropdown");
const commEl = document.getElementById("comm");

// Fast category search across 7,851 PK categories
catSearchEl.addEventListener("input", () => {
  const q = catSearchEl.value.trim().toLowerCase();
  catDropdownEl.innerHTML = "";
  if (!q || typeof DARAZ_CATEGORIES === "undefined") {
    catDropdownEl.classList.add("hidden");
    return;
  }
  const matches = [];
  for (let i = 0; i < DARAZ_CATEGORIES.length; i++) {
    if (DARAZ_CATEGORIES[i][0].toLowerCase().includes(q)) {
      matches.push(DARAZ_CATEGORIES[i]);
      if (matches.length >= 25) break;
    }
  }
  if (!matches.length) {
    catDropdownEl.classList.add("hidden");
    return;
  }
  matches.forEach(([name, rate]) => {
    const div = document.createElement("div");
    div.className = "drop-item";
    div.innerHTML = `<span>${name}</span><span class="drop-rate">${rate.toFixed(2)}%</span>`;
    div.addEventListener("click", () => {
      catSearchEl.value = name;
      commEl.value = rate.toFixed(2);
      catDropdownEl.classList.add("hidden");
      solvePricing(false);
    });
    catDropdownEl.appendChild(div);
  });
  catDropdownEl.classList.remove("hidden");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".autocomplete-wrap")) catDropdownEl.classList.add("hidden");
});

// Toggle Advanced Settings
document.getElementById("btnToggleAdv").addEventListener("click", function () {
  const box = document.getElementById("advBox");
  const isHidden = box.classList.toggle("hidden");
  this.textContent = isHidden ? "+ Advanced Settings (VAT, Packaging, Ads, Returns)" : "- Hide Advanced Settings";
});

function fmt(num) {
  return "Rs. " + Math.round(num).toLocaleString("en-PK");
}

function getDropoffFee(price) {
  if (price <= 500) return 10;
  if (price <= 1000) return 20;
  if (price <= 2000) return 40;
  return 60;
}

function evaluateSalePrice(salePrice, purchaseCost, packagingCost, commRate, vatRate, handlingMode, paymentType, returnPct, adsPct, useFsm, useVoucher, isNonAtl) {
  const commission = salePrice * commRate;
  const commVat = commission * vatRate;
  const paymentFee = salePrice * 0.0225;
  const handleFee = handlingMode === "dropoff" ? getDropoffFee(salePrice) : (handlingMode === "pickup_std" ? 30 : 120);
  const fsmFee = useFsm ? Math.min(200, Math.max(30, salePrice * 0.06)) : 0;
  const voucherFee = useVoucher ? salePrice * 0.02 : 0;
  const otherVat = (paymentFee + handleFee + fsmFee + voucherFee) * vatRate;
  let taxRate = paymentType === "cod" ? 0.02 : 0.01;
  if (isNonAtl) taxRate = (taxRate * 2) + 0.01;
  const whtFee = salePrice * taxRate;

  const darazTotal = commission + commVat + paymentFee + handleFee + fsmFee + voucherFee + otherVat + whtFee;
  const payout = salePrice - darazTotal;
  const netProfit = payout - purchaseCost - packagingCost - (salePrice * returnPct) - (salePrice * adsPct);
  return { darazTotal, payout, netProfit, extraBuffers: (salePrice * returnPct) + (salePrice * adsPct) + packagingCost };
}

let currentResult = { orig: 0, sale: 0, urdu: "" };
let historyList = JSON.parse(localStorage.getItem("sellerprice_history") || "[]");

function solvePricing(saveToHistory) {
  const purchaseCost = Math.max(0, parseFloat(document.getElementById("purchaseCost").value) || 0);
  const packagingCost = Math.max(0, parseFloat(document.getElementById("packagingCost").value) || 0);
  const commRate = Math.max(0, parseFloat(commEl.value) || 0) / 100;
  const vatRate = parseFloat(document.getElementById("vat").value) || 0.15;
  const targetType = document.getElementById("targetType").value;
  const targetPct = Math.max(0, parseFloat(document.getElementById("targetPct").value) || 0) / 100;
  const discountPct = Math.min(90, Math.max(0, parseFloat(document.getElementById("discountPct").value) || 0));
  const returnPct = Math.max(0, parseFloat(document.getElementById("returnPct").value) || 0) / 100;
  const adsPct = Math.max(0, parseFloat(document.getElementById("adsPct").value) || 0) / 100;
  const handlingMode = document.getElementById("handling").value;
  const paymentType = document.getElementById("paymentType").value;
  const useFsm = document.getElementById("fsm").checked;
  const useVoucher = document.getElementById("voucher").checked;
  const isNonAtl = document.getElementById("nonAtl").checked;

  let lo = purchaseCost + packagingCost;
  let hi = Math.max(lo * 15, 20000);
  for (let i = 0; i < 45; i++) {
    const mid = (lo + hi) / 2;
    const res = evaluateSalePrice(mid, purchaseCost, packagingCost, commRate, vatRate, handlingMode, paymentType, returnPct, adsPct, useFsm, useVoucher, isNonAtl);
    const desiredProfit = targetType === "roi" ? (purchaseCost * targetPct) : (mid * targetPct);
    if (res.netProfit >= desiredProfit) hi = mid;
    else lo = mid;
  }

  const salePrice = Math.ceil(hi);
  const r = evaluateSalePrice(salePrice, purchaseCost, packagingCost, commRate, vatRate, handlingMode, paymentType, returnPct, adsPct, useFsm, useVoucher, isNonAtl);
  const discountFactor = 1 - (discountPct / 100);
  const origPrice = discountFactor > 0 ? Math.ceil(salePrice / discountFactor) : salePrice;
  const costRoi = purchaseCost > 0 ? (r.netProfit / purchaseCost) * 100 : 0;
  const saleMargin = salePrice > 0 ? (r.netProfit / salePrice) * 100 : 0;

  document.getElementById("kpiOriginalPrice").textContent = fmt(origPrice);
  document.getElementById("kpiSalePrice").textContent = fmt(salePrice);
  document.getElementById("kpiNetProfit").textContent = fmt(r.netProfit);
  document.getElementById("kpiDualMargin").textContent = `Cost ROI: ${costRoi.toFixed(1)}% | Sale Margin: ${saleMargin.toFixed(1)}%`;
  document.getElementById("kpiAllDeductions").textContent = fmt(r.darazTotal + r.extraBuffers);
  document.getElementById("kpiPayout").textContent = `Net Payout: ${fmt(r.payout)}`;

  const urduText =
    `اگر آپ کی پروڈکٹ کی خرید قیمت ${Math.round(purchaseCost).toLocaleString("en-PK")} روپے ہے اور پیکنگ کا خرچ ${Math.round(packagingCost).toLocaleString("en-PK")} روپے ہے، ` +
    `تو دراز کمیشن، صوبائی ویلیو ایڈڈ ٹیکس، پیمنٹ فیس، ہینڈلنگ، اشتہارات اور واپسی کے اخراجات نکالنے کے بعد اپنا مطلوبہ خالص منافع (${Math.round(r.netProfit).toLocaleString("en-PK")} روپے) بچانے کے لیے ` +
    `آپ کو یہ چیز ${Math.round(salePrice).toLocaleString("en-PK")} روپے میں فروخت کرنی ہوگی۔ ` +
    `اگر آپ گاہک کو ${discountPct} فیصد ڈسکاؤنٹ دکھانا چاہتے ہیں تو دراز سیلر سینٹر میں اصل قیمت ${Math.round(origPrice).toLocaleString("en-PK")} روپے درج کریں۔ ` +
    `اس طرح ڈسکاؤنٹ کے بعد گاہک ${Math.round(salePrice).toLocaleString("en-PK")} روپے ادا کرے گا اور آپ کو خرید قیمت پر ${costRoi.toFixed(1)} فیصد منافع (فروخت قیمت کا ${saleMargin.toFixed(1)} فیصد خالص منافع) حاصل ہوگا۔`;

  document.getElementById("urduSummary").textContent = urduText;
  currentResult = { orig: Math.round(origPrice), sale: Math.round(salePrice), urdu: urduText };

  if (saveToHistory) {
    document.querySelectorAll(".kpi-card").forEach((c) => {
      c.classList.remove("pulse");
      void c.offsetWidth;
      c.classList.add("pulse");
    });

    const prodName = document.getElementById("productName").value.trim() || catSearchEl.value.trim() || "Daraz Product";
    historyList.unshift({
      name: prodName, cost: purchaseCost, orig: origPrice, discount: discountPct,
      sale: salePrice, profit: Math.round(r.netProfit), roi: costRoi.toFixed(1), margin: saleMargin.toFixed(1)
    });
    if (historyList.length > 30) historyList.pop();
    localStorage.setItem("sellerprice_history", JSON.stringify(historyList));
    renderHistory();
  }
}

function renderHistory() {
  const tbody = document.getElementById("historyBody");
  if (!historyList.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Click "Calculate Now" above to save your product calculation here automatically.</td></tr>`;
    return;
  }
  tbody.innerHTML = historyList.map((p, idx) => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td>${fmt(p.cost)}</td>
      <td>${fmt(p.orig)}</td>
      <td>${p.discount}%</td>
      <td><strong>${fmt(p.sale)}</strong></td>
      <td class="text-pos"><strong>${fmt(p.profit)}</strong></td>
      <td>${p.roi}% / ${p.margin}%</td>
      <td><button type="button" class="btn btn-red btn-sm del-btn" data-idx="${idx}">Remove</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".del-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      historyList.splice(parseInt(btn.dataset.idx), 1);
      localStorage.setItem("sellerprice_history", JSON.stringify(historyList));
      renderHistory();
    });
  });
}

// One-click copy buttons with animated feedback
function copyWithFeedback(btn, text, origLabel) {
  navigator.clipboard.writeText(String(text)).then(() => {
    btn.textContent = "Copied!";
    btn.classList.add("btn-copied");
    setTimeout(() => {
      btn.textContent = origLabel;
      btn.classList.remove("btn-copied");
    }, 1200);
  });
}

document.querySelectorAll("[data-copy]").forEach((btn) => {
  const origLabel = btn.textContent;
  btn.addEventListener("click", () => {
    const val = btn.dataset.copy === "orig" ? currentResult.orig : currentResult.sale;
    copyWithFeedback(btn, val, origLabel);
  });
});

document.getElementById("btnCopyUrdu").addEventListener("click", function () {
  copyWithFeedback(this, currentResult.urdu, "Copy Urdu");
});

document.getElementById("btnCalculate").addEventListener("click", () => solvePricing(true));

document.getElementById("btnClearHistory").addEventListener("click", () => {
  historyList = [];
  localStorage.setItem("sellerprice_history", JSON.stringify(historyList));
  renderHistory();
});

document.getElementById("btnExportCsv").addEventListener("click", () => {
  if (!historyList.length) return;
  const rows = [["Product", "Cost", "List Price", "Discount %", "Sale Price", "Net Profit", "Cost ROI %", "Sale Margin %"]];
  historyList.forEach((p) => rows.push([`"${p.name.replace(/"/g, '""')}"`, p.cost, p.orig, p.discount, p.sale, p.profit, p.roi, p.margin]));
  const csv = rows.map((r) => r.join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "sellerprice_history.csv";
  a.click();
});

document.querySelectorAll("input, select").forEach((el) => {
  if (el.id !== "catSearch") {
    el.addEventListener("input", () => solvePricing(false));
    el.addEventListener("change", () => solvePricing(false));
  }
});

solvePricing(false);
renderHistory();
