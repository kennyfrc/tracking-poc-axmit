import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { TrackingProvider } from './hooks/useTracking';
import { DemoEcommerce } from './components/DemoEcommerce';
import type { TrackingServiceConfig } from './lib/tracking-service';
import './App.css';

// Load tracking configuration from environment variables
const trackingConfig: TrackingServiceConfig = {
  ga4: import.meta.env.VITE_GA_MEASUREMENT_ID ? {
    measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID,
    apiSecret: import.meta.env.VITE_GA_API_SECRET,
  } : undefined,
  meta: import.meta.env.VITE_META_PIXEL_ID ? {
    pixelId: import.meta.env.VITE_META_PIXEL_ID,
    accessToken: import.meta.env.VITE_META_ACCESS_TOKEN,
  } : undefined,
  tiktok: import.meta.env.VITE_TIKTOK_PIXEL_ID ? {
    pixelId: import.meta.env.VITE_TIKTOK_PIXEL_ID,
    accessToken: import.meta.env.VITE_TIKTOK_ACCESS_TOKEN,
  } : undefined,
  serverEndpoint: import.meta.env.VITE_SERVER_ENDPOINT,
  debug: import.meta.env.VITE_DEBUG_MODE === 'true',
};

// Home page component
function Home() {
  return (
    <div className="page">
      <h1>Unified Ad-Event Tracking POC</h1>
      <p>
        This is a proof of concept for implementing unified tracking across Google Analytics 4, 
        Meta (Facebook), and TikTok platforms with both client-side and server-side tracking.
      </p>
      
      <div className="features">
        <h2>Features Implemented:</h2>
        <ul>
          <li>✅ TypeScript with strict typing for all tracking events</li>
          <li>✅ Google Analytics 4 (gtag.js) integration</li>
          <li>✅ Meta Pixel integration</li>
          <li>✅ TikTok Pixel integration</li>
          <li>✅ GDPR-compliant consent management</li>
          <li>✅ Event deduplication support</li>
          <li>✅ React hooks for easy integration</li>
          <li>✅ E-commerce event tracking (add to cart, checkout, purchase)</li>
          <li>✅ Server-side tracking preparation</li>
        </ul>
      </div>

      <div className="config-status">
        <h2>Configuration Status:</h2>
        <ul>
          <li>GA4: {trackingConfig.ga4 ? '✅ Configured' : '❌ Not configured (set VITE_GA_MEASUREMENT_ID)'}</li>
          <li>Meta: {trackingConfig.meta ? '✅ Configured' : '❌ Not configured (set VITE_META_PIXEL_ID)'}</li>
          <li>TikTok: {trackingConfig.tiktok ? '✅ Configured' : '❌ Not configured (set VITE_TIKTOK_PIXEL_ID)'}</li>
          <li>Debug Mode: {trackingConfig.debug ? '✅ Enabled' : '❌ Disabled'}</li>
        </ul>
      </div>

      <div className="navigation">
        <Link to="/demo" className="demo-link">
          Go to E-commerce Demo →
        </Link>
      </div>
    </div>
  );
}

// Main App component
function App() {
  return (
    <TrackingProvider config={trackingConfig}>
      <BrowserRouter>
        <div className="app">
          <nav className="navbar">
            <div className="nav-content">
              <Link to="/" className="nav-brand">Tracking POC</Link>
              <div className="nav-links">
                <Link to="/">Home</Link>
                <Link to="/demo">Demo</Link>
              </div>
            </div>
          </nav>

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/demo" element={<DemoEcommerce />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TrackingProvider>
  );
}

export default App;