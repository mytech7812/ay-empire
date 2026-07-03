// ===== PRODUCT DETAIL PAGE JAVASCRIPT =====

// ===== SUPABASE CONFIG (SINGLE DECLARATION) =====
const supabaseUrl = 'https://iirctokpamybsmgzstnj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmN0b2twYW15YnNtZ3pzdG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjYwMTksImV4cCI6MjA5ODAwMjAxOX0.eTW0Ipnibowlp3JVewxFnRXcwReKDqiJs8L_X8UfQVc'; // Replace with your actual anon key

const _supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

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
    category: p.category || 'Uncategorized',
    price: p.price,
    description: p.description || '',
    image: p.image_url || p.image || '/images/placeholder.jpg',
    stock: p.stock !== undefined && p.stock !== null ? p.stock : 'In Stock'
  };
}

function cacheProduct(product) {
  const cachedProducts = getCachedProducts() || [];
  const nextProducts = cachedProducts.filter(item => item.id !== product.id);
  nextProducts.unshift(product);
  saveProductsCache(nextProducts);
}

// ===== LOAD PRODUCT FROM SUPABASE =====
async function loadProductFromSupabase(productId) {
  const cachedProducts = getCachedProducts();
  const cachedProduct = cachedProducts?.find(product => product.id === productId);

  if (cachedProduct) {
    return cachedProduct;
  }

  try {
    const { data, error } = await _supabase
      .from('products')
      .select('*')
      .eq('slug', productId)
      .single();

    if (error) throw error;

    if (!data) {
      return null;
    }

    const product = mapProduct(data);
    cacheProduct(product);
    return product;

  } catch (error) {
    console.error('Error loading product:', error);
    return null;
  }
}

// ===== DOMContentLoaded =====
document.addEventListener('DOMContentLoaded', async function() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    document.getElementById('product-name').textContent = 'Product Not Found';
    document.getElementById('product-description').textContent = 'Please select a product from our shop.';
    return;
  }

  // Show loading state
  document.getElementById('product-name').textContent = 'Loading...';
  document.getElementById('product-description').textContent = 'Please wait...';

  // Load product from Supabase
  const product = await loadProductFromSupabase(productId);

  if (!product) {
    document.getElementById('product-name').textContent = 'Product Not Found';
    document.getElementById('product-description').textContent = 'The product you\'re looking for does not exist.';
    return;
  }

  // Populate page with product data
  document.getElementById('product-image').src = product.image;
  document.getElementById('product-image').alt = product.name;
  document.getElementById('product-category').textContent = product.category;
  document.getElementById('product-name').textContent = product.name;
  const priceEl = document.getElementById('product-price');
  priceEl.textContent = formatPrice(product.price, currentCurrency);
  priceEl.dataset.priceNgn = product.price;
  document.getElementById('product-description').textContent = product.description;
  document.getElementById('meta-category').textContent = product.category;
  document.getElementById('meta-stock').textContent = typeof product.stock === 'number' ? (product.stock > 0 ? 'In Stock' : 'Out of Stock') : product.stock;

  // Update page title
  document.title = product.name + ' | AY Empire';

  // Store current product for add to cart
  window.currentProduct = product;

  // Smart back button
  const backLink = document.querySelector('.back-link');
  const referrer = document.referrer;
  if (referrer.includes('shop.html')) {
    backLink.href = 'shop.html';
  } else if (referrer.includes('index.html') || referrer.includes('ayempire.com')) {
    backLink.href = 'index.html#treatments';
  } else {
    backLink.href = 'shop.html';
  }

  // Update cart badge
  updateCartBadge();
  window.syncCartIndicators?.();
});

// ===== QUANTITY CONTROLS =====
const qtyInput = document.getElementById('quantity');
const qtyDecrease = document.getElementById('qty-decrease');
const qtyIncrease = document.getElementById('qty-increase');

if (qtyDecrease) {
  qtyDecrease.addEventListener('click', function() {
    let currentValue = parseInt(qtyInput.value);
    if (currentValue > 1) {
      qtyInput.value = currentValue - 1;
    }
  });
}

if (qtyIncrease) {
  qtyIncrease.addEventListener('click', function() {
    let currentValue = parseInt(qtyInput.value);
    if (currentValue < 99) {
      qtyInput.value = currentValue + 1;
    }
  });
}

if (qtyInput) {
  qtyInput.addEventListener('change', function() {
    let value = parseInt(this.value);
    if (isNaN(value) || value < 1) {
      this.value = 1;
    } else if (value > 99) {
      this.value = 99;
    }
  });
}

// ===== ADD TO CART =====
const addToCartBtn = document.getElementById('add-to-cart');

if (addToCartBtn) {
  addToCartBtn.addEventListener('click', function() {
    const product = window.currentProduct;
    if (!product) {
      showToast('Product not found. Please try again.', '⚠️');
      return;
    }

    const quantity = parseInt(qtyInput.value);

    let cart = JSON.parse(localStorage.getItem('cart')) || [];
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