import type { TrackingEvent, ConsentState, UserData, ServerEventPayload } from '../types/tracking';
import { gtag, initializeGoogleTag, sendTrackingEvent, generateEventId, getClientId, updateConsent as updateGtagConsent } from './gtag';
import { initializeMetaPixel, sendMetaPixelEvent, updateMetaUserData } from './meta-pixel';
import { initializeTikTokPixel, sendTikTokPixelEvent, updateTikTokUserData } from './tiktok-pixel';

// Configuration for tracking services
export interface TrackingServiceConfig {
  ga4?: {
    measurementId: string;
    apiSecret?: string;
  };
  meta?: {
    pixelId: string;
    accessToken?: string;
  };
  tiktok?: {
    pixelId: string;
    accessToken?: string;
  };
  serverEndpoint?: string;
  debug?: boolean;
}

// Singleton tracking service
class TrackingService {
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

  // Initialize all tracking services
  initialize(config: TrackingServiceConfig): void {
    if (this.initialized) {
      console.warn('TrackingService already initialized');
      return;
    }

    this.config = config;

    // Initialize GA4
    if (config.ga4?.measurementId) {
      initializeGoogleTag(config.ga4.measurementId);
    }

    // Initialize Meta Pixel
    if (config.meta?.pixelId) {
      initializeMetaPixel(config.meta.pixelId);
    }

    // Initialize TikTok Pixel
    if (config.tiktok?.pixelId) {
      initializeTikTokPixel(config.tiktok.pixelId);
    }

    this.initialized = true;

    if (config.debug) {
      console.log('TrackingService initialized with config:', config);
    }
  }

  // Update consent state
  updateConsent(consent: Partial<ConsentState>): void {
    this.consentState = { ...this.consentState, ...consent };
    
    // Update Google consent
    updateGtagConsent(this.consentState);
    
    // Meta and TikTok don't have built-in consent APIs in their pixels
    // In production, you would conditionally load/fire pixels based on consent
    
    if (this.config?.debug) {
      console.log('Consent updated:', this.consentState);
    }
  }

  // Set user data for advanced matching
  setUserData(userData: Partial<UserData>): void {
    this.userData = { ...this.userData, ...userData };
    
    // Always set client_id if not provided
    if (!this.userData.client_id) {
      this.userData.client_id = getClientId();
    }

    // Update Meta advanced matching
    if (userData.email || userData.phone) {
      updateMetaUserData({
        email: userData.email,
        phone: userData.phone
      });
    }

    // Update TikTok advanced matching
    if (userData.email || userData.phone || userData.user_id) {
      updateTikTokUserData({
        email: userData.email,
        phone: userData.phone,
        external_id: userData.user_id
      });
    }

    if (this.config?.debug) {
      console.log('User data updated:', this.userData);
    }
  }

  // Track an event across all platforms
  async trackEvent(event: Omit<TrackingEvent, 'event_id'>): Promise<void> {
    if (!this.initialized) {
      console.error('TrackingService not initialized. Call initialize() first.');
      return;
    }

    // Generate event ID for deduplication
    const eventWithId: TrackingEvent = {
      ...event,
      event_id: generateEventId(),
      timestamp: Date.now()
    } as TrackingEvent;

    // Check consent before sending events
    const hasAdConsent = this.consentState.ad_storage === 'granted';
    const hasAnalyticsConsent = this.consentState.analytics_storage === 'granted';

    // Log what would be sent to each platform
    if (this.config?.debug) {
      console.group(`🔍 Tracking Event: ${event.event_name}`);
      
      // GA4 Server-side payload
      if (this.config.ga4 && hasAnalyticsConsent) {
        console.log('📊 GA4 Measurement Protocol payload:', {
          endpoint: 'https://www.google-analytics.com/mp/collect',
          measurement_id: this.config.ga4.measurementId,
          api_secret: this.config.ga4.apiSecret ? '***' : 'NOT SET',
          payload: {
            client_id: this.userData.client_id || getClientId(),
            events: [{
              name: event.event_name,
              params: {
                ...eventWithId,
                engagement_time_msec: 100
              }
            }]
          }
        });
      }

      // Meta CAPI payload
      if (this.config.meta && hasAdConsent) {
        console.log('📘 Meta Conversions API payload:', {
          endpoint: `https://graph.facebook.com/v18.0/${this.config.meta.pixelId}/events`,
          access_token: this.config.meta.accessToken ? '***' : 'NOT SET',
          payload: {
            data: [{
              event_name: event.event_name === 'add_to_cart' ? 'AddToCart' : 
                         event.event_name === 'begin_checkout' ? 'InitiateCheckout' : 'Purchase',
              event_time: Math.floor(Date.now() / 1000),
              event_id: eventWithId.event_id,
              user_data: {
                client_ip_address: this.userData.ip_address,
                client_user_agent: this.userData.user_agent,
                em: this.userData.email ? '[HASHED]' : undefined,
                ph: this.userData.phone ? '[HASHED]' : undefined
              },
              custom_data: {
                currency: eventWithId.currency,
                value: eventWithId.value,
                contents: eventWithId.items.map(item => ({
                  id: item.id,
                  quantity: item.quantity,
                  item_price: item.price
                }))
              }
            }]
          }
        });
      }

      // TikTok Events API payload
      if (this.config.tiktok && hasAdConsent) {
        console.log('🎵 TikTok Events API payload:', {
          endpoint: 'https://business-api.tiktok.com/open_api/v1.3/event/track/',
          access_token: this.config.tiktok.accessToken ? '***' : 'NOT SET',
          payload: {
            pixel_code: this.config.tiktok.pixelId,
            event: event.event_name === 'add_to_cart' ? 'AddToCart' : 
                   event.event_name === 'begin_checkout' ? 'InitiateCheckout' : 'Purchase',
            event_id: eventWithId.event_id,
            timestamp: Date.now(),
            user: {
              email: this.userData.email ? '[SHA256 HASHED]' : undefined,
              phone: this.userData.phone ? '[SHA256 HASHED]' : undefined
            },
            properties: {
              value: eventWithId.value,
              currency: eventWithId.currency,
              contents: eventWithId.items.map(item => ({
                content_id: item.id,
                quantity: item.quantity,
                price: item.price
              }))
            }
          }
        });
      }

      console.groupEnd();
    }

    // Send to GA4 (respects analytics consent)
    if (this.config?.ga4 && hasAnalyticsConsent) {
      sendTrackingEvent(eventWithId);
    }

    // Send to Meta Pixel (respects ad consent)
    if (this.config?.meta && hasAdConsent) {
      sendMetaPixelEvent(eventWithId);
    }

    // Send to TikTok Pixel (respects ad consent)
    if (this.config?.tiktok && hasAdConsent) {
      sendTikTokPixelEvent(eventWithId);
    }

    // Send to server for server-side tracking
    if (this.config?.serverEndpoint) {
      await this.sendToServer(eventWithId);
    }

    if (this.config?.debug) {
      console.log('Event tracked:', eventWithId);
    }
  }

  // Send event to server for server-side tracking
  private async sendToServer(event: TrackingEvent): Promise<void> {
    if (!this.config?.serverEndpoint) return;

    const payload: ServerEventPayload = {
      event,
      user: {
        client_id: this.userData.client_id || getClientId(),
        ...this.userData
      }
    };

    try {
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

      if (this.config.debug) {
        console.log('Server tracking successful:', payload);
      }
    } catch (error) {
      console.error('Server tracking error:', error);
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
export const trackingService = new TrackingService();

// Export type
export type { TrackingService };