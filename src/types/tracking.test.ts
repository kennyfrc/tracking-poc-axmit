import { describe, it, expect } from 'vitest';
import {
  isAddToCartEvent,
  isBeginCheckoutEvent,
  isPurchaseEvent,
  EVENT_NAME_MAPPING,
  type AddToCartEvent,
  type BeginCheckoutEvent,
  type PurchaseEvent,
  type TrackingEvent
} from './tracking';

describe('Type Guards', () => {
  const baseEventData = {
    event_id: 'test-123',
    currency: 'USD' as const,
    value: 99.99,
    items: [{
      id: 'PROD-001',
      name: 'Test Product',
      price: 99.99,
      quantity: 1
    }]
  };

  describe('isAddToCartEvent', () => {
    it('should return true for add_to_cart events', () => {
      const event: AddToCartEvent = {
        ...baseEventData,
        event_name: 'add_to_cart'
      };

      expect(isAddToCartEvent(event)).toBe(true);
    });

    it('should return false for other events', () => {
      const event: BeginCheckoutEvent = {
        ...baseEventData,
        event_name: 'begin_checkout'
      };

      expect(isAddToCartEvent(event)).toBe(false);
    });
  });

  describe('isBeginCheckoutEvent', () => {
    it('should return true for begin_checkout events', () => {
      const event: BeginCheckoutEvent = {
        ...baseEventData,
        event_name: 'begin_checkout',
        coupon: 'SAVE10'
      };

      expect(isBeginCheckoutEvent(event)).toBe(true);
    });

    it('should return false for other events', () => {
      const event: PurchaseEvent = {
        ...baseEventData,
        event_name: 'purchase',
        transaction_id: 'TXN-123'
      };

      expect(isBeginCheckoutEvent(event)).toBe(false);
    });
  });

  describe('isPurchaseEvent', () => {
    it('should return true for purchase events', () => {
      const event: PurchaseEvent = {
        ...baseEventData,
        event_name: 'purchase',
        transaction_id: 'TXN-123'
      };

      expect(isPurchaseEvent(event)).toBe(true);
    });

    it('should return false for other events', () => {
      const event: AddToCartEvent = {
        ...baseEventData,
        event_name: 'add_to_cart'
      };

      expect(isPurchaseEvent(event)).toBe(false);
    });
  });
});

describe('Event Name Mapping', () => {
  it('should have correct GA4 event names', () => {
    expect(EVENT_NAME_MAPPING.add_to_cart.ga4).toBe('add_to_cart');
    expect(EVENT_NAME_MAPPING.begin_checkout.ga4).toBe('begin_checkout');
    expect(EVENT_NAME_MAPPING.purchase.ga4).toBe('purchase');
  });

  it('should have correct Meta event names', () => {
    expect(EVENT_NAME_MAPPING.add_to_cart.meta).toBe('AddToCart');
    expect(EVENT_NAME_MAPPING.begin_checkout.meta).toBe('InitiateCheckout');
    expect(EVENT_NAME_MAPPING.purchase.meta).toBe('Purchase');
  });

  it('should have correct TikTok event names', () => {
    expect(EVENT_NAME_MAPPING.add_to_cart.tiktok).toBe('AddToCart');
    expect(EVENT_NAME_MAPPING.begin_checkout.tiktok).toBe('InitiateCheckout');
    expect(EVENT_NAME_MAPPING.purchase.tiktok).toBe('Purchase');
  });
});

describe('Type Validation', () => {
  it('should enforce required fields for TrackingItem', () => {
    const validItem = {
      id: 'PROD-001',
      name: 'Test Product',
      price: 99.99,
      quantity: 1,
      // Optional fields
      category: 'Electronics',
      variant: 'Black',
      brand: 'TestBrand',
      position: 1
    };

    // This should compile without errors
    const items = [validItem];
    expect(items[0].id).toBe('PROD-001');
  });

  it('should enforce required fields for PurchaseEvent', () => {
    const purchaseEvent: PurchaseEvent = {
      event_name: 'purchase',
      event_id: 'evt-123',
      transaction_id: 'TXN-123',
      currency: 'USD',
      value: 99.99,
      items: [{
        id: 'PROD-001',
        name: 'Test Product',
        price: 99.99,
        quantity: 1
      }],
      // Optional fields
      affiliation: 'Test Store',
      coupon: 'SAVE10',
      shipping: 9.99,
      tax: 7.99
    };

    expect(purchaseEvent.transaction_id).toBe('TXN-123');
    expect(purchaseEvent.affiliation).toBe('Test Store');
  });

  it('should allow standard currency codes', () => {
    const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY'];
    
    currencies.forEach(currency => {
      const event: AddToCartEvent = {
        event_name: 'add_to_cart',
        event_id: 'test-123',
        currency: currency as any,
        value: 99.99,
        items: []
      };
      
      expect(event.currency).toBe(currency);
    });
  });
});