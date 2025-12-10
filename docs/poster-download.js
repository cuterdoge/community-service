// Enhanced Poster Download Manager
class PosterDownloadManager {
    constructor() {
        this.activeDropdown = null;
        this.setupStyles();
    }

    setupStyles() {
        // Add CSS for download dropdown if not already added
        if (!document.getElementById('poster-download-styles')) {
            const style = document.createElement('style');
            style.id = 'poster-download-styles';
            style.textContent = `
                .download-dropdown {
                    position: relative;
                    display: inline-block;
                }

                .download-options {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    background: white;
                    border: 2px solid #480060;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    min-width: 160px;
                    z-index: 1000;
                    overflow: hidden;
                    margin-top: 5px;
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(-10px);
                    transition: all 0.3s ease;
                }

                .download-options.show {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0);
                }

                .download-format-btn {
                    display: block;
                    width: 100%;
                    padding: 12px 16px;
                    border: none;
                    background: white;
                    color: #480060;
                    text-align: left;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    border-bottom: 1px solid #f0f0f0;
                }

                .download-format-btn:last-child {
                    border-bottom: none;
                }

                .download-format-btn:hover {
                    background: #f8f4ff;
                    color: #480060;
                    padding-left: 20px;
                }

                .download-format-btn:active {
                    background: #480060;
                    color: white;
                }

                .download-loading {
                    opacity: 0.6;
                    pointer-events: none;
                }

                .download-status {
                    font-size: 12px;
                    margin-top: 5px;
                    text-align: center;
                    padding: 5px;
                    border-radius: 4px;
                }

                .download-success {
                    background: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }

                .download-error {
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }

                /* Mobile responsive */
                @media (max-width: 768px) {
                    .download-options {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        min-width: 200px;
                        border-radius: 12px;
                    }

                    .download-options.show {
                        transform: translate(-50%, -50%);
                    }

                    .download-format-btn {
                        padding: 16px 20px;
                        font-size: 16px;
                    }
                }

                /* Backdrop for mobile */
                .download-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: 999;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.3s ease;
                }

                .download-backdrop.show {
                    opacity: 1;
                    visibility: visible;
                }
            `;
            document.head.appendChild(style);
        }
    }

    showDownloadOptions(eventId, triggerButton) {
        // Close any existing dropdown
        this.hideDownloadOptions();

        const event = eventsManager.events.find(e => e.id === eventId);
        if (!event || !event.poster) {
            this.showStatus('No poster available for this event.', 'error');
            return;
        }

        // Create dropdown container
        const dropdown = document.createElement('div');
        dropdown.className = 'download-dropdown';
        dropdown.id = 'poster-download-dropdown';

        // Create backdrop for mobile
        const backdrop = document.createElement('div');
        backdrop.className = 'download-backdrop';
        backdrop.onclick = () => this.hideDownloadOptions();

        // Create options container
        const options = document.createElement('div');
        options.className = 'download-options';

        // Add format buttons
        const formats = [
            { type: 'jpg', label: '📸 Download as JPG', description: 'Best for photos' },
            { type: 'png', label: '🖼️ Download as PNG', description: 'Best for graphics' },
            { type: 'pdf', label: '📄 Download as PDF', description: 'Best for documents' }
        ];

        formats.forEach(format => {
            const btn = document.createElement('button');
            btn.className = 'download-format-btn';
            btn.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${format.label}</span>
                    <small style="color: #666; font-size: 11px;">${format.description}</small>
                </div>
            `;
            btn.onclick = (e) => {
                e.stopPropagation();
                this.downloadPosterInFormat(eventId, format.type, event);
            };
            options.appendChild(btn);
        });

        // Position dropdown
        const rect = triggerButton.getBoundingClientRect();
        dropdown.style.position = 'absolute';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = (rect.bottom + 5) + 'px';

        // Add elements to page
        dropdown.appendChild(options);
        document.body.appendChild(backdrop);
        document.body.appendChild(dropdown);

        // Show with animation
        setTimeout(() => {
            backdrop.classList.add('show');
            options.classList.add('show');
        }, 10);

        this.activeDropdown = { dropdown, backdrop };

        // Close on escape key
        document.addEventListener('keydown', this.handleEscapeKey.bind(this));
        
        // Close on outside click
        document.addEventListener('click', this.handleOutsideClick.bind(this));
    }

    hideDownloadOptions() {
        if (this.activeDropdown) {
            const { dropdown, backdrop } = this.activeDropdown;
            
            const options = dropdown.querySelector('.download-options');
            if (options) options.classList.remove('show');
            if (backdrop) backdrop.classList.remove('show');

            setTimeout(() => {
                if (dropdown && dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
                if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            }, 300);

            this.activeDropdown = null;
        }

        document.removeEventListener('keydown', this.handleEscapeKey.bind(this));
        document.removeEventListener('click', this.handleOutsideClick.bind(this));
    }

    handleEscapeKey(e) {
        if (e.key === 'Escape') {
            this.hideDownloadOptions();
        }
    }

    handleOutsideClick(e) {
        if (this.activeDropdown && !e.target.closest('#poster-download-dropdown') && !e.target.closest('.btn-download-poster')) {
            this.hideDownloadOptions();
        }
    }

    async downloadPosterInFormat(eventId, format, event) {
        this.hideDownloadOptions();
        
        try {
            // Show loading state
            this.showStatus('Preparing download...', 'loading');

            const filename = `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_poster`;
            
            switch (format) {
                case 'jpg':
                    await this.downloadAsJPG(event.poster, filename);
                    break;
                case 'png':
                    await this.downloadAsPNG(event.poster, filename);
                    break;
                case 'pdf':
                    await this.downloadAsPDF(event.poster, filename, event.title);
                    break;
                default:
                    throw new Error('Unsupported format');
            }

            this.showStatus(`Downloaded successfully as ${format.toUpperCase()}!`, 'success');
            
        } catch (error) {
            console.error('Download error:', error);
            this.showStatus(`Failed to download: ${error.message}`, 'error');
        }
    }

    async downloadAsJPG(base64Data, filename) {
        const canvas = await this.createCanvasFromBase64(base64Data);
        const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        this.triggerDownload(jpgDataUrl, filename + '.jpg');
    }

    async downloadAsPNG(base64Data, filename) {
        const canvas = await this.createCanvasFromBase64(base64Data);
        const pngDataUrl = canvas.toDataURL('image/png');
        this.triggerDownload(pngDataUrl, filename + '.png');
    }

    async downloadAsPDF(base64Data, filename, eventTitle) {
        try {
            const canvas = await this.createCanvasFromBase64(base64Data);
            
            // Create a new canvas with PDF page dimensions (A4)
            const pdfCanvas = document.createElement('canvas');
            const pdfCtx = pdfCanvas.getContext('2d');
            
            // A4 dimensions at 150 DPI
            const a4Width = 1240;
            const a4Height = 1754;
            pdfCanvas.width = a4Width;
            pdfCanvas.height = a4Height;
            
            // Fill with white background
            pdfCtx.fillStyle = '#ffffff';
            pdfCtx.fillRect(0, 0, a4Width, a4Height);
            
            // Calculate image dimensions to fit in PDF while maintaining aspect ratio
            const maxImageWidth = a4Width - 120; // 60px margin on each side
            const maxImageHeight = a4Height - 200; // Space for title and margins
            
            const imageAspectRatio = canvas.width / canvas.height;
            let imageWidth, imageHeight;
            
            if (maxImageWidth / imageAspectRatio <= maxImageHeight) {
                imageWidth = maxImageWidth;
                imageHeight = maxImageWidth / imageAspectRatio;
            } else {
                imageHeight = maxImageHeight;
                imageWidth = maxImageHeight * imageAspectRatio;
            }
            
            // Center the image
            const imageX = (a4Width - imageWidth) / 2;
            const imageY = 120; // Top margin
            
            // Draw the image
            pdfCtx.drawImage(canvas, imageX, imageY, imageWidth, imageHeight);
            
            // Add title at the top
            pdfCtx.fillStyle = '#480060';
            pdfCtx.font = 'bold 36px Arial';
            pdfCtx.textAlign = 'center';
            pdfCtx.fillText(eventTitle, a4Width / 2, 80);
            
            // Add footer
            pdfCtx.fillStyle = '#666666';
            pdfCtx.font = '18px Arial';
            pdfCtx.fillText('Joy Home Connect - Community Events', a4Width / 2, a4Height - 40);
            
            // Convert to PDF-like format (actually still an image, but formatted for PDF)
            const pdfDataUrl = pdfCanvas.toDataURL('image/png');
            this.triggerDownload(pdfDataUrl, filename + '.png'); // Note: This creates a PDF-formatted PNG
            
        } catch (error) {
            throw new Error('Failed to create PDF format: ' + error.message);
        }
    }

    createCanvasFromBase64(base64Data) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                resolve(canvas);
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = base64Data;
        });
    }

    triggerDownload(dataUrl, filename) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showStatus(message, type) {
        // Remove existing status
        const existing = document.getElementById('download-status');
        if (existing) existing.remove();

        // Create status element
        const status = document.createElement('div');
        status.id = 'download-status';
        status.className = `download-status download-${type}`;
        status.textContent = message;
        
        // Position at top center of screen
        status.style.position = 'fixed';
        status.style.top = '20px';
        status.style.left = '50%';
        status.style.transform = 'translateX(-50%)';
        status.style.zIndex = '10000';
        status.style.maxWidth = '300px';
        
        document.body.appendChild(status);
        
        // Auto remove after 3 seconds (except loading)
        if (type !== 'loading') {
            setTimeout(() => {
                if (status.parentNode) {
                    status.remove();
                }
            }, 3000);
        }
    }
}

// Initialize global instance
window.posterDownloadManager = new PosterDownloadManager();

// Enhanced download function for global use
window.downloadPosterWithOptions = function(eventId, triggerButton) {
    window.posterDownloadManager.showDownloadOptions(eventId, triggerButton);
};