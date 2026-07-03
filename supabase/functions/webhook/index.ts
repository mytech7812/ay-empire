// supabase/functions/webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

// ===== VERIFY PAYSTACK SIGNATURE =====
async function verifySignature(body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = encoder.encode(paystackSecret);
  const data = encoder.encode(body);
  
  const hashBuffer = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    ),
    data
  );
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex === signature;
}

// ===== VERIFY TRANSACTION WITH PAYSTACK =====
async function verifyTransaction(reference: string): Promise<boolean> {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { 'Authorization': `Bearer ${paystackSecret}` },
  });
  const data = await response.json();
  return data.status && data.data.status === 'success';
}

// ===== SEND CONFIRMATION EMAIL =====
async function sendConfirmationEmail(order: any) {
  if (!resendApiKey) {
    console.log('Resend API key not configured. Skipping email.');
    return;
  }

  // Get the currency the customer used
  const currency = order.currency_used || 'NGN';
  const exchangeRate = order.exchange_rate_used || 1400;

  // Format price based on currency with proper conversion
  function formatPrice(amountNgn: number, cur: string) {
    let displayAmount = amountNgn;
    
    if (cur === 'ZAR') {
      displayAmount = Math.round(amountNgn / exchangeRate);
    } else if (cur === 'USD') {
      displayAmount = Math.round(amountNgn / exchangeRate);
    }
    
    const symbol = cur === 'ZAR' ? 'R' : cur === 'USD' ? '$' : '₦';
    return `${symbol} ${displayAmount.toLocaleString()}`;
  }

  // Build items HTML with converted prices
  const itemsHtml = order.items.map((item: any) => {
    const itemTotal = item.price * item.quantity;
    return `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatPrice(itemTotal, currency)}</td>
      </tr>
    `;
  }).join('');

  // Calculate display totals (converted to customer's currency)
  const displaySubtotal = formatPrice(order.subtotal, currency);
  const displayShipping = formatPrice(order.shipping || 0, currency);
  const displayTotal = formatPrice(order.total, currency);

  const deliveryMethod = order.delivery_method || 'pickup';
  const deliveryPartner = order.delivery_partner || 'Pickup';
  const currencySymbol = currency === 'ZAR' ? 'R' : currency === 'USD' ? '$' : '₦';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AY Empire <orders@ayempire.com>',
        to: order.customer_email,
        subject: `Order Confirmation #${order.order_number}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; border-bottom: 2px solid #C9A84C; padding-bottom: 20px; }
              .header h1 { color: #4A2E1A; font-family: Georgia, serif; }
              .header span { color: #C9A84C; }
              .order-details { margin: 20px 0; }
              .order-details table { width: 100%; border-collapse: collapse; }
              .order-details th { background: #F5EDE0; text-align: left; padding: 8px; }
              .order-details td { padding: 8px; border-bottom: 1px solid #eee; }
              .totals { text-align: right; margin-top: 20px; padding-top: 20px; border-top: 2px solid #C9A84C; }
              .totals .total { font-size: 1.2em; font-weight: bold; color: #4A2E1A; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.9em; color: #888; }
              .currency-badge { display: inline-block; background: #F5EDE0; padding: 2px 10px; border-radius: 4px; font-size: 0.8em; margin-left: 8px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>AY <span>Empire</span></h1>
              <p>South African Kayamata Palace</p>
            </div>

            <h2>Thank you for your order!</h2>
            <p>Hi ${order.customer_name},</p>
            <p>Your order <strong>#${order.order_number}</strong> has been confirmed and is being processed.</p>
            <p><span class="currency-badge">💰 ${currencySymbol} ${currency}</span></p>

            <div class="order-details">
              <h3>Order Summary</h3>
              <table>
                <tr>
                  <th>Product</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Price</th>
                </tr>
                ${itemsHtml}
              </table>

              <div class="totals">
                <p><strong>Subtotal:</strong> ${displaySubtotal}</p>
                <p><strong>Delivery:</strong> ${deliveryMethod === 'pickup' ? 'Pickup (Free)' : `${deliveryPartner} - ${displayShipping}`}</p>
                <p class="total"><strong>Total:</strong> ${displayTotal}</p>
                ${currency !== 'NGN' ? `<p style="font-size: 0.8em; color: #888; border-top: 1px solid #eee; padding-top: 8px; margin-top: 8px;">* Charged in NGN at checkout. Your bank converted at their rate.</p>` : ''}
              </div>
            </div>

            <div style="margin: 20px 0; padding: 15px; background: #F5EDE0; border-radius: 6px;">
              <p><strong>Delivery Information</strong></p>
              <p>${order.customer_address}<br>
              ${order.customer_city}, ${order.customer_state}<br>
              ${order.customer_country}</p>
              <p><strong>Method:</strong> ${deliveryMethod === 'pickup' ? 'Pickup' : `Shipping via ${deliveryPartner}`}</p>
            </div>

            <p>We'll notify you when your order is ready for pickup or shipping.</p>
            <p>Thank you for choosing AY Empire!</p>

            <div class="footer">
              <p>AY Empire — South African Kayamata Palace</p>
              <p><a href="mailto:info@ayempire.com">info@ayempire.com</a> | <a href="https://ayempire.com">ayempire.com</a></p>
            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend error:', error);
    } else {
      console.log('Confirmation email sent to:', order.customer_email);
    }
  } catch (error) {
    console.error('Email error:', error);
  }
}

// ===== SEND ADMIN ORDER NOTIFICATION =====
async function sendAdminNotification(order: any) {
  if (!resendApiKey) {
    console.log('Resend API key not configured. Skipping admin notification.');
    return;
  }

  const itemsHtml = order.items.map((item: any) => `
    <tr>
      <td style="padding: 6px 10px; border: 1px solid #ddd;">${item.name}</td>
      <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
      <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">₦${(item.price * item.quantity).toLocaleString()}</td>
    </tr>
  `).join('');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AY Empire Orders <orders@ayempire.com>',
        to: 'Davinasleek1@gmail.com',
        subject: `🛒 New Order #${order.order_number}`,
        html: `
          <h2>You've Just Received an Order!</h2>
          
          <p><strong>Order #:</strong> ${order.order_number}</p>
          <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
          
          <h3>Customer Details</h3>
          <p>
            <strong>Name:</strong> ${order.customer_name}<br>
            <strong>Email:</strong> ${order.customer_email}<br>
            <strong>Phone:</strong> ${order.customer_phone || 'N/A'}<br>
            <strong>Address:</strong> ${order.customer_address}<br>
            ${order.customer_city ? `<strong>City:</strong> ${order.customer_city}<br>` : ''}
            ${order.customer_state ? `<strong>State:</strong> ${order.customer_state}<br>` : ''}
            ${order.customer_country ? `<strong>Country:</strong> ${order.customer_country}<br>` : ''}
            ${order.customer_zip ? `<strong>Postal Code:</strong> ${order.customer_zip}<br>` : ''}
          </p>

          <h3>Order Summary</h3>
          <table style="width:100%; border-collapse: collapse; margin-bottom: 10px;">
            <tr style="background: #F5EDE0;">
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: left;">Product</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">Qty</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">Price</th>
            </tr>
            ${itemsHtml}
          </table>

          <p style="text-align: right; font-size: 1.1em;">
            <strong>Total:</strong> ₦${order.total.toLocaleString()}
          </p>

          <p style="margin-top: 20px; color: #888; font-size: 0.9em;">
            Delivery Method: ${order.delivery_method || 'pickup'}<br>
            Delivery Partner: ${order.delivery_partner || 'N/A'}
          </p>

          <p style="margin-top: 20px;">
            <a href="https://ayempire.com/admin/orders" style="background: #C9A84C; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
              View in Admin
            </a>
          </p>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Admin notification error:', error);
    } else {
      console.log('Admin notification sent for order:', order.order_number);
    }
  } catch (error) {
    console.error('Admin notification error:', error);
  }
}

// ===== MAIN WEBHOOK HANDLER =====
Deno.serve(async (req) => {
  try {
    const signature = req.headers.get('x-paystack-signature');
    const body = await req.text();

    if (!signature) {
      console.error('Missing signature header');
      return new Response('Missing signature', { status: 401 });
    }

    const isValid = await verifySignature(body, signature);
    if (!isValid) {
      console.error('Invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event === 'charge.success') {
      const transaction = event.data;
      const reference = transaction.reference;

      console.log('Processing charge.success for reference:', reference);

      // ===== IDEMPOTENCY CHECK =====
      const { data: existing } = await supabase
        .from('orders')
        .select('status')
        .eq('transaction_reference', reference)
        .single();

      if (existing && existing.status === 'paid') {
        console.log(`Order ${reference} already processed. Ignoring duplicate.`);
        return new Response('Already processed', { status: 200 });
      }

      // ===== VERIFY TRANSACTION =====
      const verified = await verifyTransaction(reference);
      if (!verified) {
        console.error('Transaction verification failed:', reference);
        return new Response('Transaction verification failed', { status: 400 });
      }

      // ===== UPDATE ORDER =====
      const { data: order, error } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('transaction_reference', reference)
        .select()
        .single();

      if (error) {
        console.error('Order update error:', error);
        return new Response('Failed to update order', { status: 500 });
      }

      if (order) {
        console.log(`Order ${reference} updated to paid`);
        // ===== SEND EMAIL =====
        await sendConfirmationEmail(order);
        console.log(`Email sent for order ${reference}`);

         // Send admin notification
        await sendAdminNotification(order);
        console.log(`Admin notification sent for order ${reference}`);
      }
      
      

      return new Response('Webhook processed successfully', { status: 200 });
    }

    return new Response('Event ignored', { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});