"""
Image preprocessing and pixel extraction functions.
"""

from typing import List, Dict, Any
import numpy as np
import cv2


def preprocess_images(source_path: str, target_path: str, size: int = 128) -> tuple:
    """
    Load and resize both source and target images to specified size.
    
    Args:
        source_path: Path to source image
        target_path: Path to target image  
        size: Target size (both width and height)
        
    Returns:
        Tuple of (source_small, target_small) as RGB arrays
    """
    from fileio import load_image
    
    # Load images
    source = load_image(source_path)
    target = load_image(target_path)
    
    # Resize using bilinear interpolation
    source_small = cv2.resize(source, (size, size), interpolation=cv2.INTER_LINEAR)
    target_small = cv2.resize(target, (size, size), interpolation=cv2.INTER_LINEAR)
    
    # Convert to integer RGB values
    source_small = source_small.astype(np.uint8)
    target_small = target_small.astype(np.uint8)
    
    return source_small, target_small


def extract_pixels(image: np.ndarray) -> List[Dict[str, Any]]:
    """
    Extract pixel data from resized image.
    
    Args:
        image: RGB image array of shape (height, width, 3)
        
    Returns:
        List of pixel dictionaries with id, color, and position
    """
    height, width = image.shape[:2]
    pixels = []
    
    for y in range(height):
        for x in range(width):
            pixel_id = y * width + x
            color = image[y, x].tolist()  # [r, g, b]
            
            pixels.append({
                'id': pixel_id,
                'color': color,
                'src_pos': [x, y]  # Note: OpenCV uses (x, y) but images are [y, x]
            })
    
    return pixels


def calculate_luminance(color: List[int]) -> float:
    """
    Calculate luminance from RGB color using standard weights.
    
    Args:
        color: [r, g, b] values 0-255
        
    Returns:
        Luminance value
    """
    r, g, b = color
    return 0.299 * r + 0.587 * g + 0.114 * b


def get_pixel_grid(size: int) -> List[List[int]]:
    """
    Generate grid positions for target layout.
    
    Args:
        size: Grid size (both dimensions)
        
    Returns:
        List of [x, y] positions
    """
    positions = []
    for y in range(size):
        for x in range(size):
            positions.append([x, y])
    return positions