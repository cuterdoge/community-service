// Checkout functionality
let donationData = null;
let currentUser = null;

// Initialize checkout page
function initializeCheckout() {
    // Check if user is logged in
    currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Please login to continue with your donation.');
        window.location.href = 'login.html';
        return;
    }

    // Get donation data
    donationData = JSON.parse(sessionStorage.getItem('currentDonation'));
    if (!donationData) {
        alert('No donation data found. Please start from the donations page.');
        window.location.href = 'donations.html';
        return;
    }

    // Populate the page
    populateDonationSummary();
    populateDonorInfo();
    populateImpactSummary();
    setupCardFormatting();
    populateExpiryYears();
}

// Populate donation summary
function populateDonationSummary() {
    const itemsContainer = document.getElementById('donation-items');

    let itemsHTML = donationData.items.map(item => `
        <div class="donation-item">
            <div>
                <strong>${item.name}</strong><br>
                <small class="text-muted">${item.impact}</small>
            </div>
            <div>
                ${item.quantity}x × RM ${item.price} = <strong>RM ${item.quantity * item.price}</strong>
            </div>
        </div>
    `).join('');

    itemsHTML += `
        <div class="donation-item">
            <div><strong>Total Donation</strong></div>
            <div><strong>RM ${donationData.total}</strong></div>
        </div>
    `;

    itemsContainer.innerHTML = DOMPurify.sanitize(itemsHTML, { ADD_ATTR: ['onclick', 'onchange'] });
}

// Populate donor information
function populateDonorInfo() {
    const donorContainer = document.getElementById('donor-info');

    donorContainer.innerHTML = DOMPurify.sanitize(`
        <p><strong>Name:</strong> ${currentUser.name}</p>
        <p><strong>Email:</strong> ${currentUser.email}</p>
        <p><strong>Transaction ID:</strong> ${donationData.transactionId}</p>
        <p><strong>Date:</strong> ${new Date(donationData.date).toLocaleDateString()}</p>
    `, { ADD_ATTR: ['onclick', 'onchange'] });
}

// Populate impact summary
function populateImpactSummary() {
    const impactContainer = document.getElementById('impact-details');

    const impacts = donationData.items.map(item =>
        `• ${item.impact} (${item.quantity}x)`
    ).join('<br>');

    impactContainer.innerHTML = DOMPurify.sanitize(`
        <p>With your generous donation of <strong>RM ${donationData.total}</strong>, you will:</p>
        <div style="text-align: left; margin-top: 15px;">
            ${impacts}
        </div>
        <p style="margin-top: 20px;"><em>Thank you for making a real difference in our community!</em></p>
    `, { ADD_ATTR: ['onclick', 'onchange'] });
}

// Setup card number formatting
function setupCardFormatting() {
    const cardNumberInput = document.getElementById('cardNumber');

    cardNumberInput.addEventListener('input', function (e) {
        let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;

        if (formattedValue.length > 19) {
            formattedValue = formattedValue.substring(0, 19);
        }

        e.target.value = formattedValue;
    });

    // CVV input formatting
    const cvvInput = document.getElementById('cvv');
    cvvInput.addEventListener('input', function (e) {
        e.target.value = e.target.value.replace(/[^0-9]/gi, '').substring(0, 3);
    });
}

// Populate expiry years
function populateExpiryYears() {
    const yearSelect = document.getElementById('expiryYear');
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < 15; i++) {
        const year = currentYear + i;
        const option = document.createElement('option');
        option.value = year.toString().substring(2);
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

// Process payment
async function processPayment(event) {
    event.preventDefault();

    // Show processing overlay
    document.getElementById('processing-overlay').style.display = 'flex';

    try {
        // Prepare payment data
        const paymentInfo = {
            cardName: document.getElementById('cardName').value,
            cardLast4: document.getElementById('cardNumber').value.slice(-4),
            expiryMonth: document.getElementById('expiryMonth').value,
            expiryYear: document.getElementById('expiryYear').value
        };

        const donorInfo = {
            name: currentUser.name,
            email: currentUser.email,
            id: currentUser.id
        };

        // Send to database
        const response = await fetch('/processDonation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                donationData: donationData,
                donorInfo: donorInfo,
                paymentInfo: paymentInfo
            })
        });

        const result = await response.json();

        if (result.success) {
            // Create receipt data for success page
            const receipt = {
                ...donationData,
                donor: donorInfo,
                paymentMethod: paymentInfo,
                status: 'completed',
                processedAt: new Date().toISOString()
            };

            // Clear session data
            sessionStorage.removeItem('currentDonation');

            // Redirect to success page
            sessionStorage.setItem('completedDonation', JSON.stringify(receipt));
            window.location.href = 'donation-success.html';
        } else {
            throw new Error(result.message || 'Payment processing failed');
        }

    } catch (error) {
        console.error('Payment processing error:', error);
        alert('There was an error processing your donation. Please try again.');
        document.getElementById('processing-overlay').style.display = 'none';
    }
}

// Note: Donation history is now saved to database via the /processDonation API
// This function is no longer needed as the server handles donation storage