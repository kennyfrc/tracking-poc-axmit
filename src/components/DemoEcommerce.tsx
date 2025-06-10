import { useState } from 'react';
import { useTrackingContext } from '../hooks/useTracking';
import type { TrackingItem, CurrencyCode } from '../types/tracking';

// Demo product data
const DEMO_PRODUCTS: TrackingItem[] = [
  {
    id: 'PROD-001',
    name: 'Premium Wireless Headphones',
    category: 'Electronics/Audio',
    brand: 'AudioTech',
    price: 199.99,
    quantity: 1,
    variant: 'Black'
  },
  {
    id: 'PROD-002',
    name: 'Smart Fitness Watch',
    category: 'Electronics/Wearables',
    brand: 'FitTech',
    price: 299.99,
    quantity: 1,
    variant: 'Silver'
  },
  {
    id: 'PROD-003',
    name: 'Portable Bluetooth Speaker',
    category: 'Electronics/Audio',
    brand: 'SoundWave',
    price: 79.99,
    quantity: 1,
    variant: 'Blue'
  },
  {
    id: 'PROD-004',
    name: 'USB-C Hub Adapter',
    category: 'Electronics/Accessories',
    brand: 'ConnectPro',
    price: 49.99,
    quantity: 1,
    variant: '7-in-1'
  }
];

interface CartItem extends TrackingItem {
  cartId: string;
}

export function DemoEcommerce() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [lastTransactionId, setLastTransactionId] = useState<string>('');
  const [couponCode, setCouponCode] = useState('');
  const [eventLog, setEventLog] = useState<string[]>([]);

  const { trackAddToCart, setUserData } = useTrackingContext();

  // Helper to log events
  const logEvent = (message: string) => {
    setEventLog(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 9)]);
  };

  // Calculate cart totals
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const currency: CurrencyCode = 'PHP';

  // Add to cart handler
  const handleAddToCart = async (product: TrackingItem) => {
    const cartId = `cart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const cartItem: CartItem = { ...product, cartId };
    
    setCart(prev => [...prev, cartItem]);
    
    // Track add to cart event
    await trackAddToCart([product], currency, product.price * product.quantity);
    logEvent(`Added to cart: ${product.name} ($${product.price})`);
  };

  // Update quantity
  const updateQuantity = (cartId: string, change: number) => {
    setCart(prev => prev.map(item => 
      item.cartId === cartId 
        ? { ...item, quantity: Math.max(1, item.quantity + change) }
        : item
    ));
  };

  // Remove from cart
  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  // Begin checkout
  const handleBeginCheckout = async () => {
    if (cart.length === 0) return;

    try {
      // Call the actual server checkout endpoint
      const response = await fetch('http://localhost:3001/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          user: {
            user_id: 'demo-user-123',
            email: 'demo@example.com',
            phone: '+1234567890'
          }
        })
      });

      const data = await response.json();
      logEvent(`✅ Checkout started: ${data.checkoutId}`);
      logEvent(`📊 Server tracked begin_checkout event`);
      setIsCheckingOut(true);
    } catch (error) {
      logEvent(`❌ Checkout error: ${error}`);
    }
  };

  // Complete purchase
  const handleCompletePurchase = async () => {
    if (cart.length === 0) return;

    const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      // Call the actual server purchase endpoint
      const response = await fetch('http://localhost:3001/api/purchase/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentId,
          items: cart,
          user: {
            user_id: 'demo-user-123',
            email: 'demo@example.com',
            phone: '+1234567890'
          }
        })
      });

      const data = await response.json();
      logEvent(`✅ Purchase completed: ${data.orderId}`);
      logEvent(`📊 Server tracked purchase event`);
      logEvent(`💰 Total: ₱${cartTotal.toFixed(2)}`);
      
      setLastTransactionId(data.orderId);
      setPurchaseComplete(true);
      setCart([]);
      setIsCheckingOut(false);
      setCouponCode('');
    } catch (error) {
      logEvent(`❌ Purchase error: ${error}`);
    }

  };

  // Set demo user data
  const handleSetUserData = () => {
    setUserData({
      user_id: 'demo-user-123',
      email: 'demo@example.com',
      phone: '+1234567890'
    });
    logEvent('User data set for advanced matching');
  };

  return (
    <div className="demo-ecommerce">
      <h2>E-commerce Tracking Demo</h2>
      
      {/* User Data Section */}
      <div className="section">
        <h3>User Data (for Advanced Matching)</h3>
        <button onClick={handleSetUserData}>Set Demo User Data</button>
      </div>

      {/* Products Section */}
      <div className="section">
        <h3>Products</h3>
        <div className="products-grid">
          {DEMO_PRODUCTS.map(product => (
            <div key={product.id} className="product-card">
              <h4>{product.name}</h4>
              <p className="brand">{product.brand}</p>
              <p className="category">{product.category}</p>
              <p className="price">${product.price}</p>
              <button onClick={() => handleAddToCart(product)}>Add to Cart</button>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Section */}
      <div className="section">
        <h3>Shopping Cart ({cart.length} items)</h3>
        {cart.length === 0 ? (
          <p>Your cart is empty</p>
        ) : (
          <>
            <div className="cart-items">
              {cart.map(item => (
                <div key={item.cartId} className="cart-item">
                  <div className="item-info">
                    <h4>{item.name}</h4>
                    <p>{item.brand} - {item.variant}</p>
                  </div>
                  <div className="item-controls">
                    <button onClick={() => updateQuantity(item.cartId, -1)}>-</button>
                    <span className="quantity">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartId, 1)}>+</button>
                    <span className="item-total">${(item.price * item.quantity).toFixed(2)}</span>
                    <button onClick={() => removeFromCart(item.cartId)} className="remove">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="cart-summary">
              <div className="coupon-section">
                <input
                  type="text"
                  placeholder="Coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                />
              </div>
              <p className="total">Subtotal: ${cartTotal.toFixed(2)}</p>
              {!isCheckingOut && (
                <button onClick={handleBeginCheckout} className="checkout-btn">
                  Proceed to Checkout
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Checkout Section */}
      {isCheckingOut && !purchaseComplete && (
        <div className="section checkout-section">
          <h3>Checkout</h3>
          <div className="order-summary">
            <p>Subtotal: ${cartTotal.toFixed(2)}</p>
            <p>Shipping: $9.99</p>
            <p>Tax (8%): ${(cartTotal * 0.08).toFixed(2)}</p>
            {couponCode && <p>Coupon: {couponCode}</p>}
            <p className="total">Total: ${(cartTotal + 9.99 + (cartTotal * 0.08)).toFixed(2)}</p>
          </div>
          <button onClick={handleCompletePurchase} className="purchase-btn">
            Complete Purchase
          </button>
          <button onClick={() => setIsCheckingOut(false)} className="cancel-btn">
            Cancel
          </button>
        </div>
      )}

      {/* Success Section */}
      {purchaseComplete && (
        <div className="section success-section">
          <h3>✅ Purchase Complete!</h3>
          <p>Transaction ID: {lastTransactionId}</p>
          <button onClick={() => setPurchaseComplete(false)}>Continue Shopping</button>
        </div>
      )}

      {/* How Tracking Works */}
      <div className="section info-section">
        <h3>🚀 How This Demo Works</h3>
        <div className="info-content">
          <p><strong>Frontend:</strong> Tracks <code>add_to_cart</code> events when you click "Add to Cart"</p>
          <p><strong>Server:</strong> Automatically tracks conversion events:</p>
          <ul>
            <li>✅ <code>begin_checkout</code> tracked when you click "Proceed to Checkout"</li>
            <li>✅ <code>purchase</code> tracked when you click "Complete Purchase"</li>
          </ul>
          <p>Check the server console to see the tracking API calls in real-time!</p>
        </div>
      </div>

      {/* Event Log */}
      <div className="section event-log">
        <h3>Tracking Event Log</h3>
        <div className="log-entries">
          {eventLog.length === 0 ? (
            <p>No events tracked yet</p>
          ) : (
            eventLog.map((entry, index) => (
              <div key={index} className="log-entry">{entry}</div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .demo-ecommerce {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .section {
          margin-bottom: 30px;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 8px;
        }

        .section h3 {
          margin-top: 0;
        }

        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
        }

        .product-card {
          background: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .product-card h4 {
          margin: 0 0 10px 0;
        }

        .product-card .brand {
          color: #666;
          font-size: 14px;
          margin: 5px 0;
        }

        .product-card .category {
          color: #999;
          font-size: 12px;
          margin: 5px 0;
        }

        .product-card .price {
          font-size: 20px;
          font-weight: bold;
          color: #0066cc;
          margin: 10px 0;
        }

        button {
          background: #0066cc;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        button:hover {
          background: #0052a3;
        }

        .cart-items {
          background: white;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }

        .cart-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }

        .cart-item:last-child {
          border-bottom: none;
        }

        .item-info h4 {
          margin: 0 0 5px 0;
        }

        .item-info p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .item-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .quantity {
          font-weight: bold;
          padding: 0 10px;
        }

        .item-total {
          font-weight: bold;
          margin-left: 20px;
        }

        .remove {
          background: #dc3545;
          margin-left: 10px;
        }

        .remove:hover {
          background: #c82333;
        }

        .cart-summary {
          background: white;
          padding: 15px;
          border-radius: 8px;
          text-align: right;
        }

        .coupon-section {
          margin-bottom: 15px;
        }

        .coupon-section input {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          width: 200px;
        }

        .total {
          font-size: 20px;
          font-weight: bold;
          margin: 15px 0;
        }

        .checkout-btn, .purchase-btn {
          background: #28a745;
          font-size: 16px;
          padding: 12px 24px;
        }

        .checkout-btn:hover, .purchase-btn:hover {
          background: #218838;
        }

        .cancel-btn {
          background: #6c757d;
          margin-left: 10px;
        }

        .cancel-btn:hover {
          background: #5a6268;
        }

        .checkout-section, .success-section {
          background: #e8f5e9;
        }

        .order-summary {
          background: white;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .info-section {
          background: #e3f2fd;
          border: 2px solid #2196f3;
        }

        .info-content {
          background: white;
          padding: 15px;
          border-radius: 8px;
          margin-top: 10px;
        }

        .info-content code {
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
        }

        .event-log {
          background: #f8f9fa;
        }

        .log-entries {
          background: white;
          padding: 15px;
          border-radius: 8px;
          max-height: 300px;
          overflow-y: auto;
        }

        .log-entry {
          padding: 5px 0;
          font-family: monospace;
          font-size: 14px;
          border-bottom: 1px solid #eee;
        }

        .log-entry:last-child {
          border-bottom: none;
        }
      `}</style>
    </div>
  );
}