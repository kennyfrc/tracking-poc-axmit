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

// Helper function to hash PII data using SHA256
function hashPII(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

// GA4 Measurement Protocol
async function sendToGA4(event, userData) {
  const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
  const measurementId = process.env.VITE_GA_MEASUREMENT_ID;
  const apiSecret = process.env.VITE_GA_API_SECRET;

  if (!measurementId || !apiSecret) {
    console.log('⚠️  GA4: Missing measurement_id or api_secret');
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

  const url = `${GA4_ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`;

  try {
    console.log('📊 Sending to GA4:', { url, payload });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // GA4 returns 204 No Content on success
    if (response.status === 204) {
      console.log('✅ GA4: Event sent successfully');
      return { success: true };
    } else {
      const text = await response.text();
      console.error('❌ GA4 Error:', response.status, text);
      return { success: false, error: text };
    }
  } catch (error) {
    console.error('❌ GA4 Network Error:', error);
    return { success: false, error: error.message };
  }
}

// Meta Conversions API
async function sendToMeta(event, userData) {
  const META_ENDPOINT = 'https://graph.facebook.com/v18.0';
  const pixelId = process.env.VITE_META_PIXEL_ID;
  const accessToken = process.env.VITE_META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.log('⚠️  Meta: Missing pixel_id or access_token');
    return { success: false, error: 'Missing Meta credentials' };
  }

  // Map event names
  const eventNameMap = {
    'add_to_cart': 'AddToCart',
    'begin_checkout': 'InitiateCheckout',
    'purchase': 'Purchase'
  };

  const payload = {
    data: [{
      event_name: eventNameMap[event.event_name] || event.event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: event.event_id,
      event_source_url: 'https://example.com', // Your website URL
      action_source: 'website',
      user_data: {
        em: hashPII(userData.email),
        ph: hashPII(userData.phone),
        client_ip_address: userData.ip_address || '127.0.0.1',
        client_user_agent: userData.user_agent || 'Mozilla/5.0',
        fbc: userData.fbc, // Facebook click ID
        fbp: userData.fbp  // Facebook browser ID
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
    }],
    test_event_code: process.env.META_TEST_EVENT_CODE // Optional: for testing
  };

  const url = `${META_ENDPOINT}/${pixelId}/events?access_token=${accessToken}`;

  try {
    console.log('📘 Sending to Meta:', { url: url.split('?')[0], payload });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Meta: Event sent successfully', result);
      return { success: true, result };
    } else {
      console.error('❌ Meta Error:', result);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ Meta Network Error:', error);
    return { success: false, error: error.message };
  }
}

// TikTok Events API
async function sendToTikTok(event, userData) {
  const TIKTOK_ENDPOINT = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
  const pixelCode = process.env.VITE_TIKTOK_PIXEL_ID;
  const accessToken = process.env.VITE_TIKTOK_ACCESS_TOKEN;

  if (!pixelCode || !accessToken) {
    console.log('⚠️  TikTok: Missing pixel_code or access_token');
    return { success: false, error: 'Missing TikTok credentials' };
  }

  // Map event names
  const eventNameMap = {
    'add_to_cart': 'AddToCart',
    'begin_checkout': 'InitiateCheckout',
    'purchase': 'Purchase'
  };

  const payload = {
    pixel_code: pixelCode,
    event: eventNameMap[event.event_name] || event.event_name,
    event_id: event.event_id,
    timestamp: new Date().toISOString(),
    context: {
      user_agent: userData.user_agent || 'Mozilla/5.0',
      ip: userData.ip_address || '127.0.0.1',
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

  // Add user data if available
  if (userData.email || userData.phone) {
    payload.context.user = {
      email: hashPII(userData.email),
      phone_number: hashPII(userData.phone),
      external_id: userData.user_id
    };
  }

  try {
    console.log('🎵 Sending to TikTok:', { endpoint: TIKTOK_ENDPOINT, payload });
    
    const response = await fetch(TIKTOK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok && result.code === 0) {
      console.log('✅ TikTok: Event sent successfully', result);
      return { success: true, result };
    } else {
      console.error('❌ TikTok Error:', result);
      return { success: false, error: result.message };
    }
  } catch (error) {
    console.error('❌ TikTok Network Error:', error);
    return { success: false, error: error.message };
  }
}

// Main tracking endpoint
app.post('/api/track', async (req, res) => {
  const { event, user, consent } = req.body;
  
  // Get real IP address from request
  const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
  user.ip_address = ipAddress;
  
  console.log('\n📨 Received tracking event:', {
    event_name: event.event_name,
    event_id: event.event_id,
    value: event.value,
    items: event.items.length,
    consent: consent
  });

  // Check consent before sending to platforms
  const hasAnalyticsConsent = consent?.analytics_storage === 'granted';
  const hasAdConsent = consent?.ad_storage === 'granted';

  const results = [];

  // GA4 - only if analytics consent is granted
  if (hasAnalyticsConsent) {
    results.push(sendToGA4(event, user));
  } else {
    console.log('⏭️  Skipping GA4 - no analytics consent');
    results.push(Promise.resolve({ success: false, reason: 'No analytics consent' }));
  }

  // Meta - only if ad consent is granted
  if (hasAdConsent) {
    results.push(sendToMeta(event, user));
  } else {
    console.log('⏭️  Skipping Meta - no ad consent');
    results.push(Promise.resolve({ success: false, reason: 'No ad consent' }));
  }

  // TikTok - only if ad consent is granted
  if (hasAdConsent) {
    results.push(sendToTikTok(event, user));
  } else {
    console.log('⏭️  Skipping TikTok - no ad consent');
    results.push(Promise.resolve({ success: false, reason: 'No ad consent' }));
  }

  // Wait for all platform calls to complete
  const settledResults = await Promise.allSettled(results);

  const response = {
    ga4: settledResults[0].status === 'fulfilled' ? settledResults[0].value : { success: false, error: settledResults[0].reason },
    meta: settledResults[1].status === 'fulfilled' ? settledResults[1].value : { success: false, error: settledResults[1].reason },
    tiktok: settledResults[2].status === 'fulfilled' ? settledResults[2].value : { success: false, error: settledResults[2].reason }
  };

  console.log('\n📋 Tracking results:', response);
  
  res.json(response);
});

// Health check endpoint
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
  console.log('\n📊 Credentials status:');
  console.log(`   GA4: ${process.env.VITE_GA_MEASUREMENT_ID ? '✅' : '❌'} Measurement ID, ${process.env.VITE_GA_API_SECRET ? '✅' : '❌'} API Secret`);
  console.log(`   Meta: ${process.env.VITE_META_PIXEL_ID ? '✅' : '❌'} Pixel ID, ${process.env.VITE_META_ACCESS_TOKEN ? '✅' : '❌'} Access Token`);
  console.log(`   TikTok: ${process.env.VITE_TIKTOK_PIXEL_ID ? '✅' : '❌'} Pixel Code, ${process.env.VITE_TIKTOK_ACCESS_TOKEN ? '✅' : '❌'} Access Token`);
  console.log('\n📝 To get real credentials:');
  console.log('   GA4: https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events#api_secret');
  console.log('   Meta: https://developers.facebook.com/docs/marketing-api/conversions-api/get-started');
  console.log('   TikTok: https://ads.tiktok.com/marketing_api/docs?id=1741601162187777');
});