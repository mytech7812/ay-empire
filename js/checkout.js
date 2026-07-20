// ===== CHECKOUT PAGE JAVASCRIPT =====

// ===== DOM ELEMENTS =====
const checkoutItems = document.getElementById('checkout-items');
const checkoutSubtotal = document.getElementById('checkout-subtotal');
const checkoutShipping = document.getElementById('checkout-shipping');
const checkoutTotal = document.getElementById('checkout-total');
const placeOrderBtn = document.getElementById('place-order-btn');

// 👇 ADD verifyCartItems() HERE
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

// ===== SALE UTILITY (using global isSaleActive) =====
function getCheckoutItemEffectivePrice(item) {
  const rate = getExchangeRate('ZAR') || 84;
  return isSaleActive(item) ? Number(item.sale_price) * rate : Number(item.price || 0);
}

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
async function loadCheckout() {
  // ✅ Refresh cart from Supabase
  const verifiedItems = await verifyCartItems();
  
  // Filter to available and in-stock items
  const availableItems = verifiedItems.filter(item => item.available && item.inStock);
  const unavailableItems = verifiedItems.filter(item => !item.available || !item.inStock);
  
  // Update localStorage with ONLY available items
  localStorage.setItem('cart', JSON.stringify(availableItems));
  
  if (availableItems.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  // ✅ Pass both available and unavailable items to render
  renderCheckoutItems(availableItems, unavailableItems);
  
  // ✅ Only total available items
  const subtotal = availableItems.reduce((sum, item) => {
    const price = getCheckoutItemEffectivePrice(item);
    return sum + (price * item.quantity);
  }, 0);
  
  const country = document.getElementById('country').value;
  const shipping = getDeliveryFee(country);
  const total = subtotal + shipping;

  checkoutSubtotal.textContent = formatPrice(subtotal, currentCurrency);
  checkoutShipping.textContent = formatPrice(shipping, currentCurrency);
  checkoutTotal.textContent = formatPrice(total, currentCurrency);
}

function renderCheckoutItems(availableItems, unavailableItems = []) {
  checkoutItems.innerHTML = '';

  // ✅ Show available items
  availableItems.forEach(item => {
    const itemElement = document.createElement('div');
    itemElement.className = 'checkout-item';
    
    const saleActive = isSaleActive(item);
    const effectivePrice = getCheckoutItemEffectivePrice(item);
    
    itemElement.innerHTML = `
      <div class="checkout-item-name">
        ${item.name} <span>×${item.quantity}</span>
        ${saleActive ? `<span class="checkout-item-sale-tag">Sale</span>` : ''}
      </div>
      <div class="checkout-item-price">
        ${saleActive ? `
          <span class="checkout-original-price">${formatPrice(Number(item.price || 0) * item.quantity, currentCurrency)}</span>
          <span class="checkout-sale-price">${formatPrice(effectivePrice * item.quantity, currentCurrency)}</span>
        ` : formatPrice(Number(item.price || 0) * item.quantity, currentCurrency)}
      </div>
    `;
    checkoutItems.appendChild(itemElement);
  });

  // ✅ Show unavailable items with a warning
  if (unavailableItems.length > 0) {
    const warningWrapper = document.createElement('div');
    warningWrapper.className = 'checkout-unavailable-wrapper';
    warningWrapper.style.cssText = `
      padding: 1rem;
      background: #fef3c7;
      border-left: 3px solid #e67e22;
      margin: 0.5rem 0;
      border-radius: 4px;
    `;
    
    warningWrapper.innerHTML = `
      <div style="font-weight: 600; color: #92400e; margin-bottom: 0.3rem;">
        ⚠️ Items no longer available
      </div>
      <ul style="margin: 0; padding-left: 1.2rem; color: #92400e; font-size: 0.9rem;">
        ${unavailableItems.map(item => `
          <li>${item.name} — ${!item.available ? 'Product no longer exists' : 'Out of stock'}</li>
        `).join('')}
      </ul>
      <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #92400e;">
        These items have been removed from your order total.
      </div>
    `;
    
    checkoutItems.appendChild(warningWrapper);
  }
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
          sale_price: item.sale_price || null,
          on_sale: item.on_sale || false,
          sale_start: item.sale_start || null,
          sale_end: item.sale_end || null,
          price: item.price || null,
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
    const subtotal = cart.reduce((sum, item) => {
      const price = getCheckoutItemEffectivePrice(item);
      return sum + (price * item.quantity);
    }, 0);
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