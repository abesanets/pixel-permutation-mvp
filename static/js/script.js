class PixelFlowApp {
    constructor() {
        this.currentTaskId = null;
        this.sourceImageUrl = null;
        this.targetImageUrl = null;
        this.cancelRequested = false;
        this.statusCheckInterval = null;
        this.startTime = 0;
        this.totalProcessingTime = 0;
        
        this.selectors = {
            source: '#source',
            target: '#target',
            sourcePreview: '#source-preview',
            targetPreview: '#target-preview',
            processBtn: '#process-btn',
            cancelBtn: '#cancel-btn',
            animationPreview: '#animation-preview',
            previewProgress: '#preview-progress',
            animationResult: '#animation-result',
            progressFill: '#progress-fill',
            statusMessage: '#status-message',
            timeCounter: '#time-counter',
            resultVideo: '#result-video',
            downloadVideoBtn: '#download-video-btn',
            notificationContainer: '#notification-container'
        };

        this.settings = ['size', 'fps', 'duration', 'scale', 'seed', 'format'];
        this.progressMessages = [
            { threshold: 10, message: "Initializing neural network..." },
            { threshold: 25, message: "Processing source image..." },
            { threshold: 40, message: "Analyzing target image..." },
            { threshold: 55, message: "Calculating pixel mapping..." },
            { threshold: 75, message: "Generating animation frames..." },
            { threshold: 90, message: "Finalizing animation..." },
            { threshold: 100, message: "Processing complete!" }
        ];
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => this.initializeApp());
    }

    initializeApp() {
        this.restoreImagePreviews();
        this.setupEventListeners();
        this.resetPreview();
        this.hideAdditionalResults();
        this.setupImageModalListeners();
        this.loadSettings();
        this.setupScaleOptions();
    }

    setupEventListeners() {
        // Image upload handlers
        document.getElementById('source').addEventListener('change', (e) => 
            this.handleImageUpload(e, 'source'));
        document.getElementById('target').addEventListener('change', (e) => 
            this.handleImageUpload(e, 'target'));

        // Preview click handlers
        document.getElementById('source-preview').addEventListener('click', () => 
            this.triggerFileInput('source'));
        document.getElementById('target-preview').addEventListener('click', () => 
            this.triggerFileInput('target'));

        // Button handlers
        document.getElementById('process-btn').addEventListener('click', () => 
            this.startProcessing());
        document.getElementById('cancel-btn').addEventListener('click', () => 
            this.cancelProcessing());

        // Settings handlers
        this.settings.forEach(setting => {
            const element = document.getElementById(setting);
            if (element) {
                element.addEventListener('change', () => this.saveSettings());
            }
        });

        // Scale options handler
        document.getElementById('size').addEventListener('change', () => 
            this.setupScaleOptions());
    }

    triggerFileInput(type) {
        const preview = document.getElementById(`${type}-preview`);
        if (preview.classList.contains('active')) {
            document.getElementById(type).click();
        }
    }

    handleImageUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select an image file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.updatePreview(type, e.target.result);
            this[`${type}ImageUrl`] = e.target.result;
            this.saveToLocalStorage(type, e.target.result);
        };
        reader.readAsDataURL(file);
    }

    updatePreview(type, imageData) {
        const previewElement = document.getElementById(`${type}-preview`);
        const placeholder = document.getElementById(`${type}-placeholder`);
        
        previewElement.innerHTML = `
            <div class="preview-overlay">
                <i class="fas fa-sync-alt"></i>
                <span>Click to change</span>
            </div>
            <img src="${imageData}" class="preview-image">
        `;
        
        previewElement.classList.add('active');
        if (placeholder) placeholder.style.display = 'none';
    }

    // Local Storage management
    saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(`pixelFlow_${key}`, data);
        } catch (e) {
            console.warn('LocalStorage is not available');
        }
    }

    getFromLocalStorage(key) {
        try {
            return localStorage.getItem(`pixelFlow_${key}`);
        } catch (e) {
            console.warn('LocalStorage is not available');
            return null;
        }
    }

    restoreImagePreviews() {
        ['source', 'target'].forEach(type => {
            const savedImage = this.getFromLocalStorage(type);
            if (savedImage) {
                this.updatePreview(type, savedImage);
                this[`${type}ImageUrl`] = savedImage;
            }
        });
    }

    // Settings management
    loadSettings() {
        const savedSettings = JSON.parse(localStorage.getItem('pixelflowSettings') || '{}');
        this.settings.forEach(setting => {
            const element = document.getElementById(setting);
            if (element && savedSettings[setting] !== undefined) {
                element.value = savedSettings[setting];
            }
        });
    }

    saveSettings() {
        const currentSettings = {};
        this.settings.forEach(setting => {
            const element = document.getElementById(setting);
            if (element) currentSettings[setting] = element.value;
        });
        localStorage.setItem('pixelflowSettings', JSON.stringify(currentSettings));
    }

    setupScaleOptions() {
        const sizeSelect = document.getElementById('size');
        const scaleSelect = document.getElementById('scale');
        const selectedSize = parseInt(sizeSelect.value);
        
        // Reset all options
        Array.from(scaleSelect.options).forEach(option => {
            option.style.display = 'block';
            option.disabled = false;
        });

        // Hide options based on size
        const scaleRules = {
            256: ['16'],
            512: ['8', '16']
        };

        if (scaleRules[selectedSize]) {
            scaleRules[selectedSize].forEach(value => {
                const option = scaleSelect.querySelector(`option[value="${value}"]`);
                if (option) {
                    option.style.display = 'none';
                    option.disabled = true;
                }
            });
        }

        // Ensure valid selection
        const currentScale = parseInt(scaleSelect.value);
        const availableOptions = Array.from(scaleSelect.options).filter(opt => !opt.disabled);
        const availableValues = availableOptions.map(opt => parseInt(opt.value));
        
        if (!availableValues.includes(currentScale)) {
            scaleSelect.value = Math.max(...availableValues).toString();
        }
    }

    // Processing methods
    async startProcessing() {
        if (!await this.checkServerHealth()) {
            this.showNotification('Server is not responding. Please refresh the page and try again.', 'error');
            return;
        }

        try {
            this.cancelRequested = false;
            this.startTime = Date.now();
            
            this.showCancelButton();
            await this.cleanupTask();
            
            if (!this.sourceImageUrl || !this.targetImageUrl) {
                this.showNotification('Please upload both source and target images');
                return;
            }

            const params = this.getProcessingParams();
            if (!this.validateParams(params)) return;

            await this.sendProcessingRequest(params);
            
        } catch (error) {
            console.error('Start processing error:', error);
            this.showNotification('Error: ' + error.message);
            this.resetPreview();
        }
    }

    getProcessingParams() {
        return {
            size: parseInt(document.getElementById('size').value),
            fps: parseInt(document.getElementById('fps').value),
            duration: parseFloat(document.getElementById('duration').value),
            seed: parseInt(document.getElementById('seed').value),
            scale: parseInt(document.getElementById('scale').value),
            format: document.getElementById('format').value
        };
    }

    validateParams(params) {
        const validations = [
            { check: params.size < 32 || params.size > 512, message: 'Image size must be between 32 and 512' },
            { check: params.fps < 1 || params.fps > 60, message: 'FPS must be between 1 and 60' },
            { check: params.duration < 1 || params.duration > 10, message: 'Duration must be between 0.1 and 10 seconds' },
            { check: params.scale < 1 || params.scale > 16, message: 'Scale must be between 1 and 16' },
            { check: params.seed < 0 || params.seed > 999999, message: 'Seed must be between 0 and 999999' }
        ];

        for (const validation of validations) {
            if (validation.check) {
                this.showNotification(validation.message);
                return false;
            }
        }
        return true;
    }

    async sendProcessingRequest(params) {
        const formData = this.createFormData(params);
        
        this.disableProcessButton();
        this.showProgressUI();
        this.updateProgress(5, 'Starting processing...', 0);

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        this.currentTaskId = data.task_id;
        this.checkStatus();
    }

    createFormData(params) {
        const sourceBlob = this.dataURLToBlob(this.sourceImageUrl);
        const targetBlob = this.dataURLToBlob(this.targetImageUrl);
        
        const sourceFile = new File([sourceBlob], 'source.png', { type: 'image/png' });
        const targetFile = new File([targetBlob], 'target.png', { type: 'image/png' });

        const formData = new FormData();
        formData.append('source', sourceFile);
        formData.append('target', targetFile);
        Object.entries(params).forEach(([key, value]) => {
            formData.append(key, value.toString());
        });

        return formData;
    }

    dataURLToBlob(dataURL) {
        const parts = dataURL.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        
        for (let i = 0; i < raw.length; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        
        return new Blob([uInt8Array], { type: contentType });
    }

    // Status checking
    checkStatus() {
        if (!this.currentTaskId || this.cancelRequested) return;

        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }
        
        this.statusCheckInterval = setInterval(async () => {
            if (!this.currentTaskId || this.cancelRequested) {
                clearInterval(this.statusCheckInterval);
                return;
            }

            try {
                const response = await fetch(`/status/${this.currentTaskId}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const data = await response.json();
                const elapsedTime = data.time_elapsed || ((Date.now() - this.startTime) / 1000);

                switch (data.status) {
                    case 'processing':
                        this.handleProcessingStatus(data.progress, elapsedTime);
                        break;
                    case 'completed':
                        this.handleCompletionStatus(data.time_elapsed || elapsedTime);
                        break;
                    case 'error':
                        this.handleErrorStatus(data.error);
                        break;
                }
            } catch (error) {
                this.handleStatusError(error);
            }
        }, 1000);
    }

    handleProcessingStatus(progress, elapsedTime) {
        const adjustedProgress = this.calculateAdjustedProgress(progress);
        const statusMessage = this.getStatusMessage(progress);
        this.updateProgress(adjustedProgress, statusMessage, elapsedTime);
    }

    handleCompletionStatus(elapsedTime) {
        clearInterval(this.statusCheckInterval);
        this.totalProcessingTime = elapsedTime;
        this.animateCompletion(elapsedTime);
    }

    handleErrorStatus(error) {
        clearInterval(this.statusCheckInterval);
        this.showNotification('Processing error: ' + error);
        this.resetPreview();
    }

    handleStatusError(error) {
        console.error('Status check error:', error);
        clearInterval(this.statusCheckInterval);
        this.showNotification('Error checking status: ' + error.message);
        this.resetPreview();
    }

    calculateAdjustedProgress(progress) {
        const progressCurves = [
            { range: [0, 15], multiplier: 0.5, offset: 0 },
            { range: [15, 40], multiplier: 0.7, offset: 7.5 },
            { range: [40, 70], multiplier: 0.9, offset: 25 },
            { range: [70, 90], multiplier: 1.3, offset: 52 },
            { range: [90, 100], multiplier: 2.2, offset: 78 }
        ];

        for (const curve of progressCurves) {
            const [start, end] = curve.range;
            if (progress >= start && progress <= end) {
                return curve.offset + (progress - start) * curve.multiplier;
            }
        }
        return progress;
    }

    getStatusMessage(progress) {
        for (let i = this.progressMessages.length - 1; i >= 0; i--) {
            if (progress >= this.progressMessages[i].threshold) {
                return this.progressMessages[i].message;
            }
        }
        return "Starting processing...";
    }

    // UI Management
    showCancelButton() {
        const cancelBtn = document.getElementById('cancel-btn');
        cancelBtn.style.display = 'block';
        cancelBtn.disabled = false;
    }

    disableProcessButton() {
        const processBtn = document.getElementById('process-btn');
        processBtn.disabled = true;
        processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    showProgressUI() {
        document.getElementById('animation-preview').style.display = 'none';
        document.getElementById('preview-progress').style.display = 'block';
        document.getElementById('animation-result').style.display = 'none';
        this.hideAdditionalResults();
    }

    updateProgress(progress, message, time) {
        const progressFill = document.getElementById('progress-fill');
        const statusMessage = document.getElementById('status-message');
        const timeCounter = document.getElementById('time-counter');
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
            progressFill.classList.toggle('pulsing', progress > 0 && progress < 100);
            progressFill.classList.toggle('completed', progress === 100);
        }
        
        if (statusMessage) {
            if (progress < 100 && progress > 5) {
                statusMessage.innerHTML = `${message} <span class="loading-dots"><span></span><span></span><span></span></span>`;
            } else {
                statusMessage.textContent = message;
            }
        }
        
        if (timeCounter) {
            timeCounter.textContent = `${time.toFixed(1)}s`;
            timeCounter.style.color = time > 60 ? 'var(--error)' : time > 30 ? 'var(--warning)' : 'var(--accent)';
        }
    }

    animateCompletion(totalTime) {
        const progressFill = document.getElementById('progress-fill');
        const statusMessage = document.getElementById('status-message');
        const startProgress = parseFloat(progressFill.style.width) || 0;
        const duration = 1200;
        const startTime = Date.now();
        
        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentProgress = startProgress + (100 - startProgress) * easeOut;
            
            progressFill.style.width = `${currentProgress}%`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                progressFill.classList.remove('pulsing');
                progressFill.classList.add('completed');
                statusMessage.innerHTML = '<i class="fas fa-check-circle"></i> Processing complete!';
                
                setTimeout(() => {
                    this.showResults(totalTime);
                    this.scrollToTop();
                }, 800);
            }
        };
        
        animate();
    }

    showResults(totalTime) {
        document.getElementById('animation-preview').style.display = 'none';
        document.getElementById('preview-progress').style.display = 'none';
        document.getElementById('animation-result').style.display = 'block';
        
        const completionTimeElement = document.getElementById('completion-time');
        if (completionTimeElement) {
            completionTimeElement.textContent = `Completed in ${totalTime.toFixed(1)}s`;
        }
        
        const videoElement = document.getElementById('result-video');
        const downloadBtn = document.getElementById('download-video-btn');
        
        videoElement.src = `/result/${this.currentTaskId}/animation`;
        downloadBtn.href = `/result/${this.currentTaskId}/animation`;
        
        this.showAdditionalResults();
        this.populateAdditionalResults();

        const processBtn = document.getElementById('process-btn');
        processBtn.disabled = false;
        processBtn.innerHTML = '<i class="fas fa-play-circle"></i> Generate Animation';

        document.getElementById('cancel-btn').style.display = 'none';
        
        this.showNotification(`Animation generated successfully in ${totalTime.toFixed(1)} seconds!`, 'success');
    }

    populateAdditionalResults() {
        const resultsGrid = document.getElementById('additional-results-grid');
        const taskId = this.currentTaskId;
        
        resultsGrid.innerHTML = `
            <div class="result-item">
                <h3><i class="fas fa-image"></i> Final Reconstructed Image</h3>
                <img src="/result/${taskId}/final_image" 
                     alt="Final reconstructed image" 
                     data-caption="Final Reconstructed Image"
                     data-download="/result/${taskId}/final_image"
                     onerror="this.style.display='none'">
                <div>
                    <a href="/result/${taskId}/final_image" class="download-btn secondary" download>
                        <i class="fas fa-download"></i> Download PNG
                    </a>
                </div>
            </div>
            <div class="result-item">
                <h3><i class="fas fa-chart-bar"></i> Diagnostic Visualization</h3>
                <img src="/result/${taskId}/diagnostic" 
                     alt="Diagnostic visualization" 
                     data-caption="Diagnostic Visualization"
                     data-download="/result/${taskId}/diagnostic"
                     onerror="this.style.display='none'">
                <div>
                    <a href="/result/${taskId}/diagnostic" class="download-btn secondary" download>
                        <i class="fas fa-download"></i> Download PNG
                    </a>
                </div>
            </div>
            <div class="result-item">
                <h3><i class="fas fa-database"></i> Mapping Data</h3>
                <div class="image-placeholder">
                    <i class="fas fa-file-code"></i>
                    JSON Data File
                </div>
                <div>
                    <a href="/result/${taskId}/mapping" class="download-btn secondary" download>
                        <i class="fas fa-download"></i> Download JSON
                    </a>
                </div>
            </div>
        `;
        
        this.setupImageModalListeners();
    }

    resetPreview() {
        document.getElementById('animation-preview').style.display = 'flex';
        document.getElementById('preview-progress').style.display = 'none';
        document.getElementById('animation-result').style.display = 'none';
        
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            progressFill.classList.remove('pulsing', 'completed');
        }
        
        this.updateProgress(0, 'Ready to process', 0);
        
        const processBtn = document.getElementById('process-btn');
        processBtn.disabled = false;
        processBtn.innerHTML = '<i class="fas fa-play-circle"></i> Generate Animation';
        
        const cancelBtn = document.getElementById('cancel-btn');
        cancelBtn.style.display = 'none';
        cancelBtn.disabled = false;
        cancelBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Cancel Processing';
    }

    hideAdditionalResults() {
        const additionalResults = document.querySelector('.additional-results');
        if (additionalResults) {
            additionalResults.style.display = 'none';
        }
    }

    showAdditionalResults() {
        const additionalResults = document.querySelector('.additional-results');
        if (additionalResults) {
            additionalResults.style.display = 'block';
        }
    }

    // Modal management
    setupImageModalListeners() {
        const modal = document.getElementById('image-modal');
        const closeBtn = document.querySelector('.modal-close');
        
        closeBtn.addEventListener('click', () => this.closeModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
        
        document.querySelectorAll('.result-item img').forEach(img => {
            img.addEventListener('click', () => {
                this.openModal(img.src, img.getAttribute('data-caption'), img.getAttribute('data-download'));
            });
        });
    }

    openModal(imageSrc, caption, downloadUrl) {
        const modal = document.getElementById('image-modal');
        const modalImage = document.getElementById('modal-image');
        const modalCaption = document.getElementById('modal-caption-text');
        const modalDownloadBtn = document.getElementById('modal-download-btn');
        
        modalImage.src = imageSrc;
        modalCaption.textContent = caption;
        modalDownloadBtn.href = downloadUrl;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => modal.classList.add('active'), 10);
    }

    closeModal() {
        const modal = document.getElementById('image-modal');
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }

    // Utility methods
    async checkServerHealth() {
        try {
            const response = await fetch('/health');
            if (!response.ok) throw new Error('Server not healthy');
            const data = await response.json();
            return data.status === 'healthy';
        } catch (error) {
            console.error('Server health check failed:', error);
            return false;
        }
    }

    async cancelProcessing() {
        console.log('Cancel requested');
        
        this.cancelRequested = true;
        const cancelBtn = document.getElementById('cancel-btn');
        cancelBtn.disabled = true;
        cancelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Canceling...';
        
        this.showNotification('Canceling current task...', 'success');
        
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        
        await this.cleanupTask();
        
        this.cancelRequested = false;
        this.resetPreview();
        this.hideAdditionalResults();
        
        this.showNotification('Processing canceled', 'success');
    }

    async cleanupTask() {
        if (!this.currentTaskId) return;

        const taskIdToCleanup = this.currentTaskId;
        
        try {
            await fetch(`/cleanup/${taskIdToCleanup}`, { method: 'DELETE' });
            console.log('Cleanup completed for task:', taskIdToCleanup);
        } catch (error) {
            console.error('Cleanup error:', error);
        } finally {
            if (this.currentTaskId === taskIdToCleanup) {
                this.currentTaskId = null;
            }
        }
    }

    showNotification(message, type = 'error') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icon = type === 'error' ? 'exclamation-circle' : 'check-circle';
        notification.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;

        container.appendChild(notification);

        // Limit notifications to 3
        const notifications = container.querySelectorAll('.notification');
        if (notifications.length > 3) {
            notifications[0].remove();
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'fadeOut 0.5s ease forwards';
                setTimeout(() => notification.remove(), 500);
            }
        }, 5000);
    }

    scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Initialize the application
const app = new PixelFlowApp();
app.init();

// Periodic server health check
setInterval(async () => {
    const isHealthy = await app.checkServerHealth();
    if (!isHealthy) {
        console.warn('Server health check failed');
        const statusElement = document.getElementById('status-message');
        if (statusElement && statusElement.textContent.includes('Ready')) {
            statusElement.innerHTML = 'Server connection issues <span class="loading-dots"><span></span><span></span><span></span></span>';
        }
    }
}, 30000);