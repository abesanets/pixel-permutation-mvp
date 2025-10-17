"""
I/O operations for image loading and data saving.
"""

import json
from pathlib import Path
from typing import List, Dict, Any

import cv2
import numpy as np


def load_image(image_path: str) -> np.ndarray:
    """
    Load an image and convert to RGB format.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        RGB image as numpy array
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not load image: {image_path}")
    
    # Convert BGR to RGB
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return img_rgb


def save_image(image: np.ndarray, output_path: Path) -> None:
    """
    Save an RGB image to file.
    
    Args:
        image: RGB image array
        output_path: Output file path
    """
    # Convert RGB to BGR for OpenCV
    img_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    cv2.imwrite(str(output_path), img_bgr)


def create_output_dir(output_path: str) -> Path:
    """
    Create output directory if it doesn't exist.
    
    Args:
        output_path: Output directory path
        
    Returns:
        Path object for the output directory
    """
    output_dir = Path(output_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "frames").mkdir(exist_ok=True)
    return output_dir


def save_mapping(mapping: List[Dict[str, Any]], output_path: Path) -> None:
    """
    Save pixel mapping to JSON file.
    
    Args:
        mapping: List of pixel mapping dictionaries
        output_path: Output JSON file path
    """
    with open(output_path, 'w') as f:
        json.dump(mapping, f, indent=2)


def load_mapping(input_path: Path) -> List[Dict[str, Any]]:
    """
    Load pixel mapping from JSON file.
    
    Args:
        input_path: Input JSON file path
        
    Returns:
        List of pixel mapping dictionaries
    """
    with open(input_path, 'r') as f:
        return json.load(f)