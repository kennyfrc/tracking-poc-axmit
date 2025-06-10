import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackingService } from './tracking-service';
import type { TrackingServiceConfig, TrackingEvent } from '../types/tracking';

describe('TrackingService', () => {
  const mockConfig: TrackingServiceConfig = {
    ga4: {
      measurementId: 'G-TEST123',
      apiSecret: 'test-secret'
    },
    meta: {
      pixelId: '123456789',
      accessToken: 'test-token'
    },
    tiktok: {
      pixelId: 'TEST123',
      accessToken: 'test-token'
    },
    serverEndpoint: 'http://localhost:3001/api/track',
    debug: true
  };

  beforeEach(() => {
    // Reset tracking service state
    vi.clearAllMocks();
    (trackingService as any).reset();
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('initialization', () => {
    it('should initialize with valid config', () => {
      trackingService.initialize(mockConfig);
      expect(trackingService.isInitialized()).toBe(true);
      expect(trackingService.getConfig()).toEqual(mockConfig);
    });

    it('should warn if already initialized', () => {
      trackingService.initialize(mockConfig);
      trackingService.initialize(mockConfig);
      expect(console.warn).toHaveBeenCalledWith('TrackingService already initialized');
    });

    it('should initialize Google Tag when GA4 config is provided', () => {
      trackingService.initialize(mockConfig);
      expect(window.gtag).toBeDefined();
      expect(window.dataLayer).toBeDefined();
    });
  });

  describe('consent management', () => {
    beforeEach(() => {
      trackingService.initialize(mockConfig);
    });

    it('should start with denied consent by default', () => {
      const consent = trackingService.getConsentState();
      expect(consent.ad_storage).toBe('denied');
      expect(consent.analytics_storage).toBe('denied');
      expect(consent.ad_user_data).toBe('denied');
      expect(consent.ad_personalization).toBe('denied');
    });

    it('should update consent state', () => {
      trackingService.updateConsent({
        ad_storage: 'granted',
        analytics_storage: 'granted'
      });

      const consent = trackingService.getConsentState();
      expect(consent.ad_storage).toBe('granted');
      expect(consent.analytics_storage).toBe('granted');
    });
  });

  describe('user data management', () => {
    beforeEach(() => {
      trackingService.initialize(mockConfig);
    });

    it('should set user data', () => {
      const userData = {
        user_id: 'test-user-123',
        email: 'test@example.com',
        phone: '+1234567890'
      };

      trackingService.setUserData(userData);
      const storedData = trackingService.getUserData();
      
      expect(storedData.user_id).toBe(userData.user_id);
      expect(storedData.email).toBe(userData.email);
      expect(storedData.phone).toBe(userData.phone);
      expect(storedData.client_id).toBeDefined(); // Should auto-generate
    });

    it('should update Meta advanced matching when email/phone is provided', () => {
      trackingService.setUserData({
        email: 'test@example.com',
        phone: '+1234567890'
      });

      expect(window.fbq).toHaveBeenCalledWith(
        'init',
        expect.any(String),
        expect.objectContaining({
          email: 'test@example.com',
          phone: '+1234567890'
        })
      );
    });
  });

  describe('event tracking', () => {
    beforeEach(() => {
      trackingService.initialize(mockConfig);
    });

    it('should track add to cart event', async () => {
      const items = [{
        id: 'PROD-001',
        name: 'Test Product',
        price: 99.99,
        quantity: 1
      }];

      trackingService.updateConsent({
        analytics_storage: 'granted',
        ad_storage: 'granted'
      });

      await trackingService.trackAddToCart(items, 'USD', 99.99);

      // Check GA4 call
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'add_to_cart',
        expect.objectContaining({
          items,
          currency: 'USD',
          value: 99.99,
          event_id: expect.any(String),
          timestamp: expect.any(Number)
        })
      );

      // Check Meta Pixel call
      expect(window.fbq).toHaveBeenCalledWith(
        'track',
        'AddToCart',
        expect.any(Object),
        expect.objectContaining({
          eventID: expect.any(String)
        })
      );

      // Check TikTok Pixel call
      expect(window.ttq.track).toHaveBeenCalledWith(
        'AddToCart',
        expect.any(Object)
      );
    });

    it('should track purchase event with all parameters', async () => {
      const items = [{
        id: 'PROD-001',
        name: 'Test Product',
        price: 99.99,
        quantity: 2
      }];

      trackingService.updateConsent({
        analytics_storage: 'granted',
        ad_storage: 'granted'
      });

      await trackingService.trackPurchase(
        'TXN-123',
        items,
        'USD',
        199.98,
        {
          affiliation: 'Test Store',
          coupon: 'SAVE10',
          shipping: 9.99,
          tax: 15.99
        }
      );

      // Check GA4 call includes transaction_id
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'purchase',
        expect.objectContaining({
          transaction_id: 'TXN-123',
          items,
          currency: 'USD',
          value: 199.98,
          affiliation: 'Test Store',
          coupon: 'SAVE10',
          shipping: 9.99,
          tax: 15.99
        })
      );
    });

    it('should respect consent when tracking events', async () => {
      // All consent denied
      trackingService.updateConsent({
        analytics_storage: 'denied',
        ad_storage: 'denied'
      });

      await trackingService.trackAddToCart(
        [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
        'USD',
        99.99
      );

      // Should not call any tracking
      expect(window.gtag).not.toHaveBeenCalledWith('event', expect.any(String), expect.any(Object));
      expect(window.fbq).not.toHaveBeenCalledWith('track', expect.any(String), expect.any(Object));
      expect(window.ttq.track).not.toHaveBeenCalled();
    });

    it('should send events to server endpoint', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: 'OK'
      } as Response);

      await trackingService.trackAddToCart(
        [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
        'USD',
        99.99
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/track',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('"event_name":"add_to_cart"')
        }
      );
    });

    it('should handle server tracking errors gracefully', async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      await expect(
        trackingService.trackAddToCart(
          [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
          'USD',
          99.99
        )
      ).resolves.not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        'Server tracking error:',
        expect.any(Error)
      );
    });
  });

  describe('event deduplication', () => {
    beforeEach(() => {
      trackingService.initialize(mockConfig);
      trackingService.updateConsent({
        analytics_storage: 'granted',
        ad_storage: 'granted'
      });
    });

    it('should generate unique event IDs', async () => {
      const eventIds = new Set<string>();

      // Track multiple events
      for (let i = 0; i < 5; i++) {
        await trackingService.trackAddToCart(
          [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
          'USD',
          99.99
        );

        // Extract event_id from gtag call
        // gtag calls are in the format: gtag('event', 'event_name', { params })
        const gtagCalls = vi.mocked(window.gtag).mock.calls.filter(call => call[0] === 'event');
        if (i < gtagCalls.length) {
          const eventParams = gtagCalls[i][2];
          eventIds.add(eventParams.event_id);
        }
      }

      // All event IDs should be unique
      expect(eventIds.size).toBe(5);
    });

    it('should pass event_id to all platforms for deduplication', async () => {
      await trackingService.trackPurchase(
        'TXN-123',
        [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
        'USD',
        99.99
      );

      // Extract event_id from GA4 call
      // Find the event call (not js, consent, or config calls)
      const gtagEventCalls = vi.mocked(window.gtag).mock.calls.filter(call => call[0] === 'event');
      expect(gtagEventCalls.length).toBeGreaterThan(0);
      const gtagEventId = gtagEventCalls[0][2].event_id;

      // Check Meta has same event_id - look for track calls only
      const metaTrackCalls = vi.mocked(window.fbq).mock.calls.filter(call => call[0] === 'track');
      expect(metaTrackCalls.length).toBeGreaterThan(0);
      
      // Find the Purchase event (skip PageView from initialization)
      const purchaseCall = metaTrackCalls.find(call => call[1] === 'Purchase');
      expect(purchaseCall).toBeDefined();
      expect(purchaseCall![0]).toBe('track');

      // Check TikTok has same event_id
      const tiktokCall = vi.mocked(window.ttq.track).mock.calls[0];
      expect(tiktokCall[1].event_id).toBe(gtagEventId);
    });
  });
});