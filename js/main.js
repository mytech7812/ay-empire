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

// ===== CURRENCY AUTO-DETECT =====
async function detectUserCurrency() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    const country = data.country_code;
    
    if (country === 'ZA') {
      return 'ZAR';
    }
    return 'NGN';
  } catch (error) {
    console.error('Currency detection failed:', error);
    return 'NGN';
  }
}

// ===== FETCH RATES FROM SUPABASE =====
async function fetchRatesFromSupabase() {
  try {
    const response = await fetch('https://iirctokpamybsmgzstnj.supabase.co/functions/v1/rates');
    const data = await response.json();
    
    if (data.success && data.rates) {
      if (data.rates.zar_rate) {
        localStorage.setItem('exchange_rate_zar', data.rates.zar_rate);
      }
      if (data.rates.usd_rate) {
        localStorage.setItem('exchange_rate_usd', data.rates.usd_rate);
      }
      return data.rates;
    }
  } catch (error) {
    console.error('Failed to fetch rates from Supabase:', error);
  }
  return null;
}

// ===== CURRENCY SYSTEM =====
let currentCurrency = 'NGN';
let exchangeRates = { ZAR: 55, USD: 1400 };

function getExchangeRate(currency) {
  if (currency === 'ZAR') {
    return parseInt(localStorage.getItem('exchange_rate_zar')) || 55;
  } else if (currency === 'USD') {
    return parseInt(localStorage.getItem('exchange_rate_usd')) || 1400;
  }
  return 1;
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
  // Fetch rates from Supabase first
  await fetchRatesFromSupabase();
  
  let preferredCurrency = localStorage.getItem('user_currency');
  
  if (!preferredCurrency) {
    preferredCurrency = await detectUserCurrency();
    localStorage.setItem('user_currency', preferredCurrency);
  }
  
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