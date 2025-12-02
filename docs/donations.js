// Donation packages data - loaded from database
let donationPackages = [];

// Shopping cart
let donationCart = {};

// Initialize donations page
async function initializeDonations() {
    console.log('Initializing donations page...');
    
    // Show loading state immediately
    const container = document.getElementById('donation-packages');
    if (container) {
        container.innerHTML = `
            <div class="col-12">
                <div class="text-center p-5">
                    <h3>Loading donation packages...</h3>
                    <p>Please wait while we load the available donation options.</p>
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Try to load from database first, then fallback
    const loadedFromDB = await loadDonationPackages();
    
    // Always render packages (either from DB or fallback)
    renderDonationPackages();
    updateCartDisplay();
    
    if (loadedFromDB) {
        console.log('Donations page initialized with database packages');
    } else {
        console.log('Donations page initialized with fallback packages');
    }
}

// Load donation packages from database
async function loadDonationPackages() {
    console.log('Attempting to load donation packages from server...');
    
    try {
        const response = await fetch('/donationPackages');
        console.log('Server response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Server response data:', result);
        
        if (result.success && result.packages && result.packages.length > 0) {
            donationPackages = result.packages.map(pkg => ({
                id: pkg.package_id,
                name: pkg.name,
                icon: pkg.icon,
                price: parseFloat(pkg.price),
                description: pkg.description,
                impact: pkg.impact_description,
                details: pkg.description
            }));
            console.log('Successfully loaded donation packages from database:', donationPackages);
            return true;
        } else {
            console.error('Failed to load donation packages or no packages found:', result);
            loadFallbackPackages();
            return false;
        }
    } catch (error) {
        console.error('Error loading donation packages from server:', error);
        console.log('Falling back to hardcoded packages...');
        loadFallbackPackages();
        return false;
    }
}

// Helper function to get image name from package title
function getPackageImageName(title) {
    const imageMap = {
        'Water Supply': 'water-supply.jpg',
        'Blanket Bundle': 'blanket-bundle.jpg', 
        'Cooking Oil': 'cooking-oil.jpg',
        'Rice Supply': 'rice-supply.jpg',
        'Medical Kit': 'medical-kit.jpg',
        'School Supplies': 'school-supplies.jpg',
        'Emergency Food': 'emergency-food.jpg',
        'Hygiene Kit': 'hygiene-kit.jpg'
    };
    return imageMap[title] || 'donation-default.jpg';
}

// Fallback donation packages if database fails
function loadFallbackPackages() {
    console.log('Loading fallback donation packages...');
    donationPackages = [
        {
            id: 'water-supply',
            name: 'Water Supply Package',
            icon: '💧',
            price: 150,
            description: 'Clean drinking water for families',
            impact: 'Provides water for 30 families for 1 week',
            details: 'Essential clean water supply including bottles and purification tablets'
        },
        {
            id: 'blanket-bundle',
            name: 'Blanket Bundle',
            icon: '🛏️',
            price: 250,
            description: 'Warm blankets for shelter',
            impact: 'Provides 10 warm blankets for families in need',
            details: 'High-quality blankets to keep families warm during cold nights'
        },
        {
            id: 'cooking-oil',
            name: 'Cooking Oil Package',
            icon: '🫗',
            price: 120,
            description: 'Essential cooking oil supply',
            impact: 'Provides 10 bottles for community kitchen',
            details: 'Premium cooking oil to help prepare nutritious meals'
        },
        {
            id: 'rice-supply',
            name: 'Rice Supply Package',
            icon: '🍚',
            price: 300,
            description: 'Staple food for families',
            impact: 'Feeds 15 families for 1 month',
            details: '20kg bags of high-quality rice for sustained nutrition'
        },
        {
            id: 'medical-kit',
            name: 'Medical Kit Bundle',
            icon: '🏥',
            price: 500,
            description: 'Complete medical supplies',
            impact: 'Equips clinic with essential medical supplies',
            details: 'First aid supplies, medicines, and medical equipment'
        },
        {
            id: 'school-supplies',
            name: 'School Supply Package',
            icon: '📚',
            price: 400,
            description: 'Educational materials for children',
            impact: 'Provides materials for 20 children',
            details: 'Books, stationery, backpacks, and learning materials'
        },
        {
            id: 'emergency-food',
            name: 'Emergency Food Package',
            icon: '🥫',
            price: 800,
            description: 'Nutritious emergency meals',
            impact: 'Feeds 50 people for 1 week',
            details: 'Ready-to-eat meals and essential food items for emergencies'
        },
        {
            id: 'hygiene-kit',
            name: 'Hygiene Kit Bundle',
            icon: '🧼',
            price: 350,
            description: 'Personal care essentials',
            impact: 'Provides hygiene items for 25 families',
            details: 'Soap, toothbrushes, toothpaste, and personal hygiene products'
        }
    ];
    
    if (typeof showNotification === 'function') {
        showNotification('Using offline donation packages', 'warning');
    }
}

// Render donation packages
function renderDonationPackages() {
    const container = document.getElementById('donation-packages');
    
    if (!donationPackages || donationPackages.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="text-center p-5">
                    <h3>Loading donation packages...</h3>
                    <p>Please wait while we load the available donation options.</p>
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = donationPackages.map(pkg => `
        <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
            <div class="card card--donation">
                <div class="card__header">
                    <div class="donation__image">
                        <img src="images/${getPackageImageName(pkg.name)}" 
                             alt="${pkg.name}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                             style="display: block;">
                        <div class="donation__image--placeholder" style="display: none;">💝</div>
                    </div>
                    <h4 class="donation__title u-text-center">${pkg.name}</h4>
                </div>
                <div class="card__body">
                    <p class="donation__description u-text-center">${pkg.description}</p>
                    <div class="donation__amount u-text-center">RM ${pkg.price}</div>
                    <div class="donation__impact">
                        <strong>Impact:</strong> ${pkg.impact}
                    </div>
                    <p class="u-text-center" style="font-size: 0.9rem; color: var(--text-secondary);">${pkg.details}</p>
                    
                    <div class="donation__quantity">
                        <button class="donation__quantity-btn" onclick="updateQuantity('${pkg.id}', -1)">-</button>
                        <input type="number" class="donation__quantity-input" id="qty-${pkg.id}" value="0" min="0" 
                               onchange="setQuantity('${pkg.id}', this.value)">
                        <button class="donation__quantity-btn" onclick="updateQuantity('${pkg.id}', 1)">+</button>
                    </div>
                </div>
                <div class="card__footer">
                    <button class="button button--block" onclick="addToCart('${pkg.id}')">
                        Add to Cart
                    </button>
                </div>
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
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    
    const bgColor = type === 'warning' ? '#ffc107' : (type === 'error' ? '#dc3545' : '#28a745');
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        font-weight: 500;
    `;
    notification.textContent = message;
    
    // Ensure DOM is ready before appending
    if (document.body) {
        document.body.appendChild(notification);
    } else {
        // If body not ready, wait for it
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(notification);
        });
    }
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.remove();
        }
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