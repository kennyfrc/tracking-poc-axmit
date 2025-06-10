# Unified Ad-Event Tracking POC (Philippines Market)

This is a proof of concept implementation for unified tracking across Google Analytics 4, Meta (Facebook), and TikTok platforms. It demonstrates the recommended architecture where client-side pixels handle pageviews only, while ALL conversion events are tracked server-side for maximum reliability.

## Why Server-Side Tracking?

- **Client-side tracking is unreliable** - Ad blockers and browser restrictions block 20-40% of conversion events
- **Better data quality** - Server-side tracking captures 100% of conversions
- **Platform requirements** - Meta, TikTok, and Google now recommend server-side APIs
- **Privacy compliance** - Server-side allows proper PII hashing before sending

## Features Implemented

- ✅ **TypeScript with strict typing** for all tracking events
- ✅ **Client-side base pixels** for pageview tracking only
- ✅ **Server-side conversion tracking** via Express.js API
- ✅ **Google Analytics 4** Measurement Protocol integration
- ✅ **Meta Conversions API** integration  
- ✅ **TikTok Events API** integration
- ✅ **Event deduplication** with unique event_id
- ✅ **PII hashing** (SHA256 for emails/phones)
- ✅ **React hooks** for easy integration
- ✅ **E-commerce event tracking** (add to cart, checkout, purchase)
- ✅ **Comprehensive test suite** with 40 passing tests

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and add your tracking IDs:
```bash
cp .env.example .env
```

3. Run both the tracking server and React app:
```bash
# Run both server (port 3001) and client (port 5173)
npm run dev:all

# Or run them separately:
npm run server  # Start Express server on port 3001
npm run dev     # Start Vite dev server on port 5173
```

4. Run tests:
```bash
npm test
```

## Architecture

```text
React App (Client-Side)
 ├─ Google Tag base pixel         – pageviews only
 ├─ Meta Pixel base pixel         – pageviews only  
 └─ TikTok Pixel base pixel       – pageviews only
     ↓
     ↓ add_to_cart events (optional)
     ↓
Node.js/Express Server
 ├─ /api/track                    – ONLY handles: page_view, add_to_cart
 ├─ /api/checkout                 – YOUR checkout route → tracks begin_checkout
 ├─ /api/purchase/complete        – YOUR purchase route → tracks purchase
 │
 └─ All routes send to:
     ├─ GA4 Measurement Protocol (with SHA256 hashing)
     ├─ Meta Conversions API (with SHA256 hashing)
     └─ TikTok Events API (with SHA256 hashing)
```

### Client-Side Files (React)
```
src/
├── types/tracking.ts           # TypeScript types for all tracking events
├── lib/
│   ├── gtag.ts                # Google Analytics 4 base pixel
│   ├── meta-pixel.ts          # Meta/Facebook base pixel  
│   ├── tiktok-pixel.ts        # TikTok base pixel
│   └── tracking-service.ts    # Sends ALL events to server
├── hooks/
│   └── useTracking.ts         # React hooks for tracking
├── components/
│   └── DemoEcommerce.tsx      # E-commerce demo
└── App.tsx                    # Main app with routing
```

### Server-Side (Node.js/Express)
```
server.cjs                       # Express server that:
├── /api/track                   # Handles page_view and add_to_cart only
├── /api/checkout                # Example checkout route (tracks begin_checkout)
├── /api/purchase/complete       # Example purchase route (tracks purchase)
└── All routes:
    ├── Hash PII with SHA256
    ├── Send to GA4 Measurement Protocol
    ├── Send to Meta Conversions API
    └── Send to TikTok Events API
```

## How It Works

### Real-World Implementation Pattern

1. **Client-side (React/Vue/etc)**:
   - Initialize base pixels for pageview tracking
   - Send `add_to_cart` events to `/api/track` when users add items

2. **Server-side (Your existing routes)**:
   - **`/api/track`**: ONLY accepts `page_view` and `add_to_cart` events
   - **Checkout route** (`/api/checkout`): Your business logic + track `begin_checkout`
   - **Purchase route** (`/api/purchase/complete`): Your business logic + track `purchase`

3. **Important restriction**:
   - The `/api/track` endpoint will reject `begin_checkout` and `purchase` events
   - These MUST be tracked from your actual checkout/purchase routes
   - This ensures tracking happens where the business logic occurs

## Usage Examples

### Frontend (Optional - for add_to_cart)
```tsx
import { useTrackingContext } from './hooks/useTracking';

function ProductPage() {
  const { trackAddToCart } = useTrackingContext();

  const handleAddToCart = async (product) => {
    // Add to cart logic...
    await addToCart(product);
    
    // Track the event
    await trackAddToCart(
      [product],
      'PHP',
      product.price
    );
  };
}
```

### Backend (Required - for checkout/purchase)
```javascript
// Your existing checkout route
app.post('/api/checkout', async (req, res) => {
  const { items, user } = req.body;
  
  // Your checkout logic...
  const session = await createCheckoutSession(items);
  
  // Track checkout event
  const event = {
    event_name: 'begin_checkout',
    event_id: crypto.randomBytes(16).toString('hex'),
    currency: 'PHP',
    value: calculateTotal(items),
    items: items
  };
  
  await trackServerEvent(event, user, req);
  
  res.json({ sessionId: session.id });
});

// Your existing purchase completion route
app.post('/api/purchase/complete', async (req, res) => {
  const { orderId, paymentInfo } = req.body;
  
  // Verify payment and complete order...
  const order = await completeOrder(orderId, paymentInfo);
  
  // Track purchase event  
  const event = {
    event_name: 'purchase',
    event_id: crypto.randomBytes(16).toString('hex'),
    transaction_id: orderId,
    currency: 'PHP',
    value: order.total,
    items: order.items
  };
  
  await trackServerEvent(event, order.user, req);
  
  res.json({ order });
});
```

## Event Schema

The POC implements the following e-commerce events with unified schema:

| Event | GA4 | Meta | TikTok |
|-------|-----|------|--------|
| Add to Cart | `add_to_cart` | `AddToCart` | `AddToCart` |
| Begin Checkout | `begin_checkout` | `InitiateCheckout` | `InitiateCheckout` |
| Purchase | `purchase` | `Purchase` | `Purchase` |

All events include:
- `event_id` for deduplication
- `items[]` array with product details
- `currency` and `value`
- Additional parameters as needed

## Server Configuration

Add these to your `.env` file:

```bash
# GA4 Measurement Protocol
VITE_GA_MEASUREMENT_ID=G-XXXXXXXX
VITE_GA_API_SECRET=your-api-secret

# Meta Conversions API
VITE_META_PIXEL_ID=1234567890
VITE_META_ACCESS_TOKEN=your-access-token

# TikTok Events API
VITE_TIKTOK_PIXEL_ID=XXXXXXXX
VITE_TIKTOK_ACCESS_TOKEN=your-access-token
```

## Testing

The POC includes comprehensive tests covering:
- Type safety and validation
- Service initialization
- Consent management
- Event tracking
- Event deduplication
- React hooks integration

Run tests with:
```bash
npm test
```

## Production Deployment

### Current Status with Test Credentials:
- **GA4**: ✅ Working (accepts test events)
- **Meta**: ❌ Needs real access token
- **TikTok**: ❌ Needs real access token

### Next Steps:

1. **Get Production Credentials**:
   - GA4: Create API secret in Google Analytics
   - Meta: Generate System User Token in Events Manager
   - TikTok: Generate Access Token in TikTok Ads Manager

2. **Deploy Server**:
   - Deploy `server.cjs` to your Node.js hosting
   - Ensure environment variables are set
   - Use HTTPS for production

3. **Update Client**:
   - Point tracking service to your production server
   - Deploy React app with production pixel IDs

4. **Monitor & Validate**:
   - Use platform debug tools (GA4 DebugView, Meta Test Events, TikTok Event Debugging)
   - Monitor server logs for errors
   - Validate events are being received correctly

## Common Mistakes to Avoid

1. **DON'T fire conversion events client-side** - They will be blocked
2. **DON'T send unhashed PII** - Always SHA256 hash emails/phones
3. **DON'T forget event_id** - Critical for preventing duplicate conversions
4. **DON'T hardcode credentials** - Use environment variables
5. **DON'T skip error handling** - Log failures for debugging

## References

- [GA4 Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4)
- [Meta Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [TikTok Events API](https://ads.tiktok.com/marketing_api/docs?id=1741601162187777)
- See `plan.md` for detailed implementation guide
