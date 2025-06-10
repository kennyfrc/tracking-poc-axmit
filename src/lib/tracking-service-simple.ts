import type { TrackingEvent, UserData, ServerEventPayload } from '../types/tracking';
import { initializeGoogleTag, generateEventId, getClientId } from './gtag';
import { initializeMetaPixel } from './meta-pixel';
import { initializeTikTokPixel } from './tiktok-pixel';

// Simplified configuration - no consent needed
export interface TrackingServiceConfig {
  ga4?: {
    measurementId: string;
  };
  meta?: {
    pixelId: string;
  };
  tiktok?: {
    pixelId: string;
  };
  serverEndpoint: string;
  debug?: boolean;
}

// Simplified tracking service for Philippines market
class TrackingService {
  private config: TrackingServiceConfig | null = null;
  private initialized = false;
  private userData: Partial<UserData> = {};

  // Initialize base pixels only
  initialize(config: TrackingServiceConfig): void {
    if (this.initialized) {
      console.warn('TrackingService already initialized');
      return;
    }

    if (!config.serverEndpoint) {
      console.error('Server endpoint is required for tracking');
      return;
    }

    this.config = config;

    // Initialize base pixels for pageview tracking only
    if (config.ga4?.measurementId) {
      initializeGoogleTag(config.ga4.measurementId);
      if (config.debug) console.log('📊 GA4 base pixel initialized');
    }

    if (config.meta?.pixelId) {
      initializeMetaPixel(config.meta.pixelId);
      if (config.debug) console.log('📘 Meta base pixel initialized');
    }

    if (config.tiktok?.pixelId) {
      initializeTikTokPixel(config.tiktok.pixelId);
      if (config.debug) console.log('🎵 TikTok base pixel initialized');
    }

    this.initialized = true;

    if (config.debug) {
      console.log('✅ Base pixels initialized - All events will be tracked server-side');
    }
  }

  // Set user data
  setUserData(userData: Partial<UserData>): void {
    this.userData = { ...this.userData, ...userData };
    
    if (!this.userData.client_id) {
      this.userData.client_id = getClientId();
    }

    // Collect browser IDs for better tracking
    if (typeof window !== 'undefined') {
      // Facebook browser ID
      const fbpCookie = document.cookie.match(/_fbp=([^;]+)/);
      if (fbpCookie) this.userData.fbp = fbpCookie[1];

      // Facebook click ID
      const fbclid = new URLSearchParams(window.location.search).get('fbclid');
      if (fbclid) this.userData.fbc = `fb.1.${Date.now()}.${fbclid}`;
    }

    if (this.config?.debug) {
      console.log('User data updated:', this.userData);
    }
  }

  // Send ALL events to server
  async trackEvent(event: Omit<TrackingEvent, 'event_id'>): Promise<void> {
    if (!this.initialized || !this.config?.serverEndpoint) {
      console.error('TrackingService not properly initialized');
      return;
    }

    const eventWithId: TrackingEvent = {
      ...event,
      event_id: generateEventId(),
      timestamp: Date.now()
    } as TrackingEvent;

    const payload: ServerEventPayload = {
      event: eventWithId,
      user: {
        client_id: this.userData.client_id || getClientId(),
        user_agent: navigator.userAgent,
        ...this.userData
      }
    };

    try {
      if (this.config.debug) {
        console.log(`📤 Sending ${event.event_name} to server`);
      }

      const response = await fetch(this.config.serverEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (this.config.debug) {
        console.log('✅ Server response:', result);
      }
    } catch (error) {
      console.error('❌ Server tracking error:', error);
    }
  }

  // Helper methods
  async trackAddToCart(items: TrackingEvent['items'], currency: TrackingEvent['currency'], value: number): Promise<void> {
    await this.trackEvent({
      event_name: 'add_to_cart',
      items,
      currency,
      value
    });
  }

  async trackBeginCheckout(items: TrackingEvent['items'], currency: TrackingEvent['currency'], value: number, coupon?: string): Promise<void> {
    await this.trackEvent({
      event_name: 'begin_checkout',
      items,
      currency,
      value,
      coupon
    });
  }

  async trackPurchase(
    transaction_id: string,
    items: TrackingEvent['items'],
    currency: TrackingEvent['currency'],
    value: number,
    additionalParams?: {
      affiliation?: string;
      coupon?: string;
      shipping?: number;
      tax?: number;
    }
  ): Promise<void> {
    await this.trackEvent({
      event_name: 'purchase',
      transaction_id,
      items,
      currency,
      value,
      ...additionalParams
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton
export const trackingService = new TrackingService();