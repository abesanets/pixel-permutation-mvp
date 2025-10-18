"""
Web interface for Pixel Permutation MVP.
"""
import signal
import sys

def signal_handler(sig, frame):
    print('\n👋 Shutting down server gracefully...')
    # Дополнительная очистка если нужна
    sys.exit(0)

# Регистрируем обработчики сигналов
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

from flask import Flask, render_template, request, jsonify, send_file
import os
import tempfile
import json
import time
from pathlib import Path
import threading
from werkzeug.utils import secure_filename

from config import (MIN_SIZE, MAX_SIZE, MIN_FPS, MAX_FPS, MIN_DURATION, MAX_DURATION,
                    MIN_SCALE, MAX_SCALE, MIN_SEED, MAX_SEED, ALLOWED_FORMATS)

from fileio import load_image, save_mapping, create_output_dir
from proc import preprocess_images, extract_pixels
from assign import create_assignment
from render import create_animation, create_diagnostic, create_final_image

app = Flask(__name__)
app.config['SECRET_KEY'] = 'pixel-permutation-secret'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

# Create upload directory
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Store processing status and results
processing_status = {}
results = {}

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_images_task(task_id, source_path, target_path, params):
    """Background task to process images."""
    import time
    start_time = time.time()
    
    try:
        # Убедимся, что статус установлен
        processing_status[task_id] = {
            'status': 'processing', 
            'progress': 0,
            'logs': ["Starting pixel permutation process..."],
            'time_elapsed': 0
        }
        
        def log_message(message):
            try:
                current_time = time.time() - start_time
                if task_id in processing_status:
                    processing_status[task_id]['logs'].append(f"[{current_time:.1f}s] {message}")
                    processing_status[task_id]['time_elapsed'] = current_time
                print(f"Task {task_id}: {message}")
            except Exception as e:
                print(f"Logging error for {task_id}: {e}")
        
        try:
            # 1. Preprocess images
            log_message("Starting loading and preprocessing images...")
            processing_status[task_id]['progress'] = 10
            source_small, target_small = preprocess_images(source_path, target_path, params['size'])
            log_message(f"Resized images to {source_small.shape[1]}x{source_small.shape[0]}")
            log_message("Preprocessing complete.")
            
            # 2. Extract pixel data
            log_message("Starting extracting pixel data...")
            processing_status[task_id]['progress'] = 30
            source_pixels = extract_pixels(source_small)
            target_pixels = extract_pixels(target_small)
            log_message(f"Extracted {len(source_pixels)} source pixels and {len(target_pixels)} target pixels")
            log_message("Extraction complete.")
            
            # 3. Create assignment
            log_message("Starting creating pixel assignment using luminance-based matching...")
            processing_status[task_id]['progress'] = 50
            mapping = create_assignment(source_pixels, target_pixels, params['seed'])
            log_message(f"Created mapping for {len(mapping)} pixels")
            log_message("Assignment complete.")
            
            # 4. Create output directory
            output_dir = Path(tempfile.mkdtemp(prefix='pixel_perm_'))
            output_dir.mkdir(exist_ok=True)
            log_message(f"Created temporary output directory: {output_dir}")
            
            # 5. Create final reconstructed image
            log_message("Starting generating final reconstructed image...")
            processing_status[task_id]['progress'] = 60
            final_image_path = output_dir / "final_image.png"
            create_final_image(
                mapping, 
                source_small.shape,
                final_image_path,
                scale=params['scale']
            )
            log_message("Final image generated")
            
            # 6. Create animation
            log_message(f"Starting creating animation ({params['fps']} FPS, {params['duration']}s)...")
            processing_status[task_id]['progress'] = 80
            anim_path = output_dir / f"animation.{params['format']}"
            frames_dir = output_dir / "frames"
            
            create_animation(
                mapping, 
                source_small.shape,
                anim_path, 
                frames_dir,
                fps=params['fps'],
                duration=params['duration'],
                scale=params['scale'],
                output_format=params['format']
            )
            log_message("Animation rendering complete")
            
            # 7. Create diagnostic
            log_message("Starting creating diagnostic visualization...")
            processing_status[task_id]['progress'] = 90
            diagnostic_path = output_dir / "diagnostic.png"
            create_diagnostic(source_small, target_small, mapping, diagnostic_path)
            log_message("Diagnostic creation complete.")
            
            # 8. Save mapping
            log_message("Starting saving mapping data...")
            mapping_path = output_dir / "mapping.json"
            save_mapping(mapping, mapping_path)
            log_message("Saving mapping complete.")
            
            # Store results
            total_time = time.time() - start_time
            log_message(f"Process completed in {total_time:.2f} seconds!")
            
            results[task_id] = {
                'status': 'completed',
                'animation_path': str(anim_path),
                'final_image_path': str(final_image_path),
                'diagnostic_path': str(diagnostic_path),
                'mapping_path': str(mapping_path),
                'output_dir': str(output_dir),
                'total_time': total_time
            }
            
            processing_status[task_id] = {
                'status': 'completed', 
                'progress': 100,
                'logs': processing_status[task_id]['logs'],
                'time_elapsed': total_time
            }
            
        except Exception as e:
            error_time = time.time() - start_time
            log_message(f"ERROR during processing: {str(e)}")
            processing_status[task_id] = {
                'status': 'error', 
                'error': str(e),
                'logs': processing_status[task_id].get('logs', []) + [f"[{error_time:.1f}s] ERROR: {str(e)}"],
                'time_elapsed': error_time
            }
            print(f"Task {task_id} processing error: {e}")
            
    except Exception as e:
        print(f"Fatal error in process_images_task for {task_id}: {e}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health_check():
    """Health check endpoint to verify server is running."""
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time(),
        'active_tasks': len(processing_status)
    })

@app.route('/status/<task_id>')
def get_status(task_id):
    """Get processing status for a task."""
    status = processing_status.get(task_id, {'status': 'unknown'})
    return jsonify(status)

@app.route('/result/<task_id>/<file_type>')
def get_result(task_id, file_type):
    """Download result files."""
    if task_id not in results:
        return jsonify({'error': 'Result not found'}), 404
    
    result = results[task_id]
    
    if file_type == 'animation':
        file_path = result['animation_path']
        download_name = f"pixel_animation.{result['animation_path'].split('.')[-1]}"
    elif file_type == 'final_image':
        file_path = result['final_image_path']
        download_name = "final_reconstructed_image.png"
    elif file_type == 'diagnostic':
        file_path = result['diagnostic_path']
        download_name = "diagnostic.png"
    elif file_type == 'mapping':
        file_path = result['mapping_path']
        download_name = "mapping.json"
    else:
        return jsonify({'error': 'Invalid file type'}), 400
    
    return send_file(file_path, as_attachment=True, download_name=download_name)

@app.route('/cleanup/<task_id>', methods=['DELETE'])
def cleanup_task(task_id):
    """Clean up temporary files for a task."""
    try:
        print(f"Starting cleanup for task: {task_id}")
        
        # Очищаем загруженные файлы, связанные с этой задачей
        import glob
        upload_pattern = str(Path(app.config['UPLOAD_FOLDER']) / f"*{task_id}*")
        upload_files = glob.glob(upload_pattern)
        for file_path in upload_files:
            try:
                os.remove(file_path)
                print(f"Task {task_id}: Removed uploaded file {file_path}")
            except Exception as e:
                print(f"Task {task_id}: Error removing {file_path}: {e}")
        
        # Очищаем результаты задачи
        if task_id in results:
            try:
                output_dir = results[task_id]['output_dir']
                if os.path.exists(output_dir):
                    import shutil
                    shutil.rmtree(output_dir)
                    print(f"Task {task_id}: Cleaned up directory {output_dir}")
            except Exception as e:
                print(f"Task {task_id}: Error cleaning output dir: {e}")
        
        # Удаляем из памяти независимо от того, были ли файлы
        if task_id in results:
            del results[task_id]
            print(f"Task {task_id}: Removed from results")
        if task_id in processing_status:
            del processing_status[task_id]
            print(f"Task {task_id}: Removed from processing_status")
        
        print(f"Cleanup completed for task: {task_id}")
        return jsonify({'message': 'Cleaned up successfully'})
        
    except Exception as e:
        print(f"Cleanup error for {task_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_files():
    """Handle file upload and start processing."""
    try:
        # Добавим логирование для отладки
        print("Received upload request")
        
        if 'source' not in request.files or 'target' not in request.files:
            return jsonify({'error': 'Source and target files are required'}), 400
        
        source_file = request.files['source']
        target_file = request.files['target']
        
        if source_file.filename == '' or target_file.filename == '':
            return jsonify({'error': 'No files selected'}), 400
        
        if not (allowed_file(source_file.filename) and allowed_file(target_file.filename)):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Generate task ID first
        task_id = f"task_{len(processing_status)}_{os.urandom(4).hex()}"
        print(f"Generated new task ID: {task_id}")
        
        # Save uploaded files
        source_filename = secure_filename(source_file.filename)
        target_filename = secure_filename(target_file.filename)
        
        source_path = Path(app.config['UPLOAD_FOLDER']) / source_filename
        target_path = Path(app.config['UPLOAD_FOLDER']) / target_filename
        
        source_file.save(source_path)
        target_file.save(target_path)
        print(f"Saved files for task {task_id}")
        
        # Get parameters
        params = {
            'size': int(request.form.get('size', 128)),
            'fps': int(request.form.get('fps', 30)),
            'duration': float(request.form.get('duration', 4.0)),
            'seed': int(request.form.get('seed', 42)),
            'scale': int(request.form.get('scale', 8)),
            'format': request.form.get('format', 'mp4')
        }
        
        # Start background processing
        thread = threading.Thread(
            target=process_images_task,
            args=(task_id, str(source_path), str(target_path), params)
        )
        thread.daemon = True
        thread.start()
        
        print(f"Started processing thread for task: {task_id}")
        return jsonify({
            'task_id': task_id,
            'message': 'Processing started'
        })
        
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Run Pixel Permutation Web Interface')
    parser.add_argument('--port', type=int, default=5000, help='Port to run the server on')
    parser.add_argument('--host', default='0.0.0.0', help='Host to run the server on')
    args = parser.parse_args()
    
    print("🎨 Pixel Permutation MVP Web Interface")
    print("🚀 Starting server...")
    print(f"📡 Access at: http://localhost:{args.port}")
    print("💡 Make sure to upload both source and target images!")
    print("⏳ First run might take a moment to process...")
    
    app.run(debug=True, host=args.host, port=args.port)