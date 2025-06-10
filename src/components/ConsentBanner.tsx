import { useState, useEffect } from 'react';
import { useTrackingContext } from '../hooks/useTracking';
import type { ConsentState } from '../types/tracking';

export interface ConsentBannerProps {
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
}

export function ConsentBanner({ 
  privacyPolicyUrl = '/privacy-policy', 
  cookiePolicyUrl = '/cookie-policy' 
}: ConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [customConsent, setCustomConsent] = useState<ConsentState>({
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });
  
  const { updateConsent, acceptAllTracking, rejectAllTracking } = useTrackingContext();

  // Check if consent has been given before
  useEffect(() => {
    const consentGiven = localStorage.getItem('tracking_consent');
    if (!consentGiven) {
      setIsVisible(true);
    } else {
      // Restore previous consent state
      try {
        const savedConsent = JSON.parse(consentGiven) as ConsentState;
        updateConsent(savedConsent);
      } catch (e) {
        console.error('Failed to parse saved consent', e);
      }
    }
  }, [updateConsent]);

  const handleAcceptAll = () => {
    acceptAllTracking();
    localStorage.setItem('tracking_consent', JSON.stringify({
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted'
    }));
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    rejectAllTracking();
    localStorage.setItem('tracking_consent', JSON.stringify({
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    }));
    setIsVisible(false);
  };

  const handleSaveCustom = () => {
    updateConsent(customConsent);
    localStorage.setItem('tracking_consent', JSON.stringify(customConsent));
    setIsVisible(false);
  };

  const toggleConsent = (key: keyof ConsentState) => {
    setCustomConsent(prev => ({
      ...prev,
      [key]: prev[key] === 'granted' ? 'denied' : 'granted'
    }));
  };

  if (!isVisible) return null;

  return (
    <div className="consent-banner">
      <div className="consent-content">
        <h3>We value your privacy</h3>
        <p>
          We use cookies and similar technologies to enhance your experience, analyze site traffic, 
          and serve personalized ads. By clicking "Accept All", you consent to our use of cookies.
        </p>
        
        <div className="consent-links">
          <a href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          <a href={cookiePolicyUrl} target="_blank" rel="noopener noreferrer">
            Cookie Policy
          </a>
        </div>

        {showDetails && (
          <div className="consent-details">
            <h4>Manage Cookie Preferences</h4>
            
            <div className="consent-option">
              <label>
                <input
                  type="checkbox"
                  checked={customConsent.analytics_storage === 'granted'}
                  onChange={() => toggleConsent('analytics_storage')}
                />
                <span>Analytics Cookies</span>
              </label>
              <p>Help us understand how visitors interact with our website.</p>
            </div>

            <div className="consent-option">
              <label>
                <input
                  type="checkbox"
                  checked={customConsent.ad_storage === 'granted'}
                  onChange={() => toggleConsent('ad_storage')}
                />
                <span>Advertising Cookies</span>
              </label>
              <p>Used to deliver relevant ads and track ad campaign performance.</p>
            </div>

            <div className="consent-option">
              <label>
                <input
                  type="checkbox"
                  checked={customConsent.ad_user_data === 'granted'}
                  onChange={() => toggleConsent('ad_user_data')}
                />
                <span>User Data for Ads</span>
              </label>
              <p>Allow sending user data to advertising partners for better targeting.</p>
            </div>

            <div className="consent-option">
              <label>
                <input
                  type="checkbox"
                  checked={customConsent.ad_personalization === 'granted'}
                  onChange={() => toggleConsent('ad_personalization')}
                />
                <span>Ad Personalization</span>
              </label>
              <p>Allow personalized ads based on your interests and behavior.</p>
            </div>
          </div>
        )}

        <div className="consent-actions">
          <button onClick={handleRejectAll} className="btn-reject">
            Reject All
          </button>
          <button onClick={() => setShowDetails(!showDetails)} className="btn-manage">
            {showDetails ? 'Hide Details' : 'Manage Preferences'}
          </button>
          {showDetails && (
            <button onClick={handleSaveCustom} className="btn-save">
              Save Preferences
            </button>
          )}
          <button onClick={handleAcceptAll} className="btn-accept">
            Accept All
          </button>
        </div>
      </div>

      <style>{`
        .consent-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
          z-index: 9999;
          padding: 20px;
        }

        .consent-content {
          max-width: 1200px;
          margin: 0 auto;
        }

        .consent-content h3 {
          margin: 0 0 10px 0;
          font-size: 20px;
        }

        .consent-content p {
          margin: 0 0 15px 0;
          color: #666;
        }

        .consent-links {
          margin-bottom: 15px;
        }

        .consent-links a {
          color: #0066cc;
          margin-right: 15px;
          text-decoration: none;
        }

        .consent-links a:hover {
          text-decoration: underline;
        }

        .consent-details {
          margin: 20px 0;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 5px;
        }

        .consent-details h4 {
          margin: 0 0 15px 0;
          font-size: 16px;
        }

        .consent-option {
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #ddd;
        }

        .consent-option:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .consent-option label {
          display: flex;
          align-items: center;
          font-weight: bold;
          cursor: pointer;
        }

        .consent-option input[type="checkbox"] {
          margin-right: 10px;
          cursor: pointer;
        }

        .consent-option p {
          margin: 5px 0 0 25px;
          font-size: 14px;
          color: #666;
        }

        .consent-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .consent-actions button {
          padding: 10px 20px;
          border: none;
          border-radius: 5px;
          font-size: 14px;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .consent-actions button:hover {
          opacity: 0.9;
        }

        .btn-accept {
          background: #0066cc;
          color: white;
        }

        .btn-reject {
          background: #f5f5f5;
          color: #333;
        }

        .btn-manage {
          background: #f5f5f5;
          color: #333;
        }

        .btn-save {
          background: #28a745;
          color: white;
        }

        @media (max-width: 768px) {
          .consent-actions {
            justify-content: stretch;
          }

          .consent-actions button {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}