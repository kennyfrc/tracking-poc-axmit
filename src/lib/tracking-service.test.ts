import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackingService } from './tracking-service';
import type { TrackingServiceConfig } from './tracking-service';

// Mock global objects
declare global {
  interface Window {
    gtag: any;
    dataLayer: any[];
    fbq: any;
    ttq: any;
  }
}

describe('TrackingService', () => {
  const mockConfig: TrackingServiceConfig = {
    ga4: {
      measurementId: 'G-TEST123'
    },
    meta: {
      pixelId: '123456789'
    },
    tiktok: {
      pixelId: 'TEST123'
    },
    serverEndpoint: 'http://localhost:3001/api/track',
    debug: true
  };

  beforeEach(() => {
    // Reset tracking service state
    vi.clearAllMocks();
    // Reset the initialized state by creating a new instance
    (trackingService as any).initialized = false;
    (trackingService as any).config = null;
    (trackingService as any).userData = {};
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock fetch
    global.fetch = vi.fn();

    // Mock window objects
    window.gtag = vi.fn();
    window.dataLayer = [];
    window.fbq = vi.fn();
    
    // Properly mock TikTok pixel with all required methods
    window.ttq = {
      load: vi.fn(),
      page: vi.fn(),
      track: vi.fn(),
      identify: vi.fn()
    };
  });

  describe('initialization', () => {
    it('should initialize with valid config', () => {
      trackingService.initialize(mockConfig);
      expect(trackingService.isInitialized()).toBe(true);
    });

    it('should warn if already initialized', () => {
      trackingService.initialize(mockConfig);
      trackingService.initialize(mockConfig);
      expect(console.warn).toHaveBeenCalledWith('TrackingService already initialized');
    });

    it('should require server endpoint', () => {
      const configWithoutEndpoint = {
        ga4: { measurementId: 'G-TEST123' }
      } as TrackingServiceConfig;
      
      trackingService.initialize(configWithoutEndpoint);
      expect(console.error).toHaveBeenCalledWith('Server endpoint is required for tracking');
      expect(trackingService.isInitialized()).toBe(false);
    });

    it('should log initialization in debug mode', () => {
      trackingService.initialize(mockConfig);
      expect(console.log).toHaveBeenCalledWith('✅ Base pixels initialized - All events will be tracked server-side');
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
      
      // Since getUserData is not exposed, we can only verify through logs
      expect(console.log).toHaveBeenCalledWith('User data updated:', expect.objectContaining({
        user_id: userData.user_id,
        email: userData.email,
        phone: userData.phone,
        client_id: expect.any(String)
      }));
    });

    it('should auto-generate client_id if not provided', () => {
      trackingService.setUserData({
        email: 'test@example.com'
      });

      expect(console.log).toHaveBeenCalledWith('User data updated:', expect.objectContaining({
        email: 'test@example.com',
        client_id: expect.any(String)
      }));
    });

    it('should extract Facebook browser ID from cookie', () => {
      document.cookie = '_fbp=fb.1.1234567890.123456';
      
      trackingService.setUserData({
        email: 'test@example.com'
      });

      expect(console.log).toHaveBeenCalledWith('User data updated:', expect.objectContaining({
        fbp: 'fb.1.1234567890.123456'
      }));
    });
  });

  describe('event tracking', () => {
    beforeEach(() => {
      trackingService.initialize(mockConfig);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      } as Response);
    });

    it('should track add to cart event', async () => {
      const items = [{
        id: 'PROD-001',
        name: 'Test Product',
        price: 99.99,
        quantity: 1
      }];

      await trackingService.trackAddToCart(items, 'USD', 99.99);

      // Check server call
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/track',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"event_name":"add_to_cart"')
        }
      );

      // Verify the payload structure
      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      
      expect(body.event).toMatchObject({
        event_name: 'add_to_cart',
        items,
        currency: 'USD',
        value: 99.99,
        event_id: expect.any(String),
        timestamp: expect.any(Number)
      });

      expect(body.user).toMatchObject({
        client_id: expect.any(String),
        user_agent: expect.any(String)
      });
    });

    it('should track begin checkout event', async () => {
      const items = [{
        id: 'PROD-001',
        name: 'Test Product',
        price: 99.99,
        quantity: 1
      }];

      await trackingService.trackBeginCheckout(items, 'USD', 99.99, 'SAVE10');

      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      
      expect(body.event).toMatchObject({
        event_name: 'begin_checkout',
        items,
        currency: 'USD',
        value: 99.99,
        coupon: 'SAVE10'
      });
    });

    it('should track purchase event with all parameters', async () => {
      const items = [{
        id: 'PROD-001',
        name: 'Test Product',
        price: 99.99,
        quantity: 2
      }];

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

      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      
      expect(body.event).toMatchObject({
        event_name: 'purchase',
        transaction_id: 'TXN-123',
        items,
        currency: 'USD',
        value: 199.98,
        affiliation: 'Test Store',
        coupon: 'SAVE10',
        shipping: 9.99,
        tax: 15.99
      });
    });

    it('should track generic events', async () => {
      await trackingService.trackEvent({
        event_name: 'view_item',
        items: [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
        currency: 'USD',
        value: 99.99
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/track',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"event_name":"view_item"')
        })
      );
    });

    it('should handle server tracking errors gracefully', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      await expect(
        trackingService.trackAddToCart(
          [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
          'USD',
          99.99
        )
      ).resolves.not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        '❌ Server tracking error:',
        expect.any(Error)
      );
    });

    it('should not track if not initialized', async () => {
      // Reset to uninitialized state
      (trackingService as any).initialized = false;
      (trackingService as any).config = null;

      await trackingService.trackAddToCart(
        [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
        'USD',
        99.99
      );

      expect(console.error).toHaveBeenCalledWith('TrackingService not properly initialized');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should include user data in tracking payload', async () => {
      trackingService.setUserData({
        user_id: 'test-123',
        email: 'test@example.com',
        phone: '+1234567890'
      });

      await trackingService.trackAddToCart(
        [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
        'USD',
        99.99
      );

      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      
      expect(body.user).toMatchObject({
        user_id: 'test-123',
        email: 'test@example.com',
        phone: '+1234567890',
        client_id: expect.any(String),
        user_agent: expect.any(String)
      });
    });
  });

  describe('event deduplication', () => {
    beforeEach(() => {
      trackingService.initialize(mockConfig);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      } as Response);
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

        const callArgs = vi.mocked(global.fetch).mock.calls[i];
        const body = JSON.parse(callArgs[1].body as string);
        eventIds.add(body.event.event_id);
      }

      // All event IDs should be unique
      expect(eventIds.size).toBe(5);
    });

    it('should include timestamp with events', async () => {
      const beforeTime = Date.now();
      
      await trackingService.trackPurchase(
        'TXN-123',
        [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
        'USD',
        99.99
      );

      const afterTime = Date.now();

      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      
      expect(body.event.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(body.event.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('debug logging', () => {
    it('should log events in debug mode', async () => {
      trackingService.initialize({ ...mockConfig, debug: true });
      
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      } as Response);

      await trackingService.trackAddToCart(
        [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
        'USD',
        99.99
      );

      expect(console.log).toHaveBeenCalledWith('📤 Sending add_to_cart to server');
      expect(console.log).toHaveBeenCalledWith('✅ Server response:', { success: true });
    });

    it('should not log events when debug is false', async () => {
      trackingService.initialize({ ...mockConfig, debug: false });
      
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      } as Response);

      // Clear previous console.log calls
      vi.mocked(console.log).mockClear();

      await trackingService.trackAddToCart(
        [{ id: 'PROD-001', name: 'Test', price: 99.99, quantity: 1 }],
        'USD',
        99.99
      );

      expect(console.log).not.toHaveBeenCalled();
    });
  });
});