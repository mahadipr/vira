// ============ SESSION CHECK ============
(function checkAuth() {
  const session = sessionStorage.getItem('inventori_session');
  if (!session) {
    window.location.href = 'login.html';
    return;
  }
  try {
    const data = JSON.parse(session);
    if (!data.loggedIn) {
      window.location.href = 'login.html';
    }
  } catch (e) {
    window.location.href = 'login.html';
  }
})();

// ============ STATE ============
let items = [];
let cart = [];
let transactions = [];
let currentPage = 'dashboard';
let deleteTargetId = null;
let salesChart = null;
let reportChart = null;
let currentReportPeriod = 'daily';
let isLoading = false;

// ============ LOADING HELPERS ============
function showLoading() {
  isLoading = true;
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('active');
}

function hideLoading() {
  isLoading = false;
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('active');
}

// ============ GET SESSION ============
function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem('inventori_session') || '{}');
  } catch (e) {
    return {};
  }
}

function getUserRole() {
  return getSession().role || '';
}

function isAdmin() {
  return getUserRole() === 'Pemilik Toko';
}

// ============ INIT ============
async function init() {
  showLoading();
  try {
    await loadData();
    await loadTransactions();
    setupGreeting();
    applyRolePermissions();
    renderAll();
    setupKeyboardShortcuts();
    renderPosProducts();
  } catch (error) {
    console.error('Init error:', error);
    showNotification('Gagal memuat data dari server. Periksa koneksi internet.', 'error');
  } finally {
    hideLoading();
  }
}

// ============ DATA PERSISTENCE (MockAPI) ============
async function loadData() {
  try {
    const data = await apiGetItems();
    items = data.map(item => ({
      ...item,
      id: typeof item.id === 'string' ? item.id : String(item.id),
      stock: Number(item.stock) || 0,
      minStock: Number(item.minStock) || 0,
      price: Number(item.price) || 0,
      costPrice: Number(item.costPrice) || 0,
    }));
  } catch (e) {
    console.error('Error loading items:', e);
    items = [];
  }
}

async function loadTransactions() {
  try {
    const txData = await apiGetTransactions();
    const txItemsData = await apiGetAllTransactionItems();

    // Attach items to each transaction
    transactions = txData.map(tx => {
      const txItems = txItemsData.filter(ti => ti.transactionId === tx.txId);
      return {
        ...tx,
        id: tx.txId || tx.id,
        total: Number(tx.total) || 0,
        items: txItems.map(ti => ({
          itemId: ti.itemId,
          name: ti.name,
          qty: Number(ti.qty) || 0,
          price: Number(ti.price) || 0,
          costPrice: Number(ti.costPrice) || 0,
          subtotal: Number(ti.subtotal) || 0,
        })),
      };
    });
  } catch (e) {
    console.error('Error loading transactions:', e);
    transactions = [];
  }
}

// ============ ROLE-BASED PERMISSIONS ============
function applyRolePermissions() {
  const adminElements = document.querySelectorAll('.admin-only');

  if (isAdmin()) {
    adminElements.forEach(el => el.style.display = '');
    // Admin default page: dashboard
    if (currentPage === 'dashboard') {
      switchPage('dashboard');
    }
  } else {
    adminElements.forEach(el => el.style.display = 'none');
    // Kasir default page: transaction
    switchPage('transaction');
  }
}

// ============ GREETING ============
function setupGreeting() {
  const session = getSession();
  const username = session.username || 'Admin';
  const role = session.role || 'Pengguna';
  const hour = new Date().getHours();
  let greeting;

  if (hour < 12) greeting = 'Selamat Pagi';
  else if (hour < 15) greeting = 'Selamat Siang';
  else if (hour < 18) greeting = 'Selamat Sore';
  else greeting = 'Selamat Malam';

  document.getElementById('greetingText').textContent = `${greeting}, ${username}!`;
  document.getElementById('userName').textContent = username;
  document.getElementById('userAvatar').textContent = username.charAt(0).toUpperCase();
  document.getElementById('userRole').textContent = role;

  // Update mobile navbar username
  const mobileUserNameEl = document.getElementById('mobileUserName');
  if (mobileUserNameEl) mobileUserNameEl.textContent = username;
}

// ============ MOBILE SIDEBAR TOGGLE ============
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburgerBtn');

  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');

  // Update hamburger icon
  if (sidebar.classList.contains('open')) {
    hamburger.innerHTML = '<i data-feather="x"></i>';
  } else {
    hamburger.innerHTML = '<i data-feather="menu"></i>';
  }
  feather.replace();
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburgerBtn');

  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  hamburger.innerHTML = '<i data-feather="menu"></i>';
  feather.replace();
}

// ============ MOBILE USER DROPDOWN ============
function toggleMobileUserDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('mobileUserDropdown');
  if (dropdown) dropdown.classList.toggle('open');
}

// Close mobile dropdown when clicking outside
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('mobileUserDropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});

// ============ NAVIGATION ============
function switchPage(page) {
  // If kasir tries to access admin pages, redirect to transaction
  if (!isAdmin() && ['dashboard', 'inventory', 'alerts', 'report'].includes(page)) {
    page = 'transaction';
  }

  currentPage = page;

  // Hide all pages
  document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('hidden'));
  // Show target page
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.remove('hidden');

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 768) {
    closeSidebar();
  }

  // Re-render in case data changed
  renderAll();
}

// ============ RENDER ============
function renderAll() {
  renderStats();
  renderAlerts();
  renderTable();
  renderPosCart();
  renderTransactionHistory();
  renderPosProducts();
  if (isAdmin() && currentPage === 'dashboard') {
    renderSalesChart();
  }
  if (isAdmin() && currentPage === 'report') {
    renderReport();
  }
  feather.replace();
}

function renderStats() {
  const total = items.length;
  const totalStock = items.reduce((sum, i) => sum + i.stock, 0);

  // Counter for basic stats
  animateCounter('statTotal', total);
  animateCounter('statTotalStock', totalStock);

  // Financial stats
  const financials = calculateFinancials();
  document.getElementById('statGrossIncome').textContent = formatRupiah(financials.gross);
  document.getElementById('statNetIncome').textContent = formatRupiah(financials.net);

  // Update alert badge
  const danger = items.filter(i => i.stock <= i.minStock * 0.5).length;
  const warning = items.filter(i => i.stock > i.minStock * 0.5 && i.stock <= i.minStock).length;
  const alertCount = danger + warning;
  const badge = document.getElementById('alertBadge');
  if (badge) {
    badge.textContent = alertCount;
    badge.style.display = alertCount > 0 ? 'inline' : 'none';
  }
}

function calculateFinancials() {
  let gross = 0;
  let totalCost = 0;

  transactions.forEach(tx => {
    tx.items.forEach(txItem => {
      gross += txItem.price * txItem.qty;
      totalCost += txItem.costPrice * txItem.qty;
    });
  });

  return {
    gross: gross,
    net: gross - totalCost
  };
}

function formatRupiah(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

function animateCounter(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;

  const duration = 400;
  const step = (target - current) / (duration / 16);
  let value = current;

  const timer = setInterval(() => {
    value += step;
    if ((step > 0 && value >= target) || (step < 0 && value <= target)) {
      value = target;
      clearInterval(timer);
    }
    el.textContent = Math.round(value);
  }, 16);
}

// ============ SALES CHART ============
function renderSalesChart() {
  const ctx = document.getElementById('salesChart');
  if (!ctx) return;

  const last7Days = getLast7DaysSales();

  if (salesChart) {
    salesChart.data.labels = last7Days.labels;
    salesChart.data.datasets[0].data = last7Days.totals;
    salesChart.data.datasets[1].data = last7Days.counts;
    salesChart.update();
    return;
  }

  salesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: last7Days.labels,
      datasets: [
        {
          label: 'Pendapatan (Rp)',
          data: last7Days.totals,
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 2,
          borderRadius: 8,
          yAxisID: 'y',
        },
        {
          label: 'Jumlah Transaksi',
          data: last7Days.counts,
          type: 'line',
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          pointRadius: 5,
          pointBackgroundColor: 'rgba(16, 185, 129, 1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 12 },
            usePointStyle: true,
            pointStyle: 'circle',
          }
        },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(148, 163, 184, 0.15)',
          borderWidth: 1,
          cornerRadius: 12,
          padding: 12,
          callbacks: {
            label: function(context) {
              if (context.datasetIndex === 0) {
                return 'Pendapatan: Rp ' + context.raw.toLocaleString('id-ID');
              }
              return 'Transaksi: ' + context.raw;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          ticks: {
            color: '#64748b',
            font: { family: 'Inter', size: 11 },
            callback: (v) => 'Rp ' + (v / 1000).toFixed(0) + 'K'
          },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          ticks: {
            color: '#64748b',
            font: { family: 'Inter', size: 11 },
            stepSize: 1,
          },
          grid: { drawOnChartArea: false },
        }
      }
    }
  });
}

function getLast7DaysSales() {
  const labels = [];
  const totals = [];
  const counts = [];

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayName = dayNames[date.getDay()];
    const dateLabel = `${dayName}, ${date.getDate()}/${date.getMonth() + 1}`;

    labels.push(dateLabel);

    // Sum up transactions for this day
    const dayTx = transactions.filter(tx => tx.date.split('T')[0] === dateStr);
    const dayTotal = dayTx.reduce((sum, tx) => {
      return sum + tx.items.reduce((s, item) => s + (item.price * item.qty), 0);
    }, 0);

    totals.push(dayTotal);
    counts.push(dayTx.length);
  }

  return { labels, totals, counts };
}

// ============ ALERTS ============
function renderAlerts() {
  const lowStockItems = items
    .filter(i => i.stock <= i.minStock)
    .sort((a, b) => (a.stock / a.minStock) - (b.stock / b.minStock));

  const dashboardAlerts = document.getElementById('alertItems');
  const pageAlerts = document.getElementById('alertPageItems');

  if (lowStockItems.length === 0) {
    const emptyHtml = `
      <div class="alert-empty">
        <div class="empty-icon"><i data-feather="check-circle"></i></div>
        <p>Semua stok aman! Tidak ada barang yang perlu direstok.</p>
      </div>
    `;
    if (dashboardAlerts) dashboardAlerts.innerHTML = emptyHtml;
    if (pageAlerts) pageAlerts.innerHTML = emptyHtml;
    return;
  }

  const html = lowStockItems.map(item => {
    const ratio = item.stock / item.minStock;
    const urgency = ratio <= 0.5 ? '<i data-feather="alert-octagon" class="urgency-icon danger"></i> SEGERA' : '<i data-feather="alert-triangle" class="urgency-icon warning"></i> Menipis';
    return `
      <div class="alert-item">
        <div>
          <div class="item-name">${item.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 2px;">${item.category}</div>
        </div>
        <div style="text-align: right;">
          <div class="item-stock">${urgency}</div>
          <div style="font-size: 0.75rem; color: var(--text-tertiary);">Sisa: ${item.stock} / Min: ${item.minStock}</div>
        </div>
      </div>
    `;
  }).join('');

  if (dashboardAlerts) dashboardAlerts.innerHTML = html;
  if (pageAlerts) pageAlerts.innerHTML = html;
}

// ============ INVENTORY TABLE ============
function renderTable(filterText = '') {
  const tbody = document.getElementById('inventoryTableBody');
  const emptyEl = document.getElementById('emptyTable');
  if (!tbody) return;

  let filtered = items;
  if (filterText) {
    const q = filterText.toLowerCase();
    filtered = items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  tbody.innerHTML = filtered.map((item, index) => {
    const status = getStockStatus(item);
    return `
      <tr>
        <td>${index + 1}</td>
        <td style="font-weight: 600;">${item.name}</td>
        <td><span style="color: var(--text-secondary)">${item.category}</span></td>
        <td>
          <div class="stock-controls">
            <button class="stock-btn minus" onclick="adjustStock('${item.id}', -1)" title="Kurangi stok">−</button>
            <span class="stock-value">${item.stock}</span>
            <button class="stock-btn plus" onclick="adjustStock('${item.id}', 1)" title="Tambah stok">+</button>
          </div>
        </td>
        <td>${item.minStock}</td>
        <td>Rp ${item.price.toLocaleString('id-ID')}</td>
        <td>Rp ${item.costPrice.toLocaleString('id-ID')}</td>
        <td><span class="stock-badge ${status.class}"><span class="status-dot ${status.class}"></span> ${status.text}</span></td>
        <td>
          <div class="action-btns">
            <button class="action-btn" onclick="openEditModal('${item.id}')" title="Edit"><i data-feather="edit"></i></button>
            <button class="action-btn delete" onclick="openDeleteModal('${item.id}')" title="Hapus"><i data-feather="trash-2"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getStockStatus(item) {
  const ratio = item.stock / item.minStock;
  if (ratio <= 0.5) return { class: 'danger', text: 'Kritis' };
  if (ratio <= 1) return { class: 'warning', text: 'Menipis' };
  return { class: 'safe', text: 'Aman' };
}

// ============ STOCK ADJUSTMENT ============
async function adjustStock(id, delta) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  const newStock = item.stock + delta;
  if (newStock < 0) return;

  try {
    await apiUpdateItem(id, { stock: newStock });
    item.stock = newStock;
    renderAll();
  } catch (error) {
    showNotification('Gagal mengubah stok. Coba lagi.', 'error');
  }
}

// ============ FILTER ============
function filterItems() {
  const query = document.getElementById('searchInput').value;
  renderTable(query);
  feather.replace();
}

// ============ POS: PRODUCT GRID ============

// Map of item names to image filenames (without extension)
// Add entries here as images are added to the images/ folder
const productImageMap = {
  'Indomie Goreng': 'indomie_goreng',
  'Indomie Soto': 'indomie_soto',
  'Beras 5kg': 'beras_5kg',
  'Minyak Goreng 1L': 'minyak_1l',
  'Gula Pasir 1kg': 'gula_1kg',
  'Kopi Good Day Mocacinno': 'good_day',
  'Teh Celup Sosro': 'teh_celup',
  'Oasis 600ml': 'oasis_600ml',
  'Sabun Mandi Shinzui': 'sabun_shinzui',
  'Sampo Sachet Clear': 'sampo_clear',
  'Rokok Filter': 'roko_filter',
  'Gas LPG 3kg': 'gas_lpg',
};

function getProductImageSlug(name) {
  return productImageMap[name] || null;
}

function renderPosProducts(filterText = '') {
  const grid = document.getElementById('posProductGrid');
  const emptyEl = document.getElementById('posEmpty');
  if (!grid) return;

  let filtered = items;
  if (filterText) {
    const q = filterText.toLowerCase();
    filtered = items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  grid.innerHTML = filtered.map(item => {
    const inCart = cart.find(c => c.itemId === item.id);
    const cartBadge = inCart ? `<span class="pos-card-added">${inCart.qty}</span>` : '';
    const outClass = item.stock <= 0 ? 'out-of-stock' : '';

    // Check if product has an image
    const imgSlug = getProductImageSlug(item.name);
    let iconHtml;
    if (imgSlug) {
      iconHtml = `<div class="pos-card-icon"><img src="images/${imgSlug}.png" alt="${item.name}" class="pos-card-img"></div>`;
    } else {
      iconHtml = `<div class="pos-card-icon"><i data-feather="shopping-cart"></i></div>`;
    }

    return `
      <div class="pos-product-card ${outClass}" onclick="addToCartFromPOS('${item.id}')" title="${item.name}">
        ${cartBadge}
        ${iconHtml}
        <div class="pos-card-name">${item.name}</div>
        <div class="pos-card-price">Rp ${item.price.toLocaleString('id-ID')}</div>
        <div class="pos-card-stock">Stok: ${item.stock}</div>
      </div>
    `;
  }).join('');

  feather.replace();
}

function filterPosProducts() {
  const query = document.getElementById('posSearchInput').value;
  renderPosProducts(query);
}

// ============ POS: ADD TO CART ============
function addToCartFromPOS(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  const existingIndex = cart.findIndex(c => c.itemId === itemId);
  const currentCartQty = existingIndex >= 0 ? cart[existingIndex].qty : 0;

  if (currentCartQty + 1 > item.stock) {
    showNotification(`Stok tidak cukup! Tersedia: ${item.stock}, Di keranjang: ${currentCartQty}`, 'error');
    return;
  }

  if (existingIndex >= 0) {
    cart[existingIndex].qty += 1;
  } else {
    cart.push({
      itemId: item.id,
      name: item.name,
      price: item.price,
      costPrice: item.costPrice,
      qty: 1
    });
  }

  showNotification(`${item.name} ditambahkan ke keranjang`, 'success');
  renderPosCart();
  // Re-render product grid to update badges
  const searchInput = document.getElementById('posSearchInput');
  renderPosProducts(searchInput ? searchInput.value : '');
}

// Keep the old addToCart as a wrapper for backward compat
function addToCart() {
  // Not used in new POS layout, but kept for safety
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderPosCart();
  const searchInput = document.getElementById('posSearchInput');
  renderPosProducts(searchInput ? searchInput.value : '');
}

function updateCartQty(index, newQty) {
  if (newQty < 1) {
    removeFromCart(index);
    return;
  }

  const cartItem = cart[index];
  const item = items.find(i => i.id === cartItem.itemId);

  if (item && newQty > item.stock) {
    showNotification(`Stok tidak cukup! Tersedia: ${item.stock}`, 'error');
    return;
  }

  cart[index].qty = newQty;
  renderPosCart();
  const searchInput = document.getElementById('posSearchInput');
  renderPosProducts(searchInput ? searchInput.value : '');
}

// ============ POS: RENDER CART SIDEBAR ============
function renderPosCart() {
  const cartItemsEl = document.getElementById('posCartItems');
  const emptyEl = document.getElementById('cartEmpty');
  const footerEl = document.getElementById('cartFooter');
  const countEl = document.getElementById('posCartCount');
  if (!cartItemsEl) return;

  if (cart.length === 0) {
    cartItemsEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    if (footerEl) footerEl.style.display = 'none';
    if (countEl) countEl.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (footerEl) footerEl.style.display = 'block';

  // Update cart count badge
  const totalItems = cart.reduce((sum, c) => sum + c.qty, 0);
  if (countEl) {
    countEl.textContent = totalItems;
    countEl.style.display = 'inline';
  }

  let total = 0;
  cartItemsEl.innerHTML = cart.map((cartItem, index) => {
    const subtotal = cartItem.price * cartItem.qty;
    total += subtotal;
    return `
      <div class="pos-cart-item">
        <div class="pos-cart-item-info">
          <div class="pos-cart-item-name">${cartItem.name}</div>
          <div class="pos-cart-item-price">Rp ${cartItem.price.toLocaleString('id-ID')}</div>
        </div>
        <div class="pos-cart-item-qty">
          <button class="qty-btn" onclick="updateCartQty(${index}, ${cartItem.qty - 1})">−</button>
          <span class="qty-value">${cartItem.qty}</span>
          <button class="qty-btn" onclick="updateCartQty(${index}, ${cartItem.qty + 1})">+</button>
        </div>
        <div class="pos-cart-item-subtotal">Rp ${subtotal.toLocaleString('id-ID')}</div>
        <button class="pos-cart-item-remove" onclick="removeFromCart(${index})" title="Hapus">
          <i data-feather="x"></i>
        </button>
      </div>
    `;
  }).join('');

  // Update totals
  const totalEl = document.getElementById('cartTotalValue');
  if (totalEl) totalEl.textContent = formatRupiah(total);
  const totalItemsEl = document.getElementById('posTotalItems');
  if (totalItemsEl) totalItemsEl.textContent = totalItems;

  feather.replace();
}

// Backward compatibility aliases
function renderCart() { renderPosCart(); }
function populateItemSelect() { renderPosProducts(); }

// ============ CHECKOUT ============
async function checkout() {
  if (cart.length === 0) {
    showNotification('Keranjang belanja kosong!', 'error');
    return;
  }

  // Validate stock availability
  for (const cartItem of cart) {
    const item = items.find(i => i.id === cartItem.itemId);
    if (!item) {
      showNotification(`Barang "${cartItem.name}" tidak ditemukan!`, 'error');
      return;
    }
    if (item.stock < cartItem.qty) {
      showNotification(`Stok "${item.name}" tidak cukup! Tersedia: ${item.stock}, Dipesan: ${cartItem.qty}`, 'error');
      return;
    }
  }

  showLoading();

  try {
    // Create transaction record
    const session = getSession();
    const now = new Date();
    const txId = generateTransactionId(now);
    const total = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);

    // 1. Save transaction header to MockAPI (Akun 2)
    await apiCreateTransaction({
      txId: txId,
      date: now.toISOString(),
      cashier: session.username || 'Unknown',
      total: total,
    });

    // 2. Save each transaction item to MockAPI (Akun 2)
    const txItems = cart.map(c => ({
      transactionId: txId,
      itemId: c.itemId,
      name: c.name,
      qty: c.qty,
      price: c.price,
      costPrice: c.costPrice,
      subtotal: c.price * c.qty,
    }));

    for (const txItem of txItems) {
      await apiCreateTransactionItem(txItem);
    }

    // 3. Deduct stock for each item via MockAPI (Akun 1)
    for (const cartItem of cart) {
      const item = items.find(i => i.id === cartItem.itemId);
      if (item) {
        const newStock = item.stock - cartItem.qty;
        await apiUpdateItem(item.id, { stock: newStock });
        item.stock = newStock;
      }
    }

    // Build local transaction object for receipt
    const transaction = {
      id: txId,
      date: now.toISOString(),
      cashier: session.username || 'Unknown',
      items: cart.map(c => ({
        itemId: c.itemId,
        name: c.name,
        qty: c.qty,
        price: c.price,
        costPrice: c.costPrice,
        subtotal: c.price * c.qty
      })),
      total: total
    };

    transactions.push(transaction);

    // Show receipt
    showReceipt(transaction);

    // Clear cart
    cart = [];

    renderAll();
    showNotification('Transaksi berhasil! Struk siap dicetak.', 'success');
  } catch (error) {
    console.error('Checkout error:', error);
    showNotification('Gagal menyimpan transaksi. Coba lagi.', 'error');
  } finally {
    hideLoading();
  }
}

function generateTransactionId(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;

  // Count transactions today
  const todayTx = transactions.filter(tx => tx.id.includes(dateStr));
  const seq = String(todayTx.length + 1).padStart(3, '0');

  return `TRX-${dateStr}-${seq}`;
}

// ============ RECEIPT ============
function showReceipt(transaction) {
  const receiptContent = document.getElementById('receiptContent');
  const now = new Date(transaction.date);

  const itemsHtml = transaction.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td class="receipt-center">${item.qty}</td>
      <td class="receipt-right">Rp ${item.price.toLocaleString('id-ID')}</td>
      <td class="receipt-right">Rp ${item.subtotal.toLocaleString('id-ID')}</td>
    </tr>
  `).join('');

  receiptContent.innerHTML = `
    <div class="receipt-paper">
      <div class="receipt-header">
        <div class="receipt-logo">
          <img src="images/logooo.png" alt="VIRA Logo" class="receipt-logo-img">
        </div>
        <h2>VIRA</h2>
        <p class="receipt-subtitle">Struk Transaksi</p>
      </div>

      <div class="receipt-info">
        <div class="receipt-info-row">
          <span>No. Transaksi:</span>
          <span class="receipt-bold">${transaction.id}</span>
        </div>
        <div class="receipt-info-row">
          <span>Tanggal:</span>
          <span>${now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div class="receipt-info-row">
          <span>Waktu:</span>
          <span>${now.toLocaleTimeString('id-ID')}</span>
        </div>
        <div class="receipt-info-row">
          <span>Kasir:</span>
          <span>${transaction.cashier}</span>
        </div>
      </div>

      <div class="receipt-divider"></div>

      <table class="receipt-table">
        <thead>
          <tr>
            <th>Barang</th>
            <th class="receipt-center">Qty</th>
            <th class="receipt-right">Harga</th>
            <th class="receipt-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="receipt-divider"></div>

      <div class="receipt-total">
        <span>TOTAL</span>
        <span>Rp ${transaction.total.toLocaleString('id-ID')}</span>
      </div>

      <div class="receipt-footer">
        <p>Terima kasih atas kunjungan Anda!</p>
        <p class="receipt-small">Barang yang sudah dibeli tidak dapat ditukar</p>
      </div>
    </div>
  `;

  document.getElementById('receiptModal').classList.add('active');
  feather.replace();
}

function closeReceiptModal() {
  document.getElementById('receiptModal').classList.remove('active');
}

function printReceipt() {
  window.print();
}


// ============ TRANSACTION HISTORY ============
function renderTransactionHistory() {
  const tbody = document.getElementById('historyTableBody');
  const emptyEl = document.getElementById('emptyHistory');
  if (!tbody) return;

  const filteredTx = getFilteredTransactions();

  if (filteredTx.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  // Sort by date descending (newest first)
  const sorted = [...filteredTx].sort((a, b) => new Date(b.date) - new Date(a.date));

  tbody.innerHTML = sorted.map(tx => {
    const date = new Date(tx.date);
    const totalItems = tx.items.reduce((sum, i) => sum + i.qty, 0);
    return `
      <tr>
        <td><span class="tx-id">${tx.id}</span></td>
        <td>${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${tx.cashier}</td>
        <td>${totalItems} item</td>
        <td style="font-weight: 700;">Rp ${tx.total.toLocaleString('id-ID')}</td>
        <td>
          <button class="action-btn" onclick="viewReceipt('${tx.id}')" title="Lihat Struk">
            <i data-feather="eye"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function getFilteredTransactions() {
  const searchEl = document.getElementById('searchTransaction');
  if (!searchEl || !searchEl.value) return transactions;

  const q = searchEl.value.toLowerCase();
  return transactions.filter(tx =>
    tx.id.toLowerCase().includes(q) ||
    tx.cashier.toLowerCase().includes(q)
  );
}

function filterTransactions() {
  renderTransactionHistory();
  feather.replace();
}

function viewReceipt(txId) {
  const tx = transactions.find(t => t.id === txId);
  if (tx) showReceipt(tx);
}

// ============ MODAL: ADD / EDIT ============
function openAddModal() {
  document.getElementById('modalTitle').innerHTML = '<i data-feather="plus"></i> Tambah Barang Baru';
  feather.replace();
  document.getElementById('editItemId').value = '';
  document.getElementById('itemForm').reset();
  document.getElementById('itemModal').classList.add('active');
}

function openEditModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('modalTitle').innerHTML = '<i data-feather="edit"></i> Edit Barang';
  feather.replace();
  document.getElementById('editItemId').value = item.id;
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemCategory').value = item.category;
  document.getElementById('itemStock').value = item.stock;
  document.getElementById('itemMinStock').value = item.minStock;
  document.getElementById('itemPrice').value = item.price;
  document.getElementById('itemCostPrice').value = item.costPrice;
  document.getElementById('itemModal').classList.add('active');
}

function closeModal() {
  document.getElementById('itemModal').classList.remove('active');
}

async function handleSaveItem(event) {
  event.preventDefault();

  const editId = document.getElementById('editItemId').value;
  const name = document.getElementById('itemName').value.trim();
  const category = document.getElementById('itemCategory').value.trim();
  const stock = parseInt(document.getElementById('itemStock').value) || 0;
  const minStock = parseInt(document.getElementById('itemMinStock').value) || 0;
  const price = parseInt(document.getElementById('itemPrice').value) || 0;
  const costPrice = parseInt(document.getElementById('itemCostPrice').value) || 0;

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i data-feather="loader"></i> Menyimpan...';
  feather.replace();

  try {
    if (editId) {
      // Update existing via API
      await apiUpdateItem(editId, { name, category, stock, minStock, price, costPrice });
    } else {
      // Create new via API
      await apiCreateItem({ name, category, stock, minStock, price, costPrice });
    }

    // Reload items from API
    await loadData();
    renderAll();
    closeModal();
    showNotification(editId ? 'Barang berhasil diperbarui!' : 'Barang baru berhasil ditambahkan!', 'success');
  } catch (error) {
    console.error('Save item error:', error);
    showNotification('Gagal menyimpan barang. Coba lagi.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i data-feather="save"></i> Simpan';
    feather.replace();
  }

  return false;
}

// ============ MODAL: DELETE ============
function openDeleteModal(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  deleteTargetId = id;
  document.getElementById('deleteItemName').textContent = item.name;
  document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('active');
  deleteTargetId = null;
}

async function confirmDelete() {
  if (deleteTargetId !== null) {
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i data-feather="loader"></i> Menghapus...';
    feather.replace();

    try {
      await apiDeleteItem(deleteTargetId);
      await loadData();
      renderAll();
      showNotification('Barang berhasil dihapus!', 'success');
    } catch (error) {
      console.error('Delete error:', error);
      showNotification('Gagal menghapus barang. Coba lagi.', 'error');
    } finally {
      deleteBtn.disabled = false;
      deleteBtn.innerHTML = '<i data-feather="trash-2"></i> Hapus';
      feather.replace();
    }
  }
  closeDeleteModal();
}

// ============ NOTIFICATIONS ============
function showNotification(message, type = 'info') {
  // Remove any existing notification
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;

  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';

  toast.innerHTML = `
    <i data-feather="${iconName}"></i>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);
  feather.replace();

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============ REPORT: LAPORAN PENJUALAN ============

function switchReportPeriod(period) {
  currentReportPeriod = period;

  // Update active tab
  document.querySelectorAll('.period-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.period === period);
  });

  // Update date picker type and label
  const picker = document.getElementById('reportDatePicker');
  const label = document.getElementById('reportDateLabel');
  const today = new Date();

  switch (period) {
    case 'daily':
      picker.type = 'date';
      picker.value = today.toISOString().split('T')[0];
      label.textContent = 'Pilih Tanggal';
      break;
    case 'weekly':
      picker.type = 'week';
      // Set to current week
      const weekNum = getISOWeek(today);
      picker.value = `${today.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      label.textContent = 'Pilih Minggu';
      break;
    case 'monthly':
      picker.type = 'month';
      picker.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      label.textContent = 'Pilih Bulan';
      break;
    case 'yearly':
      picker.type = 'number';
      picker.value = today.getFullYear();
      picker.min = 2020;
      picker.max = 2099;
      label.textContent = 'Pilih Tahun';
      break;
  }

  renderReport();
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function getReportDateRange() {
  const picker = document.getElementById('reportDatePicker');
  const value = picker.value;
  let start, end;

  switch (currentReportPeriod) {
    case 'daily': {
      if (!value) return null;
      start = new Date(value + 'T00:00:00');
      end = new Date(value + 'T23:59:59');
      break;
    }
    case 'weekly': {
      if (!value) return null;
      // Parse week input: YYYY-Www
      const parts = value.split('-W');
      if (parts.length !== 2) return null;
      const year = parseInt(parts[0]);
      const week = parseInt(parts[1]);
      // Get first day of the ISO week (Monday)
      const jan4 = new Date(year, 0, 4);
      const dayOfWeek = jan4.getDay() || 7;
      start = new Date(jan4);
      start.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'monthly': {
      if (!value) return null;
      const [year, month] = value.split('-').map(Number);
      start = new Date(year, month - 1, 1, 0, 0, 0);
      end = new Date(year, month, 0, 23, 59, 59); // last day of month
      break;
    }
    case 'yearly': {
      const year = parseInt(value);
      if (!year || year < 2020) return null;
      start = new Date(year, 0, 1, 0, 0, 0);
      end = new Date(year, 11, 31, 23, 59, 59);
      break;
    }
  }

  return { start, end };
}

function getFilteredReportTransactions() {
  const range = getReportDateRange();
  if (!range) return [];

  return transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate >= range.start && txDate <= range.end;
  });
}

function renderReport() {
  if (currentPage !== 'report') return;

  // Set default date picker value on first load
  const picker = document.getElementById('reportDatePicker');
  if (!picker.value) {
    switchReportPeriod('daily');
    return;
  }

  const filteredTx = getFilteredReportTransactions();

  // Calculate summary
  let grossIncome = 0;
  let totalCost = 0;
  let totalItemsSold = 0;

  filteredTx.forEach(tx => {
    tx.items.forEach(item => {
      grossIncome += item.price * item.qty;
      totalCost += item.costPrice * item.qty;
      totalItemsSold += item.qty;
    });
  });

  const netIncome = grossIncome - totalCost;

  // Update stat cards
  document.getElementById('reportTotalTx').textContent = filteredTx.length;
  document.getElementById('reportGrossIncome').textContent = formatRupiah(grossIncome);
  document.getElementById('reportNetIncome').textContent = formatRupiah(netIncome);
  document.getElementById('reportTotalItems').textContent = totalItemsSold;

  // Render chart
  renderReportChart(filteredTx);

  // Render top items table
  renderReportTopItems(filteredTx);

  // Render transaction list
  renderReportTxList(filteredTx);

  // Update chart title
  const titleMap = {
    daily: 'Grafik Pendapatan Per Jam (Hari Ini)',
    weekly: 'Grafik Pendapatan Harian (Minggu Ini)',
    monthly: 'Grafik Pendapatan Harian (Bulan Ini)',
    yearly: 'Grafik Pendapatan Bulanan (Tahun Ini)',
  };
  document.getElementById('reportChartTitle').textContent = titleMap[currentReportPeriod];

  feather.replace();
}

function renderReportChart(filteredTx) {
  const ctx = document.getElementById('reportChart');
  if (!ctx) return;

  let labels = [];
  let incomeData = [];
  let countData = [];

  const range = getReportDateRange();
  if (!range) return;

  switch (currentReportPeriod) {
    case 'daily': {
      // Group by hour (0-23)
      for (let h = 0; h < 24; h++) {
        labels.push(`${String(h).padStart(2, '0')}:00`);
        const hourTx = filteredTx.filter(tx => new Date(tx.date).getHours() === h);
        const income = hourTx.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.price * i.qty, 0), 0);
        incomeData.push(income);
        countData.push(hourTx.length);
      }
      break;
    }
    case 'weekly': {
      const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(range.start);
        dayDate.setDate(range.start.getDate() + d);
        const dateStr = dayDate.toISOString().split('T')[0];
        labels.push(`${dayNames[d]} ${dayDate.getDate()}/${dayDate.getMonth() + 1}`);
        const dayTx = filteredTx.filter(tx => tx.date.split('T')[0] === dateStr);
        const income = dayTx.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.price * i.qty, 0), 0);
        incomeData.push(income);
        countData.push(dayTx.length);
      }
      break;
    }
    case 'monthly': {
      const daysInMonth = new Date(range.end.getFullYear(), range.end.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = new Date(range.start.getFullYear(), range.start.getMonth(), d);
        const dateStr = dayDate.toISOString().split('T')[0];
        labels.push(String(d));
        const dayTx = filteredTx.filter(tx => tx.date.split('T')[0] === dateStr);
        const income = dayTx.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.price * i.qty, 0), 0);
        incomeData.push(income);
        countData.push(dayTx.length);
      }
      break;
    }
    case 'yearly': {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      for (let m = 0; m < 12; m++) {
        labels.push(monthNames[m]);
        const monthTx = filteredTx.filter(tx => new Date(tx.date).getMonth() === m);
        const income = monthTx.reduce((sum, tx) => sum + tx.items.reduce((s, i) => s + i.price * i.qty, 0), 0);
        incomeData.push(income);
        countData.push(monthTx.length);
      }
      break;
    }
  }

  if (reportChart) {
    reportChart.data.labels = labels;
    reportChart.data.datasets[0].data = incomeData;
    reportChart.data.datasets[1].data = countData;
    reportChart.update();
    return;
  }

  reportChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Pendapatan (Rp)',
          data: incomeData,
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 2,
          borderRadius: 6,
          yAxisID: 'y',
        },
        {
          label: 'Jumlah Transaksi',
          data: countData,
          type: 'line',
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(16, 185, 129, 1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#6b7280',
            font: { family: 'Inter', size: 12 },
            usePointStyle: true,
            pointStyle: 'circle',
          }
        },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(148, 163, 184, 0.15)',
          borderWidth: 1,
          cornerRadius: 12,
          padding: 12,
          callbacks: {
            label: function (context) {
              if (context.datasetIndex === 0) {
                return 'Pendapatan: Rp ' + context.raw.toLocaleString('id-ID');
              }
              return 'Transaksi: ' + context.raw;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, maxRotation: 45, minRotation: 0 },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          ticks: {
            color: '#64748b',
            font: { family: 'Inter', size: 11 },
            callback: (v) => 'Rp ' + (v / 1000).toFixed(0) + 'K'
          },
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, stepSize: 1 },
          grid: { drawOnChartArea: false },
        }
      }
    }
  });
}

function renderReportTopItems(filteredTx) {
  const tbody = document.getElementById('reportTopItemsBody');
  const emptyEl = document.getElementById('emptyTopItems');
  if (!tbody) return;

  // Aggregate items sold
  const itemMap = {};
  filteredTx.forEach(tx => {
    tx.items.forEach(item => {
      if (!itemMap[item.name]) {
        itemMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
      }
      itemMap[item.name].qty += item.qty;
      itemMap[item.name].revenue += item.price * item.qty;
    });
  });

  const sorted = Object.values(itemMap).sort((a, b) => b.qty - a.qty);

  if (sorted.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  tbody.innerHTML = sorted.slice(0, 10).map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight: 600;">${item.name}</td>
      <td>${item.qty}</td>
      <td style="font-weight: 700;">Rp ${item.revenue.toLocaleString('id-ID')}</td>
    </tr>
  `).join('');
}

function renderReportTxList(filteredTx) {
  const tbody = document.getElementById('reportTxListBody');
  const emptyEl = document.getElementById('emptyReportTx');
  if (!tbody) return;

  if (filteredTx.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  const sorted = [...filteredTx].sort((a, b) => new Date(b.date) - new Date(a.date));

  tbody.innerHTML = sorted.map(tx => {
    const date = new Date(tx.date);
    return `
      <tr>
        <td><span class="tx-id">${tx.id}</span></td>
        <td>${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${tx.cashier}</td>
        <td style="font-weight: 700;">Rp ${tx.total.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }).join('');
}

function printReport() {
  const range = getReportDateRange();
  if (!range) {
    showNotification('Pilih periode laporan terlebih dahulu!', 'error');
    return;
  }

  const filteredTx = getFilteredReportTransactions();
  let grossIncome = 0;
  let totalCost = 0;
  let totalItemsSold = 0;

  filteredTx.forEach(tx => {
    tx.items.forEach(item => {
      grossIncome += item.price * item.qty;
      totalCost += item.costPrice * item.qty;
      totalItemsSold += item.qty;
    });
  });

  const netIncome = grossIncome - totalCost;

  // Aggregate top items
  const itemMap = {};
  filteredTx.forEach(tx => {
    tx.items.forEach(item => {
      if (!itemMap[item.name]) {
        itemMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
      }
      itemMap[item.name].qty += item.qty;
      itemMap[item.name].revenue += item.price * item.qty;
    });
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10);

  const periodLabel = {
    daily: 'Harian',
    weekly: 'Mingguan',
    monthly: 'Bulanan',
    yearly: 'Tahunan',
  }[currentReportPeriod];

  const dateLabel = `${range.start.toLocaleDateString('id-ID')} \u2014 ${range.end.toLocaleDateString('id-ID')}`;

  const topItemsRows = topItems.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:600;">${item.name}</td>
      <td class="receipt-center">${item.qty}</td>
      <td class="receipt-right">Rp ${item.revenue.toLocaleString('id-ID')}</td>
    </tr>
  `).join('');

  const txRows = [...filteredTx].sort((a, b) => new Date(b.date) - new Date(a.date)).map(tx => {
    const date = new Date(tx.date);
    return `
      <tr>
        <td style="font-weight:600;">${tx.id}</td>
        <td>${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${tx.cashier}</td>
        <td class="receipt-right" style="font-weight:700;">Rp ${tx.total.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }).join('');

  const reportContent = document.getElementById('reportPrintContent');
  reportContent.innerHTML = `
    <div class="receipt-paper">
      <div class="receipt-header">
        <h2>VIRA</h2>
        <p class="receipt-subtitle">Laporan Penjualan ${periodLabel}</p>
      </div>

      <div class="receipt-info">
        <div class="receipt-info-row">
          <span>Periode:</span>
          <span class="receipt-bold">${dateLabel}</span>
        </div>
        <div class="receipt-info-row">
          <span>Dicetak pada:</span>
          <span>${new Date().toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div class="receipt-divider"></div>

      <div class="report-print-stats">
        <div class="report-print-stat">
          <div class="report-print-stat-val">${filteredTx.length}</div>
          <div class="report-print-stat-lbl">Total Transaksi</div>
        </div>
        <div class="report-print-stat">
          <div class="report-print-stat-val">Rp ${grossIncome.toLocaleString('id-ID')}</div>
          <div class="report-print-stat-lbl">Pendapatan Kotor</div>
        </div>
        <div class="report-print-stat">
          <div class="report-print-stat-val">Rp ${netIncome.toLocaleString('id-ID')}</div>
          <div class="report-print-stat-lbl">Laba Bersih</div>
        </div>
        <div class="report-print-stat">
          <div class="report-print-stat-val">${totalItemsSold}</div>
          <div class="report-print-stat-lbl">Barang Terjual</div>
        </div>
      </div>

      <div class="receipt-divider"></div>

      <div class="report-print-section-title">Barang Terlaris</div>
      <table class="receipt-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Barang</th>
            <th class="receipt-center">Qty</th>
            <th class="receipt-right">Pendapatan</th>
          </tr>
        </thead>
        <tbody>${topItemsRows || '<tr><td colspan="4" style="text-align:center;padding:12px;color:#aaa;">Tidak ada data</td></tr>'}</tbody>
      </table>

      <div class="receipt-divider"></div>

      <div class="report-print-section-title">Detail Transaksi</div>
      <table class="receipt-table">
        <thead>
          <tr>
            <th>No. Transaksi</th>
            <th>Tanggal</th>
            <th>Kasir</th>
            <th class="receipt-right">Total</th>
          </tr>
        </thead>
        <tbody>${txRows || '<tr><td colspan="4" style="text-align:center;padding:12px;color:#aaa;">Tidak ada transaksi</td></tr>'}</tbody>
      </table>

      <div class="receipt-footer">
        <p>VIRA - Value-based Inventory & Retail Assistant</p>
      </div>
    </div>
  `;

  document.getElementById('reportPrintModal').classList.add('active');
}

function closeReportPrintModal() {
  document.getElementById('reportPrintModal').classList.remove('active');
}

function doPrintReport() {
  window.print();
}

// ============ EXPORT REPORT TO EXCEL ============
function exportReportToExcel() {
  const range = getReportDateRange();
  if (!range) {
    showNotification('Pilih periode laporan terlebih dahulu!', 'error');
    return;
  }

  const filteredTx = getFilteredReportTransactions();

  if (filteredTx.length === 0) {
    showNotification('Tidak ada data transaksi pada periode ini.', 'error');
    return;
  }

  let grossIncome = 0;
  let totalCost = 0;
  let totalItemsSold = 0;

  filteredTx.forEach(tx => {
    tx.items.forEach(item => {
      grossIncome += item.price * item.qty;
      totalCost += item.costPrice * item.qty;
      totalItemsSold += item.qty;
    });
  });

  const netIncome = grossIncome - totalCost;

  // Aggregate top items
  const itemMap = {};
  filteredTx.forEach(tx => {
    tx.items.forEach(item => {
      if (!itemMap[item.name]) {
        itemMap[item.name] = { name: item.name, qty: 0, revenue: 0, cost: 0 };
      }
      itemMap[item.name].qty += item.qty;
      itemMap[item.name].revenue += item.price * item.qty;
      itemMap[item.name].cost += item.costPrice * item.qty;
    });
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty);

  const periodLabel = {
    daily: 'Harian',
    weekly: 'Mingguan',
    monthly: 'Bulanan',
    yearly: 'Tahunan',
  }[currentReportPeriod];

  const dateLabel = `${range.start.toLocaleDateString('id-ID')} - ${range.end.toLocaleDateString('id-ID')}`;

  // Build Excel-compatible HTML table
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
        <x:Name>Laporan</x:Name>
        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
      </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      <style>
        td, th { padding: 6px 10px; font-family: Arial, sans-serif; font-size: 11pt; }
        th { background-color: #c8d96f; color: #2d3a0f; font-weight: bold; text-align: center; }
        .header { font-size: 16pt; font-weight: bold; }
        .sub-header { font-size: 11pt; color: #666; }
        .section-title { font-size: 12pt; font-weight: bold; background-color: #f0f0f0; }
        .number { text-align: right; }
        .currency { text-align: right; }
        .center { text-align: center; }
      </style>
    </head>
    <body>
      <table>
        <tr><td class="header" colspan="4">VIRA - Laporan Penjualan ${periodLabel}</td></tr>
        <tr><td class="sub-header" colspan="4">Periode: ${dateLabel}</td></tr>
        <tr><td class="sub-header" colspan="4">Dicetak: ${new Date().toLocaleString('id-ID')}</td></tr>
        <tr><td colspan="4"></td></tr>

        <!-- Ringkasan -->
        <tr><td class="section-title" colspan="4">RINGKASAN</td></tr>
        <tr><td>Total Transaksi</td><td class="number">${filteredTx.length}</td><td></td><td></td></tr>
        <tr><td>Total Barang Terjual</td><td class="number">${totalItemsSold}</td><td></td><td></td></tr>
        <tr><td>Pendapatan Kotor</td><td class="currency">Rp ${grossIncome.toLocaleString('id-ID')}</td><td></td><td></td></tr>
        <tr><td>Total Modal</td><td class="currency">Rp ${totalCost.toLocaleString('id-ID')}</td><td></td><td></td></tr>
        <tr><td><b>Laba Bersih</b></td><td class="currency"><b>Rp ${netIncome.toLocaleString('id-ID')}</b></td><td></td><td></td></tr>
        <tr><td colspan="4"></td></tr>

        <!-- Barang Terlaris -->
        <tr><td class="section-title" colspan="4">BARANG TERLARIS</td></tr>
        <tr>
          <th>No</th>
          <th>Nama Barang</th>
          <th>Qty Terjual</th>
          <th>Pendapatan</th>
        </tr>`;

  topItems.forEach((item, i) => {
    html += `
        <tr>
          <td class="center">${i + 1}</td>
          <td>${item.name}</td>
          <td class="number">${item.qty}</td>
          <td class="currency">Rp ${item.revenue.toLocaleString('id-ID')}</td>
        </tr>`;
  });

  html += `
        <tr><td colspan="4"></td></tr>

        <!-- Detail Transaksi -->
        <tr><td class="section-title" colspan="4">DETAIL TRANSAKSI</td></tr>
        <tr>
          <th>No. Transaksi</th>
          <th>Tanggal</th>
          <th>Kasir</th>
          <th>Total</th>
        </tr>`;

  const sortedTx = [...filteredTx].sort((a, b) => new Date(b.date) - new Date(a.date));
  sortedTx.forEach(tx => {
    const date = new Date(tx.date);
    html += `
        <tr>
          <td>${tx.id}</td>
          <td>${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${tx.cashier}</td>
          <td class="currency">Rp ${tx.total.toLocaleString('id-ID')}</td>
        </tr>`;
  });

  html += `
      </table>
    </body>
    </html>`;

  // Create downloadable file
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fileName = `Laporan_${periodLabel}_${range.start.toLocaleDateString('id-ID').replace(/\//g, '-')}.xls`;
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showNotification(`Laporan berhasil di-export: ${fileName}`, 'success');
}

// ============ LOGOUT ============
function handleLogout() {
  sessionStorage.removeItem('inventori_session');
  window.location.href = 'login.html';
}

// ============ KEYBOARD SHORTCUTS ============
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Esc to close modals
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
      closeReceiptModal();
      closeReportPrintModal();
    }
  });

  // Close modals on overlay click
  ['itemModal', 'deleteModal', 'receiptModal', 'reportPrintModal'].forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target.id === modalId) {
          if (modalId === 'itemModal') closeModal();
          else if (modalId === 'deleteModal') closeDeleteModal();
          else if (modalId === 'receiptModal') closeReceiptModal();
          else if (modalId === 'reportPrintModal') closeReportPrintModal();
        }
      });
    }
  });
}

// ============ BOOT ============
document.addEventListener('DOMContentLoaded', init);

