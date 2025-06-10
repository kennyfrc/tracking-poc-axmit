import type { GtagArgs, TrackingEvent, EVENT_NAME_MAPPING } from '../types/tracking';

// Extend Window interface to include dataLayer and gtag
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Initialize dataLayer if it doesn't exist
if (typeof window !== 'undefined') {
  window.dataLayer = window.dataLayer || [];
}

// Type-safe gtag function
export function gtag(...args: GtagArgs): void {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push(arguments);
  }
}

// Helper to generate unique event IDs for deduplication
export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Initialize Google Tag with measurement ID
export function initializeGoogleTag(measurementId: string): void {
  // Load gtag script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  // Initialize gtag only if not already defined
  if (!window.gtag) {
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
  }

  // Set up gtag with current date
  const gtagFn = window.gtag || gtag;
  gtagFn('js', new Date());

  // Configure measurement ID
  gtagFn('config', measurementId, {
    send_page_view: true
  });
}

// Send tracking event to Google Analytics
export function sendTrackingEvent(event: TrackingEvent): void {
  const { event_name, event_id, timestamp, ...params } = event;
  
  // Send to GA4 with proper event name
  // Use window.gtag if available (for testing), otherwise use our gtag function
  const gtagFn = window.gtag || gtag;
  gtagFn('event', event_name, {
    event_id,
    timestamp: timestamp || Date.now(),
    ...params
  });
}

// Get or generate GA4 client ID
export function getClientId(): string {
  // In a real implementation, you would retrieve this from GA4's cookie
  // For POC, we'll generate a persistent one
  const storageKey = 'ga_client_id';
  let clientId = localStorage.getItem(storageKey);
  
  if (!clientId) {
    clientId = `${Date.now()}.${Math.random().toString(36).substring(2)}`;
    localStorage.setItem(storageKey, clientId);
  }
  
  return clientId;
}

// Environment variables type
export interface TrackingConfig {
  GA_MEASUREMENT_ID: string;
  GA_API_SECRET?: string;
  META_PIXEL_ID?: string;
  META_ACCESS_TOKEN?: string;
  TIKTOK_PIXEL_ID?: string;
  TIKTOK_ACCESS_TOKEN?: string;
  SERVER_ENDPOINT?: string;
}