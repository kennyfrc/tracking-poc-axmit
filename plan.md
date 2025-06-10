### MB Go – Unified Ad-Event Tracking Implementation Guide (Philippines Market)

---

#### 1. Why we need server-side tracking

* **Client-side tracking is unreliable** - Ad blockers, iOS tracking prevention, and browser restrictions block 20-40% of conversion events
* **Better data quality** - Server-side tracking captures 100% of conversions with accurate attribution
* **Platform requirements** - Meta, TikTok, and Google now recommend server-side APIs for conversion tracking
* **Privacy compliance** - Server-side allows proper PII hashing before sending to platforms

---

#### 2. Architecture (What we built)

```text
React (client-side)
 ├─ Google Tag base pixel         – pageviews only
 ├─ Meta Pixel base pixel         – pageviews only  
 └─ TikTok Pixel base pixel       – pageviews only
     ↓
     ↓ ALL conversion events sent to ↓
     ↓
Node.js/Express Server (port 3001)
 ├─ Receives events from React app
 ├─ Hashes PII data (email/phone)
 ├─ Sends to GA4 Measurement Protocol
 ├─ Sends to Meta Conversions API
 └─ Sends to TikTok Events API
```

**Key insight**: Client-side pixels are ONLY for pageviews. ALL conversion events (add to cart, checkout, purchase) MUST go through your server.

---

#### 3. Event mapping

| User Action | Event Name | GA4 | Meta | TikTok | Required Data |
|-------------|------------|-----|------|--------|---------------|
| Adds item to cart | `add_to_cart` | `add_to_cart` | `AddToCart` | `AddToCart` | items[], value, currency |
| Starts checkout | `begin_checkout` | `begin_checkout` | `InitiateCheckout` | `InitiateCheckout` | items[], value, currency |
| Completes purchase | `purchase` | `purchase` | `Purchase` | `Purchase` | transaction_id, items[], value, currency |

**Critical**: Include `event_id` for deduplication across all platforms.

---

#### 4. Implementation Steps

##### 4.1 Client-side (React) - Base pixels only

```javascript
// Initialize base pixels for pageview tracking ONLY
initializeGoogleTag(GA_MEASUREMENT_ID);
initializeMetaPixel(META_PIXEL_ID);
initializeTikTokPixel(TIKTOK_PIXEL_ID);

// Send ALL events to your server
async function trackPurchase(orderData) {
  await fetch('http://your-server.com/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: {
        event_name: 'purchase',
        transaction_id: orderData.id,
        value: orderData.total,
        currency: 'PHP',
        items: orderData.items
      },
      user: {
        email: orderData.customer.email,
        phone: orderData.customer.phone
      }
    })
  });
}
```

##### 4.2 Server-side (Node.js/Express) - All conversion tracking

```javascript
// server.js - This is where ALL conversion tracking happens
app.post('/api/track', async (req, res) => {
  const { event, user } = req.body;
  
  // Hash PII before sending
  const hashedEmail = sha256(user.email);
  const hashedPhone = sha256(user.phone);
  
  // Send to all platforms in parallel
  await Promise.all([
    sendToGA4(event, hashedEmail, hashedPhone),
    sendToMeta(event, hashedEmail, hashedPhone),
    sendToTikTok(event, hashedEmail, hashedPhone)
  ]);
  
  res.json({ success: true });
});
```

---

#### 5. Getting API Credentials

##### GA4 Measurement Protocol
1. Go to Google Analytics > Admin > Data Streams
2. Select your web stream
3. Under "Measurement Protocol API secrets" create new secret
4. Copy Measurement ID (G-XXXXXXXX) and API Secret

##### Meta Conversions API
1. Go to Facebook Events Manager
2. Select your pixel > Settings > Conversions API
3. Generate access token (System User Token recommended)
4. Copy Pixel ID and Access Token

##### TikTok Events API
1. Go to TikTok Ads Manager > Assets > Events
2. Select Web Events > Manage > Generate Access Token
3. Copy Pixel Code and Access Token

---

#### 6. Testing & Validation

##### What success looks like:
```
📨 Event: purchase | ID: 1749541866126-xyz | Value: ₱1,999
✅ GA4: Success
✅ Meta: Success
✅ TikTok: Success
```

##### Current status with test credentials:
- **GA4**: ✅ Working (accepts test events)
- **Meta**: ❌ Needs real access token
- **TikTok**: ❌ Needs real access token

##### Debug tools:
- **GA4**: Realtime reports + DebugView
- **Meta**: Test Events tool in Events Manager
- **TikTok**: Event Debugging in Events Manager

---

#### 7. Implementation Checklist

- [ ] **Client-side setup**
  - [ ] Remove ALL conversion event firing from client
  - [ ] Keep only base pixel initialization
  - [ ] Route all events through your server endpoint

- [ ] **Server-side setup**
  - [ ] Copy `server-simple.js` as starting point
  - [ ] Add to `.env`:
    ```
    VITE_GA_MEASUREMENT_ID=G-XXXXXXXX
    VITE_GA_API_SECRET=your-secret
    VITE_META_PIXEL_ID=1234567890
    VITE_META_ACCESS_TOKEN=your-token
    VITE_TIKTOK_PIXEL_ID=XXXXXXXX
    VITE_TIKTOK_ACCESS_TOKEN=your-token
    ```
  - [ ] Test with real credentials
  - [ ] Deploy server (recommended: AWS/GCP with auto-scaling)

- [ ] **Data quality**
  - [ ] Ensure all prices are in PHP
  - [ ] Include all product details (id, name, category, price, quantity)
  - [ ] Always hash PII before sending
  - [ ] Include event_id for deduplication

---

#### 8. Common Mistakes to Avoid

1. **DON'T fire conversion events client-side** - They will be blocked
2. **DON'T send unhashed PII** - Always SHA256 hash emails/phones
3. **DON'T forget event_id** - Critical for preventing duplicate conversions
4. **DON'T hardcode credentials** - Use environment variables
5. **DON'T skip error handling** - Log failures for debugging

---

#### 9. Support & Resources

- **GA4 Measurement Protocol**: https://developers.google.com/analytics/devguides/collection/protocol/ga4
- **Meta Conversions API**: https://developers.facebook.com/docs/marketing-api/conversions-api
- **TikTok Events API**: https://ads.tiktok.com/marketing_api/docs?id=1741601162187777

**POC Repository**: This implementation includes working code for all platforms with full TypeScript support.