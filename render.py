"""
Animation rendering and visualization functions.
"""

from pathlib import Path
from typing import List, Dict, Any
import numpy as np
import cv2
import imageio
from tqdm import tqdm


def create_animation(
    mapping: List[Dict[str, Any]],
    image_shape: tuple,
    output_path: Path,
    frames_dir: Path = None,
    fps: int = 30,
    duration: float = 4.0,
    scale: int = 8,
    output_format: str = "mp4"
) -> None:
    """
    Create animation of pixel permutation.
    
    Args:
        mapping: Pixel mapping data
        image_shape: Original image shape (height, width, channels)
        output_path: Output animation path
        frames_dir: Directory to save individual frames (optional)
        fps: Frames per second
        duration: Animation duration in seconds
        scale: Output scale factor
        output_format: Output format ('mp4' or 'gif')
    """
    height, width = image_shape[:2]
    num_frames = int(fps * duration)
    
    # Calculate output dimensions
    output_height = height * scale
    output_width = width * scale
    
    print(f"   Rendering {num_frames} frames at {output_width}x{output_height}")
    
    frames = []
    
    for frame_idx in tqdm(range(num_frames), desc="Rendering frames"):
        # Calculate interpolation factor (0 to 1)
        t = frame_idx / (num_frames - 1) if num_frames > 1 else 1.0
        
        # Create blank frame
        frame = np.zeros((output_height, output_width, 3), dtype=np.uint8)
        
        # Draw each pixel
        for pixel_data in mapping:
            src_x, src_y = pixel_data['src_pos']
            dst_x, dst_y = pixel_data['dst_pos']
            color = pixel_data['color']
            
            # Interpolate position
            current_x = int(src_x + (dst_x - src_x) * t)
            current_y = int(src_y + (dst_y - src_y) * t)
            
            # Scale position and draw pixel
            x1 = current_x * scale
            y1 = current_y * scale
            x2 = x1 + scale
            y2 = y1 + scale
            
            # Fill rectangle with pixel color (using nearest-neighbor concept)
            frame[y1:y2, x1:x2] = color
        
        # Convert RGB to BGR for OpenCV if saving individual frames
        frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        
        # Save frame if requested
        if frames_dir:
            frame_path = frames_dir / f"frame_{frame_idx:04d}.png"
            cv2.imwrite(str(frame_path), frame_bgr)
        
        # Convert back to RGB for imageio
        frames.append(frame)
    
    # Create animation
    print("   Encoding animation...")
    if output_format == "gif":
        imageio.mimsave(
            str(output_path), 
            frames, 
            fps=fps,
            loop=0
        )
    else:  # mp4
        imageio.mimsave(
            str(output_path), 
            frames, 
            fps=fps,
            quality=8
        )


def create_diagnostic(
    source_small: np.ndarray,
    target_small: np.ndarray, 
    mapping: List[Dict[str, Any]],
    output_path: Path,
    scale: int = 8
) -> None:
    """
    Create diagnostic visualization showing source, target, and mapping.
    
    Args:
        source_small: Resized source image
        target_small: Resized target image
        mapping: Pixel mapping data
        output_path: Output image path
        scale: Scale factor for visualization
    """
    import matplotlib.pyplot as plt
    from matplotlib.patches import Arrow
    
    height, width = source_small.shape[:2]
    
    # Create figure
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    
    # Plot source image
    axes[0, 0].imshow(source_small)
    axes[0, 0].set_title('Source Image (B)')
    axes[0, 0].axis('off')
    
    # Plot target image  
    axes[0, 1].imshow(target_small)
    axes[0, 1].set_title('Target Image (A)')
    axes[0, 1].axis('off')
    
    # Plot final reconstruction
    final_image = np.zeros_like(target_small)
    for pixel_data in mapping:
        dst_x, dst_y = pixel_data['dst_pos']
        color = pixel_data['color']
        final_image[dst_y, dst_x] = color
    
    axes[1, 0].imshow(final_image)
    axes[1, 0].set_title('Reconstructed Image')
    axes[1, 0].axis('off')
    
    # Sample some arrows to show mapping (don't show all 16384!)
    axes[1, 1].imshow(target_small, alpha=0.3)
    num_arrows = min(100, len(mapping))
    step = len(mapping) // num_arrows
    
    for i in range(0, len(mapping), step):
        pixel_data = mapping[i]
        src_x, src_y = pixel_data['src_pos']
        dst_x, dst_y = pixel_data['dst_pos']
        
        # Only show significant movements
        if abs(src_x - dst_x) > 2 or abs(src_y - dst_y) > 2:
            axes[1, 1].arrow(
                src_x, src_y, 
                dst_x - src_x, dst_y - src_y,
                head_width=1, head_length=1, 
                fc='red', ec='red', alpha=0.7
            )
    
    axes[1, 1].set_title('Pixel Mapping (sample arrows)')
    axes[1, 1].axis('off')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()


def verify_color_preservation(
    source_small: np.ndarray, 
    final_frame: np.ndarray,
    scale: int
) -> bool:
    """
    Verify that final frame uses exactly the same colors as source image.
    
    Args:
        source_small: Original source image (128x128)
        final_frame: Final animation frame (scaled)
        scale: Scale factor used
        
    Returns:
        True if colors are preserved
    """
    # Downsample final frame to original size using nearest-neighbor
    h, w = source_small.shape[:2]
    final_small = cv2.resize(
        final_frame, 
        (w, h), 
        interpolation=cv2.INTER_NEAREST
    )
    
    # Get unique colors
    source_colors = set(tuple(color) for color in source_small.reshape(-1, 3))
    final_colors = set(tuple(color) for color in final_small.reshape(-1, 3))
    
    return source_colors == final_colors