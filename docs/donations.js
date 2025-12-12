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
        container.innerHTML = DOMPurify.sanitize(`
            <div class="col-12">
                <div class="text-center p-5">
                    <h3>Loading donation packages...</h3>
                    <p>Please wait while we load the available donation options.</p>
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        `);
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
        const response = await fetch('/donationPackages?' + Date.now(), { cache: 'no-store' });
        console.log('Server response status:', response.status);

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Server response data:', result);

        if (result.success && result.packages && result.packages.length > 0) {
            // Only include packages that actually exist (hard delete removes them completely)
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
        container.innerHTML = DOMPurify.sanitize(`
            <div class="col-12">
                <div class="text-center p-5">
                    <h3>Loading donation packages...</h3>
                    <p>Please wait while we load the available donation options.</p>
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        `);
        return;
    }

    // Check if current user is admin
    const currentUser = getCurrentUser();
    const isAdmin = currentUser && currentUser.isAdmin;

    //   ${!isAdmin ? `
    //                 <div class="donation__image">
    //                     <img src="images/${getPackageImageName(pkg.name)}" 
    //                          alt="${pkg.name}" 
    //                          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
    //                          style="display: block;">
    //                     <div class="donation__image--placeholder" style="display: none;">💝</div>
    //                 </div>
    //                 ` : ''}

    container.innerHTML = DOMPurify.sanitize(donationPackages.map(pkg => `
        <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
            <div class="card card--donation">
                <div class="card__header">
                  
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
    `).join(''));
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

    const cartEntries = Object.entries(donationCart);
    const hasItems = cartEntries.length > 0;

    if (hasItems) {
        // Show cart summary
        cartSummary.style.display = 'block';

        // Render cart items
        cartItems.innerHTML = DOMPurify.sanitize(cartEntries.map(([packageId, quantity]) => {
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
        }).join(''));

        // Calculate total
        const total = cartEntries.reduce((sum, [packageId, quantity]) => {
            const pkg = donationPackages.find(p => p.id === packageId);
            return sum + (pkg.price * quantity);
        }, 0);

        cartTotal.textContent = `Total: RM ${total}`;

    } else {
        cartSummary.style.display = 'none';
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
document.addEventListener('DOMContentLoaded', function () {
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

    // Check user auth and show appropriate interface (same as app.js)
    checkUserAuth();
});

// Check if user is logged in and show appropriate interface (copied from app.js)
function checkUserAuth() {
    currentUser = getCurrentUser();

    if (currentUser) {
        console.log('User found:', currentUser);
        showDonationInterface();
    } else {
        console.log('No user found, showing regular donation interface');
        showRegularDonationInterface();
    }
}

function showDonationInterface() {
    if (currentUser.isAdmin) {
        console.log('Admin detected - showing admin interface');
        // Hide regular donation sections
        hideRegularDonationElements();
        // Show admin section with explicit styling to override any CSS
        const adminSection = document.getElementById('admin-section');
        adminSection.style.display = 'block';
        adminSection.style.visibility = 'visible';
        adminSection.style.opacity = '1';
        adminSection.style.height = 'auto';
        adminSection.style.overflow = 'visible';
        adminSection.style.position = 'relative';
        adminSection.style.zIndex = '1000';
        adminSection.style.backgroundColor = 'white';
        adminSection.style.padding = '20px';
        adminSection.style.margin = '20px 0';
        adminSection.style.border = '2px solid red'; // Temporary border to see if it's there
        console.log('Admin section styled. Computed style:', window.getComputedStyle(adminSection).display);
        // Create admin hero
        createAdminHero();
        // Load admin data
        loadAdminData();
    } else {
        console.log('Regular user - showing donation interface');
        showRegularDonationInterface();
        // Load regular donation packages
        loadDonationPackages();
    }
}

function hideRegularDonationElements() {
    const heroSection = document.querySelector('.donation__hero');
    const donationPackagesContainer = document.getElementById('donation-packages');
    const cartSummary = document.getElementById('cart-summary');

    // Hide individual elements, not entire sections to avoid hiding admin section
    if (heroSection) heroSection.style.display = 'none';
    if (donationPackagesContainer) donationPackagesContainer.style.display = 'none';
    if (cartSummary) cartSummary.style.display = 'none';

    // Also hide any other donation-related elements but preserve admin section
    const donationRows = document.querySelectorAll('.row:has(#donation-packages)');
    donationRows.forEach(row => {
        // Only hide if it doesn't contain the admin section
        if (!row.querySelector('#admin-section')) {
            row.style.display = 'none';
        }
    });
}

// Debug function removed as requested

// Removed old complex checkAdminAccess function - using simple app.js approach instead

// Create admin-specific hero section
function createAdminHero() {
    const container = document.querySelector('.container-fluid');

    // Check if admin hero already exists
    if (document.getElementById('admin-hero')) {
        return;
    }

    const adminHero = document.createElement('section');
    adminHero.id = 'admin-hero';
    adminHero.className = 'py-5';
    adminHero.style.background = 'linear-gradient(135deg, #a88db4 0%, #480060 100%)';
    adminHero.style.color = 'white';
    adminHero.innerHTML = DOMPurify.sanitize(`
        <div class="container">
            <div class="text-center">
                <h1 class="display-4 fw-bold mb-4"> Donation Management Dashboard</h1>
                <p class="lead mb-0">Manage donation packages, track donations, and view analytics</p>
            </div>
        </div>
    `);

    // Insert after the header (first element in container-fluid)
    const firstChild = container.firstElementChild;
    if (firstChild) {
        container.insertBefore(adminHero, firstChild.nextSibling);
    } else {
        container.appendChild(adminHero);
    }
}

// Show regular donation interface for non-admin users
function showRegularDonationInterface() {
    const heroSection = document.querySelector('.donation__hero');
    const donationPackagesSection = document.getElementById('donation-packages').closest('section');
    const cartSummary = document.getElementById('cart-summary');
    const adminSection = document.getElementById('admin-section');
    const adminHero = document.getElementById('admin-hero');

    // Show regular elements
    if (heroSection) heroSection.style.display = 'block';
    if (donationPackagesSection) donationPackagesSection.style.display = 'block';
    if (cartSummary) cartSummary.style.display = 'block';

    // Hide admin elements
    if (adminSection) adminSection.style.display = 'none';
    if (adminHero) adminHero.remove();
}

// Create admin section if it's missing from the DOM
function createAdminSectionIfMissing() {
    console.log('Creating missing admin section...');

    const container = document.querySelector('.container');
    if (!container) {
        console.error('No container found to add admin section');
        return;
    }

    //   <div class="d-flex gap-2">
    //                             <input type="date" id="filter-date-from" class="form-control" placeholder="From" style="width: 150px;">
    //                             <input type="date" id="filter-date-to" class="form-control" placeholder="To" style="width: 150px;">
    //                             <button onclick="filterDonations()" class="btn btn-outline-secondary">Filter</button>
    //                             <button onclick="exportDonations()" class="btn btn-secondary">Export</button>
    //                         </div>

    const adminSectionHTML = `
        <div id="admin-section" style="margin-top: 40px; display: block;">
            <div class="card">
                <div class="card-header">
                    <h3 class="text-center">Donation Management</h3>
                </div>
                <div class="card-body">
                    <!-- Admin Navigation Tabs -->
                    <div class="d-flex justify-content-center gap-3 mb-4">
                        <button onclick="showManagePackages()" class="btn btn-primary" id="manage-packages-btn">Manage Packages</button>
                        <button onclick="showDonationHistory()" class="btn btn-outline-primary" id="donation-history-btn">Donation History</button>
                        <button onclick="showDonationStats()" class="btn btn-outline-primary" id="donation-stats-btn">Statistics</button>
                    </div>

                    <!-- Manage Packages Section -->
                    <div id="manage-packages-section" class="admin-content-section">
                        <div class="flex--between d-flex justify-content-between align-items-center mb-3 flex--align-center ">
                            <h4>Donation Packages</h4>
                            <button onclick="showCreatePackageModal()" class="btn btn-success">Add New Package</button>
                        </div>
                        <div id="admin-packages-list" class="mt-3">
                            <div class="text-center">Loading packages...</div>
                        </div>
                    </div>

                    <!-- Donation History Section -->
                    <div id="donation-history-section" class="admin-content-section" style="display:none;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h4>All Donations</h4>
                          
                        </div>
                        <div id="admin-donations-list" class="mt-3">
                            <div class="text-center">Loading donations...</div>
                        </div>
                    </div>

                    <!-- Statistics Section -->
                    <div id="donation-stats-section" class="admin-content-section" style="display:none;">
                        <h4 class="mb-3">Donation Statistics</h4>
                        <div id="admin-stats-content" class="mt-3">
                            <div class="text-center">Loading statistics...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add admin section to the end of the container
    container.insertAdjacentHTML('beforeend', DOMPurify.sanitize(adminSectionHTML));

    // Now try to show it
    const newAdminSection = document.getElementById('admin-section');
    if (newAdminSection) {
        console.log('Successfully created admin section');
        newAdminSection.style.display = 'block !important';
        newAdminSection.style.visibility = 'visible';
        newAdminSection.style.opacity = '1';
        createAdminHero();
        loadAdminData();
    }
}

// Load admin data
function loadAdminData() {
    console.log('=== Loading Admin Data ===');
    try {
        showManagePackages(); // Default to packages view
        console.log('Called showManagePackages()');
    } catch (error) {
        console.error('Error in loadAdminData:', error);
    }
}

// Admin tab navigation
function showManagePackages() {
    console.log('=== Show Manage Packages ===');

    // Update button states
    const manageBtn = document.getElementById('manage-packages-btn');
    const historyBtn = document.getElementById('donation-history-btn');
    const statsBtn = document.getElementById('donation-stats-btn');

    console.log('Manage packages button found:', !!manageBtn);
    console.log('History button found:', !!historyBtn);
    console.log('Stats button found:', !!statsBtn);

    if (manageBtn) manageBtn.className = 'btn btn-primary';
    if (historyBtn) historyBtn.className = 'btn btn-outline-primary';
    if (statsBtn) statsBtn.className = 'btn btn-outline-primary';

    // Show/hide sections
    const manageSection = document.getElementById('manage-packages-section');
    const historySection = document.getElementById('donation-history-section');
    const statsSection = document.getElementById('donation-stats-section');

    console.log('Manage packages section found:', !!manageSection);
    console.log('History section found:', !!historySection);
    console.log('Stats section found:', !!statsSection);

    if (manageSection) manageSection.style.display = 'block';
    if (historySection) historySection.style.display = 'none';
    if (statsSection) statsSection.style.display = 'none';

    console.log('Calling loadAdminPackages()...');
    loadAdminPackages();
}

function showDonationHistory() {
    // Update button states - copy the working pattern from showManagePackages
    const manageBtn = document.getElementById('manage-packages-btn');
    const historyBtn = document.getElementById('donation-history-btn');
    const statsBtn = document.getElementById('donation-stats-btn');

    if (manageBtn) manageBtn.className = 'btn btn-outline-primary';
    if (historyBtn) historyBtn.className = 'btn btn-primary';
    if (statsBtn) statsBtn.className = 'btn btn-outline-primary';

    // Show/hide sections
    document.getElementById('manage-packages-section').style.display = 'none';
    document.getElementById('donation-history-section').style.display = 'block';
    document.getElementById('donation-stats-section').style.display = 'none';

    loadAllDonations();
}

function showDonationStats() {
    // Update button states - copy the working pattern from showManagePackages
    const manageBtn = document.getElementById('manage-packages-btn');
    const historyBtn = document.getElementById('donation-history-btn');
    const statsBtn = document.getElementById('donation-stats-btn');

    if (manageBtn) manageBtn.className = 'btn btn-outline-primary';
    if (historyBtn) historyBtn.className = 'btn btn-outline-primary';
    if (statsBtn) statsBtn.className = 'btn btn-primary';

    // Show/hide sections
    document.getElementById('manage-packages-section').style.display = 'none';
    document.getElementById('donation-history-section').style.display = 'none';
    document.getElementById('donation-stats-section').style.display = 'block';

    loadDonationStats();
}

// Load all packages for admin management
async function loadAdminPackages() {
    console.log('=== Load Admin Packages ===');
    try {
        console.log('Making fetch request to /getAllDonationPackages...');
        // Add cache busting to ensure we get fresh data
        const response = await apiFetch('/getAllDonationPackages?' + new Date().getTime());
        console.log('Response received:', response);
        console.log('Response status:', response.status);

        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            console.log('Packages loaded successfully:', data.packages.length, 'packages');
            console.log('Package IDs:', data.packages.map(p => p.id));
            displayAdminPackages(data.packages);
        } else {
            console.error('Failed to load packages:', data.message);
            showMessage('Failed to load packages: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error loading admin packages:', error);
        showMessage('Error loading packages: ' + error.message, 'error');
    }
}

// Display packages in admin view
function displayAdminPackages(packages) {
    console.log('=== Display Admin Packages ===');
    const container = document.getElementById('admin-packages-list');
    console.log('Container found:', !!container);
    console.log('Number of packages:', packages.length);

    if (packages.length === 0) {
        container.innerHTML = DOMPurify.sanitize('<p class="text-muted">No donation packages found.</p>');
        return;
    }

    const packagesHTML = packages.map(pkg => {
        console.log('Rendering package:', pkg.name);
        return `
        <div class="card mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-2">
                            <div>
                                <h6 class="mb-1">${pkg.name}</h6>
                                <p class="text-muted mb-1">${pkg.description}</p>
                                <small class="text-muted">ID: ${pkg.package_id} | Price: RM ${pkg.price}</small>
                            </div>
                        </div>
                        ${pkg.impact_description ? `<p class="text-success mt-2 mb-0"><small>${pkg.impact_description}</small></p>` : ''}
                    </div>
                    <div class="d-flex gap-2 align-items-center">
                        <button onclick="editPackage(${pkg.id})" class="btn btn-sm btn-outline-primary" style="color: #0d6efd !important; border-color: #0d6efd !important; background-color: white !important;">Edit</button>
                        <button onclick="deletePackage(${pkg.id})" class="btn btn-sm btn-danger">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    console.log('Setting innerHTML with packages HTML');
    container.innerHTML = DOMPurify.sanitize(packagesHTML);
    console.log('Packages should now be visible');
}

// Show create package form
function showCreatePackageForm() {
    document.getElementById('packageFormTitle').textContent = 'Create New Package';
    document.getElementById('packageForm').reset();
    document.getElementById('package_edit_id').value = '';
    document.getElementById('package_id').readOnly = false;
    document.getElementById('package-form-section').style.display = 'block';
    document.getElementById('package-form-section').scrollIntoView({ behavior: 'smooth' });
}

// Hide package form
function hidePackageForm() {
    document.getElementById('package-form-section').style.display = 'none';
}

// Edit package
async function editPackage(packageId) {
    try {
        const response = await apiFetch('/getAllDonationPackages');
        const data = await response.json();

        if (data.success) {
            const pkg = data.packages.find(p => p.id === packageId);
            if (pkg) {
                // Populate form
                document.getElementById('packageFormTitle').textContent = 'Edit Package';
                document.getElementById('package_edit_id').value = pkg.id;
                document.getElementById('package_id').value = pkg.package_id;
                document.getElementById('package_id').readOnly = true;
                document.getElementById('package_name').value = pkg.name;
                document.getElementById('package_description').value = pkg.description;
                document.getElementById('package_price').value = pkg.price;
                document.getElementById('package_impact').value = pkg.impact_description || '';

                document.getElementById('package-form-section').style.display = 'block';
                document.getElementById('package-form-section').scrollIntoView({ behavior: 'smooth' });
            }
        }
    } catch (error) {
        console.error('Error loading package for edit:', error);
        showMessage('Error loading package details', 'error');
    }
}

// Save package (create or update)
async function savePackage() {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.isAdmin) {
        showMessage('Admin access required', 'error');
        return;
    }

    const editId = document.getElementById('package_edit_id').value;
    const isEdit = editId !== '';

    const packageData = {
        package_id: document.getElementById('package_id').value.trim(),
        name: document.getElementById('package_name').value.trim(),
        description: document.getElementById('package_description').value.trim(),
        price: parseFloat(document.getElementById('package_price').value),
        impact_description: document.getElementById('package_impact').value.trim(),
        // Removed is_active - no longer using soft delete

    };

    // Validation
    if (!packageData.package_id || !packageData.name || !packageData.description || !packageData.price) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }

    if (packageData.price <= 0) {
        showMessage('Price must be greater than 0', 'error');
        return;
    }

    try {
        let response;
        if (isEdit) {
            packageData.id = editId;
            response = await apiFetch('/updateDonationPackage', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(packageData)
            });
        } else {
            response = await apiFetch('/createDonationPackage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(packageData)
            });
        }

        const data = await response.json();

        if (data.success) {
            showMessage(data.message, 'success');
            hidePackageForm();
            // Refresh the admin list immediately after successful save
            setTimeout(() => {
                console.log('Refreshing admin packages after save/create...');
                loadAdminPackages();
                loadDonationPackages(); // Refresh public view too
            }, 300);
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        console.error('Error saving package:', error);
        showMessage('Error saving package', 'error');
    }
}

// Delete package permanently
async function deletePackage(packageId) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.isAdmin) {
        showMessage('Admin access required', 'error');
        return;
    }

    if (!confirm('Are you sure you want to delete this donation package? This action cannot be undone.')) {
        return;
    }

    try {
        console.log('Attempting to delete package ID:', packageId);
        const response = await apiFetch(`/deleteDonationPackage/${packageId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        console.log('Delete response status:', response.status);
        const data = await response.json();
        console.log('Delete response data:', data);

        if (data.success) {
            showMessage('Package permanently deleted', 'success');
            // Immediate refresh - package should be gone from database
            console.log('Package deleted from database, refreshing views...');
            loadAdminPackages();
            loadDonationPackages(); // Refresh public view too
        } else {
            showMessage('Delete failed: ' + data.message, 'error');
            console.error('Server delete error:', data.message);
        }
    } catch (error) {
        console.error('Error deleting package:', error);
        showMessage('Error deleting package: ' + error.message, 'error');
    }
}

// Load all donations for admin
async function loadAllDonations() {
    console.log('=== Load All Donations ===');
    try {
        console.log('Making fetch request to /getAllDonations...');
        const response = await apiFetch('/getAllDonations');
        console.log('Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseText = await response.text();
        console.log('Raw response text:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Response was:', responseText);
            showMessage('Error: Server returned invalid response', 'error');
            return;
        }

        console.log('Parsed response data:', data);

        if (data.success) {
            console.log('Donations loaded successfully:', data.donations.length, 'donations');
            displayAllDonations(data.donations);
        } else {
            console.error('Server returned error:', data.message);
            showMessage('Failed to load donations: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error loading donations:', error);
        showMessage('Error loading donations: ' + error.message, 'error');
    }
}

// Display all donations in admin view
function displayAllDonations(donations) {
    const container = document.getElementById('admin-donations-list');

    if (donations.length === 0) {
        container.innerHTML = DOMPurify.sanitize('<p class="text-muted">No donations found.</p>');
        return;
    }

    const donationsHTML = donations.map(donation => {
        const donationDate = new Date(donation.created_at).toLocaleDateString();
        const donationTime = new Date(donation.created_at).toLocaleTimeString();
        const paymentInfo = donation.payment_method ? `**** ${donation.payment_method.cardLast4}` : 'N/A';

        const itemsHTML = donation.items.map(item =>
            `<li>${item.quantity}x ${item.name} - RM ${(item.subtotal || item.price * item.quantity).toFixed(2)}</li>`
        ).join('');

        return `
            <div class="card u-mb-md">
                <div class="card__body">
                    <div class="flex flex--space-between flex--align-center">
                        <div class="flex-grow-1">
                            <div class="flex flex--space-between flex--align-center u-mb-sm">
                                <h6 class="mb-0">Transaction: ${donation.transaction_id}</h6>
                                <span class="badge bg-success">RM ${parseFloat(donation.total_amount).toFixed(2)}</span>
                            </div>
                            <p class="mb-1"><strong>Donor:</strong> ${donation.donor_name} (${donation.donor_email})</p>
                            <p class="mb-1"><strong>Date:</strong> ${donationDate} at ${donationTime}</p>
                            <p class="mb-1"><strong>Payment:</strong> ${paymentInfo}</p>
                            <div class="mt-2">
                                <strong>Items:</strong>
                                <ul class="mb-0 mt-1">${itemsHTML}</ul>
                            </div>
                        </div>
                        <div class="flex flex--gap-sm">
                            <button onclick="deleteDonation(${donation.id})" class="button button--small button--danger">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = DOMPurify.sanitize(donationsHTML);
}

// Delete donation
async function deleteDonation(donationId) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.isAdmin) {
        showMessage('Admin access required', 'error');
        return;
    }

    if (!confirm('Are you sure you want to delete this donation record? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await apiFetch(`/deleteDonation/${donationId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const data = await response.json();
        if (data.success) {
            showMessage('Donation record deleted successfully', 'success');
            loadAllDonations();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting donation:', error);
        showMessage('Error deleting donation', 'error');
    }
}

// Load donation statistics
async function loadDonationStats() {
    try {
        const response = await apiFetch('/donationStats');
        const data = await response.json();

        if (data.success) {
            displayDonationStats(data.stats);
        } else {
            showMessage('Failed to load statistics: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        showMessage('Error loading statistics', 'error');
    }
}

// Display donation statistics
function displayDonationStats(stats) {
    const container = document.getElementById('admin-stats-content');

    const recentDonationsHTML = stats.recentDonations.map(donation => {
        const date = new Date(donation.created_at).toLocaleDateString();
        return `
            <tr>
                <td>${donation.transaction_id}</td>
                <td>${donation.donor_name}</td>
                <td>RM ${parseFloat(donation.total_amount).toFixed(2)}</td>
                <td>${date}</td>
            </tr>
        `;
    }).join('');

    const popularPackagesHTML = stats.popularPackages.map(pkg => `
        <tr>
            <td>${pkg.package_name}</td>
            <td>${pkg.total_quantity}</td>
            <td>RM ${parseFloat(pkg.total_amount).toFixed(2)}</td>
        </tr>
    `).join('');

    const statsHTML = `
        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card__header">
                        <h5>Overview</h5>
                    </div>
                    <div class="card__body">
                        <div class="row text-center">
                            <div class="col-6">
                                <h3 class="text-primary">${stats.totalDonations}</h3>
                                <p class="text-muted">Total Donations</p>
                            </div>
                            <div class="col-6">
                                <h3 class="text-success">RM ${parseFloat(stats.totalAmount || 0).toFixed(2)}</h3>
                                <p class="text-muted">Total Amount</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card__header">
                        <h5>Popular Packages</h5>
                    </div>
                    <div class="card__body">
                        ${stats.popularPackages.length > 0 ? `
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Package</th>
                                            <th>Quantity</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>${popularPackagesHTML}</tbody>
                                </table>
                            </div>
                        ` : '<p class="text-muted">No package data available</p>'}
                    </div>
                </div>
            </div>
        </div>
        <div class="row mt-4">
            <div class="col-12">
                <div class="card">
                    <div class="card__header">
                        <h5>Recent Donations</h5>
                    </div>
                    <div class="card__body">
                        ${stats.recentDonations.length > 0 ? `
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Transaction ID</th>
                                            <th>Donor</th>
                                            <th>Amount</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>${recentDonationsHTML}</tbody>
                                </table>
                            </div>
                        ` : '<p class="text-muted">No recent donations</p>'}
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = DOMPurify.sanitize(statsHTML);
}

// Filter donations by date
function filterDonations() {
    const fromDate = document.getElementById('filter-date-from').value;
    const toDate = document.getElementById('filter-date-to').value;

    // For now, just reload all donations
    // In a production app, you'd send the filter params to the server
    loadAllDonations();

    if (fromDate || toDate) {
        showMessage(`Filtering by date range: ${fromDate || 'beginning'} to ${toDate || 'end'}`, 'info');
    }
}

// Export donations to CSV
function exportDonations() {
    // Simple CSV export functionality
    showMessage('Export functionality would be implemented here', 'info');
}

// Show message helper
function showMessage(message, type) {
    // Create a simple message display
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show`;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.right = '20px';
    messageDiv.style.zIndex = '9999';
    messageDiv.style.minWidth = '300px';
    messageDiv.innerHTML = DOMPurify.sanitize(`
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `);

    document.body.appendChild(messageDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}