// ===== CART PAGE JAVASCRIPT =====

// ===== DOM ELEMENTS =====
const cartItemsContainer = document.getElementById('cart-items');
const cartItemsWrapper = document.getElementById('cart-items-wrapper');
const cartEmpty = document.getElementById('cart-empty');
const cartSubtotal = document.getElementById('cart-subtotal');
const cartTotal = document.getElementById('cart-total');

// ===== LOAD CART =====
function loadCart() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];

  if (cart.length === 0) {
    // Show empty cart
    cartItemsWrapper.style.display = 'none';
    cartEmpty.style.display = 'block';
    return;
  }

  // Show cart items
  cartItemsWrapper.style.display = 'block';
  cartEmpty.style.display = 'none';

  // Render cart items
  renderCartItems(cart);

  // Update totals
  updateTotals(cart);
}

// ===== RENDER CART ITEMS =====
function renderCartItems(cart) {
  cartItemsContainer.innerHTML = '';

  cart.forEach((item, index) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item';
    itemElement.innerHTML = `
      <div class="cart-item-image">
        <img src="${item.image}" alt="${item.name}">
      </div>
      <div class="cart-item-details">
        <h3 class="cart-item-name">${item.name}</h3>
        <div class="cart-item-price">${formatPrice(item.price, currentCurrency)}</div>
        <div class="cart-item-actions">
          <div class="cart-item-quantity">
            <button class="qty-btn cart-qty-decrease" data-index="${index}">−</button>
            <input type="number" class="cart-qty-input" value="${item.quantity}" min="1" max="99" data-index="${index}">
            <button class="qty-btn cart-qty-increase" data-index="${index}">+</button>
          </div>
          <button class="cart-item-remove" data-index="${index}">Remove</button>
        </div>
      </div>
      <div class="cart-item-total">
        ${formatPrice(item.price * item.quantity, currentCurrency)}
      </div>
    `;

    cartItemsContainer.appendChild(itemElement);
  });

  // Add event listeners for quantity buttons
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
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  cartSubtotal.textContent = formatPrice(subtotal, currentCurrency);
  cartTotal.textContent = formatPrice(subtotal, currentCurrency);
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