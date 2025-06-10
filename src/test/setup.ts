import '@testing-library/jest-dom';

// Mock window.gtag, fbq, and ttq for tests
beforeEach(() => {
  // Mock Google Tag
  window.gtag = vi.fn();
  window.dataLayer = [];

  // Mock Meta Pixel
  window.fbq = vi.fn();
  window._fbq = vi.fn();

  // Mock TikTok Pixel with proper array functionality
  const ttqArray: any[] = [];
  ttqArray.push = vi.fn().mockImplementation((...args) => Array.prototype.push.apply(ttqArray, args));
  ttqArray._initialized = true;
  (window as any).ttq = ttqArray;
  
  window.ttq = {
    load: vi.fn(),
    page: vi.fn(),
    track: vi.fn(),
    identify: vi.fn(),
  };

  // Mock localStorage
  const localStorageMock: Storage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  };
  global.localStorage = localStorageMock;

  // Mock fetch
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});