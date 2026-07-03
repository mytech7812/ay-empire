// ===== ORDERS MANAGEMENT =====
// Supabase config is already in admin.js - using _supabase globally

// ===== LOAD ORDERS =====
async function loadOrders(filter = 'all', search = '') {
  const grid = document.getElementById('orders-grid');
  grid.innerHTML = '<div class="loading-message">Loading orders...</div>';

  try {
    let query = _supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    if (search) {
      query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    if (!orders || orders.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>No orders found.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = orders.map(order => {
      const itemCount = order.items ? order.items.length : 0;
      
      return `
        <div class="order-card ${order.status}" data-id="${order.id}">
          <div class="order-card-preview" onclick="toggleOrderCard(this)">
            <div class="order-card-header">
              <div class="order-card-id">
                <span class="order-label">Order</span>
                <span class="order-number">${order.order_number}</span>
              </div>
              <span class="status-badge ${order.status}">${order.status}</span>
            </div>
            
            <div class="order-card-main">
              <div class="order-card-customer">
                <span class="order-label">Customer</span>
                <span class="order-name">${order.customer_name}</span>
              </div>
              
              <div class="order-card-stats">
                <div class="order-stat">
                  <span class="order-label">Items</span>
                  <span class="order-value">${itemCount}</span>
                </div>
                <div class="order-stat">
                  <span class="order-label">Total</span>
                  <span class="order-value total">₦${order.total.toLocaleString()}</span>
                </div>
                <div class="order-stat">
                  <span class="order-label">Date</span>
                  <span class="order-value">${new Date(order.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div class="order-card-expand-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
          
          <div class="order-card-details">
            <div class="order-details-grid">
              <div class="order-detail-section">
                <h4>Customer Information</h4>
                <div class="detail-row"><span class="detail-label">Name</span><span>${order.customer_name}</span></div>
                <div class="detail-row"><span class="detail-label">Email</span><span>${order.customer_email}</span></div>
                ${order.customer_phone ? `<div class="detail-row"><span class="detail-label">Phone</span><span>${order.customer_phone}</span></div>` : ''}
                <div class="detail-row"><span class="detail-label">Status</span><span class="status-badge ${order.status}">${order.status}</span></div>
              </div>
              
              <div class="order-detail-section">
                <h4>Delivery Address</h4>
                <div class="detail-row"><span class="detail-label">Address</span><span>${order.customer_address}</span></div>
                ${order.customer_city ? `<div class="detail-row"><span class="detail-label">City</span><span>${order.customer_city}</span></div>` : ''}
                ${order.customer_state ? `<div class="detail-row"><span class="detail-label">State</span><span>${order.customer_state}</span></div>` : ''}
                ${order.customer_country ? `<div class="detail-row"><span class="detail-label">Country</span><span>${order.customer_country}</span></div>` : ''}
                ${order.customer_zip ? `<div class="detail-row"><span class="detail-label">Postal Code</span><span>${order.customer_zip}</span></div>` : ''}
                ${order.notes ? `<div class="detail-row"><span class="detail-label">Notes</span><span>${order.notes}</span></div>` : ''}
              </div>
              
              <div class="order-detail-section order-detail-items">
                <h4>Items (${itemCount})</h4>
                ${order.items && order.items.length > 0 ? `
                  <div class="items-list">
                    ${order.items.map(item => `
                      <div class="item-row">
                        <span class="item-name">${item.name}</span>
                        <span class="item-qty">×${item.quantity}</span>
                        <span class="item-price">₦${(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    `).join('')}
                  </div>
                  <div class="order-total-row">
                    <span class="total-label">Total</span>
                    <span class="total-amount">₦${order.total.toLocaleString()}</span>
                  </div>
                ` : '<p>No items</p>'}
              </div>
              
              <div class="order-detail-section order-detail-actions">
                <h4>Update Status</h4>
                <select class="status-update" data-id="${order.id}">
                  <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                  <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>Paid</option>
                  <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                  <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                  <option value="failed" ${order.status === 'failed' ? 'selected' : ''}>Failed</option>
                </select>
                <button class="view-order-btn" data-id="${order.id}">View Full Details</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners for status updates
    document.querySelectorAll('.status-update').forEach(select => {
      select.addEventListener('change', function() {
        const orderId = this.dataset.id;
        const newStatus = this.value;
        updateOrderStatus(orderId, newStatus);
      });
    });

    // Add event listeners for view buttons (modal)
    document.querySelectorAll('.view-order-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const orderId = this.dataset.id;
        const order = orders.find(o => o.id === orderId);
        if (order) showOrderModal(order);
      });
    });

  } catch (error) {
    console.error('Load orders error:', error);
    grid.innerHTML = `
      <div class="error-state">
        <p>Error loading orders. Please refresh.</p>
      </div>
    `;
  }
}

// ===== TOGGLE ORDER CARD (Expand/Collapse) =====
function toggleOrderCard(element) {
  const card = element.closest('.order-card');
  if (card) {
    card.classList.toggle('expanded');
  }
}

// ===== UPDATE ORDER STATUS =====
async function updateOrderStatus(orderId, newStatus) {
  try {
    const { error } = await _supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) throw error;

    const filter = document.getElementById('status-filter').value;
    const search = document.getElementById('search-orders').value;
    loadOrders(filter, search);

    showToast('Order status updated successfully!', 'success');

  } catch (error) {
    console.error('Update status error:', error);
    showToast('Failed to update status.', 'error');
  }
}

// ===== SHOW ORDER MODAL =====
function showOrderModal(order) {
  const modal = document.getElementById('order-modal');
  const modalTitle = document.getElementById('modal-order-number');
  const modalDetails = document.getElementById('modal-order-details');

  modalTitle.textContent = `Order #${order.order_number}`;

  let itemsHtml = '';
  if (order.items && order.items.length > 0) {
    itemsHtml = `
      <div style="margin: 1rem 0;">
        <h4>Items</h4>
        <table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
          <tr style="border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:0.3rem 0;">Product</th>
            <th style="text-align:center;padding:0.3rem 0;">Qty</th>
            <th style="text-align:right;padding:0.3rem 0;">Price</th>
          </tr>
          ${order.items.map(item => `
            <tr style="border-bottom:1px solid rgba(201,168,76,0.1);">
              <td style="padding:0.3rem 0;">${item.name}</td>
              <td style="text-align:center;padding:0.3rem 0;">${item.quantity}</td>
              <td style="text-align:right;padding:0.3rem 0;">₦${(item.price * item.quantity).toLocaleString()}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  }

  modalDetails.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:1rem;">
      <div><strong>Customer:</strong> ${order.customer_name}</div>
      <div><strong>Email:</strong> ${order.customer_email}</div>
      <div><strong>Phone:</strong> ${order.customer_phone || 'N/A'}</div>
      <div><strong>Status:</strong> <span class="status-badge ${order.status}">${order.status}</span></div>
      <div style="grid-column: span 2;"><strong>Address:</strong> ${order.customer_address}</div>
      <div><strong>City:</strong> ${order.customer_city || 'N/A'}</div>
      <div><strong>State:</strong> ${order.customer_state || 'N/A'}</div>
      <div style="grid-column: span 2;"><strong>Country:</strong> ${order.customer_country || 'N/A'}</div>
      ${order.notes ? `<div style="grid-column: span 2;"><strong>Notes:</strong> ${order.notes}</div>` : ''}
      ${itemsHtml}
      <div style="grid-column: span 2; text-align:right; font-size:1.2rem; font-weight:700; padding-top:0.5rem; border-top:2px solid var(--gold);">
        Total: ₦${order.total.toLocaleString()}
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

// ===== CLOSE MODAL =====
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('order-modal');
  const closeBtn = document.getElementById('modal-close');

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      modal.style.display = 'none';
    });
  }

  window.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  const filterSelect = document.getElementById('status-filter');
  if (filterSelect) {
    filterSelect.addEventListener('change', function() {
      const search = document.getElementById('search-orders').value;
      loadOrders(this.value, search);
    });
  }

  const searchInput = document.getElementById('search-orders');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const filter = document.getElementById('status-filter').value;
      loadOrders(filter, this.value);
    });
  }

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      const filter = document.getElementById('status-filter').value;
      const search = document.getElementById('search-orders').value;
      loadOrders(filter, search);
    });
  }

  loadOrders();
});