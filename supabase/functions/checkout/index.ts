// supabase/functions/checkout/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Generate unique order number
function generateOrderNumber(): string {
  const prefix = 'AYE';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${timestamp}${random}`;
}

// Rate limit check
async function checkRateLimit(ip: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('rate_limits')
    .select('request_count')
    .eq('ip_address', ip)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Rate limit error:', error);
    return false;
  }

  if (!data) {
    await supabase.from('rate_limits').insert({
      ip_address: ip,
      request_count: 1,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    return true;
  }

  if (data.request_count >= 5) {
    return false;
  }

  await supabase
    .from('rate_limits')
    .update({ request_count: data.request_count + 1 })
    .eq('ip_address', ip);
  
  return true;
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET request for debugging
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        message: 'Checkout endpoint is working. Use POST to create an order.',
        status: 'ready',
        paystack_key_configured: !!Deno.env.get('PAYSTACK_SECRET_KEY')
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    
    // Rate limiting
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { customer, items, currency } = body;

    console.log('Items received from frontend:', JSON.stringify(items));

    // Validate required fields
    const required = ['fullName', 'email', 'phone', 'address', 'city', 'state', 'country'];
    for (const field of required) {
      if (!customer[field]) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ===== LOOK UP PRODUCTS BY BOTH ID AND SLUG =====
    const productIds = items.map((item: any) => item.id);
    const slugs = items.map((item: any) => item.slug || item.id);

    // Query by both UUID and slug
    const { data: products, error } = await supabase
      .from('products')
      .select('id, slug, name, price')
      .or(`id.in.(${productIds.join(',')}),slug.in.(${slugs.map((s: string) => `'${s}'`).join(',')})`);

    if (error) {
      console.error('Product lookup error:', error);
      throw new Error('Failed to fetch products');
    }

    // Build price map keyed by both UUID and slug
    const priceMap: Record<string, number> = {};
    const productMap: Record<string, any> = {};
    products?.forEach((p: any) => {
      priceMap[p.id] = p.price;
      if (p.slug) {
        priceMap[p.slug] = p.price;
      }
      productMap[p.id] = p;
      if (p.slug) {
        productMap[p.slug] = p;
      }
    });

    // ===== CALCULATE TOTAL WITH VALIDATION =====
    let subtotal = 0;
    const orderItems = [];
    const invalidItems = [];

    for (const item of items) {
      const product = productMap[item.id] || productMap[item.slug];
      
      if (!product) {
        invalidItems.push(item.id || item.slug);
        continue;
      }
      
      const realPrice = product.price || 0;
      const quantity = parseInt(item.quantity) || 1;
      subtotal += realPrice * quantity;
      
      orderItems.push({
        id: product.id,
        slug: product.slug,
        name: product.name,
        quantity: quantity,
        price: realPrice,
        total: realPrice * quantity,
      });
    }

    // ✅ Reject invalid items
    if (invalidItems.length > 0) {
      console.error('Invalid products in cart:', invalidItems);
      return new Response(
        JSON.stringify({ 
          error: 'Some products in your cart are no longer available',
          invalid_items: invalidItems 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (orderItems.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Your cart is empty or contains invalid items.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== SERVER-SIDE EXCHANGE RATE =====
    const { data: rateData, error: rateError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'exchange_rate_zar')
      .single();

    const serverRate = rateData ? parseInt(rateData.value) : 84;

    // ===== SERVER-SIDE SHIPPING CALCULATION =====
    let shippingNgn = 0;
    const country = customer.country || '';

    if (body.deliveryMethod === 'shipping') {
      if (country === 'South Africa') {
        shippingNgn = 100 * serverRate;
      } else if (country === 'Nigeria') {
        shippingNgn = 0;
      } else if (['USA', 'Canada', 'Mexico'].includes(country)) {
        shippingNgn = 2500 * serverRate;
      } else if (['UK', 'United Arab Emirates'].includes(country)) {
        shippingNgn = 2200 * serverRate;
      } else if (country && country !== '') {
        shippingNgn = 1200 * serverRate;
      }
    }

    // ===== CREATE ORDER =====
    const totalNgn = subtotal + shippingNgn;
    const totalZar = Math.round(totalNgn / serverRate);
    const orderNumber = generateOrderNumber();
    const currencyUsed = currency || 'NGN';

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_name: customer.fullName,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: customer.address,
        customer_city: customer.city,
        customer_state: customer.state,
        customer_country: customer.country,
        customer_zip: customer.zip || '', 
        notes: customer.notes || '',
        items: orderItems,
        subtotal: subtotal,
        shipping: shippingNgn,
        total: totalNgn,
        total_zar: totalZar,
        exchange_rate_used: serverRate,
        currency_used: currencyUsed,
        delivery_method: body.deliveryMethod || 'pickup',
        delivery_partner: body.deliveryPartner || 'Pickup',
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      throw new Error('Failed to create order');
    }

    // ===== INITIALIZE PAYSTACK =====
    const siteUrl = (Deno.env.get('SITE_URL') || 'https://ayempire.com').replace(/\/$/, '');
    console.log('Payment callback URL:', siteUrl);
    console.log('Amount being sent to Paystack (in kobo):', totalNgn * 100);

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: customer.email,
        amount: totalNgn * 100, // Convert to kobo
        reference: orderNumber,
        callback_url: `${siteUrl}/success?reference=${orderNumber}`,
        metadata: {
          order_id: order.id,
          order_number: orderNumber,
          customer_name: customer.fullName,
        },
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error('Paystack error:', paystackData);
      throw new Error('Failed to initialize payment');
    }

    // Update order with transaction reference
    await supabase
      .from('orders')
      .update({ transaction_reference: paystackData.data.reference })
      .eq('id', order.id);

    // Return payment URL to browser
    return new Response(
      JSON.stringify({
        success: true,
        orderNumber: orderNumber,
        authorization_url: paystackData.data.authorization_url,
        reference: paystackData.data.reference,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: 'Payment could not be initialized. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});