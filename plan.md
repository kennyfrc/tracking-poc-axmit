### MB Go – Unified Ad-Event Tracking Guide (2025 edition)

---

#### 1. Why we have to update

* **The old snippet (2021)** was a *Universal Analytics* gtag.js integration. UA stopped processing hits on **1 July 2023** and the *Global Site Tag* branding changed to **“Google Tag”**. Configuration tags were silently auto-migrated, but several pieces we rely on (UA event names, legacy “value”/“currencyCode” fields, non-deduplicated client/server calls) no longer feed reporting or smart-bidding.([support.google.com][1])
* GA4 introduced a stricter ecommerce schema (`add_to_cart`, `begin_checkout`, `purchase`) and new privacy requirements such as **Consent Mode v2** (adds `ad_user_data` and `ad_personalization`).([developers.google.com][2])
* Parallel server-side APIs—**Meta Conversions API**, **TikTok Events API**, and **GA4 Measurement Protocol**—are now the recommended way to guarantee hit delivery despite ITP/ad-blockers.

---

#### 2. Target architecture

```text
React (client)
 ├─ Google Tag (gtag.js)                – page_view + ecommerce events
 │   └─ sends to GTM Web container      – for rule-based firing, consent
 ├─ Meta Pixel                          – browser duplicate
 └─ TikTok Pixel                        – browser duplicate
Node (server, same repo)
 ├─ GA4 Measurement Protocol module     – node-google-analytics / axios
 ├─ Meta Conversions API module         – facebook-nodejs-business-sdk
 └─ TikTok Events API module            – fetch/axios POST
GTM Server container (optional)
 └─ Receives incoming POSTs → forwards to GA4, Ads, TikTok
```

This **“dual send + deduplicate”** pattern aligns with all three networks’ best practice guidance for 2025.

---

#### 3. Event map & parameters

| Business action | Google Tag / GA4 | Meta (CAPI/Pixel)  | TikTok (Pixel/API) | Required parameters\*                      |
| --------------- | ---------------- | ------------------ | ------------------ | ------------------------------------------ |
| Add to cart     | `add_to_cart`    | `AddToCart`        | `AddToCart`        | `items[], value, currency`                 |
| Checkout start  | `begin_checkout` | `InitiateCheckout` | `InitiateCheckout` | `items[], value, currency`                 |
| Purchase        | `purchase`       | `Purchase`         | `Purchase`         | `transaction_id, items[], value, currency` |

\*Pass `event_id` on both client and server calls to avoid double counting (Meta & TikTok deduplication, GA4 `x-ga-mp2-sent` autodedupe).

GA4 parameter reference([developers.google.com][3], [developers.google.com][4]); TikTok standard events list([ads.tiktok.com][5]).

---

#### 4. Client-side snippet (React)

```tsx
// src/lib/gtag.ts
export const gtag = (...args: any[]) => {
  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).dataLayer.push(arguments);
};

// in _app.tsx or index.html <head>
<script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`} />
<script
  dangerouslySetInnerHTML={{
    __html: `
      window.dataLayer=window.dataLayer||[];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('consent','default',{
        ad_storage:'denied',
        analytics_storage:'denied',
        ad_user_data:'denied',
        ad_personalization:'denied'
      });
      gtag('config','${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
    `,
  }}
/>
```

*Update consent at runtime once the user opts in* (`gtag('consent','update',…)`). ([developers.google.com][2])

---

#### 5. Server-side implementation (Node 18+)

##### 5.1 GA4 Measurement Protocol (node-google-analytics or raw fetch)

```ts
import { GA4MeasurementProtocol } from 'node-google-analytics';

const ga = new GA4MeasurementProtocol({
  apiSecret: process.env.GA_API_SECRET!,
  measurementId: process.env.GA_MEASUREMENT_ID!,
});

export async function sendPurchaseGA4(evt: PurchasePayload) {
  await ga.sendEvent({
    client_id: evt.clientId,
    events: [{
      name: 'purchase',
      params: {
        transaction_id: evt.orderId,
        currency: evt.currency,
        value: evt.value,
        items: evt.items,
      },
    }],
  });
}
```

GA4 MP endpoint spec([developers.google.com][6]); open-source NestJS example([medium.com][7]).

##### 5.2 Meta Conversions API (facebook-nodejs-business-sdk)

```ts
import bizSdk from 'facebook-nodejs-business-sdk';
const { FacebookAdsApi, ServerEvent, UserData, CustomData, EventRequest } = bizSdk;

FacebookAdsApi.init(process.env.FB_ACCESS_TOKEN);
const eventRequest = new EventRequest(process.env.FB_ACCESS_TOKEN, process.env.FB_PIXEL_ID);

export async function sendPurchaseFB(evt: PurchasePayload) {
  const userData = new UserData()
    .setEmails([evt.email])
    .setPhones([evt.phone])
    .setClientIpAddress(evt.ip)
    .setClientUserAgent(evt.ua);

  const customData = new CustomData()
    .setCurrency(evt.currency)
    .setValue(evt.value)
    .setContents(evt.items.map(i => ({ id: i.id, quantity: i.qty, item_price: i.price })));

  const serverEvent = new ServerEvent()
    .setEventName('Purchase')
    .setEventId(evt.eventId)
    .setEventTime(Math.floor(Date.now() / 1000))
    .setUserData(userData)
    .setCustomData(customData);

  await eventRequest.setEvents([serverEvent]).execute();
}
```

Step-by-step JS guide([rollout.com][8]).

##### 5.3 TikTok Events API (fetch)

```ts
import fetch from 'node-fetch';
export async function sendPurchaseTikTok(evt: PurchasePayload) {
  await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Access-Token': process.env.TT_ACCESS_TOKEN! },
    body: JSON.stringify({
      pixel_code: process.env.TT_PIXEL_ID,
      event: 'Purchase',
      event_id: evt.eventId,
      timestamp: Date.now(),
      user: { email: [evt.email], phone: [evt.phone] }, // SHA-256 hash raw PII beforehand
      properties: {
        value: evt.value,
        currency: evt.currency,
        contents: evt.items.map(i => ({ content_id: i.id, quantity: i.qty, price: i.price })),
      },
    }),
  });
}
```

Official Events API notes and benefits([ads.tiktok.com][5]); step-by-step server-side guide (stape.io)([matthewclarkson.com.au][9]).

---

#### 6. Library / tooling quick picks

| Need                | Recommended lib / template                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| GA4 server calls    | **node-google-analytics** (npm)([jsdelivr.com][10])                                                                              |
| Meta C-API          | **facebook-nodejs-business-sdk** (npm) – examples in Rollout guide([rollout.com][8])                                             |
| TikTok server calls | No official SDK yet; use fetch/axios or the open-source **stape.io TikTok Events API Tag** for SGTM([matthewclarkson.com.au][9]) |
| Tag governance      | Keep code in Git; publish env vars via `.env` for Measurement ID, API secrets, tokens                                            |
| Debugging           | GA4 *Realtime* + `?debug_mode=1`, Facebook *Test Events*, TikTok *Events Manager*                                                |

---

#### 7. Migration checklist

1. **Remove** the 2021 UA `<script>` and any `gtag('config','UA-XXXX')` lines.
2. **Insert** the new Google Tag snippet (section 4) early in `<head>`.
3. Add **Consent Mode v2** default command before *any* `config` calls.
4. **Wrap** React checkout actions with a shared `fireEvent(ecommerceAction, payload)` utility that:

   * sends `gtag('event', …)` client-side
   * emits a message to the Node side (queue, REST, or same request) carrying `event_id`.
5. **Implement** the three server functions (section 5) and call them inside order/checkout controllers.
6. **Validate**:

   * Browser dev-tools → Network → verify beacon/fetch calls.
   * GA4 Realtime “Events (last 30 min)”.
   * Meta “Test Events”.
   * TikTok “Diagnostics”.
7. **Enable** GTM Server container (optional but recommended) and route the Node POSTs there to consolidate tokens/secrets.
8. **Document** any custom parameters you add (coupon codes, shipping tier, etc.) so Marketing can build audiences later.

---

#### 8. Further reading

* Julius Fedorovicius, “GTAG vs Google Tag Manager” – excellent overview of why direct gtag sometimes still makes sense([analyticsmania.com][11])
* Google Tag setup & ecommerce guides([developers.google.com][12], [developers.google.com][3])
* GA4 Measurement Protocol reference([developers.google.com][6])
* TikTok Events API docs (Apr 2025)([ads.tiktok.com][5])

---


[1]: https://support.google.com/tagmanager/answer/4620708?hl=en&utm_source=chatgpt.com "Release notes - Tag Manager Help"
[2]: https://developers.google.com/tag-platform/security/guides/consent "Set up consent mode on websites  |  Tag Platform  |  Google for Developers"
[3]: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce?utm_source=chatgpt.com "Analytics - Measure ecommerce - Google for Developers"
[4]: https://developers.google.com/analytics/devguides/collection/ga4/set-up-ecommerce?utm_source=chatgpt.com "Set up a purchase event | Google Analytics"
[5]: https://ads.tiktok.com/help/article/events-api "About Events API | TikTok For Business "
[6]: https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events "Send Measurement Protocol events to Google Analytics  |  Google for Developers"
[7]: https://medium.com/%40andrei_17010/sending-events-to-google-ga4-with-nestjs-aa5e9a564621 "Sending events to Google Analytics with NestJS | by Andrei | Medium"
[8]: https://rollout.com/integration-guides/facebook-conversions/sdk/step-by-step-guide-to-building-a-facebook-conversions-api-integration-in-js "How to build a Facebook Conversions API integration"
[9]: https://matthewclarkson.com.au/blog/how-to-set-up-tiktok-server-side-tracking/ "How to Set Up TikTok Server Side Tracking - A Step-by-Step Guide | Matthew Clarkson"
[10]: https://www.jsdelivr.com/package/npm/node-google-analytics?utm_source=chatgpt.com "node-google-analytics CDN by jsDelivr - A CDN for npm and GitHub"
[11]: https://www.analyticsmania.com/post/gtag-vs-google-tag-manager/ "GTAG vs Google Tag Manager. What is the Difference? What to Choose?"
[12]: https://developers.google.com/tag-platform/gtagjs?utm_source=chatgpt.com "Set up the Google tag with gtag.js | Tag Platform"

