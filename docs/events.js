// Events Management System
class EventsManager {
    constructor() {
        this.events = this.loadEvents();
        this.currentFilter = 'upcoming';
        this.currentUser = getCurrentUser();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAdminAccess();
        this.renderEvents();
    }

    setupEventListeners() {
        // Search input listener
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.searchEvents();
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchEvents();
                }
            });
        }

        // Filter buttons
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                filterButtons.forEach(b => b.classList.remove('active'));
                
                // Add active class to clicked button
                e.target.classList.add('active');
                
                // Update current filter and render events
                this.currentFilter = e.target.dataset.filter;
                this.renderEvents();
            });
        });

        // Admin form submission
        const addEventForm = document.getElementById('addEventForm');
        if (addEventForm) {
            addEventForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addEvent();
            });
        }

        // Poster upload handling
        this.setupPosterUpload();

        // Modal click outside to close
        const modal = document.getElementById('eventModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeEventModal();
                }
            });
        }
    }

    setupPosterUpload() {
        const uploadArea = document.getElementById('posterUpload');
        const fileInput = document.getElementById('posterFile');

        if (uploadArea && fileInput) {
            // Click to upload
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });

            // File input change
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files[0]);
            });

            // Drag and drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) {
                    this.handleFileUpload(file);
                }
            });
        }
    }

    handleFileUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file (PNG, JPG, etc.)');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('File size too large. Please select an image under 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.showPosterPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    showPosterPreview(imageData) {
        const uploadText = document.getElementById('uploadText');
        const uploadPreview = document.getElementById('uploadPreview');
        const previewImage = document.getElementById('previewImage');

        uploadText.style.display = 'none';
        uploadPreview.style.display = 'block';
        previewImage.src = imageData;
        
        // Store the image data for later use
        this.tempPosterData = imageData;
    }

    clearPosterUpload() {
        const uploadText = document.getElementById('uploadText');
        const uploadPreview = document.getElementById('uploadPreview');
        const fileInput = document.getElementById('posterFile');

        uploadText.style.display = 'block';
        uploadPreview.style.display = 'none';
        fileInput.value = '';
        this.tempPosterData = null;
    }

    checkAdminAccess() {
        const adminSection = document.getElementById('adminSection');
        if (this.currentUser && this.currentUser.isAdmin) {
            adminSection.style.display = 'block';
        } else {
            adminSection.style.display = 'none';
        }
    }

    toggleAdminPanel() {
        const content = document.getElementById('adminPanelContent');
        const toggleText = document.getElementById('adminToggleText');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggleText.textContent = '▼ Hide Admin Panel';
        } else {
            content.style.display = 'none';
            toggleText.textContent = '➤ Show Admin Panel';
        }
    }

    addEvent() {
        const title = document.getElementById('eventTitle').value.trim();
        const date = document.getElementById('eventDate').value;
        const location = document.getElementById('eventLocation').value.trim();
        const description = document.getElementById('eventDescription').value.trim();

        if (!title || !date || !location || !description) {
            alert('Please fill in all required fields.');
            return;
        }

        const newEvent = {
            id: 'event_' + Date.now(),
            title: title,
            description: description,
            date: date,
            location: location,
            poster: this.tempPosterData || null,
            published: true,
            createdBy: this.currentUser.id,
            createdAt: new Date().toISOString()
        };

        this.events.push(newEvent);
        this.saveEvents();
        this.renderEvents();
        
        // Reset form
        document.getElementById('addEventForm').reset();
        this.clearPosterUpload();
        
        // Collapse admin panel
        document.getElementById('adminPanelContent').style.display = 'none';
        document.getElementById('adminToggleText').textContent = '➤ Show Admin Panel';

        alert('Event published successfully!');
    }

    deleteEvent(eventId) {
        if (confirm('Are you sure you want to delete this event?')) {
            this.events = this.events.filter(event => event.id !== eventId);
            this.saveEvents();
            this.renderEvents();
            alert('Event deleted successfully!');
        }
    }

    searchEvents() {
        this.renderEvents();
    }

    getFilteredEvents() {
        let filteredEvents = [...this.events];
        const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
        const now = new Date();

        // Apply search filter
        if (searchTerm) {
            filteredEvents = filteredEvents.filter(event => 
                event.title.toLowerCase().includes(searchTerm) ||
                event.description.toLowerCase().includes(searchTerm) ||
                event.location.toLowerCase().includes(searchTerm)
            );
        }

        // Apply date filter
        if (this.currentFilter === 'upcoming') {
            filteredEvents = filteredEvents.filter(event => new Date(event.date) >= now);
        } else if (this.currentFilter === 'past') {
            filteredEvents = filteredEvents.filter(event => new Date(event.date) < now);
        }
        // 'all' filter shows everything

        // Sort events by date (upcoming events first, then by date)
        filteredEvents.sort((a, b) => {
            if (this.currentFilter === 'past') {
                return new Date(b.date) - new Date(a.date); // Most recent past events first
            }
            return new Date(a.date) - new Date(b.date); // Soonest upcoming events first
        });

        return filteredEvents;
    }

    renderEvents() {
        const eventsGrid = document.getElementById('eventsGrid');
        const noEventsMessage = document.getElementById('noEventsMessage');
        const filteredEvents = this.getFilteredEvents();

        if (filteredEvents.length === 0) {
            eventsGrid.style.display = 'none';
            noEventsMessage.style.display = 'block';
            
            // Update message based on filter
            const messageElement = noEventsMessage.querySelector('h3:nth-child(2)');
            if (this.currentFilter === 'upcoming') {
                messageElement.textContent = 'There are no upcoming events';
            } else if (this.currentFilter === 'past') {
                messageElement.textContent = 'There are no past events';
            } else {
                messageElement.textContent = 'There are no events';
            }
        } else {
            eventsGrid.style.display = 'grid';
            noEventsMessage.style.display = 'none';
            
            eventsGrid.innerHTML = filteredEvents.map(event => this.createEventCard(event)).join('');
        }
    }

    createEventCard(event) {
        const eventDate = new Date(event.date);
        const isUpcoming = eventDate >= new Date();
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const truncatedDescription = event.description.length > 100 
            ? event.description.substring(0, 100) + '...' 
            : event.description;

        const posterContent = event.poster 
            ? `<img src="${event.poster}" alt="${event.title}" class="event-poster">`
            : `<div class="event-poster">📅<br>No Image</div>`;

        const adminActions = (this.currentUser && this.currentUser.isAdmin) 
            ? `<button onclick="eventsManager.deleteEvent('${event.id}')" class="btn-download-poster" style="background: #dc3545; color: white; border-color: #dc3545;">Delete</button>`
            : '';

        return `
            <div class="event-card" onclick="eventsManager.openEventModal('${event.id}')">
                ${posterContent}
                <div class="event-content">
                    <div class="event-date ${isUpcoming ? '' : 'past-event'}">${formattedDate}</div>
                    <h3 class="event-title">${event.title}</h3>
                    <div class="event-location">
                        <span>📍</span>
                        ${event.location}
                    </div>
                    <p class="event-description">${truncatedDescription}</p>
                    <div class="event-actions" onclick="event.stopPropagation();">
                        <button onclick="eventsManager.openEventModal('${event.id}')" class="btn-view-details">
                            View Details
                        </button>
                        <div style="display: flex; gap: 10px;">
                            ${event.poster ? `<button onclick="eventsManager.downloadPoster('${event.id}')" class="btn-download-poster">Download Poster</button>` : ''}
                            ${adminActions}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    openEventModal(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        const modal = document.getElementById('eventModal');
        const modalContent = document.getElementById('modalContent');
        
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const posterContent = event.poster 
            ? `<img src="${event.poster}" alt="${event.title}" style="width: 100%; max-width: 400px; border-radius: 10px; margin-bottom: 20px;">`
            : `<div style="width: 100%; height: 200px; background: linear-gradient(45deg, #a88db4, #480060); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; margin-bottom: 20px;">📅<br>Event</div>`;

        modalContent.innerHTML = `
            <div style="text-align: center;">
                ${posterContent}
                <h2 style="color: #480060; margin-bottom: 10px;">${event.title}</h2>
                <div style="background: #a88db4; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin-bottom: 20px; font-weight: 600;">
                    📅 ${formattedDate}
                </div>
                <div style="color: #666; margin-bottom: 20px; font-size: 16px;">
                    <strong>📍 Location:</strong> ${event.location}
                </div>
                <div style="text-align: left; line-height: 1.6; color: #333; margin-bottom: 20px;">
                    <strong>Description:</strong><br>
                    ${event.description}
                </div>
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    ${event.poster ? `<button onclick="eventsManager.downloadPoster('${event.id}')" class="btn-primary">Download Poster</button>` : ''}
                    <button onclick="eventsManager.closeEventModal()" style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeEventModal() {
        const modal = document.getElementById('eventModal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    downloadPoster(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event || !event.poster) {
            alert('No poster available for this event.');
            return;
        }

        // Create download link
        const link = document.createElement('a');
        link.href = event.poster;
        link.download = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_poster.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    loadEvents() {
        const storedEvents = localStorage.getItem('communityEvents');
        if (storedEvents) {
            return JSON.parse(storedEvents);
        }
        
        // Return some sample events if none exist
        return this.createSampleEvents();
    }

    saveEvents() {
        localStorage.setItem('communityEvents', JSON.stringify(this.events));
    }

    createSampleEvents() {
        const now = new Date();
        const futureDate1 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
        const futureDate2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks from now
        const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 1 week ago

        return [
            {
                id: 'sample_1',
                title: 'Community Health Workshop',
                description: 'Join us for an informative workshop about maintaining good health in our community. We will cover topics including nutrition, exercise, mental wellness, and preventive care. This workshop is designed for all age groups and will include interactive sessions and Q&A with healthcare professionals.',
                date: futureDate1.toISOString().slice(0, 16),
                location: 'Joy Home Community Center',
                poster: null,
                published: true,
                createdBy: 'admin',
                createdAt: new Date().toISOString()
            },
            {
                id: 'sample_2',
                title: 'Annual Charity Fundraiser',
                description: 'Our biggest fundraising event of the year! Join us for an evening of entertainment, auctions, and community spirit. All proceeds will go towards supporting our elderly care programs and children\'s education initiatives. Dinner will be provided, and there will be live music and entertainment throughout the evening.',
                date: futureDate2.toISOString().slice(0, 16),
                location: 'Grand Ballroom, City Hall',
                poster: null,
                published: true,
                createdBy: 'admin',
                createdAt: new Date().toISOString()
            },
            {
                id: 'sample_3',
                title: 'Volunteer Appreciation Day',
                description: 'A special day to celebrate and thank all our amazing volunteers who make our work possible. We had a wonderful celebration with food, awards, and recognition for outstanding service. Thank you to everyone who attended and continues to support our mission.',
                date: pastDate.toISOString().slice(0, 16),
                location: 'Joy Home Connect Main Office',
                poster: null,
                published: true,
                createdBy: 'admin',
                createdAt: new Date().toISOString()
            }
        ];
    }
}

// Global instance will be created when the page loads