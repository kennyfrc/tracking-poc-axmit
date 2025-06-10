const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Helper to hash PII data
function hashPII(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

// GA4 Measurement Protocol
async function sendToGA4(event, userData) {
  const measurementId = process.env.VITE_GA_MEASUREMENT_ID;
  const apiSecret = process.env.VITE_GA_API_SECRET;

  if (!measurementId || !apiSecret) {
    console.log('⚠️  GA4: Missing credentials');
    return { success: false, error: 'Missing GA4 credentials' };
  }

  const payload = {
    client_id: userData.client_id,
    user_id: userData.user_id,
    events: [{
      name: event.event_name,
      params: {
        currency: event.currency,
        value: event.value,
        items: event.items,
        transaction_id: event.transaction_id,
        event_id: event.event_id,
        engagement_time_msec: 100
      }
    }]
  };

  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.status === 204) {
      console.log('✅ GA4: Success');
      return { success: true };
    } else {
      console.error('❌ GA4 Error:', response.status);
      return { success: false, error: `Status ${response.status}` };
    }
  } catch (error) {
    console.error('❌ GA4 Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Meta Conversions API
async function sendToMeta(event, userData) {
  const pixelId = process.env.VITE_META_PIXEL_ID;
  const accessToken = process.env.VITE_META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.log('⚠️  Meta: Missing credentials');
    return { success: false, error: 'Missing Meta credentials' };
  }

  const eventNameMap = {
    'add_to_cart': 'AddToCart',
    'begin_checkout': 'InitiateCheckout',
    'purchase': 'Purchase'
  };

  const payload = {
    data: [{
      event_name: eventNameMap[event.event_name],
      event_time: Math.floor(Date.now() / 1000),
      event_id: event.event_id,
      event_source_url: 'https://example.com',
      action_source: 'website',
      user_data: {
        em: hashPII(userData.email),
        ph: hashPII(userData.phone),
        client_ip_address: userData.ip_address,
        client_user_agent: userData.user_agent,
        fbc: userData.fbc,
        fbp: userData.fbp
      },
      custom_data: {
        currency: event.currency,
        value: event.value,
        contents: event.items.map(item => ({
          id: item.id,
          quantity: item.quantity,
          item_price: item.price
        })),
        content_type: 'product'
      }
    }]
  };

  try {
    const url = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Meta: Success', result);
      return { success: true, events_received: result.events_received };
    } else {
      console.error('❌ Meta Error:', result);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ Meta Error:', error.message);
    return { success: false, error: error.message };
  }
}

// TikTok Events API
async function sendToTikTok(event, userData) {
  const pixelCode = process.env.VITE_TIKTOK_PIXEL_ID;
  const accessToken = process.env.VITE_TIKTOK_ACCESS_TOKEN;

  if (!pixelCode || !accessToken) {
    console.log('⚠️  TikTok: Missing credentials');
    return { success: false, error: 'Missing TikTok credentials' };
  }

  const eventNameMap = {
    'add_to_cart': 'AddToCart',
    'begin_checkout': 'InitiateCheckout',
    'purchase': 'Purchase'
  };

  const payload = {
    pixel_code: pixelCode,
    event: eventNameMap[event.event_name],
    event_id: event.event_id,
    timestamp: new Date().toISOString(),
    context: {
      user_agent: userData.user_agent,
      ip: userData.ip_address,
      page: {
        url: 'https://example.com',
        referrer: ''
      }
    },
    properties: {
      currency: event.currency,
      value: event.value,
      contents: event.items.map(item => ({
        content_id: item.id,
        content_name: item.name,
        content_category: item.category,
        quantity: item.quantity,
        price: item.price
      })),
      content_type: 'product'
    }
  };

  if (userData.email || userData.phone) {
    payload.context.user = {
      email: hashPII(userData.email),
      phone_number: hashPII(userData.phone),
      external_id: userData.user_id
    };
  }

  try {
    const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok && result.code === 0) {
      console.log('✅ TikTok: Success');
      return { success: true };
    } else {
      console.error('❌ TikTok Error:', result);
      return { success: false, error: result.message };
    }
  } catch (error) {
    console.error('❌ TikTok Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Helper function to track events internally from server routes
async function trackServerEvent(event, userData, req) {
  // Get real IP and user agent from request
  const enrichedUser = {
    ...userData,
    ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1',
    user_agent: req.headers['user-agent'] || 'Unknown'
  };

  console.log(`\n📨 Server Event: ${event.event_name} | ID: ${event.event_id} | Value: ₱${event.value}`);

  // Send to all platforms
  const [ga4Result, metaResult, tiktokResult] = await Promise.allSettled([
    sendToGA4(event, enrichedUser),
    sendToMeta(event, enrichedUser),
    sendToTikTok(event, enrichedUser)
  ]);

  return {
    event_id: event.event_id,
    ga4: ga4Result.value || { success: false, error: ga4Result.reason },
    meta: metaResult.value || { success: false, error: metaResult.reason },
    tiktok: tiktokResult.value || { success: false, error: tiktokResult.reason }
  };
}

// ===== ROUTES =====

// Frontend tracking endpoint - ONLY for pageview and add_to_cart
app.post('/api/track', async (req, res) => {
  const { event, user } = req.body;
  
  // Only allow pageview and add_to_cart from frontend
  const allowedEvents = ['page_view', 'add_to_cart'];
  if (!allowedEvents.includes(event.event_name)) {
    return res.status(400).json({ 
      error: `Event '${event.event_name}' not allowed from frontend. Use server routes for checkout/purchase.` 
    });
  }
  
  // Get real IP
  user.ip_address = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
  
  console.log(`\n📨 Frontend Event: ${event.event_name} | ID: ${event.event_id} | Value: ₱${event.value || 0}`);

  // Send to all platforms in parallel
  const [ga4Result, metaResult, tiktokResult] = await Promise.allSettled([
    sendToGA4(event, user),
    sendToMeta(event, user),
    sendToTikTok(event, user)
  ]);

  const response = {
    event_id: event.event_id,
    ga4: ga4Result.value || { success: false, error: ga4Result.reason },
    meta: metaResult.value || { success: false, error: metaResult.reason },
    tiktok: tiktokResult.value || { success: false, error: tiktokResult.reason }
  };

  console.log('Results:', {
    ga4: response.ga4.success ? '✅' : '❌',
    meta: response.meta.success ? '✅' : '❌',
    tiktok: response.tiktok.success ? '✅' : '❌'
  });
  
  res.json(response);
});

// ===== EXAMPLE: Real-world e-commerce routes =====

// Example: Checkout route (begin_checkout event)
app.post('/api/checkout', async (req, res) => {
  const { items, user } = req.body;
  
  // Your checkout logic here...
  // e.g., validate items, calculate totals, create checkout session
  
  // Track the checkout event
  const event = {
    event_name: 'begin_checkout',
    event_id: crypto.randomBytes(16).toString('hex'),
    currency: 'PHP',
    value: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    items: items,
    timestamp: Date.now()
  };
  
  await trackServerEvent(event, user, req);
  
  // Return checkout session or redirect URL
  res.json({
    checkoutId: 'checkout_' + Date.now(),
    message: 'Checkout session created',
    // ... other checkout data
  });
});

// Example: Purchase completion route (purchase event)
app.post('/api/purchase/complete', async (req, res) => {
  const { orderId, paymentId, items, user } = req.body;
  
  // Your purchase completion logic here...
  // e.g., verify payment, update inventory, create order record
  
  // Track the purchase event
  const event = {
    event_name: 'purchase',
    event_id: crypto.randomBytes(16).toString('hex'),
    transaction_id: orderId,
    currency: 'PHP',
    value: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    items: items,
    timestamp: Date.now()
  };
  
  await trackServerEvent(event, user, req);
  
  // Return order confirmation
  res.json({
    orderId: orderId,
    status: 'completed',
    message: 'Thank you for your purchase!',
    // ... other order details
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    credentials: {
      ga4: !!(process.env.VITE_GA_MEASUREMENT_ID && process.env.VITE_GA_API_SECRET),
      meta: !!(process.env.VITE_META_PIXEL_ID && process.env.VITE_META_ACCESS_TOKEN),
      tiktok: !!(process.env.VITE_TIKTOK_PIXEL_ID && process.env.VITE_TIKTOK_ACCESS_TOKEN)
    }
  });
});

// ===== BEST PRACTICES =====
/**
 * 1. The /api/track endpoint ONLY handles page_view and add_to_cart events
 * 2. checkout and purchase events MUST be tracked from your actual business routes
 * 3. Always include event_id for deduplication
 * 4. Hash all PII (email, phone) before sending
 * 5. Track events where they naturally occur in your business logic
 * 6. Don't wait for tracking to complete before responding to users
 * 7. Include as much product detail as possible
 * 8. Use consistent currency codes (PHP for Philippines)
 * 9. Log tracking errors but don't let them break your checkout flow
 */

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log('\n📊 Tracking Status:');
  console.log(`   GA4: ${process.env.VITE_GA_MEASUREMENT_ID ? '✅' : '❌ Set VITE_GA_MEASUREMENT_ID & VITE_GA_API_SECRET'}`);
  console.log(`   Meta: ${process.env.VITE_META_PIXEL_ID ? '✅' : '❌ Set VITE_META_PIXEL_ID & VITE_META_ACCESS_TOKEN'}`);
  console.log(`   TikTok: ${process.env.VITE_TIKTOK_PIXEL_ID ? '✅' : '❌ Set VITE_TIKTOK_PIXEL_ID & VITE_TIKTOK_ACCESS_TOKEN'}`);
});