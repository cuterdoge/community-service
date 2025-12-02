// Donation packages data - loaded from database
let donationPackages = [];

// Shopping cart
let donationCart = {};

// Initialize donations page
async function initializeDonations() {
    await loadDonationPackages();
    renderDonationPackages();
    updateCartDisplay();
}

// Load donation packages from database
async function loadDonationPackages() {
    try {
        const response = await fetch('/donationPackages');
        const result = await response.json();
        
        if (result.success) {
            donationPackages = result.packages.map(pkg => ({
                id: pkg.package_id,
                name: pkg.name,
                icon: pkg.icon,
                price: parseFloat(pkg.price),
                description: pkg.description,
                impact: pkg.impact_description,
                details: pkg.description
            }));
        } else {
            console.error('Failed to load donation packages');
            showNotification('Failed to load donation packages');
        }
    } catch (error) {
        console.error('Error loading donation packages:', error);
        showNotification('Error loading donation packages');
    }
}

// Render donation packages
function renderDonationPackages() {
    const container = document.getElementById('donation-packages');
    
    container.innerHTML = donationPackages.map(pkg => `
        <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
            <div class="donation-card">
                <div class="donation-icon">${pkg.icon}</div>
                <h4 class="text-center">${pkg.name}</h4>
                <p class="text-center text-muted">${pkg.description}</p>
                <div class="donation-amount text-center">RM ${pkg.price}</div>
                <div class="donation-impact">${pkg.impact}</div>
                <p class="text-sm text-muted">${pkg.details}</p>
                
                <div class="quantity-selector">
                    <button class="quantity-btn" onclick="updateQuantity('${pkg.id}', -1)">-</button>
                    <input type="number" class="quantity-input" id="qty-${pkg.id}" value="0" min="0" 
                           onchange="setQuantity('${pkg.id}', this.value)">
                    <button class="quantity-btn" onclick="updateQuantity('${pkg.id}', 1)">+</button>
                </div>
                
                <button class="btn donate-btn w-100" onclick="addToCart('${pkg.id}')">
                    Add to Cart
                </button>
            </div>
        </div>
    `).join('');
}

// Update quantity
function updateQuantity(packageId, change) {
    const input = document.getElementById(`qty-${packageId}`);
    const currentValue = parseInt(input.value) || 0;
    const newValue = Math.max(0, currentValue + change);
    input.value = newValue;
    setQuantity(packageId, newValue);
}

// Set specific quantity
function setQuantity(packageId, quantity) {
    const qty = Math.max(0, parseInt(quantity) || 0);
    document.getElementById(`qty-${packageId}`).value = qty;
    
    if (qty > 0) {
        donationCart[packageId] = qty;
    } else {
        delete donationCart[packageId];
    }
    
    updateCartDisplay();
}

// Add to cart
function addToCart(packageId) {
    const quantity = parseInt(document.getElementById(`qty-${packageId}`).value) || 0;
    
    if (quantity <= 0) {
        alert('Please select a quantity first');
        return;
    }
    
    donationCart[packageId] = (donationCart[packageId] || 0) + quantity;
    document.getElementById(`qty-${packageId}`).value = donationCart[packageId];
    
    updateCartDisplay();
    
    // Show success message
    const pkg = donationPackages.find(p => p.id === packageId);
    showNotification(`Added ${quantity}x ${pkg.name} to cart!`);
}

// Update cart display
function updateCartDisplay() {
    const cartSummary = document.getElementById('cart-summary');
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const mobileTotal = document.getElementById('mobile-total');
    const mobileTotalAmount = document.getElementById('mobile-total-amount');
    
    const cartEntries = Object.entries(donationCart);
    const hasItems = cartEntries.length > 0;
    
    if (hasItems) {
        // Show cart summary
        cartSummary.style.display = 'block';
        mobileTotal.style.display = 'block';
        
        // Render cart items
        cartItems.innerHTML = cartEntries.map(([packageId, quantity]) => {
            const pkg = donationPackages.find(p => p.id === packageId);
            const subtotal = pkg.price * quantity;
            
            return `
                <div class="row align-items-center mb-3 pb-3 border-bottom">
                    <div class="col-md-6">
                        <strong>${pkg.name}</strong><br>
                        <small class="text-muted">${pkg.impact}</small>
                    </div>
                    <div class="col-md-2 text-center">
                        <span class="badge bg-primary">${quantity}x</span>
                    </div>
                    <div class="col-md-2 text-center">
                        <strong>RM ${subtotal}</strong>
                    </div>
                    <div class="col-md-2 text-center">
                        <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart('${packageId}')">
                            Remove
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Calculate total
        const total = cartEntries.reduce((sum, [packageId, quantity]) => {
            const pkg = donationPackages.find(p => p.id === packageId);
            return sum + (pkg.price * quantity);
        }, 0);
        
        cartTotal.textContent = `Total: RM ${total}`;
        mobileTotalAmount.textContent = `RM ${total}`;
        
    } else {
        cartSummary.style.display = 'none';
        mobileTotal.style.display = 'none';
    }
}

// Remove from cart
function removeFromCart(packageId) {
    delete donationCart[packageId];
    document.getElementById(`qty-${packageId}`).value = 0;
    updateCartDisplay();
    
    const pkg = donationPackages.find(p => p.id === packageId);
    showNotification(`Removed ${pkg.name} from cart`);
}

// Clear cart
function clearCart() {
    donationCart = {};
    
    // Reset all quantity inputs
    donationPackages.forEach(pkg => {
        document.getElementById(`qty-${pkg.id}`).value = 0;
    });
    
    updateCartDisplay();
    showNotification('Cart cleared');
}

// Show cart summary (mobile)
function showCartSummary() {
    const cartSummary = document.getElementById('cart-summary');
    cartSummary.scrollIntoView({ behavior: 'smooth' });
}

// Proceed to checkout
function proceedToCheckout() {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        if (confirm('You need to login to make a donation. Would you like to login now?')) {
            // Store cart in sessionStorage for after login
            sessionStorage.setItem('pendingDonationCart', JSON.stringify(donationCart));
            window.location.href = 'login.html';
        }
        return;
    }
    
    // Calculate total and prepare donation data
    const cartEntries = Object.entries(donationCart);
    const total = cartEntries.reduce((sum, [packageId, quantity]) => {
        const pkg = donationPackages.find(p => p.id === packageId);
        return sum + (pkg.price * quantity);
    }, 0);
    
    const donationData = {
        items: cartEntries.map(([packageId, quantity]) => {
            const pkg = donationPackages.find(p => p.id === packageId);
            return {
                id: packageId,
                name: pkg.name,
                price: pkg.price,
                quantity: quantity,
                impact: pkg.impact
            };
        }),
        total: total,
        date: new Date().toISOString(),
        transactionId: generateTransactionId()
    };
    
    // Store donation for processing
    sessionStorage.setItem('currentDonation', JSON.stringify(donationData));
    
    // Redirect to payment page
    window.location.href = 'donation-checkout.html';
}

// Generate transaction ID
function generateTransactionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `DON-${timestamp}-${random}`;
}

// Show notification
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        font-weight: 500;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Check for pending donation cart after login
document.addEventListener('DOMContentLoaded', function() {
    const pendingCart = sessionStorage.getItem('pendingDonationCart');
    if (pendingCart && getCurrentUser()) {
        donationCart = JSON.parse(pendingCart);
        sessionStorage.removeItem('pendingDonationCart');
        
        // Update quantity inputs
        Object.entries(donationCart).forEach(([packageId, quantity]) => {
            const input = document.getElementById(`qty-${packageId}`);
            if (input) input.value = quantity;
        });
        
        updateCartDisplay();
        showNotification('Welcome back! Your cart has been restored.');
    }
});