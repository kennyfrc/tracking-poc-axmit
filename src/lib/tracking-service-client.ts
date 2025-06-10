import type { TrackingEvent, ConsentState, UserData, ServerEventPayload } from '../types/tracking';
import { gtag, initializeGoogleTag, generateEventId, getClientId, updateConsent as updateGtagConsent } from './gtag';
import { initializeMetaPixel } from './meta-pixel';
import { initializeTikTokPixel } from './tiktok-pixel';

// Configuration for tracking services (client-side only needs pixel IDs)
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
  serverEndpoint: string; // Required for server-side tracking
  debug?: boolean;
}

// Client-side tracking service (only initializes pixels, sends events to server)
class TrackingServiceClient {
  private config: TrackingServiceConfig | null = null;
  private initialized = false;
  private consentState: ConsentState = {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  };
  private userData: Partial<UserData> = {};

  // Reset method for testing
  reset(): void {
    this.config = null;
    this.initialized = false;
    this.consentState = {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    };
    this.userData = {};
  }

  // Initialize base pixels only - no event firing
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

    // Initialize GA4 base pixel (for page views only)
    if (config.ga4?.measurementId) {
      initializeGoogleTag(config.ga4.measurementId);
      if (config.debug) {
        console.log('📊 GA4 base pixel initialized');
      }
    }

    // Initialize Meta base pixel (for page views only)
    if (config.meta?.pixelId) {
      initializeMetaPixel(config.meta.pixelId);
      if (config.debug) {
        console.log('📘 Meta base pixel initialized');
      }
    }

    // Initialize TikTok base pixel (for page views only)
    if (config.tiktok?.pixelId) {
      initializeTikTokPixel(config.tiktok.pixelId);
      if (config.debug) {
        console.log('🎵 TikTok base pixel initialized');
      }
    }

    this.initialized = true;

    if (config.debug) {
      console.log('✅ Client-side pixels initialized (page view only)');
      console.log('🔄 All conversion events will be sent server-side to:', config.serverEndpoint);
    }
  }

  // Update consent state
  updateConsent(consent: Partial<ConsentState>): void {
    this.consentState = { ...this.consentState, ...consent };
    
    // Update Google consent
    updateGtagConsent(this.consentState);
    
    if (this.config?.debug) {
      console.log('Consent updated:', this.consentState);
    }
  }

  // Set user data for server-side tracking
  setUserData(userData: Partial<UserData>): void {
    this.userData = { ...this.userData, ...userData };
    
    // Always set client_id if not provided
    if (!this.userData.client_id) {
      this.userData.client_id = getClientId();
    }

    // Get browser IDs for server-side tracking
    if (typeof window !== 'undefined') {
      // Get Facebook browser ID (fbp cookie)
      const fbpCookie = document.cookie.match(/fbp=([^;]+)/);
      if (fbpCookie) {
        this.userData.fbp = fbpCookie[1];
      }

      // Get Facebook click ID (fbc parameter)
      const fbcParam = new URLSearchParams(window.location.search).get('fbclid');
      if (fbcParam) {
        this.userData.fbc = `fb.1.${Date.now()}.${fbcParam}`;
      }
    }

    if (this.config?.debug) {
      console.log('User data updated:', this.userData);
    }
  }

  // Send ALL events to server - no client-side event firing
  async trackEvent(event: Omit<TrackingEvent, 'event_id'>): Promise<void> {
    if (!this.initialized) {
      console.error('TrackingService not initialized. Call initialize() first.');
      return;
    }

    if (!this.config?.serverEndpoint) {
      console.error('No server endpoint configured');
      return;
    }

    // Generate event ID for deduplication
    const eventWithId: TrackingEvent = {
      ...event,
      event_id: generateEventId(),
      timestamp: Date.now()
    } as TrackingEvent;

    // Always send to server - let server handle consent and platform logic
    await this.sendToServer(eventWithId);
  }

  // Send event to server for ALL tracking
  private async sendToServer(event: TrackingEvent): Promise<void> {
    if (!this.config?.serverEndpoint) return;

    const payload: ServerEventPayload = {
      event,
      user: {
        client_id: this.userData.client_id || getClientId(),
        user_agent: navigator.userAgent,
        ip_address: 'Will be set by server', // Server will get real IP
        ...this.userData
      },
      consent: this.consentState // Send consent state to server
    };

    try {
      if (this.config.debug) {
        console.log('🚀 Sending event to server:', {
          endpoint: this.config.serverEndpoint,
          event_name: event.event_name,
          event_id: event.event_id
        });
      }

      const response = await fetch(this.config.serverEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server tracking failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (this.config.debug) {
        console.log('✅ Server tracking response:', result);
      }
    } catch (error) {
      console.error('❌ Server tracking error:', error);
    }
  }

  // Helper methods for common events
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

  // Get current configuration
  getConfig(): TrackingServiceConfig | null {
    return this.config;
  }

  // Check if service is initialized
  isInitialized(): boolean {
    return this.initialized;
  }

  // Get current consent state
  getConsentState(): ConsentState {
    return { ...this.consentState };
  }

  // Get current user data
  getUserData(): Partial<UserData> {
    return { ...this.userData };
  }
}

// Export singleton instance
export const trackingService = new TrackingServiceClient();

// Export type
export type { TrackingServiceClient as TrackingService };