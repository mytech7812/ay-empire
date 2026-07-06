// ===== PRODUCTS MANAGEMENT =====
// Supabase config is already in admin.js - using _supabase globally

// ===== EXCHANGE RATES =====
let currentExchangeRate = 84; // ZAR fallback (84 NGN = 1 ZAR)
let currentUsdRate = 1400;    // USD fallback
const PRODUCTS_CACHE_KEY = 'ay_empire_products_cache_v1';

function clearPublicProductsCache() {
  try {
    localStorage.removeItem(PRODUCTS_CACHE_KEY);
  } catch (error) {
    console.warn('Unable to clear product cache:', error);
  }
}

// ===== GET RATE FROM SUPABASE =====
async function getExchangeRateFromDB() {
  try {
    const { data, error } = await _supabase
      .from('settings')
      .select('value')
      .eq('key', 'exchange_rate_zar')
      .single();
    
    if (error) throw error;
    return parseInt(data.value) || 84;
  } catch (error) {
    console.error('Error fetching rate from Supabase:', error);
    return null;
  }
}

// ===== UPDATE RATE IN SUPABASE =====
async function updateExchangeRateInDB(newRate) {
  try {
    const { error } = await _supabase
      .from('settings')
      .update({ value: newRate.toString(), updated_at: new Date().toISOString() })
      .eq('key', 'exchange_rate_zar');
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating rate:', error);
    return false;
  }
}

// ===== FETCH EXCHANGE RATE — CHECK SUPABASE FIRST =====
async function fetchExchangeRate() {
  try {
    // Priority 1: Fetch from Supabase (synced across all devices)
    const rate = await getExchangeRateFromDB();
    if (rate && rate > 0) {
      currentExchangeRate = rate;
      localStorage.setItem('exchange_rate_zar', rate.toString());
      updateRateDisplay();
      updateRateDisplayInForm();
      return currentExchangeRate;
    }
  } catch (error) {
    console.error('Failed to fetch rate from Supabase:', error);
  }

  // Priority 2: Check if dashboard rate exists in localStorage (fallback)
  const dashboardRate = localStorage.getItem('exchange_rate_zar');
  if (dashboardRate) {
    currentExchangeRate = parseInt(dashboardRate);
    updateRateDisplay();
    updateRateDisplayInForm();
    return currentExchangeRate;
  }

  // Priority 3: Fetch from API only if no stored rate
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/NGN');
    const data = await response.json();
    
    if (data && data.rates) {
      const zarRate = 1 / data.rates.ZAR;
      const bufferedZar = Math.ceil((zarRate + 20) / 100) * 100;
      currentExchangeRate = bufferedZar;
      localStorage.setItem('exchange_rate_zar', currentExchangeRate.toString());
      
      const usdRate = 1 / data.rates.USD;
      const bufferedUsd = Math.ceil((usdRate + 20) / 100) * 100;
      currentUsdRate = bufferedUsd;
      localStorage.setItem('exchange_rate_usd', currentUsdRate.toString());
      
      updateRateDisplay();
      updateRateDisplayInForm();
      return currentExchangeRate;
    }
  } catch (error) {
    console.error('Exchange rate fetch error:', error);
  }
  
  // Priority 4: Hardcoded fallback
  currentExchangeRate = 84;
  localStorage.setItem('exchange_rate_zar', '84');
  updateRateDisplay();
  updateRateDisplayInForm();
  return currentExchangeRate;
}

function updateRateDisplay() {
  const display = document.getElementById('rate-status');
  if (display) {
    display.textContent = `1 ZAR = ₦${currentExchangeRate} | 1 USD = ₦${currentUsdRate}`;
  }
  
  const input = document.getElementById('exchange-rate');
  if (input) {
    input.value = currentExchangeRate;
  }
}

function updateRateDisplayInForm() {
  const display = document.getElementById('display-rate');
  if (display) {
    display.textContent = currentExchangeRate;
  }
}

// ===== SYNC RATE TO SUPABASE =====
async function syncRateToSupabase(rate) {
  try {
    const success = await updateExchangeRateInDB(rate);
    if (success) {
      // Update local storage after successful sync
      localStorage.setItem('exchange_rate_zar', rate.toString());
      currentExchangeRate = rate;
      updateRateDisplay();
      updateRateDisplayInForm();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Sync rate error:', error);
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNaira(value) {
  const amount = Number(value) || 0;
  return `&#8358;${amount.toLocaleString()}`;
}

function getStockMeta(stock) {
  if (stock === undefined || stock === null || stock === '') {
    return { label: 'Unlimited', className: 'in-stock' };
  }

  const stockCount = Number(stock);
  if (stockCount <= 0) return { label: 'Out of stock', className: 'out-stock' };
  if (stockCount <= 5) return { label: `${stockCount} left`, className: 'low-stock' };
  return { label: `${stockCount} in stock`, className: 'in-stock' };
}

function getProductDescription(description) {
  const cleanDescription = String(description || '').trim();
  if (!cleanDescription) return 'No description added yet.';
  return cleanDescription.length > 120 ? `${cleanDescription.slice(0, 120)}...` : cleanDescription;
}

// ===== LOAD PRODUCTS =====
async function loadProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading-message">Loading products...</div>';

  try {
    const { data: products, error } = await _supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!products || products.length === 0) {
      grid.innerHTML = `
        <div class="empty-state product-empty-state">
          <p>No products added yet.</p>
          <button class="btn-primary" type="button" onclick="openAddProductModal()">Add your first product</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map(product => {
      const stockMeta = getStockMeta(product.stock);
      const category = product.category || 'Uncategorized';
      const imageUrl = product.image_url || '/images/placeholder.jpg';
      const zarPrice = product.price_zar ? `R${Number(product.price_zar).toLocaleString()}` : 'Auto';

      return `
        <article class="product-admin-card" data-id="${escapeHtml(product.id)}">
          <div class="product-card-image-wrap">
            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" class="product-card-image">
            <span class="product-card-category">${escapeHtml(category)}</span>
          </div>

          <div class="product-card-body">
            <div class="product-card-heading">
              <h3>${escapeHtml(product.name)}</h3>
              <span class="product-stock-pill ${stockMeta.className}">${escapeHtml(stockMeta.label)}</span>
            </div>

            <p class="product-card-description">${escapeHtml(getProductDescription(product.description))}</p>

            <div class="product-card-meta">
              <div>
                <span class="product-card-label">NGN Price</span>
                <strong>${formatNaira(product.price)}</strong>
              </div>
              <div>
                <span class="product-card-label">ZAR Price</span>
                <strong>${escapeHtml(zarPrice)}</strong>
              </div>
            </div>

            <div class="product-card-actions">
              <button class="edit-product-btn" data-id="${escapeHtml(product.id)}" type="button">Edit</button>
              <button class="delete-product-btn" data-id="${escapeHtml(product.id)}" type="button">Delete</button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    document.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const productId = this.dataset.id;
        const product = products.find(p => String(p.id) === String(productId));
        if (product) openEditProductModal(product);
      });
    });

    document.querySelectorAll('.delete-product-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const productId = this.dataset.id;
        const product = products.find(p => String(p.id) === String(productId));
        if (product) openDeleteModal(product.id, product.name);
      });
    });

  } catch (error) {
    console.error('Load products error:', error);
    grid.innerHTML = `
      <div class="error-state">
        <p>Error loading products. Please refresh.</p>
      </div>
    `;
  }
}

// ===== IMAGE UPLOAD FUNCTIONS =====
async function uploadImage(file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { data, error } = await _supabase.storage
    .from('product-images')
    .upload(filePath, file);

  if (error) {
    console.error('Upload error:', error);
    showToast('Failed to upload image.', 'error');
    return null;
  }

  const { data: { publicUrl } } = _supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return publicUrl;
}

function previewImage(file) {
  const preview = document.getElementById('image-preview');
  const img = document.getElementById('image-preview-img');
  const reader = new FileReader();

  reader.onload = function(e) {
    img.src = e.target.result;
    preview.style.display = 'block';
  };

  reader.readAsDataURL(file);
}

function removeImage() {
  document.getElementById('image-preview').style.display = 'none';
  document.getElementById('image-preview-img').src = '#';
  document.getElementById('product-image').value = '';
  document.getElementById('product-image-url').value = '';
}

// ===== OPEN ADD PRODUCT MODAL =====
function openAddProductModal() {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('modal-product-title');
  const submitBtn = document.getElementById('product-submit-btn');

  title.textContent = 'Add Product';
  submitBtn.textContent = 'Add Product';
  document.getElementById('product-form').reset();
  document.getElementById('product-id').value = '';
  document.getElementById('product-image-url').value = '';
  document.getElementById('image-preview').style.display = 'none';
  document.getElementById('image-preview-img').src = '#';

  modal.style.display = 'flex';
}

// ===== OPEN EDIT PRODUCT MODAL =====
function openEditProductModal(product) {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('modal-product-title');
  const submitBtn = document.getElementById('product-submit-btn');
  const preview = document.getElementById('image-preview');
  const previewImg = document.getElementById('image-preview-img');
  const imageUrlInput = document.getElementById('product-image-url');

  title.textContent = 'Edit Product';
  submitBtn.textContent = 'Update Product';

  document.getElementById('product-id').value = product.id;
  document.getElementById('product-name').value = product.name;
  document.getElementById('product-description').value = product.description || '';
  document.getElementById('product-price-zar').value = product.price_zar || '';
  document.getElementById('product-category').value = product.category || '';
  document.getElementById('product-stock').value = product.stock || 10;
  document.getElementById('product-image').value = '';

  if (product.image_url) {
    previewImg.src = product.image_url;
    preview.style.display = 'block';
    imageUrlInput.value = product.image_url;
  } else {
    preview.style.display = 'none';
    imageUrlInput.value = '';
  }

  modal.style.display = 'flex';
}

// ===== SAVE PRODUCT =====
async function saveProduct(event) {
  event.preventDefault();

  const id = document.getElementById('product-id').value;
  const name = document.getElementById('product-name').value.trim();
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const description = document.getElementById('product-description').value.trim();
  
  // ===== PRICE HANDLING =====
  // Get ZAR price (required)
  const priceZarInput = document.getElementById('product-price-zar').value.trim();
  const priceZar = parseInt(priceZarInput);

  // Get the dashboard rate (from localStorage or fallback)
  const rate = parseInt(localStorage.getItem('exchange_rate_zar')) || 84;

  // Auto-calculate NGN price
  const priceNgn = priceZar * rate;
  
  const category = document.getElementById('product-category').value;
  const stock = parseInt(document.getElementById('product-stock').value) || 0;
  const imageFile = document.getElementById('product-image').files[0];
  const existingImageUrl = document.getElementById('product-image-url').value;

  if (!name || !slug || !priceZar || !category) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }

  const submitBtn = document.getElementById('product-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    let imageUrl = existingImageUrl;

    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = id ? 'Update Product' : 'Add Product';
        return;
      }
    }

    if (!imageUrl) {
      imageUrl = '/images/placeholder.jpg';
    }

    let result;

    if (id) {
      result = await _supabase
        .from('products')
        .update({
          name,
          slug,
          description,
          price: priceNgn,
          price_zar: priceZar,
          category,
          image_url: imageUrl,
          stock,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
    } else {
      result = await _supabase
        .from('products')
        .insert({
          name,
          slug,
          description,
          price: priceNgn,
          price_zar: priceZar,
          category,
          image_url: imageUrl,
          stock
        });
    }

    if (result.error) throw result.error;

    clearPublicProductsCache();
    showToast(id ? 'Product updated successfully!' : 'Product added successfully!', 'success');
    closeProductModal();
    loadProducts();

  } catch (error) {
    console.error('Save product error:', error);
    showToast('Failed to save product. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = id ? 'Update Product' : 'Add Product';
  }
}

// ===== DELETE PRODUCT =====
async function deleteProduct(productId) {
  try {
    // First, get the product to find the image URL
    const { data: product, error: fetchError } = await _supabase
      .from('products')
      .select('image_url')
      .eq('id', productId)
      .single();

    if (fetchError) throw fetchError;

    // Delete the product from database
    const { error: deleteError } = await _supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (deleteError) throw deleteError;

    // If product had an image, delete it from storage
    if (product && product.image_url) {
      const urlParts = product.image_url.split('/');
      const filePath = urlParts.slice(urlParts.indexOf('product-images') + 1).join('/');
      
      if (filePath) {
        const { error: storageError } = await _supabase.storage
          .from('product-images')
          .remove([filePath]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
        } else {
          console.log('Image deleted from storage:', filePath);
        }
      }
    }

    clearPublicProductsCache();
    showToast('Product deleted successfully!', 'success');
    closeDeleteModal();
    loadProducts();

  } catch (error) {
    console.error('Delete product error:', error);
    showToast('Failed to delete product.', 'error');
  }
}

// ===== MODAL CONTROLS =====
function closeProductModal() {
  document.getElementById('product-modal').style.display = 'none';
}

function openDeleteModal(productId, productName) {
  const modal = document.getElementById('delete-modal');
  document.getElementById('delete-product-name').textContent = productName;
  document.getElementById('delete-confirm-btn').dataset.id = productId;
  modal.style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function() {
  const addBtn = document.getElementById('add-product-btn');
  if (addBtn) {
    addBtn.addEventListener('click', openAddProductModal);
  }

  const productForm = document.getElementById('product-form');
  if (productForm) {
    productForm.addEventListener('submit', saveProduct);
  }

  const modalClose = document.getElementById('modal-close');
  if (modalClose) {
    modalClose.addEventListener('click', closeProductModal);
  }

  const modalCancel = document.getElementById('modal-cancel-btn');
  if (modalCancel) {
    modalCancel.addEventListener('click', closeProductModal);
  }

  const productModal = document.getElementById('product-modal');
  if (productModal) {
    productModal.addEventListener('click', function(e) {
      if (e.target === this) closeProductModal();
    });
  }

  const deleteCancel = document.getElementById('delete-cancel-btn');
  if (deleteCancel) {
    deleteCancel.addEventListener('click', closeDeleteModal);
  }

  const deleteConfirm = document.getElementById('delete-confirm-btn');
  if (deleteConfirm) {
    deleteConfirm.addEventListener('click', function() {
      const productId = this.dataset.id;
      if (productId) deleteProduct(productId);
    });
  }

  const deleteModal = document.getElementById('delete-modal');
  if (deleteModal) {
    deleteModal.addEventListener('click', function(e) {
      if (e.target === this) closeDeleteModal();
    });
  }

  const imageInput = document.getElementById('product-image');
  if (imageInput) {
    imageInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        if (this.files[0].size > 2 * 1024 * 1024) {
          showToast('Image is too large. Maximum 2MB allowed.', 'warning');
          this.value = '';
          return;
        }
        previewImage(this.files[0]);
      }
    });
  }

  const removeImageBtn = document.getElementById('remove-image-btn');
  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', removeImage);
  }

  // ===== EXCHANGE RATE: Load rate on page load =====
  fetchExchangeRate();

// ===== EXCHANGE RATE: Update rate handler (SYNC TO SUPABASE) =====
const updateRateBtn = document.getElementById('update-rate-btn');
if (updateRateBtn) {
  updateRateBtn.addEventListener('click', async function() {
    const input = document.getElementById('exchange-rate');
    const newRate = parseInt(input.value);
    if (newRate && newRate > 0) {
      try {
        // ✅ Direct fetch with admin API key header
        const response = await fetch('https://iirctokpamybsmgzstnj.supabase.co/functions/v1/rates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': 'ayempire_admin_2026_secure_key_12345'
          },
          body: JSON.stringify({ zar_rate: newRate }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to sync rate');
        }

        // Update local storage after successful sync
        localStorage.setItem('exchange_rate_zar', newRate.toString());
        currentExchangeRate = newRate;
        updateRateDisplay();
        updateRateDisplayInForm();
        
        showToast('Exchange rate updated and synced across all devices!', 'success');
      } catch (error) {
        console.error('Rate sync error:', error);
        showToast('Failed to sync rate. Please try again.', 'error');
      }
    } else {
      showToast('Please enter a valid exchange rate.', 'warning');
    }
  });
}

loadProducts();
});