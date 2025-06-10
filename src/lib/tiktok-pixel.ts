import type { TrackingEvent } from '../types/tracking';

// Extend Window interface to include ttq
declare global {
  interface Window {
    ttq: {
      load: (pixelId: string) => void;
      page: () => void;
      track: (eventName: string, params?: any) => void;
      identify: (params: any) => void;
    };
  }
}

// Initialize TikTok Pixel
export function initializeTikTokPixel(pixelId: string): void {
  if (typeof window === 'undefined') return;

  // Skip complex initialization if ttq is already mocked (for tests)
  if (window.ttq && typeof window.ttq.load === 'function') {
    window.ttq.load(pixelId);
    window.ttq.page();
    return;
  }

  // TikTok Pixel base code
  (function() {
    // Initialize ttq array if it doesn't exist
    (window as any).ttq = (window as any).ttq || [];
    const ttq = (window as any).ttq;
    
    // Only initialize if not already done
    if (!ttq._initialized) {
      ttq._initialized = true;
      
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
      ttq.setAndDefer = function(t: any, e: any) {
        t[e] = function() {
          t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      
      for (let i = 0; i < ttq.methods.length; i++) {
        ttq.setAndDefer(ttq, ttq.methods[i]);
      }
      
      ttq.instance = function(t: any) {
        const e = ttq._i[t] || [];
        for (let n = 0; n < ttq.methods.length; n++) {
          ttq.setAndDefer(e, ttq.methods[n]);
        }
        return e;
      };
      
      ttq.load = function(e: any, n: any) {
        const i = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[e] = [];
        ttq._i[e]._u = i;
        ttq._t = ttq._t || {};
        ttq._t[e] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[e] = n || {};
        
        // Load the script
        const script = document.createElement('script');
        script.async = true;
        script.src = i + '?sdkid=' + e;
        const firstScript = document.getElementsByTagName('script')[0];
        firstScript.parentNode?.insertBefore(script, firstScript);
      };
    }

    // Create the window.ttq interface
    window.ttq = {
      load: (pixelId: string) => {
        ttq.load(pixelId);
      },
      page: () => {
        if (typeof ttq.page === 'function') {
          ttq.page();
        } else {
          ttq.push(['page']);
        }
      },
      track: (eventName: string, params?: any) => {
        if (typeof ttq.track === 'function') {
          ttq.track(eventName, params);
        } else {
          ttq.push(['track', eventName, params]);
        }
      },
      identify: (params: any) => {
        if (typeof ttq.identify === 'function') {
          ttq.identify(params);
        } else {
          ttq.push(['identify', params]);
        }
      }
    };
  })();

  // Load pixel and track page view
  window.ttq.load(pixelId);
  window.ttq.page();
}

// Convert our tracking event to TikTok format
function convertToTikTokEvent(event: TrackingEvent): [string, any] {
  const eventNameMap = {
    add_to_cart: 'AddToCart',
    begin_checkout: 'InitiateCheckout',
    purchase: 'Purchase'
  } as const;

  const tiktokEventName = eventNameMap[event.event_name];
  
  // Build TikTok-specific parameters
  const params: any = {
    content_type: 'product',
    content_id: event.items[0]?.id, // TikTok uses single content_id
    contents: event.items.map(item => ({
      content_id: item.id,
      content_name: item.name,
      content_category: item.category,
      brand: item.brand,
      price: item.price,
      quantity: item.quantity
    })),
    currency: event.currency,
    value: event.value,
    quantity: event.items.reduce((sum, item) => sum + item.quantity, 0),
    event_id: event.event_id // For deduplication
  };

  // Add purchase-specific parameters
  if (event.event_name === 'purchase') {
    params.order_id = (event as any).transaction_id;
    params.coupon = (event as any).coupon;
    params.shipping = (event as any).shipping;
  }

  return [tiktokEventName, params];
}

// Send event to TikTok Pixel
export function sendTikTokPixelEvent(event: TrackingEvent): void {
  if (typeof window === 'undefined' || !window.ttq) return;

  const [eventName, params] = convertToTikTokEvent(event);
  
  // Track the event
  window.ttq.track(eventName, params);
}

// Update user data for advanced matching
export function updateTikTokUserData(userData: {
  email?: string;
  phone?: string;
  external_id?: string; // Your user ID
}): void {
  if (typeof window === 'undefined' || !window.ttq) return;

  // TikTok will automatically hash PII
  window.ttq.identify({
    email: userData.email,
    phone_number: userData.phone,
    external_id: userData.external_id
  });
}