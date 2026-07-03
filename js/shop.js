// ===== SHOP PAGE JAVASCRIPT =====

// ===== SUPABASE CONFIG (SINGLE DECLARATION) =====
const supabaseUrl = 'https://iirctokpamybsmgzstnj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmN0b2twYW15YnNtZ3pzdG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjYwMTksImV4cCI6MjA5ODAwMjAxOX0.eTW0Ipnibowlp3JVewxFnRXcwReKDqiJs8L_X8UfQVc'; // Replace with your actual anon key

const _supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// ===== DOM ELEMENTS =====
const shopGrid = document.getElementById('shop-grid');
const emptyState = document.getElementById('empty-state');
const filterBtns = document.querySelectorAll('.filter-btn');
const sortSelect = document.getElementById('sort-select');

// ===== STATE =====
let products = [];
let currentFilter = 'all';
let currentSort = 'default';
let filteredProducts = [];

const PRODUCTS_CACHE_KEY = 'ay_empire_products_cache_v1';
const PRODUCTS_CACHE_TTL = 10 * 60 * 1000;

function getCachedProducts() {
  try {
    const cached = JSON.parse(localStorage.getItem(PRODUCTS_CACHE_KEY));
    if (!cached || !Array.isArray(cached.products)) return null;
    if (Date.now() - cached.savedAt > PRODUCTS_CACHE_TTL) return null;
    return cached.products;
  } catch (error) {
    return null;
  }
}

function saveProductsCache(items) {
  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      products: items
    }));
  } catch (error) {
    console.warn('Product cache unavailable:', error);
  }
}

function mapProduct(p) {
  return {
    id: p.slug || p.id,
    name: p.name,
    category: p.category || 'uncategorized',
    price: p.price,
    description: p.description || '',
    image: p.image_url || p.image || '/images/placeholder.jpg',
    sub: p.description ? p.description.substring(0, 60) + (p.description.length > 60 ? '...' : '') : '',
    supabase_id: p.id || p.supabase_id,
    stock: p.stock !== undefined && p.stock !== null ? p.stock : 'In Stock'
  };
}

// ===== LOAD PRODUCTS FROM SUPABASE =====
async function loadProductsFromSupabase() {
  const cachedProducts = getCachedProducts();
  const hasCachedProducts = cachedProducts && cachedProducts.length > 0;

  if (hasCachedProducts) {
    products = cachedProducts;
    renderProducts();
    updateCartBadge();
  }

  try {
    const { data, error } = await _supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      if (!hasCachedProducts) {
        shopGrid.innerHTML = `
          <div class="empty-state" style="display: block; grid-column: 1 / -1; text-align: center; padding: 3rem 0;">
            <p style="color: var(--text-mid);">No products found. Check back soon!</p>
          </div>
        `;
      }
      return;
    }

    products = data.map(mapProduct);
    saveProductsCache(products);
    renderProducts();
    updateCartBadge();

  } catch (error) {
    console.error('Error loading products:', error);

    if (!hasCachedProducts) {
      shopGrid.innerHTML = `
        <div class="empty-state" style="display: block; grid-column: 1 / -1; text-align: center; padding: 3rem 0;">
          <p style="color: #e74c3c;">Failed to load products. Please refresh the page.</p>
        </div>
      `;
    }
  }
}

// ===== RENDER PRODUCTS =====
function renderProducts() {
  if (currentFilter === 'all') {
    filteredProducts = [...products];
  } else {
    filteredProducts = products.filter(p => p.category === currentFilter);
  }

  switch (currentSort) {
    case 'price-low':
      filteredProducts.sort((a, b) => a.price - b.price);
      break;
    case 'price-high':
      filteredProducts.sort((a, b) => b.price - a.price);
      break;
    case 'name-asc':
      filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
      break;
    default:
      break;
  }

  shopGrid.innerHTML = '';

  if (filteredProducts.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  filteredProducts.forEach(product => {
    const card = document.createElement('div');
    card.className = 'shop-card';
    
    card.innerHTML = `
      <div class="treatment-card">
        <a href="product.html?id=${product.id}" class="shop-card-image-link">
          <div class="treatment-img">
            <img src="${product.image}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        </a>
        <div class="treatment-info">
          <a href="product.html?id=${product.id}" class="shop-card-title-link">
            <div class="treatment-name">${product.name}</div>
          </a>
          <div class="treatment-sub">${product.sub}</div>
          <div class="shop-card-actions">
            <div class="shop-quantity-selector" aria-label="Quantity for ${product.name}">
              <button type="button" class="shop-qty-btn shop-qty-decrease" aria-label="Decrease quantity">−</button>
              <input type="number" class="shop-qty-input" value="1" min="1" max="99" aria-label="Quantity">
              <button type="button" class="shop-qty-btn shop-qty-increase" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="btn-primary shop-add-to-cart" data-product-id="${product.id}">Add to Cart</button>
          </div>
          <div class="product-price-shop" data-price-ngn="${product.price}">${formatPrice(product.price, currentCurrency)}</div>
        </div>
      </div>
    `;
    
    shopGrid.appendChild(card);
  });

  attachShopCardHandlers();
}

// ===== SHOP CARD CART HANDLERS =====
function attachShopCardHandlers() {
  document.querySelectorAll('.shop-qty-decrease').forEach(btn => {
    btn.addEventListener('click', function() {
      const input = this.parentElement.querySelector('.shop-qty-input');
      input.value = Math.max(1, (parseInt(input.value) || 1) - 1);
    });
  });

  document.querySelectorAll('.shop-qty-increase').forEach(btn => {
    btn.addEventListener('click', function() {
      const input = this.parentElement.querySelector('.shop-qty-input');
      input.value = Math.min(99, (parseInt(input.value) || 1) + 1);
    });
  });

  document.querySelectorAll('.shop-qty-input').forEach(input => {
    input.addEventListener('change', function() {
      let value = parseInt(this.value);
      if (isNaN(value) || value < 1) value = 1;
      if (value > 99) value = 99;
      this.value = value;
    });
  });

  document.querySelectorAll('.shop-add-to-cart').forEach(btn => {
    btn.addEventListener('click', function() {
      const product = products.find(item => item.id === this.dataset.productId);
      const input = this.closest('.shop-card-actions').querySelector('.shop-qty-input');
      const quantity = Math.min(99, Math.max(1, parseInt(input.value) || 1));

      if (!product) {
        showToast('Product not found.', '⚠️');
        return;
      }

      const cart = JSON.parse(localStorage.getItem('cart')) || [];
      const existingItem = cart.find(item => item.id === product.id);

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: quantity,
          image: product.image
        });
      }

      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartBadge();
      window.syncCartIndicators?.(true);
      showToast(`<strong>${product.name}</strong> added to cart! (${quantity})`, '🛒');
    });
  });
}

// ===== FILTER HANDLERS =====
filterBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    filterBtns.forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentFilter = this.dataset.filter;
    renderProducts();
  });
});

// ===== SORT HANDLER =====
if (sortSelect) {
  sortSelect.addEventListener('change', function() {
    currentSort = this.value;
    renderProducts();
  });
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
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  loadProductsFromSupabase();
});