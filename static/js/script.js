let currentTaskId = null;
let sourceImageUrl = null;
let targetImageUrl = null;
let cancelRequested = false;
let statusCheckInterval = null;

// Инициализация
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

function initializeApp() {
    restoreImagePreviews();
    setupEventListeners();
    resetPreview();
    hideAdditionalResults();
}

function setupEventListeners() {
    // Обработчики загрузки изображений через input
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

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
        showNotification('Please select an image file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        updatePreview(type, e.target.result);
        
        // Сохраняем URL
        if (type === 'source') {
            sourceImageUrl = e.target.result;
        } else {
            targetImageUrl = e.target.result;
        }
        
        // Сохраняем в localStorage
        saveToLocalStorage(type, e.target.result);
    };
    reader.readAsDataURL(file);
}

function updatePreview(type, imageData) {
    const previewElement = document.getElementById(`${type}-preview`);
    const placeholder = document.getElementById(`${type}-placeholder`);
    
    // Очищаем и создаем новое изображение
    previewElement.innerHTML = `
        <div class="preview-overlay">
            <i class="fas fa-sync-alt"></i>
            <span>Click to change</span>
        </div>
        <img src="${imageData}" class="preview-image">
    `;
    
    previewElement.classList.add('active');
    
    // Скрываем плейсхолдер
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

    // Ограничиваем количество уведомлений
    const notifications = container.querySelectorAll('.notification');
    if (notifications.length > 3) {
        notifications[0].remove();
    }

    // Автоматическое удаление
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
    const progressPercent = document.getElementById('progress-percent');
    const statusMessage = document.getElementById('status-message');
    const timeCounter = document.getElementById('time-counter');
    
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressPercent) progressPercent.textContent = `${progress}%`;
    if (statusMessage) statusMessage.textContent = message;
    if (timeCounter) timeCounter.textContent = `${time.toFixed(1)}s`;
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
        
        // Показываем кнопку отмены
        const cancelBtn = document.getElementById('cancel-btn');
        cancelBtn.style.display = 'block';
        cancelBtn.disabled = false;

        // Очищаем предыдущую задачу
        await cleanupTask();
        
        // Проверяем загруженные изображения
        if (!sourceImageUrl || !targetImageUrl) {
            showNotification('Please upload both source and target images');
            return;
        }

        // Получаем параметры
        const params = {
            size: parseInt(document.getElementById('size').value),
            fps: parseInt(document.getElementById('fps').value),
            duration: parseFloat(document.getElementById('duration').value),
            seed: parseInt(document.getElementById('seed').value),
            scale: parseInt(document.getElementById('scale').value),
            format: document.getElementById('format').value
        };

        // Валидация параметров
        if (!validateParams(params)) {
            return;
        }

        // Конвертируем DataURL в Blob для отправки
        const sourceBlob = dataURLToBlob(sourceImageUrl);
        const targetBlob = dataURLToBlob(targetImageUrl);
        
        const sourceFile = new File([sourceBlob], 'source.png', { type: 'image/png' });
        const targetFile = new File([targetBlob], 'target.png', { type: 'image/png' });

        // Подготавливаем FormData
        const formData = new FormData();
        formData.append('source', sourceFile);
        formData.append('target', targetFile);
        Object.entries(params).forEach(([key, value]) => {
            formData.append(key, value);
        });

        // Обновляем UI
        const processBtn = document.getElementById('process-btn');
        processBtn.disabled = true;
        processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        // Показываем прогресс
        document.getElementById('animation-preview').style.display = 'none';
        document.getElementById('preview-progress').style.display = 'block';
        document.getElementById('animation-result').style.display = 'none';
        hideAdditionalResults();
        
        updateProgress(5, 'Starting processing...', 0);

        // Отправляем запрос
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
        { check: params.size < 32 || params.size > 256, message: 'Image size must be between 32 and 256' },
        { check: params.fps < 1 || params.fps > 60, message: 'FPS must be between 1 and 60' },
        { check: params.duration < 0.5 || params.duration > 10, message: 'Duration must be between 0.5 and 10 seconds' },
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
    
    // Очищаем предыдущий интервал
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

            if (data.status === 'processing') {
                const adjustedProgress = calculateAdjustedProgress(data.progress);
                updateProgress(
                    adjustedProgress,
                    `Processing... ${data.progress}%`,
                    data.time_elapsed || 0
                );
            } else if (data.status === 'completed') {
                clearInterval(statusCheckInterval);
                updateProgress(100, 'Processing complete!', data.time_elapsed || 0);
                setTimeout(() => {
                    showResults(data.time_elapsed);
                    scrollToTop();
                }, 1000);
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
    if (progress < 30) {
        return progress * 0.8;
    } else if (progress < 80) {
        return 24 + (progress - 30) * 0.7;
    } else {
        return 59 + (progress - 80) * 2.05;
    }
}

function showResults(totalTime) {
    // Показываем основной результат
    document.getElementById('animation-preview').style.display = 'none';
    document.getElementById('preview-progress').style.display = 'none';
    document.getElementById('animation-result').style.display = 'block';
    
    const videoElement = document.getElementById('result-video');
    const downloadBtn = document.getElementById('download-video-btn');
    
    videoElement.src = `/result/${currentTaskId}/animation`;
    downloadBtn.href = `/result/${currentTaskId}/animation`;
    
    // Показываем дополнительные результаты
    showAdditionalResults();
    populateAdditionalResults();

    // Восстанавливаем кнопку процесса
    const processBtn = document.getElementById('process-btn');
    processBtn.disabled = false;
    processBtn.innerHTML = '<i class="fas fa-play-circle"></i> Generate Animation';

    // Скрываем кнопку отмены
    document.getElementById('cancel-btn').style.display = 'none';
}

function populateAdditionalResults() {
    const resultsGrid = document.getElementById('additional-results-grid');
    
    resultsGrid.innerHTML = `
        <div class="result-item">
            <h3><i class="fas fa-image"></i> Final Reconstructed Image</h3>
            <img src="/result/${currentTaskId}/final_image" alt="Final reconstructed image" onerror="this.style.display='none'">
            <div>
                <a href="/result/${currentTaskId}/final_image" class="download-btn secondary" download>
                    <i class="fas fa-download"></i> Download PNG
                </a>
            </div>
        </div>
        <div class="result-item">
            <h3><i class="fas fa-chart-bar"></i> Diagnostic Visualization</h3>
            <img src="/result/${currentTaskId}/diagnostic" alt="Diagnostic visualization" onerror="this.style.display='none'">
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
}

async function cancelProcessing() {
    console.log('Cancel requested');
    
    cancelRequested = true;
    const cancelBtn = document.getElementById('cancel-btn');
    cancelBtn.disabled = true;
    cancelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Canceling...';
    
    showNotification('Canceling current task...', 'success');
    
    // Останавливаем проверку статуса
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
    
    // Очищаем задачу
    await cleanupTask();
    
    // Восстанавливаем UI
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