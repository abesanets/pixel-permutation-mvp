"""
Configuration for parameter limits and defaults.
Edit these values to change allowed ranges for size, fps, etc.
These are used in both CLI (run_mvp.py) and web (web_interface.py) for validation.
"""

# Image processing size (must be square, affects computation time and memory)
MIN_SIZE = 32
MAX_SIZE = 512

# Frames per second for animation
MIN_FPS = 1
MAX_FPS = 120

# Animation duration in seconds
MIN_DURATION = 0.1
MAX_DURATION = 10.0

# Output scale factor (pixel magnification)
MIN_SCALE = 1
MAX_SCALE = 16

# Random seed range
MIN_SEED = 0
MAX_SEED = 999999

# Supported output formats
ALLOWED_FORMATS = ['mp4', 'gif']

# Default values (used if not specified)
DEFAULT_SIZE = 128
DEFAULT_FPS = 30
DEFAULT_DURATION = 4.0
DEFAULT_SCALE = 8
DEFAULT_FORMAT = 'mp4'
DEFAULT_SEED = 42