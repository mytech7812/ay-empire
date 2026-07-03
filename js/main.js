// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = this.getAttribute('href');
    if (target && target !== '#' && document.querySelector(target)) {
      e.preventDefault();
      document.querySelector(target).scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ===== HAMBURGER MENU =====
document.querySelector('.hamburger')?.addEventListener('click', function() {
  const links = document.querySelector('.nav-links');
  if (links.style.display === 'flex') {
    links.style.display = 'none';
  } else {
    links.style.display = 'flex';
    links.style.position = 'absolute';
    links.style.top = '72px';
    links.style.left = '0';
    links.style.right = '0';
    links.style.background = 'var(--cream-light)';
    links.style.padding = '1.5rem 5%';
    links.style.borderBottom = '1px solid var(--border)';
  }
});

// ===== MOBILE CART LINK =====
function updateMobileCartBadge() {
  const nav = document.querySelector('nav');
  const hamburger = document.querySelector('.hamburger');
  if (!nav || !hamburger) return;

  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  let mobileCartLink = document.querySelector('.mobile-cart-link');

  if (!mobileCartLink) {
    mobileCartLink = document.createElement('a');
    mobileCartLink.href = 'cart.html';
    mobileCartLink.className = 'mobile-cart-link';
    mobileCartLink.setAttribute('aria-label', 'View cart');
    mobileCartLink.innerHTML = `
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"/>
        <circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
      <span class="mobile-cart-count">0</span>
    `;
    nav.insertBefore(mobileCartLink, hamburger);
  }

  mobileCartLink.querySelector('.mobile-cart-count').textContent = totalItems;
}

updateMobileCartBadge();

function getCartItemCount() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function updateFloatingCartBadge(animate = false) {
  const floatingCart = document.querySelector('.floating-cart-link');
  if (!floatingCart) return;

  const totalItems = getCartItemCount();
  const count = floatingCart.querySelector('.floating-cart-count');

  if (count) {
    count.textContent = totalItems;
  }

  floatingCart.classList.toggle('has-items', totalItems > 0);

  if (animate) {
    floatingCart.classList.remove('cart-bump');
    void floatingCart.offsetWidth;
    floatingCart.classList.add('cart-bump');
  }
}

window.updateFloatingCartBadge = updateFloatingCartBadge;
window.syncCartIndicators = function(animate = false) {
  updateMobileCartBadge();
  updateFloatingCartBadge(animate);
};

updateFloatingCartBadge();

// ===== TOAST NOTIFICATION =====
function showToast(message, icon = '\u2713') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  const toastIcon = toast?.querySelector('.toast-icon');
  
  if (!toast) return;
  
  if (toastMessage) {
    toastMessage.innerHTML = message;
  }
  if (toastIcon) {
    toastIcon.textContent = icon;
  }
  
  toast._shownAt = Date.now();
  toast.classList.add('show');
  
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

document.addEventListener('click', function(e) {
  const toast = document.getElementById('toast');
  if (
    toast &&
    toast.classList.contains('show') &&
    Date.now() - (toast._shownAt || 0) > 100 &&
    !toast.contains(e.target)
  ) {
    toast.classList.remove('show');
  }
});

// ===== CURRENCY SYSTEM (SIMPLIFIED) =====
let currentCurrency = 'NGN';

// ===== FETCH RATES FROM SUPABASE =====
async function fetchRatesFromSupabase() {
  try {
    const response = await fetch('https://iirctokpamybsmgzstnj.supabase.co/functions/v1/rates');
    const data = await response.json();
    
    if (data.success && data.rates) {
      if (data.rates.exchange_rate_zar) {
        localStorage.setItem('exchange_rate_zar', data.rates.exchange_rate_zar);
      }
      if (data.rates.exchange_rate_usd) {
        localStorage.setItem('exchange_rate_usd', data.rates.exchange_rate_usd);
      }
      return data.rates;
    }
  } catch (error) {
    console.error('Failed to fetch rates from Supabase:', error);
  }
  return null;
}

function getExchangeRate(currency) {
  if (currency === 'ZAR') {
    const stored = localStorage.getItem('exchange_rate_zar');
    return stored ? parseInt(stored) : 84; // Fallback: 84 NGN = 1 ZAR
  } else if (currency === 'USD') {
    const stored = localStorage.getItem('exchange_rate_usd');
    return stored ? parseInt(stored) : 1400; // Fallback: 1400 NGN = 1 USD
  }
  return 1; // NGN is base
}

function formatPrice(priceNgn, currency) {
  if (currency === 'ZAR') {
    const rate = getExchangeRate('ZAR');
    const zarPrice = Math.round(priceNgn / rate);
    return 'R ' + zarPrice.toLocaleString();
  } else if (currency === 'USD') {
    const rate = getExchangeRate('USD');
    const usdPrice = Math.round(priceNgn / rate);
    return '$ ' + usdPrice.toLocaleString();
  }
  return '₦ ' + priceNgn.toLocaleString();
}

function updatePrices(currency) {
  currentCurrency = currency;
  
  const display = document.getElementById('currency-display');
  if (display) {
    const symbols = { NGN: '₦ NGN', ZAR: 'R ZAR', USD: '$ USD' };
    display.textContent = symbols[currency] || '₦ NGN';
  }
  
  document.querySelectorAll('[data-price-ngn]').forEach(el => {
    const priceNgn = parseInt(el.dataset.priceNgn);
    el.textContent = formatPrice(priceNgn, currency);
  });
  
  document.querySelectorAll('.product-price-shop').forEach(el => {
    const priceNgn = parseInt(el.dataset.priceNgn);
    if (priceNgn) {
      el.textContent = formatPrice(priceNgn, currency);
    }
  });
  
  const productPrice = document.getElementById('product-price');
  if (productPrice) {
    const priceNgn = parseInt(productPrice.dataset.priceNgn);
    if (priceNgn) {
      productPrice.textContent = formatPrice(priceNgn, currency);
    }
  }
  
  localStorage.setItem('user_currency', currency);
}

// ===== INITIALIZE CURRENCY SYSTEM =====
async function initCurrency() {
  // Fetch rates from Supabase
  await fetchRatesFromSupabase();
  
  // Use stored preference or default to NGN
  const preferredCurrency = localStorage.getItem('user_currency') || 'NGN';
  currentCurrency = preferredCurrency;
  
  const display = document.getElementById('currency-display');
  if (display) {
    display.textContent = currentCurrency === 'NGN' ? '₦ NGN' : 'R ZAR';
  }
  
  updatePrices(currentCurrency);
}

// ===== CURRENCY DROPDOWN EVENTS =====
document.addEventListener('DOMContentLoaded', function() {
  const currencyBtn = document.getElementById('currency-btn');
  const currencyDropdown = document.getElementById('currency-dropdown');
  
  if (currencyBtn && currencyDropdown) {
    currencyBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      currencyDropdown.classList.toggle('show');
      currencyBtn.classList.toggle('active');
    });
    
    document.addEventListener('click', function(e) {
      if (!currencyBtn.contains(e.target) && !currencyDropdown.contains(e.target)) {
        currencyDropdown.classList.remove('show');
        currencyBtn.classList.remove('active');
      }
    });
    
    document.querySelectorAll('.currency-option').forEach(option => {
      option.addEventListener('click', function() {
        const currency = this.dataset.currency;
        updatePrices(currency);
        
        document.querySelectorAll('.currency-option').forEach(opt => {
          opt.classList.remove('active');
        });
        this.classList.add('active');
        
        currencyDropdown.classList.remove('show');
        currencyBtn.classList.remove('active');
      });
    });
  }
  
  initCurrency();
});