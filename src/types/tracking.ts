// Strict TypeScript types for unified ad-event tracking

// Common event parameters shared across all platforms
export interface BaseEventParams {
  event_id: string; // For deduplication
  timestamp?: number;
}

// Product/Item structure aligned with GA4, Meta, and TikTok schemas
export interface TrackingItem {
  id: string; // product ID
  name: string;
  category?: string;
  variant?: string;
  brand?: string;
  price: number;
  quantity: number;
  position?: number; // for list position
}

// Currency must be ISO 4217 3-letter code
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | 'CNY' | string;

// E-commerce event parameters
export interface EcommerceEventParams extends BaseEventParams {
  currency: CurrencyCode;
  value: number; // total value
  items: TrackingItem[];
}

// Add to cart event
export interface AddToCartEvent extends EcommerceEventParams {
  event_name: 'add_to_cart';
}

// Begin checkout event
export interface BeginCheckoutEvent extends EcommerceEventParams {
  event_name: 'begin_checkout';
  coupon?: string;
}

// Purchase event
export interface PurchaseEvent extends EcommerceEventParams {
  event_name: 'purchase';
  transaction_id: string;
  affiliation?: string;
  coupon?: string;
  shipping?: number;
  tax?: number;
}

// Union type for all tracking events
export type TrackingEvent = AddToCartEvent | BeginCheckoutEvent | PurchaseEvent;

// User data for server-side tracking
export interface UserData {
  client_id: string; // GA4 client ID
  user_id?: string; // Your internal user ID
  email?: string; // Will be hashed
  phone?: string; // Will be hashed
  ip_address?: string;
  user_agent?: string;
}

// Server-side event payload
export interface ServerEventPayload {
  event: TrackingEvent;
  user: UserData;
  consent?: ConsentState;
}

// Platform-specific event names mapping
export const EVENT_NAME_MAPPING = {
  add_to_cart: {
    ga4: 'add_to_cart',
    meta: 'AddToCart',
    tiktok: 'AddToCart'
  },
  begin_checkout: {
    ga4: 'begin_checkout',
    meta: 'InitiateCheckout',
    tiktok: 'InitiateCheckout'
  },
  purchase: {
    ga4: 'purchase',
    meta: 'Purchase',
    tiktok: 'Purchase'
  }
} as const;

// Consent states for GDPR compliance
export interface ConsentState {
  ad_storage: 'granted' | 'denied';
  analytics_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
}

// Google Tag (gtag) types
export interface GtagConfig {
  send_page_view?: boolean;
  debug_mode?: boolean;
  [key: string]: any;
}

export type GtagCommand = 'js' | 'config' | 'event' | 'consent' | 'set';

export type GtagArgs = 
  | ['js', Date]
  | ['config', string, GtagConfig?]
  | ['event', string, any?]
  | ['consent', 'default' | 'update', ConsentState]
  | ['set', any];

// Type guard functions
export function isAddToCartEvent(event: TrackingEvent): event is AddToCartEvent {
  return event.event_name === 'add_to_cart';
}

export function isBeginCheckoutEvent(event: TrackingEvent): event is BeginCheckoutEvent {
  return event.event_name === 'begin_checkout';
}

export function isPurchaseEvent(event: TrackingEvent): event is PurchaseEvent {
  return event.event_name === 'purchase';
}