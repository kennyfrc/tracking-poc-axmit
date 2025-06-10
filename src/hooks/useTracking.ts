import React, { useCallback, useEffect, useRef, createContext, useContext, type ReactNode } from 'react';
import { trackingService, type TrackingServiceConfig } from '../lib/tracking-service';
import type { TrackingItem, CurrencyCode, ConsentState, UserData } from '../types/tracking';

// Hook configuration
export interface UseTrackingConfig extends TrackingServiceConfig {
  autoInitialize?: boolean;
}

// Hook return type
export interface UseTrackingReturn {
  // Initialization
  initialize: (config?: TrackingServiceConfig) => void;
  isInitialized: boolean;
  
  // Consent management
  updateConsent: (consent: Partial<ConsentState>) => void;
  acceptAllTracking: () => void;
  rejectAllTracking: () => void;
  
  // User data
  setUserData: (userData: Partial<UserData>) => void;
  
  // E-commerce events
  trackAddToCart: (items: TrackingItem[], currency: CurrencyCode, value: number) => Promise<void>;
  trackBeginCheckout: (items: TrackingItem[], currency: CurrencyCode, value: number, coupon?: string) => Promise<void>;
  trackPurchase: (
    transactionId: string,
    items: TrackingItem[],
    currency: CurrencyCode,
    value: number,
    additionalParams?: {
      affiliation?: string;
      coupon?: string;
      shipping?: number;
      tax?: number;
    }
  ) => Promise<void>;
  
  // Generic event tracking
  trackEvent: (event: Parameters<typeof trackingService.trackEvent>[0]) => Promise<void>;
}

// Main tracking hook
export function useTracking(config?: UseTrackingConfig): UseTrackingReturn {
  const isInitializedRef = useRef(false);

  // Auto-initialize on mount if configured
  useEffect(() => {
    if (config?.autoInitialize && !isInitializedRef.current && !trackingService.isInitialized()) {
      trackingService.initialize(config);
      isInitializedRef.current = true;
    }
  }, [config]);

  // Initialize tracking
  const initialize = useCallback((overrideConfig?: TrackingServiceConfig) => {
    const finalConfig = overrideConfig || config;
    if (finalConfig) {
      trackingService.initialize(finalConfig);
      isInitializedRef.current = true;
    }
  }, [config]);

  // Update consent
  const updateConsent = useCallback((consent: Partial<ConsentState>) => {
    trackingService.updateConsent(consent);
  }, []);

  // Accept all tracking
  const acceptAllTracking = useCallback(() => {
    trackingService.updateConsent({
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted'
    });
  }, []);

  // Reject all tracking
  const rejectAllTracking = useCallback(() => {
    trackingService.updateConsent({
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }, []);

  // Set user data
  const setUserData = useCallback((userData: Partial<UserData>) => {
    trackingService.setUserData(userData);
  }, []);

  // Track add to cart
  const trackAddToCart = useCallback(async (
    items: TrackingItem[],
    currency: CurrencyCode,
    value: number
  ) => {
    await trackingService.trackAddToCart(items, currency, value);
  }, []);

  // Track begin checkout
  const trackBeginCheckout = useCallback(async (
    items: TrackingItem[],
    currency: CurrencyCode,
    value: number,
    coupon?: string
  ) => {
    await trackingService.trackBeginCheckout(items, currency, value, coupon);
  }, []);

  // Track purchase
  const trackPurchase = useCallback(async (
    transactionId: string,
    items: TrackingItem[],
    currency: CurrencyCode,
    value: number,
    additionalParams?: {
      affiliation?: string;
      coupon?: string;
      shipping?: number;
      tax?: number;
    }
  ) => {
    await trackingService.trackPurchase(transactionId, items, currency, value, additionalParams);
  }, []);

  // Generic event tracking
  const trackEvent = useCallback(async (event: Parameters<typeof trackingService.trackEvent>[0]) => {
    await trackingService.trackEvent(event);
  }, []);

  return {
    initialize,
    isInitialized: trackingService.isInitialized(),
    updateConsent,
    acceptAllTracking,
    rejectAllTracking,
    setUserData,
    trackAddToCart,
    trackBeginCheckout,
    trackPurchase,
    trackEvent
  };
}

// Context-based tracking provider hook for sharing tracking across components
const TrackingContext = createContext<UseTrackingReturn | null>(null);

export interface TrackingProviderProps {
  children: ReactNode;
  config: UseTrackingConfig;
}

export function TrackingProvider({ children, config }: TrackingProviderProps): JSX.Element {
  const tracking = useTracking({ ...config, autoInitialize: true });

  return React.createElement(
    TrackingContext.Provider,
    { value: tracking },
    children
  );
}

// Hook to use tracking from context
export function useTrackingContext(): UseTrackingReturn {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTrackingContext must be used within a TrackingProvider');
  }
  return context;
}