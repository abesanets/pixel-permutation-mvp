let currentTaskId = null;
let sourceImageUrl = null;
let targetImageUrl = null;
let cancelRequested = false;
let statusCheckInterval = null;
let startTime = 0;
let totalProcessingTime = 0;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

function initializeApp() {
    restoreImagePreviews();
    setupEventListeners();
    resetPreview();
    hideAdditionalResults();
    setupImageModalListeners();
}

function setupEventListeners() {
    // Обработчики загрузки изображений
    document.getElementById('source').addEventListener('change', function (e) {
        handleImageUpload(e, 'source');
    });
    
    document.getElementById('target').addEventListener('change', function (e) {
        handleImageUpload(e, 'target');
    });

    // Обработчики клика по превью для замены
    document.getElementById('source-preview').addEventListener('click', function() {
        if (this.classList.contains('active')) {
            document.getElementById('source').click();
        }
    });

    document.getElementById('target-preview').addEventListener('click', function() {
        if (this.classList.contains('active')) {
            document.getElementById('target').click();
        }
    });

    // Обработчики кнопок
    document.getElementById('process-btn').addEventListener('click', startProcessing);
    document.getElementById('cancel-btn').addEventListener('click', cancelProcessing);
}

function handleImageUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showNotification('Please select an image file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        updatePreview(type, e.target.result);
        
        if (type === 'source') {
            sourceImageUrl = e.target.result;
        } else {
            targetImageUrl = e.target.result;
        }
        
        saveToLocalStorage(type, e.target.result);
    };
    reader.readAsDataURL(file);
}

function updatePreview(type, imageData) {
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
    
    if (placeholder) {
        placeholder.style.display = 'none';
    }
}

function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(`pixelFlow_${key}`, data);
    } catch (e) {
        console.warn('LocalStorage is not available');
    }
}

function getFromLocalStorage(key) {
    try {
        return localStorage.getItem(`pixelFlow_${key}`);
    } catch (e) {
        console.warn('LocalStorage is not available');
        return null;
    }
}

function restoreImagePreviews() {
    ['source', 'target'].forEach(type => {
        const savedImage = getFromLocalStorage(type);
        if (savedImage) {
            updatePreview(type, savedImage);
            
            if (type === 'source') {
                sourceImageUrl = savedImage;
            } else {
                targetImageUrl = savedImage;
            }
        }
    });
}

function resetPreview() {
    document.getElementById('animation-preview').style.display = 'flex';
    document.getElementById('preview-progress').style.display = 'none';
    document.getElementById('animation-result').style.display = 'none';
    
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.classList.remove('pulsing', 'completed');
    }
    
    updateProgress(0, 'Ready to process', 0);
    
    const processBtn = document.getElementById('process-btn');
    processBtn.disabled = false;
    processBtn.innerHTML = '<i class="fas fa-play-circle"></i> Generate Animation';
    
    const cancelBtn = document.getElementById('cancel-btn');
    cancelBtn.style.display = 'none';
    cancelBtn.disabled = false;
    cancelBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Cancel Processing';
}

function hideAdditionalResults() {
    const additionalResults = document.querySelector('.additional-results');
    if (additionalResults) {
        additionalResults.style.display = 'none';
    }
}

function showAdditionalResults() {
    const additionalResults = document.querySelector('.additional-results');
    if (additionalResults) {
        additionalResults.style.display = 'block';
    }
}

function showNotification(message, type = 'error') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icon = type === 'error' ? 'exclamation-circle' : 'check-circle';
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(notification);

    const notifications = container.querySelectorAll('.notification');
    if (notifications.length > 3) {
        notifications[0].remove();
    }

    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'fadeOut 0.5s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }
    }, 5000);
}

function updateProgress(progress, message, time) {
    const progressFill = document.getElementById('progress-fill');
    const statusMessage = document.getElementById('status-message');
    const timeCounter = document.getElementById('time-counter');
    
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
        
        if (progress > 0 && progress < 100) {
            progressFill.classList.add('pulsing');
        } else {
            progressFill.classList.remove('pulsing');
        }
        
        if (progress === 100) {
            progressFill.classList.add('completed');
        }
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
        
        if (time > 30) {
            timeCounter.style.color = 'var(--warning)';
        } else if (time > 60) {
            timeCounter.style.color = 'var(--error)';
        } else {
            timeCounter.style.color = 'var(--accent)';
        }
    }
}

async function checkServerHealth() {
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

async function startProcessing() {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
        showNotification('Server is not responding. Please refresh the page and try again.', 'error');
        return;
    }
    
    try {
        console.log('Starting processing...');
        
        cancelRequested = false;
        startTime = Date.now();
        
        const cancelBtn = document.getElementById('cancel-btn');
        cancelBtn.style.display = 'block';
        cancelBtn.disabled = false;

        await cleanupTask();
        
        if (!sourceImageUrl || !targetImageUrl) {
            showNotification('Please upload both source and target images');
            return;
        }

        const params = {
            size: parseInt(document.getElementById('size').value),
            fps: parseInt(document.getElementById('fps').value),
            duration: parseFloat(document.getElementById('duration').value),
            seed: parseInt(document.getElementById('seed').value),
            scale: parseInt(document.getElementById('scale').value),
            format: document.getElementById('format').value
        };

        if (!validateParams(params)) {
            return;
        }

        const sourceBlob = dataURLToBlob(sourceImageUrl);
        const targetBlob = dataURLToBlob(targetImageUrl);
        
        const sourceFile = new File([sourceBlob], 'source.png', { type: 'image/png' });
        const targetFile = new File([targetBlob], 'target.png', { type: 'image/png' });

        const formData = new FormData();
        formData.append('source', sourceFile);
        formData.append('target', targetFile);
        Object.entries(params).forEach(([key, value]) => {
            formData.append(key, value);
        });

        const processBtn = document.getElementById('process-btn');
        processBtn.disabled = true;
        processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        document.getElementById('animation-preview').style.display = 'none';
        document.getElementById('preview-progress').style.display = 'block';
        document.getElementById('animation-result').style.display = 'none';
        hideAdditionalResults();
        
        updateProgress(5, 'Starting processing...', 0);

        console.log('Sending upload request...');
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Upload response:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        currentTaskId = data.task_id;
        console.log('Current task ID set to:', currentTaskId);
        checkStatus();
        
    } catch (error) {
        console.error('Start processing error:', error);
        showNotification('Error: ' + error.message);
        resetPreview();
    }
}

function dataURLToBlob(dataURL) {
    const parts = dataURL.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);
    
    for (let i = 0; i < raw.length; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    
    return new Blob([uInt8Array], { type: contentType });
}

function validateParams(params) {
    const validations = [
        { check: params.size < 32 || params.size > 512, message: 'Image size must be between 32 and 512' },
        { check: params.fps < 1 || params.fps > 60, message: 'FPS must be between 1 and 60' },
        { check: params.duration < 1 || params.duration > 10, message: 'Duration must be between 0.1 and 10 seconds' },
        { check: params.scale < 1 || params.scale > 16, message: 'Scale must be between 1 and 16' },
        { check: params.seed < 0 || params.seed > 999999, message: 'Seed must be between 0 and 999999' }
    ];

    for (const validation of validations) {
        if (validation.check) {
            showNotification(validation.message);
            return false;
        }
    }
    return true;
}

function checkStatus() {
    if (!currentTaskId || cancelRequested) {
        console.log('Status check stopped: no task ID or cancel requested');
        return;
    }

    console.log('Checking status for task:', currentTaskId);
    
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    statusCheckInterval = setInterval(async () => {
        if (!currentTaskId || cancelRequested) {
            clearInterval(statusCheckInterval);
            return;
        }

        try {
            const response = await fetch(`/status/${currentTaskId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Status response:', data);

            const elapsedTime = data.time_elapsed || ((Date.now() - startTime) / 1000);
            totalProcessingTime = elapsedTime;

            if (data.status === 'processing') {
                const adjustedProgress = calculateAdjustedProgress(data.progress);
                const statusMessage = getStatusMessage(data.progress);
                
                updateProgress(
                    adjustedProgress,
                    statusMessage,
                    elapsedTime
                );
                
            } else if (data.status === 'completed') {
                clearInterval(statusCheckInterval);
                totalProcessingTime = data.time_elapsed || elapsedTime;
                animateCompletion(totalProcessingTime);
                
            } else if (data.status === 'error') {
                clearInterval(statusCheckInterval);
                showNotification('Processing error: ' + data.error);
                resetPreview();
            }
        } catch (error) {
            console.error('Status check error:', error);
            clearInterval(statusCheckInterval);
            showNotification('Error checking status: ' + error.message);
            resetPreview();
        }
    }, 1000);
}

function calculateAdjustedProgress(progress) {
    // Плавная кривая прогресса с реалистичным ускорением
    if (progress < 15) {
        return progress * 0.5; // Медленный старт
    } else if (progress < 40) {
        return 7.5 + (progress - 15) * 0.7; // Стабильный рост
    } else if (progress < 70) {
        return 25 + (progress - 40) * 0.9; // Ускорение
    } else if (progress < 90) {
        return 52 + (progress - 70) * 1.3; // Быстрый прогресс
    } else {
        return 78 + (progress - 90) * 2.2; // Финальный рывок
    }
}

function getStatusMessage(progress) {
    const messages = [
        { threshold: 10, message: "Initializing neural network..." },
        { threshold: 25, message: "Processing source image..." },
        { threshold: 40, message: "Analyzing target image..." },
        { threshold: 55, message: "Calculating pixel mapping..." },
        { threshold: 75, message: "Generating animation frames..." },
        { threshold: 90, message: "Finalizing animation..." },
        { threshold: 100, message: "Processing complete!" }
    ];

    for (let i = messages.length - 1; i >= 0; i--) {
        if (progress >= messages[i].threshold) {
            return messages[i].message;
        }
    }
    return "Starting processing...";
}

function animateCompletion(totalTime) {
    const progressFill = document.getElementById('progress-fill');
    const statusMessage = document.getElementById('status-message');
    const timeCounter = document.getElementById('time-counter');
    
    // Плавное заполнение до 100% с bounce эффектом
    let startProgress = parseFloat(progressFill.style.width) || 0;
    const targetProgress = 100;
    const duration = 1200;
    const startTime = Date.now();
    
    function animate() {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // easing function для плавного завершения
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentProgress = startProgress + (targetProgress - startProgress) * easeOut;
        
        progressFill.style.width = `${currentProgress}%`;
        timeCounter.textContent = `${totalTime.toFixed(1)}s`;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Финальные анимации
            progressFill.classList.remove('pulsing');
            progressFill.classList.add('completed');
            statusMessage.innerHTML = '<i class="fas fa-check-circle"></i> Processing complete!';
            
            setTimeout(() => {
                showResults(totalTime);
                scrollToTop();
            }, 800);
        }
    }
    
    animate();
}

function showResults(totalTime) {
    document.getElementById('animation-preview').style.display = 'none';
    document.getElementById('preview-progress').style.display = 'none';
    document.getElementById('animation-result').style.display = 'block';
    
    const completionTimeElement = document.getElementById('completion-time');
    if (completionTimeElement) {
        completionTimeElement.textContent = `Completed in ${totalTime.toFixed(1)}s`;
    }
    
    const videoElement = document.getElementById('result-video');
    const downloadBtn = document.getElementById('download-video-btn');
    
    videoElement.src = `/result/${currentTaskId}/animation`;
    downloadBtn.href = `/result/${currentTaskId}/animation`;
    
    showAdditionalResults();
    populateAdditionalResults();

    const processBtn = document.getElementById('process-btn');
    processBtn.disabled = false;
    processBtn.innerHTML = '<i class="fas fa-play-circle"></i> Generate Animation';

    document.getElementById('cancel-btn').style.display = 'none';
    
    showNotification(`Animation generated successfully in ${totalTime.toFixed(1)} seconds!`, 'success');
}

function populateAdditionalResults() {
    const resultsGrid = document.getElementById('additional-results-grid');
    
    resultsGrid.innerHTML = `
        <div class="result-item">
            <h3><i class="fas fa-image"></i> Final Reconstructed Image</h3>
            <img src="/result/${currentTaskId}/final_image" 
                 alt="Final reconstructed image" 
                 data-caption="Final Reconstructed Image"
                 data-download="/result/${currentTaskId}/final_image"
                 onerror="this.style.display='none'">
            <div>
                <a href="/result/${currentTaskId}/final_image" class="download-btn secondary" download>
                    <i class="fas fa-download"></i> Download PNG
                </a>
            </div>
        </div>
        <div class="result-item">
            <h3><i class="fas fa-chart-bar"></i> Diagnostic Visualization</h3>
            <img src="/result/${currentTaskId}/diagnostic" 
                 alt="Diagnostic visualization" 
                 data-caption="Diagnostic Visualization"
                 data-download="/result/${currentTaskId}/diagnostic"
                 onerror="this.style.display='none'">
            <div>
                <a href="/result/${currentTaskId}/diagnostic" class="download-btn secondary" download>
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
                <a href="/result/${currentTaskId}/mapping" class="download-btn secondary" download>
                    <i class="fas fa-download"></i> Download JSON
                </a>
            </div>
        </div>
    `;
    
    setupImageModalListeners();
}

function setupImageModalListeners() {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalCaption = document.getElementById('modal-caption-text');
    const modalDownloadBtn = document.getElementById('modal-download-btn');
    const closeBtn = document.querySelector('.modal-close');
    
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
    
    const resultImages = document.querySelectorAll('.result-item img');
    resultImages.forEach(img => {
        img.addEventListener('click', function() {
            openModal(this.src, this.getAttribute('data-caption'), this.getAttribute('data-download'));
        });
    });
}

function openModal(imageSrc, caption, downloadUrl) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalCaption = document.getElementById('modal-caption-text');
    const modalDownloadBtn = document.getElementById('modal-download-btn');
    
    modalImage.src = imageSrc;
    modalCaption.textContent = caption;
    modalDownloadBtn.href = downloadUrl;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('image-modal');
    
    modal.classList.remove('active');
    
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}

async function cancelProcessing() {
    console.log('Cancel requested');
    
    cancelRequested = true;
    const cancelBtn = document.getElementById('cancel-btn');
    cancelBtn.disabled = true;
    cancelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Canceling...';
    
    showNotification('Canceling current task...', 'success');
    
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
    
    await cleanupTask();
    
    cancelRequested = false;
    resetPreview();
    hideAdditionalResults();
    
    showNotification('Processing canceled', 'success');
}

function cleanupTask() {
    return new Promise((resolve) => {
        if (!currentTaskId) {
            resolve();
            return;
        }
        
        console.log('Cleaning up task:', currentTaskId);
        const taskIdToCleanup = currentTaskId;
        
        fetch(`/cleanup/${taskIdToCleanup}`, { method: 'DELETE' })
            .then(response => {
                if (!response.ok) {
                    console.warn('Cleanup request failed');
                }
                return response.json().catch(() => ({}));
            })
            .then(data => {
                console.log('Cleanup completed for task:', taskIdToCleanup);
                if (currentTaskId === taskIdToCleanup) {
                    currentTaskId = null;
                }
                resolve();
            })
            .catch(error => {
                console.error('Cleanup error:', error);
                if (currentTaskId === taskIdToCleanup) {
                    currentTaskId = null;
                }
                resolve();
            });
    });
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Функция для скрытия/показа опций масштаба
function toggleScaleOptions() {
    const sizeSelect = document.getElementById('size');
    const scaleSelect = document.getElementById('scale');
    const selectedSize = parseInt(sizeSelect.value);
    
    // Показываем все опции сначала
    Array.from(scaleSelect.options).forEach(option => {
        option.style.display = 'block';
        option.disabled = false;
    });
    
    // Скрываем опции в зависимости от размера
    if (selectedSize === 256) {
        // Для 256x256 скрываем 16x
        const option16x = scaleSelect.querySelector('option[value="16"]');
        if (option16x) {
            option16x.style.display = 'none';
            option16x.disabled = true;
        }
    } else if (selectedSize === 512) {
        // Для 512x512 скрываем 8x и 16x
        const option8x = scaleSelect.querySelector('option[value="8"]');
        const option16x = scaleSelect.querySelector('option[value="16"]');
        
        if (option8x) {
            option8x.style.display = 'none';
            option8x.disabled = true;
        }
        if (option16x) {
            option16x.style.display = 'none';
            option16x.disabled = true;
        }
    }
    
    // Если текущее выбранное значение стало недоступным, выбираем максимальное доступное
    const currentScale = parseInt(scaleSelect.value);
    const availableOptions = Array.from(scaleSelect.options).filter(opt => !opt.disabled);
    const availableValues = availableOptions.map(opt => parseInt(opt.value));
    
    if (!availableValues.includes(currentScale)) {
        scaleSelect.value = Math.max(...availableValues).toString();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Список всех элементов настроек
    const settingsElements = {
        size: document.getElementById('size'),
        fps: document.getElementById('fps'),
        duration: document.getElementById('duration'),
        scale: document.getElementById('scale'),
        seed: document.getElementById('seed'),
        format: document.getElementById('format')
    };

    // Загрузка настроек из localStorage
    const savedSettings = JSON.parse(localStorage.getItem('pixelflowSettings') || '{}');
    for (const key in settingsElements) {
        if (savedSettings[key] !== undefined) {
            settingsElements[key].value = savedSettings[key];
        }
    }

    // Сохранение настроек при изменении
    for (const key in settingsElements) {
        settingsElements[key].addEventListener('change', () => {
            const currentSettings = {};
            for (const k in settingsElements) {
                currentSettings[k] = settingsElements[k].value;
            }
            localStorage.setItem('pixelflowSettings', JSON.stringify(currentSettings));
        });
    }
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const sizeSelect = document.getElementById('size');
    
    // Устанавливаем обработчик изменения размера
    sizeSelect.addEventListener('change', toggleScaleOptions);
    
    // Инициализируем опции при загрузке
    toggleScaleOptions();
});

// Периодическая проверка здоровья сервера
setInterval(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
        console.warn('Server health check failed');
        const statusElement = document.getElementById('status-message');
        if (statusElement && statusElement.textContent.includes('Ready')) {
            statusElement.innerHTML = 'Server connection issues <span class="loading-dots"><span></span><span></span><span></span></span>';
        }
    }
}, 30000);