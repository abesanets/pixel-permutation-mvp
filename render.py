"""
Optimized animation rendering and visualization functions.
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import cv2
import imageio
from tqdm import tqdm


def create_final_image(
    mapping: List[Dict[str, Any]],
    image_shape: tuple,
    output_path: Path,
    scale: int = 8
) -> np.ndarray:
    """
    Create the final reconstructed image from the mapping.
    
    Args:
        mapping: Pixel mapping data
        image_shape: Original image shape (height, width, channels)
        output_path: Output image path
        scale: Output scale factor
    """
    height, width = image_shape[:2]
    
    # Use optimized image creation
    final_image = _create_image_from_mapping_vectorized(
        mapping, width, height, scale
    )
    
    # Save with optimized parameters
    if output_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
        cv2.imwrite(str(output_path), final_image[..., ::-1])  # RGB to BGR
    else:
        imageio.imwrite(str(output_path), final_image)
    
    return final_image


def _create_image_from_mapping_vectorized(
    mapping: List[Dict[str, Any]],
    width: int,
    height: int,
    scale: int,
    t: float = 1.0
) -> np.ndarray:
    """Create image from mapping using fully vectorized operations."""
    # Pre-allocate small image first, then scale up
    small_img = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Extract arrays for vectorized processing
    if t < 1.0:
        # For animation frames - interpolate positions
        src_pos = np.array([p['src_pos'] for p in mapping], dtype=np.float32)
        dst_pos = np.array([p['dst_pos'] for p in mapping], dtype=np.float32)
        current_pos = src_pos + (dst_pos - src_pos) * t
        positions = np.round(current_pos).astype(np.int32)
    else:
        # For final image - use destination positions directly
        positions = np.array([p['dst_pos'] for p in mapping], dtype=np.int32)
    
    colors = np.array([p['color'] for p in mapping], dtype=np.uint8)
    
    # Vectorized assignment to small image
    y_coords = np.clip(positions[:, 1], 0, height - 1)
    x_coords = np.clip(positions[:, 0], 0, width - 1)
    small_img[y_coords, x_coords] = colors
    
    # Scale up using OpenCV for better performance
    if scale > 1:
        final_image = cv2.resize(small_img, (width * scale, height * scale), 
                               interpolation=cv2.INTER_NEAREST)
    else:
        final_image = small_img
    
    return final_image


def create_animation(
    mapping: List[Dict[str, Any]],
    image_shape: tuple,
    output_path: Path,
    frames_dir: Optional[Path] = None,
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
    
    print(f"   Rendering {num_frames} frames at {width*scale}x{height*scale}")
    
    # Pre-extract data for vectorization (moved outside loop)
    src_pos = np.array([p['src_pos'] for p in mapping], dtype=np.float32)
    dst_pos = np.array([p['dst_pos'] for p in mapping], dtype=np.float32)
    colors = np.array([p['color'] for p in mapping], dtype=np.uint8)
    
    # Generate frames with progress bar
    frames = []
    for frame_idx in tqdm(range(num_frames), desc="Rendering frames"):
        t = frame_idx / (num_frames - 1) if num_frames > 1 else 1.0
        
        # Create frame using optimized method
        frame = _create_frame_vectorized(
            src_pos, dst_pos, colors, width, height, scale, t
        )
        
        if frames_dir:
            frame_path = frames_dir / f"frame_{frame_idx:04d}.png"
            cv2.imwrite(str(frame_path), frame[..., ::-1])
        
        frames.append(frame)
    
    # Add final frame pause
    final_frame = frames[-1]
    frames.extend([final_frame] * int(fps))
    
    print(f"   Encoding animation with {len(frames)} frames...")
    _save_animation_optimized(frames, output_path, fps, output_format)


def _create_frame_vectorized(
    src_pos: np.ndarray,
    dst_pos: np.ndarray,
    colors: np.ndarray,
    width: int,
    height: int,
    scale: int,
    t: float
) -> np.ndarray:
    """Create a single frame using fully vectorized operations."""
    # Vectorized interpolation
    current_pos = src_pos + (dst_pos - src_pos) * t
    positions = np.round(current_pos).astype(np.int32)
    
    # Create small image first
    small_img = np.zeros((height, width, 3), dtype=np.uint8)
    y_coords = np.clip(positions[:, 1], 0, height - 1)
    x_coords = np.clip(positions[:, 0], 0, width - 1)
    small_img[y_coords, x_coords] = colors
    
    # Scale up
    if scale > 1:
        frame = cv2.resize(small_img, (width * scale, height * scale), 
                         interpolation=cv2.INTER_NEAREST)
    else:
        frame = small_img
    
    return frame


def _save_animation_optimized(
    frames: List[np.ndarray],
    output_path: Path,
    fps: int,
    output_format: str
) -> None:
    """Save animation with optimized parameters."""
    if output_format == "gif":
        # Use subrectangles for smaller GIF files
        imageio.mimsave(
            str(output_path), 
            frames, 
            fps=fps,
            loop=0,
            subrectangles=True  # Only store changed parts between frames
        )
    else:  # mp4
        # Optimized MP4 encoding
        imageio.mimsave(
            str(output_path), 
            frames, 
            fps=fps,
            quality=8,
            codec='libx264',
            pixelformat='yuv420p',
            macro_block_size=8  # Smaller blocks for faster encoding
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
    """
    height, width = source_small.shape[:2]
    
    # Create figure with smaller size for faster rendering
    fig, axes = plt.subplots(2, 2, figsize=(10, 8))
    
    # Plot images without interpolation for speed
    axes[0, 0].imshow(source_small, interpolation='none')
    axes[0, 0].set_title('Source Image (B)', fontsize=9)
    axes[0, 0].axis('off')
    
    axes[0, 1].imshow(target_small, interpolation='none')
    axes[0, 1].set_title('Target Image (A)', fontsize=9)
    axes[0, 1].axis('off')
    
    # Create final reconstruction efficiently
    final_image = _create_final_reconstruction_vectorized(mapping, target_small.shape)
    axes[1, 0].imshow(final_image, interpolation='none')
    axes[1, 0].set_title('Reconstructed Image', fontsize=9)
    axes[1, 0].axis('off')
    
    # Optimized arrow plotting with fewer samples
    _plot_arrow_samples_optimized(mapping, target_small, axes[1, 1])
    
    # Save with optimized parameters - REMOVED 'optimize' parameter
    plt.savefig(output_path, dpi=100, bbox_inches='tight', 
                facecolor='white', edgecolor='none')
    plt.close(fig)


def _create_final_reconstruction_vectorized(
    mapping: List[Dict[str, Any]], 
    shape: Tuple[int, int, int]
) -> np.ndarray:
    """Create final reconstruction image using vectorized operations."""
    final_image = np.zeros(shape, dtype=np.uint8)
    
    # Vectorized assignment
    dst_positions = np.array([p['dst_pos'] for p in mapping])
    colors = np.array([p['color'] for p in mapping])
    
    # Use advanced indexing for vectorized assignment
    y_coords = dst_positions[:, 1]
    x_coords = dst_positions[:, 0]
    
    # Ensure coordinates are within bounds
    valid_mask = (x_coords < shape[1]) & (y_coords < shape[0]) & (x_coords >= 0) & (y_coords >= 0)
    
    final_image[y_coords[valid_mask], x_coords[valid_mask]] = colors[valid_mask]
    
    return final_image


def _plot_arrow_samples_optimized(
    mapping: List[Dict[str, Any]],
    target_small: np.ndarray,
    ax: plt.Axes
) -> None:
    """Plot sampled arrows efficiently with reduced samples."""
    ax.imshow(target_small, alpha=0.3, interpolation='none')
    
    # Use fixed number of samples for consistency
    num_arrows = min(80, len(mapping))
    if len(mapping) > num_arrows:
        indices = np.random.choice(len(mapping), num_arrows, replace=False)
    else:
        indices = np.arange(len(mapping))
    
    # Batch process arrow data
    arrows_data = []
    for i in indices:
        pixel_data = mapping[i]
        src_x, src_y = pixel_data['src_pos']
        dst_x, dst_y = pixel_data['dst_pos']
        
        # Only plot arrows with significant movement
        if abs(src_x - dst_x) > 1 or abs(src_y - dst_y) > 1:
            arrows_data.append((src_x, src_y, dst_x - src_x, dst_y - src_y))
    
    # Batch plot arrows with simpler styling
    for src_x, src_y, dx, dy in arrows_data:
        ax.arrow(
            src_x, src_y, dx, dy,
            head_width=0.8, head_length=0.8, 
            fc='red', ec='red', alpha=0.6,
            length_includes_head=True,
            linewidth=0.8
        )
    
    ax.set_title('Pixel Mapping (sample arrows)', fontsize=9)
    ax.axis('off')


def verify_color_preservation(
    source_img: np.ndarray, 
    result_img: np.ndarray, 
    tolerance: int = 5
) -> bool:
    """
    Verify that colors are preserved between source and result.
    
    Args:
        source_img: Source image
        result_img: Result image to verify
        tolerance: Color difference tolerance
    
    Returns:
        bool: True if colors are preserved within tolerance
    """
    # Resize result to match source if different sizes
    if source_img.shape != result_img.shape:
        result_img = cv2.resize(result_img, (source_img.shape[1], source_img.shape[0]))
    
    # Calculate color differences
    diff = cv2.absdiff(source_img, result_img)
    max_diff = np.max(diff)
    
    print(f"Maximum color difference: {max_diff}")
    
    return max_diff <= tolerance