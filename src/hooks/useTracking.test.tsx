import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTracking, TrackingProvider, useTrackingContext } from './useTracking';
import { trackingService } from '../lib/tracking-service';
import type { ReactNode } from 'react';

describe('useTracking', () => {
  const mockConfig = {
    ga4: {
      measurementId: 'G-TEST123'
    },
    debug: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset trackingService state by mocking isInitialized
    vi.spyOn(trackingService, 'isInitialized').mockReturnValue(false);
    vi.spyOn(trackingService, 'initialize').mockImplementation(() => {});
    vi.spyOn(trackingService, 'updateConsent').mockImplementation(() => {});
    vi.spyOn(trackingService, 'setUserData').mockImplementation(() => {});
    vi.spyOn(trackingService, 'trackAddToCart').mockResolvedValue(undefined);
    vi.spyOn(trackingService, 'trackBeginCheckout').mockResolvedValue(undefined);
    vi.spyOn(trackingService, 'trackPurchase').mockResolvedValue(undefined);
    vi.spyOn(trackingService, 'trackEvent').mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should auto-initialize when autoInitialize is true', () => {
      renderHook(() => useTracking({ ...mockConfig, autoInitialize: true }));
      
      expect(trackingService.initialize).toHaveBeenCalledWith({ ...mockConfig, autoInitialize: true });
    });

    it('should not auto-initialize when autoInitialize is false', () => {
      renderHook(() => useTracking({ ...mockConfig, autoInitialize: false }));
      
      expect(trackingService.initialize).not.toHaveBeenCalled();
    });

    it('should allow manual initialization', () => {
      const { result } = renderHook(() => useTracking());
      
      act(() => {
        result.current.initialize(mockConfig);
      });

      expect(trackingService.initialize).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('consent management', () => {
    it('should update consent', () => {
      const { result } = renderHook(() => useTracking());
      
      act(() => {
        result.current.updateConsent({
          ad_storage: 'granted',
          analytics_storage: 'granted'
        });
      });

      expect(trackingService.updateConsent).toHaveBeenCalledWith({
        ad_storage: 'granted',
        analytics_storage: 'granted'
      });
    });

    it('should accept all tracking', () => {
      const { result } = renderHook(() => useTracking());
      
      act(() => {
        result.current.acceptAllTracking();
      });

      expect(trackingService.updateConsent).toHaveBeenCalledWith({
        ad_storage: 'granted',
        analytics_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted'
      });
    });

    it('should reject all tracking', () => {
      const { result } = renderHook(() => useTracking());
      
      act(() => {
        result.current.rejectAllTracking();
      });

      expect(trackingService.updateConsent).toHaveBeenCalledWith({
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    });
  });

  describe('user data', () => {
    it('should set user data', () => {
      const { result } = renderHook(() => useTracking());
      const userData = {
        user_id: 'test-123',
        email: 'test@example.com'
      };
      
      act(() => {
        result.current.setUserData(userData);
      });

      expect(trackingService.setUserData).toHaveBeenCalledWith(userData);
    });
  });

  describe('event tracking', () => {
    it('should track add to cart', async () => {
      const { result } = renderHook(() => useTracking());
      const items = [{
        id: 'PROD-001',
        name: 'Test Product',
        price: 99.99,
        quantity: 1
      }];
      
      await act(async () => {
        await result.current.trackAddToCart(items, 'USD', 99.99);
      });

      expect(trackingService.trackAddToCart).toHaveBeenCalledWith(items, 'USD', 99.99);
    });

    it('should track begin checkout', async () => {
      const { result } = renderHook(() => useTracking());
      const items = [{
        id: 'PROD-001',
        name: 'Test Product',
        price: 99.99,
        quantity: 1
      }];
      
      await act(async () => {
        await result.current.trackBeginCheckout(items, 'USD', 99.99, 'SAVE10');
      });

      expect(trackingService.trackBeginCheckout).toHaveBeenCalledWith(items, 'USD', 99.99, 'SAVE10');
    });

    it('should track purchase', async () => {
      const { result } = renderHook(() => useTracking());
      const items = [{
        id: 'PROD-001',
        name: 'Test Product',
        price: 99.99,
        quantity: 1
      }];
      const additionalParams = {
        affiliation: 'Test Store',
        coupon: 'SAVE10',
        shipping: 9.99,
        tax: 7.99
      };
      
      await act(async () => {
        await result.current.trackPurchase('TXN-123', items, 'USD', 99.99, additionalParams);
      });

      expect(trackingService.trackPurchase).toHaveBeenCalledWith(
        'TXN-123', 
        items, 
        'USD', 
        99.99, 
        additionalParams
      );
    });

    it('should track generic events', async () => {
      const { result } = renderHook(() => useTracking());
      const event = {
        event_name: 'add_to_cart' as const,
        items: [{
          id: 'PROD-001',
          name: 'Test Product',
          price: 99.99,
          quantity: 1
        }],
        currency: 'USD' as const,
        value: 99.99
      };
      
      await act(async () => {
        await result.current.trackEvent(event);
      });

      expect(trackingService.trackEvent).toHaveBeenCalledWith(event);
    });
  });
});

describe('TrackingProvider', () => {
  const mockConfig = {
    ga4: {
      measurementId: 'G-TEST123'
    },
    debug: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(trackingService, 'isInitialized').mockReturnValue(false);
    vi.spyOn(trackingService, 'initialize').mockImplementation(() => {});
  });

  it('should provide tracking context', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TrackingProvider config={mockConfig}>
        {children}
      </TrackingProvider>
    );

    const { result } = renderHook(() => useTrackingContext(), { wrapper });
    
    expect(result.current).toBeDefined();
    expect(typeof result.current.trackAddToCart).toBe('function');
    expect(typeof result.current.trackPurchase).toBe('function');
  });

  it('should auto-initialize tracking service', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TrackingProvider config={mockConfig}>
        {children}
      </TrackingProvider>
    );

    renderHook(() => useTrackingContext(), { wrapper });
    
    expect(trackingService.initialize).toHaveBeenCalledWith({ ...mockConfig, autoInitialize: true });
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useTrackingContext());
    }).toThrow('useTrackingContext must be used within a TrackingProvider');
    
    consoleError.mockRestore();
  });
});