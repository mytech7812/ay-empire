// ===== CHECKOUT PAGE JAVASCRIPT =====

// ===== DOM ELEMENTS =====
const checkoutItems = document.getElementById('checkout-items');
const checkoutSubtotal = document.getElementById('checkout-subtotal');
const checkoutShipping = document.getElementById('checkout-shipping');
const checkoutTotal = document.getElementById('checkout-total');
const placeOrderBtn = document.getElementById('place-order-btn');

// ===== GET EXCHANGE RATE =====
function getExchangeRate(currency) {
  if (currency === 'ZAR') {
    const stored = localStorage.getItem('exchange_rate_zar');
    return stored ? parseInt(stored) : 84;
  } else if (currency === 'USD') {
    const stored = localStorage.getItem('exchange_rate_usd');
    return stored ? parseInt(stored) : 1400;
  }
  return 1; // NGN is base
}

// ===== LOAD CART INTO CHECKOUT =====
function loadCheckout() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];

  if (cart.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  renderCheckoutItems(cart);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const country = document.getElementById('country').value;
  const shipping = getDeliveryFee(country);
  const total = subtotal + shipping;

  checkoutSubtotal.textContent = formatPrice(subtotal, currentCurrency);
  checkoutShipping.textContent = formatPrice(shipping, currentCurrency);
  checkoutTotal.textContent = formatPrice(total, currentCurrency);
}

// ===== RENDER CHECKOUT ITEMS =====
function renderCheckoutItems(cart) {
  checkoutItems.innerHTML = '';

  cart.forEach(item => {
    const itemElement = document.createElement('div');
    itemElement.className = 'checkout-item';
    itemElement.innerHTML = `
      <div class="checkout-item-name">
        ${item.name} <span>×${item.quantity}</span>
      </div>
      <div class="checkout-item-price">${formatPrice(item.price * item.quantity, currentCurrency)}</div>
    `;
    checkoutItems.appendChild(itemElement);
  });
}

// ===== DELIVERY LOGIC =====
function getDeliveryMethod() {
  const selected = document.querySelector('input[name="delivery_method"]:checked');
  return selected ? selected.value : 'pickup';
}

function getDeliveryPartner(country) {
  if (getDeliveryMethod() === 'pickup') {
    return 'Pickup';
  }
  
  if (country === 'South Africa') {
    return 'Aramex Courier';
  }
  
  if (country === 'Nigeria') {
    return 'Delivery Fee settled on arrival';
  }
  
  // All other countries
  return 'DHL Express';
}

function getDeliveryFee(country) {
  // Pickup = free
  if (getDeliveryMethod() === 'pickup') {
    return 0;
  }
  
  // South Africa: 100 ZAR converted to NGN
  if (country === 'South Africa') {
    const rate = getExchangeRate('ZAR');
    return 100 * rate;
  }
  
  // Nigeria: Free (settled on arrival)
  if (country === 'Nigeria') {
    return 0;
  }
  
  // USA, Canada, Mexico: R 2,500 converted to NGN
  if (country === 'USA' || country === 'Canada' || country === 'Mexico') {
    const rate = getExchangeRate('ZAR');
    return 2500 * rate;
  }
  
  // UK and UAE: R 2,200 converted to NGN
  if (country === 'UK' || country === 'United Arab Emirates') {
    const rate = getExchangeRate('ZAR');
    return 2200 * rate;
  }
  
  // All other countries: R 1,200 converted to NGN
  const rate = getExchangeRate('ZAR');
  return 1200 * rate;
}

function updateDeliveryInfo() {
  const country = document.getElementById('country').value;
  const method = getDeliveryMethod();
  const partner = getDeliveryPartner(country);
  const fee = getDeliveryFee(country);
  
  const infoDiv = document.getElementById('delivery-partner-info');
  const partnerGroup = document.getElementById('delivery-partner-group');
  
  if (method === 'shipping') {
    partnerGroup.style.display = 'block';
    
    let feeDisplay = '';
    if (country === 'Nigeria') {
      feeDisplay = '— Settled on arrival';
    } else if (fee > 0) {
      feeDisplay = `— ${formatPrice(fee, currentCurrency)}`;
    } else {
      feeDisplay = '— No fee';
    }
    
    infoDiv.innerHTML = `
      <strong>${partner}</strong>
      ${feeDisplay}
    `;
  } else {
    partnerGroup.style.display = 'none';
  }
  
  loadCheckout();
}

function calculateShipping() {
  const country = document.getElementById('country').value;
  let shippingNgn = 0;
  
  // South Africa: 100 ZAR converted to NGN
  if (country === 'South Africa') {
    const rate = getExchangeRate('ZAR');
    shippingNgn = 100 * rate;
  }
  // Other countries: DHL placeholder
  else if (country && country !== '') {
    shippingNgn = 0;
  }
  
  return shippingNgn;
}

// ===== UPDATE SHIPPING WHEN COUNTRY CHANGES =====
document.addEventListener('DOMContentLoaded', function() {
  const countrySelect = document.getElementById('country');
  if (countrySelect) {
    countrySelect.addEventListener('change', function() {
      loadCheckout(); // Recalculate shipping
    });
  }
});

// ===== PLACE ORDER =====
placeOrderBtn.addEventListener('click', async function() {
  // Get form values
  const fullName = document.getElementById('full-name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();
  const city = document.getElementById('city').value.trim();
  const state = document.getElementById('state').value.trim();
  const country = document.getElementById('country').value.trim();
  const zip = document.getElementById('zip').value.trim();
  const notes = document.getElementById('notes').value.trim();

  // Validate required fields
  if (!fullName) {
    showToast('Please enter your full name.');
    document.getElementById('full-name').focus();
    return;
  }

  if (!email) {
    showToast('Please enter your email address.');
    document.getElementById('email').focus();
    return;
  }

  if (!phone) {
    showToast('Please enter your phone number.');
    document.getElementById('phone').focus();
    return;
  }

  if (!address) {
    showToast('Please enter your delivery address.');
    document.getElementById('address').focus();
    return;
  }

  if (!city) {
    showToast('Please enter your city.');
    document.getElementById('city').focus();
    return;
  }

  if (!state) {
    showToast('Please enter your state.');
    document.getElementById('state').focus();
    return;
  }

  if (!country) {
    showToast('Please select your country.');
    document.getElementById('country').focus();
    return;
  }

  // Get cart
  const cart = JSON.parse(localStorage.getItem('cart')) || [];

  if (cart.length === 0) {
    showToast('Your cart is empty.');
    return;
  }

  

  // Calculate shipping in NGN
  const shippingNgn = getDeliveryFee(document.getElementById('country').value);

  // Disable button to prevent double-click
  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = 'Processing...';

  try {
    // Get the Supabase function URL
    const supabaseProjectId = 'iirctokpamybsmgzstnj';
    const functionUrl = `https://${supabaseProjectId}.supabase.co/functions/v1/checkout`;

    // Send to server
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
// Inside the fetch call, update the body:
      body: JSON.stringify({
        customer: {
          fullName,
          email,
          phone,
          address,
          city,
          state,
          country,
          zip,
          notes,
        },
        items: cart.map(item => ({
          id: item.id,
          quantity: item.quantity,
        })),
        shipping: shippingNgn,
        currency: currentCurrency || 'NGN',
        exchangeRate: getExchangeRate(currentCurrency),
        deliveryMethod: getDeliveryMethod(),
        deliveryPartner: getDeliveryPartner(country),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'Something went wrong. Please try again.', 'error');
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = 'Pay Now';
      return;
    }

    if (!data.success) {
      showToast(data.error || 'Payment could not be initialized.', 'error');
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = 'Pay Now';
      return;
    }

// Store order data for success page
const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
const orderData = {
  orderNumber: data.orderNumber,
  total: subtotal + shippingNgn,
  currency: currentCurrency || 'NGN',
  exchangeRate: getExchangeRate(currentCurrency) || 55,
};
sessionStorage.setItem('orderData', JSON.stringify(orderData));

    // Redirect to Paystack
    window.location.href = data.authorization_url;

  } catch (error) {
    console.error('Checkout error:', error);
    showToast('Network error. Please check your connection and try again.', 'error');
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = 'Pay Now';
  }
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  // ===== DELIVERY EVENT LISTENERS =====
  // Delivery method radio buttons
  document.querySelectorAll('input[name="delivery_method"]').forEach(radio => {
    radio.addEventListener('change', function() {
      updateDeliveryInfo();
    });
  });

  // Country change also updates delivery
  const countrySelect = document.getElementById('country');
  if (countrySelect) {
    countrySelect.addEventListener('change', function() {
      updateDeliveryInfo();
    });
  }

  // Initialize delivery info
  updateDeliveryInfo();

  // Wait for currency to be ready before loading checkout
  if (typeof currencyReady !== 'undefined' && currencyReady) {
    loadCheckout();
  } else {
    document.addEventListener('currencyReady', function() {
      loadCheckout();
    });
  }
});