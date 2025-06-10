import type { TrackingEvent, EVENT_NAME_MAPPING } from '../types/tracking';

// Extend Window interface to include fbq
declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    _fbq: (...args: any[]) => void;
  }
}

// Type definitions for Meta Pixel
export interface MetaPixelConfig {
  pixelId: string;
}

// Initialize Meta Pixel
export function initializeMetaPixel(pixelId: string): void {
  if (typeof window === 'undefined') return;

  // Meta Pixel base code
  (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  // Store pixel ID for later use
  (window as any)._fbPixelId = pixelId;
  
  // Initialize pixel
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}

// Convert our tracking event to Meta Pixel format
function convertToMetaEvent(event: TrackingEvent): [string, any] {
  const eventNameMap = {
    add_to_cart: 'AddToCart',
    begin_checkout: 'InitiateCheckout',
    purchase: 'Purchase'
  } as const;

  const metaEventName = eventNameMap[event.event_name];
  
  // Build Meta-specific parameters
  const params: any = {
    content_ids: event.items.map(item => item.id),
    contents: event.items.map(item => ({
      id: item.id,
      quantity: item.quantity,
      item_price: item.price
    })),
    content_type: 'product',
    currency: event.currency,
    value: event.value,
    num_items: event.items.reduce((sum, item) => sum + item.quantity, 0),
    event_id: event.event_id // For deduplication
  };

  // Add purchase-specific parameters
  if (event.event_name === 'purchase') {
    params.order_id = (event as any).transaction_id;
  }

  return [metaEventName, params];
}

// Send event to Meta Pixel
export function sendMetaPixelEvent(event: TrackingEvent): void {
  if (typeof window === 'undefined' || !window.fbq) return;

  const [eventName, params] = convertToMetaEvent(event);
  
  // Track the event
  window.fbq('track', eventName, params, {
    eventID: event.event_id // For server-side deduplication
  });
}

// Track custom events
export function trackMetaCustomEvent(eventName: string, params?: any): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  
  window.fbq('trackCustom', eventName, params);
}

// Update user data for advanced matching
export function updateMetaUserData(userData: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}): void {
  if (typeof window === 'undefined' || !window.fbq) return;

  // Meta will automatically hash this data
  // Note: Meta SDK doesn't provide a way to get the pixel ID from fbq object
  // In production, you would store the pixel ID and use it here
  window.fbq('init', (window as any)._fbPixelId || 'unknown', userData);
}