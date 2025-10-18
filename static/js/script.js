let currentTaskId = null;
let sourceImageUrl = null;
let targetImageUrl = null;
let cancelRequested = false;
let statusCheckInterval = null;

function setupCancelButton() {
    const cancelBtn = document.getElementById('cancel-btn');
    if (!cancelBtn) return;
    
    // Очищаем старые обработчики
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    document.getElementById('cancel-btn').addEventListener('click', function () {
        cancelRequested = true;
        const btn = document.getElementById('cancel-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Canceling...';
        showNotification('Canceling current task...', 'success');
        
        // Останавливаем проверку статуса
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
        }
        
        cleanupTask().then(() => {
            currentTaskId = null;
            cancelRequested = false;
            document.getElementById('cancel-btn').style.display = 'none';
            const processBtn = document.getElementById('process-btn');
            processBtn.disabled = false;
            processBtn.innerHTML = '<i class="fas fa-play-circle"></i> Generate Animation';
            updateProgress(0, 'Ready to process', ['Processing canceled by user.'], 0);
        });
    });
}

// Initialize image previews
document.addEventListener('DOMContentLoaded', function () {
    restoreImagePreviews();

    document.getElementById('source').addEventListener('change', function (e) {
        handleImagePreview(e, 'source-preview');
    });

    document.getElementById('target').addEventListener('change', function (e) {
        handleImagePreview(e, 'target-preview');
    });

    document.getElementById('process-btn').addEventListener('click', startProcessing);
    document.getElementById('new-generation-btn').addEventListener('click', cleanup);

    updateProgress(0, 'Ready to process', ['System ready. Upload images and click "Generate Animation" to start.'], 0);
    setupCancelButton();
});

function handleImagePreview(event, previewId) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const previewElement = document.getElementById(previewId);
            previewElement.innerHTML = '';
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'preview-image';
            previewElement.appendChild(img);

            if (previewId === 'source-preview') {
                sourceImageUrl = e.target.result;
            } else {
                targetImageUrl = e.target.result;
            }
        };
        reader.readAsDataURL(file);
    }
}

function restoreImagePreviews() {
    if (sourceImageUrl) {
        const previewElement = document.getElementById('source-preview');
        previewElement.innerHTML = '';
        const img = document.createElement('img');
        img.src = sourceImageUrl;
        img.className = 'preview-image';
        previewElement.appendChild(img);
    }

    if (targetImageUrl) {
        const previewElement = document.getElementById('target-preview');
        previewElement.innerHTML = '';
        const img = document.createElement('img');
        img.src = targetImageUrl;
        img.className = 'preview-image';
        previewElement.appendChild(img);
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

function updateProgress(progress, message, logs, time) {
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-percent').textContent = `${progress}%`;
    document.getElementById('status-message').textContent = message;
    document.getElementById('time-counter').textContent = `${time.toFixed(1)}s`;

    const stages = ['preprocess', 'extraction', 'assignment', 'rendering', 'final'];
    stages.forEach((stage, index) => {
        const stageElement = document.getElementById(`stage-${stage}`);
        const stageProgress = (index + 1) * 20;

        if (progress >= stageProgress) {
            stageElement.classList.add('completed');
        } else if (progress >= (index * 20)) {
            stageElement.classList.add('active');
            stageElement.classList.remove('completed');
        } else {
            stageElement.classList.remove('active', 'completed');
        }
    });

    const consoleLog = document.getElementById('console-log');
    logs.forEach(log => {
        if (!consoleLog.querySelector(`[data-log="${log}"]`)) {
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            logEntry.textContent = log;
            logEntry.setAttribute('data-log', log);
            consoleLog.appendChild(logEntry);
        }
    });

    const logEntries = consoleLog.querySelectorAll('.log-entry');
    if (logEntries.length > 20) {
        for (let i = 0; i < logEntries.length - 20; i++) {
            consoleLog.removeChild(logEntries[i]);
        }
    }

    consoleLog.scrollTo({
        top: consoleLog.scrollHeight,
        behavior: 'smooth'
    });
}

// Функция проверки здоровья сервера
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

// Обновите startProcessing с проверкой здоровья
async function startProcessing() {
    // Проверяем здоровье сервера перед началом
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
        showNotification('Server is not responding. Please refresh the page and try again.', 'error');
        return;
    }
    try {
        console.log('Starting processing...');
        
        // Сбрасываем состояния
        cancelRequested = false;
        
        // Показываем кнопку отмены
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) {
            cancelBtn.style.display = 'block';
            cancelBtn.disabled = false;
            cancelBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Cancel Processing';
        }

        // Очищаем предыдущую задачу
        await cleanupTask();
        
        const sourceFile = document.getElementById('source').files[0];
        const targetFile = document.getElementById('target').files[0];

        if (!sourceFile || !targetFile) {
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

        // Client-side validation
        if (params.size < 32 || params.size > 256) {
            showNotification('Image size must be between 32 and 256');
            return;
        }
        if (params.fps < 1 || params.fps > 60) {
            showNotification('FPS must be between 1 and 60');
            return;
        }
        if (params.duration < 0.5 || params.duration > 10) {
            showNotification('Duration must be between 0.5 and 10 seconds');
            return;
        }
        if (params.scale < 1 || params.scale > 16) {
            showNotification('Scale must be between 1 and 16');
            return;
        }
        if (params.seed < 0 || params.seed > 999999) {
            showNotification('Seed must be between 0 and 999999');
            return;
        }

        // Create FormData
        const formData = new FormData();
        formData.append('source', sourceFile);
        formData.append('target', targetFile);
        formData.append('size', params.size);
        formData.append('fps', params.fps);
        formData.append('duration', params.duration);
        formData.append('seed', params.seed);
        formData.append('scale', params.scale);
        formData.append('format', params.format);

        // Disable process button
        const processBtn = document.getElementById('process-btn');
        processBtn.disabled = true;
        processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        // Show loading status
        updateProgress(5, 'Starting processing...', ['Starting pixel permutation process...'], 0);

        // Send request
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
        const processBtn = document.getElementById('process-btn');
        processBtn.disabled = false;
        processBtn.innerHTML = '<i class="fas fa-play-circle"></i> Generate Animation';
        updateProgress(0, 'Ready to process', ['Error occurred. Ready to try again.'], 0);
        
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';
    }
}

function checkStatus() {
    if (!currentTaskId || cancelRequested) {
        console.log('Status check stopped: no task ID or cancel requested');
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';
        return;
    }

    console.log('Checking status for task:', currentTaskId);
    
    // Используем интервал вместо рекурсивного setTimeout для лучшего контроля
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
                let adjustedProgress = data.progress;
                if (data.progress < 30) {
                    adjustedProgress = data.progress * 0.8;
                } else if (data.progress < 80) {
                    adjustedProgress = 24 + (data.progress - 30) * 0.7;
                } else {
                    adjustedProgress = 59 + (data.progress - 80) * 2.05;
                }

                updateProgress(
                    adjustedProgress,
                    `Processing... ${data.progress}%`,
                    data.logs || [],
                    data.time_elapsed || 0
                );
            } else if (data.status === 'completed') {
                clearInterval(statusCheckInterval);
                updateProgress(100, 'Processing complete!', data.logs || [], data.time_elapsed || 0);
                showResults(data.time_elapsed);
                const cancelBtn = document.getElementById('cancel-btn');
                if (cancelBtn) cancelBtn.style.display = 'none';
            } else if (data.status === 'error') {
                clearInterval(statusCheckInterval);
                showNotification('Processing error: ' + data.error);
                const processBtn = document.getElementById('process-btn');
                processBtn.disabled = false;
                processBtn.innerHTML = '<i class="fas fa-play-circle"></i> Generate Animation';
                updateProgress(0, 'Ready to process', data.logs || [], data.time_elapsed || 0);
                const cancelBtn = document.getElementById('cancel-btn');
                if (cancelBtn) cancelBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Status check error:', error);
            clearInterval(statusCheckInterval);
            showNotification('Error checking status: ' + error.message);
            const processBtn = document.getElementById('process-btn');
            processBtn.disabled = false;
            processBtn.innerHTML = '<i class="fas fa-play-circle"></i> Generate Animation';
            const cancelBtn = document.getElementById('cancel-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
        }
    }, 1000);
}

function showResults(totalTime) {
    const resultsSection = document.getElementById('results-section');
    const resultsGrid = document.getElementById('results-grid');
    const completionTime = document.getElementById('completion-time');

    completionTime.textContent = `Completed in ${totalTime.toFixed(1)}s`;

    resultsGrid.innerHTML = `
        <div class="result-item">
            <h3><i class="fas fa-film"></i> Animation</h3>
            <video controls autoplay loop muted>
                <source src="/result/${currentTaskId}/animation" type="video/mp4">
                Your browser does not support the video tag.
            </video>
            <div>
                <a href="/result/${currentTaskId}/animation" class="download-btn" download>
                    <i class="fas fa-download"></i> Download MP4
                </a>
            </div>
        </div>
        <div class="result-item">
            <h3><i class="fas fa-image"></i> Final Reconstructed Image</h3>
            <img src="/result/${currentTaskId}/final_image" alt="Final reconstructed image">
            <div>
                <a href="/result/${currentTaskId}/final_image" class="download-btn secondary" download>
                    <i class="fas fa-download"></i> Download PNG
                </a>
            </div>
        </div>
        <div class="result-item">
            <h3><i class="fas fa-chart-bar"></i> Diagnostic Visualization</h3>
            <img src="/result/${currentTaskId}/diagnostic" alt="Diagnostic visualization">
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

    resultsSection.style.display = 'block';
    const processBtn = document.getElementById('process-btn');
    processBtn.disabled = false;
    processBtn.innerHTML = '<i class="fas fa-play-circle"></i> Generate Animation';

    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function cleanupTask() {
    return new Promise((resolve) => {
        console.log('Starting cleanup task, currentTaskId:', currentTaskId);
        
        // Останавливаем проверку статуса
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
        }

        if (currentTaskId) {
            const taskIdToCleanup = currentTaskId;
            console.log('Cleaning up task:', taskIdToCleanup);
            
            fetch(`/cleanup/${taskIdToCleanup}`, { method: 'DELETE' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Cleanup response:', data);
                    if (currentTaskId === taskIdToCleanup) {
                        currentTaskId = null;
                    }
                    resolve();
                })
                .catch(error => {
                    console.error('Cleanup error:', error);
                    // Все равно разрешаем промис даже при ошибке
                    if (currentTaskId === taskIdToCleanup) {
                        currentTaskId = null;
                    }
                    resolve();
                });
        } else {
            console.log('No current task to clean up');
            resolve();
        }
    });
}

async function cleanup() {
    showNotification('Cleaning up previous task...', 'success');
    await cleanupTask();

    currentTaskId = null;
    cancelRequested = false;
    document.getElementById('results-section').style.display = 'none';
    updateProgress(0, 'Ready to process', ['System ready. Upload images and click "Generate Animation" to start.'], 0);

    document.querySelectorAll('.stage').forEach(stage => {
        stage.classList.remove('active', 'completed');
    });

    document.getElementById('source').value = '';
    document.getElementById('target').value = '';

    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';

    showNotification('Ready for new generation', 'success');
}

// Периодическая проверка здоровья сервера
setInterval(async () => {
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
        console.warn('Server health check failed');
        // Можно показать предупреждение пользователю
        const statusElement = document.getElementById('status-message');
        if (statusElement && statusElement.textContent.includes('Ready')) {
            statusElement.innerHTML = 'Server connection issues <span class="loading-dots"><span></span><span></span><span></span></span>';
        }
    }
}, 30000); // Проверяем каждые 30 секунд