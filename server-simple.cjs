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

// Main tracking endpoint
app.post('/api/track', async (req, res) => {
  const { event, user } = req.body;
  
  // Get real IP
  user.ip_address = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
  
  console.log(`\n📨 Event: ${event.event_name} | ID: ${event.event_id} | Value: ₱${event.value}`);

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

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log('\n📊 Tracking Status:');
  console.log(`   GA4: ${process.env.VITE_GA_MEASUREMENT_ID ? '✅' : '❌ Set VITE_GA_MEASUREMENT_ID & VITE_GA_API_SECRET'}`);
  console.log(`   Meta: ${process.env.VITE_META_PIXEL_ID ? '✅' : '❌ Set VITE_META_PIXEL_ID & VITE_META_ACCESS_TOKEN'}`);
  console.log(`   TikTok: ${process.env.VITE_TIKTOK_PIXEL_ID ? '✅' : '❌ Set VITE_TIKTOK_PIXEL_ID & VITE_TIKTOK_ACCESS_TOKEN'}`);
});