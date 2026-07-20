// ===== SUPABASE CONFIG =====
const supabaseUrl = 'https://iirctokpamybsmgzstnj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmN0b2twYW15YnNtZ3pzdG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjYwMTksImV4cCI6MjA5ODAwMjAxOX0.eTW0Ipnibowlp3JVewxFnRXcwReKDqiJs8L_X8UfQVc'; // Replace with your actual anon key

const _supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// ===== ADMIN API KEY =====
const ADMIN_API_KEY = 'ayempire_admin_2026_secure_key_12345';

// ✅ Make it available to other admin scripts
window.ADMIN_API_KEY = ADMIN_API_KEY;

// ===== CHECK AUTH ON EVERY ADMIN PAGE =====
async function checkAuth() {
  const { data: { session } } = await _supabase.auth.getSession();
  
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  
  if (session.user.email !== 'imp4luv@gmail.com') {
    await _supabase.auth.signOut();
    window.location.href = 'login.html';
    return null;
  }
  
  return session;
}

// ===== LOGOUT =====
document.addEventListener('DOMContentLoaded', function() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      await _supabase.auth.signOut();
      localStorage.removeItem('admin_session');
      window.location.href = 'login.html';
    });
  }
});

// ===== LOAD DASHBOARD STATS =====
async function loadDashboardStats() {
  try {
    const session = await checkAuth();
    if (!session) return;

    const { data: orders, error: ordersError } = await _supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    const { data: products, error: productsError } = await _supabase
      .from('products')
      .select('id');

    if (productsError) throw productsError;

    const totalOrders = orders?.length || 0;
    const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
    const paidOrders = orders?.filter(o => o.status === 'paid').length || 0;
    const totalProducts = products?.length || 0;

    document.getElementById('total-orders').textContent = totalOrders;
    document.getElementById('pending-orders').textContent = pendingOrders;
    document.getElementById('paid-orders').textContent = paidOrders;
    document.getElementById('total-products').textContent = totalProducts;

    renderRecentOrders(orders?.slice(0, 5) || []);

  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

// ===== RENDER RECENT ORDERS =====
function renderRecentOrders(orders) {
  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; color: var(--text-mid);">No orders yet.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => `
    <tr>
      <td><strong>${order.order_number}</strong></td>
      <td>${order.customer_name}</td>
      <td>₦${order.total.toLocaleString()}</td>
      <td><span class="status-badge ${order.status}">${order.status}</span></td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
      <td><a href="orders.html#${order.id}" style="color: var(--gold);">View</a></td>
    </tr>
  `).join('');
}

// ===== TOAST FOR ADMIN =====
const ADMIN_TOAST_HIDE_DELAY = 3000;
const ADMIN_TOAST_ICONS = {
  success: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  `,
  warning: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  `
};

function getAdminToastType(message, icon) {
  const rawIcon = String(icon || '').toLowerCase();
  const rawMessage = String(message || '').toLowerCase();
  const warningTerms = ['warn', 'error', 'fail', 'failed', 'please', 'large'];

  return warningTerms.some(term => rawIcon.includes(term) || rawMessage.includes(term))
    ? 'warning'
    : 'success';
}

function hideAdminToast(toast) {
  toast.style.opacity = '0';
  toast.style.visibility = 'hidden';
  toast.style.pointerEvents = 'none';
  toast.style.transform = 'translateY(-16px)';
}

function showToast(message, icon = 'success') {
  let toast = document.getElementById('admin-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 32px;
      background: #1a1a2e;
      color: #fff;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 0.8rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateY(-16px);
      transition: opacity 0.35s ease, transform 0.35s ease, visibility 0s linear 0.35s;
      z-index: 9999;
      max-width: 400px;
      min-width: 280px;
      font-family: 'Jost', sans-serif;
    `;
    toast.innerHTML = `
      <span id="admin-toast-icon" style="width:1.35rem;height:1.35rem;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;color:#c9a84c;"></span>
      <span id="admin-toast-message" style="font-size:0.9rem;font-weight:500;"></span>
    `;
    document.body.appendChild(toast);
  }

  const toastIcon = document.getElementById('admin-toast-icon');
  const toastMessage = document.getElementById('admin-toast-message');
  const toastType = getAdminToastType(message, icon);
  
  toastIcon.innerHTML = ADMIN_TOAST_ICONS[toastType];
  toastIcon.querySelector('svg').style.cssText = 'width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round;';
  toastMessage.textContent = message;
  
  toast.style.opacity = '1';
  toast.style.visibility = 'visible';
  toast.style.pointerEvents = 'auto';
  toast.style.transform = 'translateY(0)';
  toast.style.transition = 'opacity 0.35s ease, transform 0.35s ease, visibility 0s';
  
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.transition = 'opacity 0.35s ease, transform 0.35s ease, visibility 0s linear 0.35s';
    hideAdminToast(toast);
  }, ADMIN_TOAST_HIDE_DELAY);
}
// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  if (document.querySelector('.admin-stats')) {
    loadDashboardStats();
  }
});