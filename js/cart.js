// ===== CART PAGE JAVASCRIPT =====

// ===== DOM ELEMENTS =====
const cartItemsContainer = document.getElementById('cart-items');
const cartItemsWrapper = document.getElementById('cart-items-wrapper');
const cartEmpty = document.getElementById('cart-empty');
const cartSubtotal = document.getElementById('cart-subtotal');
const cartTotal = document.getElementById('cart-total');

// ===== SALE UTILITY (using global isSaleActive) =====
function getCartItemEffectivePrice(item) {
  const rate = getExchangeRate('ZAR') || 84;
  return isSaleActive(item) ? Number(item.sale_price) * rate : Number(item.price || 0);
}

function getCartItemEffectivePrice(item) {
  const rate = getExchangeRate('ZAR') || 84;
  return isSaleActive(item) ? Number(item.sale_price) * rate : Number(item.price || 0);
}

// ===== VERIFY CART ITEMS AGAINST SUPABASE =====
async function verifyCartItems() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  if (cart.length === 0) return [];

  try {
    let supabase = window._supabase;
    
    if (!supabase) {
      const supabaseUrl = 'https://iirctokpamybsmgzstnj.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmN0b2twYW15YnNtZ3pzdG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjYwMTksImV4cCI6MjA5ODAwMjAxOX0.eTW0Ipnibowlp3JVewxFnRXcwReKDqiJs8L_X8UfQVc';
      
      if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded.');
        return cart;
      }
      
      supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
      window._supabase = supabase;
    }

    // Fetch products by UUID (id column)
    const { data: products, error } = await supabase
      .from('products')
        .select('id, slug, name, price, image_url, sale_price, on_sale, sale_start, sale_end, stock');

    if (error) {
      console.error('Error fetching products:', error);
      return cart;
    }

const productMap = {};
products.forEach(p => {
  productMap[p.id] = {
    id: p.id,
    name: p.name,
    price: p.price,
    image: p.image_url || '/images/placeholder.jpg',
    slug: p.slug,
    sale_price: p.sale_price || null,
    on_sale: p.on_sale || false,
    sale_start: p.sale_start || null,
    sale_end: p.sale_end || null,
    stock: p.stock !== undefined && p.stock !== null ? p.stock : 0
  };

  if (p.slug) {
    productMap[p.slug] = {
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image_url || '/images/placeholder.jpg',
      slug: p.slug,
      sale_price: p.sale_price || null,
      on_sale: p.on_sale || false,
      sale_start: p.sale_start || null,
      sale_end: p.sale_end || null,
      stock: p.stock !== undefined && p.stock !== null ? p.stock : 0
    };
  }
});

const verifiedItems = cart.map(item => {
  const product = productMap[item.id] || (item.slug ? productMap[item.slug] : null);
  if (product) {
    const isInStock = product.stock !== undefined && product.stock !== null && product.stock > 0;
    const availableStock = product.stock || 0;
    const quantityExceedsStock = availableStock > 0 && item.quantity > availableStock;
    
    return {
      ...item,
      id: product.id,
      available: true,
      inStock: isInStock,
      quantityExceedsStock: quantityExceedsStock,
      availableStock: availableStock,
      name: product.name,
      price: product.price,
      image: product.image,
      slug: product.slug,
      sale_price: product.sale_price || null,
      on_sale: product.on_sale || false,
      sale_start: product.sale_start || null,
      sale_end: product.sale_end || null,
      stock: availableStock
    };
  } else {
    return {
      ...item,
      available: false,
      inStock: false,
      quantityExceedsStock: false,
      availableStock: 0
    };
  }
});

    return verifiedItems;

  } catch (error) {
    console.error('Verification error:', error);
    return cart;
  }
}

// ===== LOAD CART =====
async function loadCart() {
  // Show loading state
  const loadingEl = document.getElementById('cart-loading');
  if (loadingEl) {
    loadingEl.style.display = 'block';
  }
  
  // Hide empty and items wrappers while loading
  if (cartEmpty) {
    cartEmpty.style.display = 'none';
  }
  if (cartItemsWrapper) {
    cartItemsWrapper.style.display = 'none';
  }

  const verifiedItems = await verifyCartItems();
  
  // Hide loading
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
  
  // Update localStorage with verified items (remove unavailable ones)
const availableItems = verifiedItems.filter(item => item.available && item.inStock);
  localStorage.setItem('cart', JSON.stringify(availableItems));
  
  updateCartBadge();

  if (verifiedItems.length === 0 || availableItems.length === 0) {
    cartItemsWrapper.style.display = 'none';
    cartEmpty.style.display = 'block';
    return;
  }

  cartItemsWrapper.style.display = 'block';
  cartEmpty.style.display = 'none';

  renderCartItems(verifiedItems);
  updateTotals(availableItems);
}

function renderCartItems(cart) {
  cartItemsContainer.innerHTML = '';

  cart.forEach((item, index) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item';
    
    if (!item.available) {
      itemElement.classList.add('cart-item-unavailable');
    }

    const isOutOfStock = !item.inStock && item.available;
    const exceedsStock = item.quantityExceedsStock && item.available && item.inStock;

    if (isOutOfStock) {
      itemElement.classList.add('cart-item-out-of-stock');
    }
    if (exceedsStock) {
      itemElement.classList.add('cart-item-exceeds-stock');
    }
    
    const saleActive = isSaleActive(item);
    const effectivePrice = getCartItemEffectivePrice(item);
    
    // Build the HTML based on item status
    let detailsHtml = '';
    let totalHtml = '';
    
    if (item.available && item.inStock) {
      // In stock - show normal cart item
      detailsHtml = `
        <div class="cart-item-price">
          ${saleActive ? `
            <span class="cart-original-price">${formatPrice(Number(item.price) || 0, currentCurrency)}</span>
            <span class="cart-sale-price">${formatPrice(effectivePrice, currentCurrency)}</span>
          ` : formatPrice(Number(item.price) || 0, currentCurrency)}
        </div>
        
        ${exceedsStock ? `
          <div class="cart-item-stock-warning">
            ⚠️ Only ${item.availableStock} items of "${item.name}" available in stock. Please reduce quantity.
          </div>
        ` : ''}
        
        <div class="cart-item-actions">
          <div class="cart-item-quantity">
            <button class="qty-btn cart-qty-decrease" data-index="${index}">−</button>
            <input type="number" class="cart-qty-input" value="${item.quantity}" min="1" max="${item.availableStock > 0 ? item.availableStock : 99}" data-index="${index}">
            <button class="qty-btn cart-qty-increase" data-index="${index}">+</button>
          </div>
          <button class="cart-item-remove" data-index="${index}">Remove</button>
        </div>
      `;
      
      totalHtml = `
        <div class="cart-item-total">
          ${saleActive ? `
            <span class="cart-original-total">${formatPrice(Number(item.price) * item.quantity, currentCurrency)}</span>
            <span class="cart-sale-total">${formatPrice(effectivePrice * item.quantity, currentCurrency)}</span>
          ` : formatPrice(Number(item.price) * item.quantity, currentCurrency)}
        </div>
      `;
    } else if (item.available && !item.inStock) {
      // Out of stock
      detailsHtml = `
        <div class="cart-item-out-of-stock-message">
          ⚠️ This product is currently out of stock
        </div>
        <button class="cart-item-remove" data-index="${index}">Remove from cart</button>
      `;
      totalHtml = '';
    } else {
      // Unavailable (product no longer exists)
      detailsHtml = `
        <div class="cart-item-unavailable-message">
          ⚠️ This product is no longer available
        </div>
        <button class="cart-item-remove" data-index="${index}">Remove from cart</button>
      `;
      totalHtml = '';
    }
    
    itemElement.innerHTML = `
      <div class="cart-item-image">
        <img src="${item.image || '/images/placeholder.jpg'}" alt="${item.name}">
      </div>
      <div class="cart-item-details">
        <h3 class="cart-item-name">${item.name}</h3>
        ${detailsHtml}
      </div>
      ${totalHtml}
    `;

    cartItemsContainer.appendChild(itemElement);
  });

  // Attach event listeners for quantity buttons
  document.querySelectorAll('.cart-qty-decrease').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.dataset.index);
      updateQuantity(index, -1);
    });
  });

  document.querySelectorAll('.cart-qty-increase').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.dataset.index);
      updateQuantity(index, 1);
    });
  });

  document.querySelectorAll('.cart-qty-input').forEach(input => {
    input.addEventListener('change', function() {
      const index = parseInt(this.dataset.index);
      let value = parseInt(this.value);
      if (isNaN(value) || value < 1) {
        value = 1;
      } else if (value > 99) {
        value = 99;
      }
      this.value = value;
      updateQuantity(index, 0, value);
    });
  });

  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.dataset.index);
      removeItem(index);
    });
  });
}

// ===== UPDATE QUANTITY =====
function updateQuantity(index, change, newValue) {
  let cart = JSON.parse(localStorage.getItem('cart')) || [];

  if (index < 0 || index >= cart.length) return;

  if (newValue !== undefined) {
    cart[index].quantity = newValue;
  } else {
    cart[index].quantity += change;
    if (cart[index].quantity < 1) {
      cart[index].quantity = 1;
    }
    if (cart[index].quantity > 99) {
      cart[index].quantity = 99;
    }
  }

  localStorage.setItem('cart', JSON.stringify(cart));
  loadCart(); // Reload the cart
  updateCartBadge(); // Update navbar badge
}

// ===== REMOVE ITEM =====
function removeItem(index) {
  let cart = JSON.parse(localStorage.getItem('cart')) || [];

  if (index < 0 || index >= cart.length) return;

  // Confirm removal
  if (!confirm(`Remove "${cart[index].name}" from your cart?`)) {
    return;
  }

  cart.splice(index, 1);
  localStorage.setItem('cart', JSON.stringify(cart));
  loadCart(); // Reload the cart
  updateCartBadge(); // Update navbar badge
}

// ===== UPDATE TOTALS =====
function updateTotals(cart) {
  // Calculate subtotal using the active sale price when applicable
  const subtotal = cart.reduce((sum, item) => {
    const price = getCartItemEffectivePrice(item);
    return sum + (price * item.quantity);
  }, 0);
  
  cartSubtotal.textContent = formatPrice(subtotal, currentCurrency);
  cartTotal.textContent = formatPrice(subtotal, currentCurrency);
}

function canProceedToCheckout() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  
  // Check for unavailable items
  const hasUnavailable = cart.some(item => item.available === false);
  if (hasUnavailable) {
    showToast('Please remove unavailable items before proceeding.');
    return false;
  }
  
  // Check for out-of-stock items
  const hasOutOfStock = cart.some(item => !item.inStock && item.available);
  if (hasOutOfStock) {
    showToast('Some items in your cart are out of stock. Please remove them.');
    return false;
  }
  
  // Check for quantity exceeding stock
  const exceedsStock = cart.some(item => item.quantityExceedsStock && item.available && item.inStock);
  if (exceedsStock) {
    showToast('Please reduce the quantity of items that exceed available stock.');
    return false;
  }
  
  return true;
}

// ===== UPDATE CART BADGE =====
function updateCartBadge() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  let badge = document.querySelector('.cart-badge');
  if (!badge) {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
      const cartLink = document.createElement('li');
      cartLink.innerHTML = `<a href="cart.html">
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="9" cy="21" r="1"/>
    <circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
  <span class="cart-badge">${totalItems}</span>
</a>`;
      navLinks.appendChild(cartLink);
    }
  } else {
    badge.textContent = totalItems;
  }

  if (typeof updateMobileCartBadge === 'function') {
    updateMobileCartBadge();
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  if (typeof currencyReady !== 'undefined' && currencyReady) {
    loadCart();
  } else {
    document.addEventListener('currencyReady', function() {
      loadCart();
    });
  }
});