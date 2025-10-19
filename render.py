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
    output_height = height * scale
    output_width = width * scale
    
    # Pre-allocate and create image using vectorized operations
    final_image = _create_image_from_mapping(
        mapping, width, height, output_width, output_height, scale
    )
    
    # Save directly without extra conversion when possible
    if output_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
        cv2.imwrite(str(output_path), final_image[..., ::-1])  # RGB to BGR
    else:
        imageio.imwrite(str(output_path), final_image)
    
    return final_image


def _create_image_from_mapping(
    mapping: List[Dict[str, Any]],
    width: int,
    height: int,
    output_width: int,
    output_height: int,
    scale: int,
    t: float = 1.0
) -> np.ndarray:
    """Create image from mapping with optional interpolation."""
    # Pre-allocate output array
    final_image = np.zeros((output_height, output_width, 3), dtype=np.uint8)
    
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
    
    # Vectorized scaling and drawing
    scaled_positions = positions * scale
    x1 = scaled_positions[:, 0]
    y1 = scaled_positions[:, 1]
    
    # Create all rectangles at once using broadcasting
    for i in range(len(mapping)):
        x1_i, y1_i = x1[i], y1[i]
        x2_i, y2_i = x1_i + scale, y1_i + scale
        final_image[y1_i:y2_i, x1_i:x2_i] = colors[i]
    
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
    output_height = height * scale
    output_width = width * scale
    
    print(f"   Rendering {num_frames} frames at {output_width}x{output_height}")
    
    # Pre-compute all frames
    frames = _compute_animation_frames(
        mapping, width, height, output_width, output_height, 
        scale, num_frames, frames_dir
    )
    
    # Add final frame pause
    final_frame = frames[-1]
    extra_frames = int(fps)
    frames.extend([final_frame] * extra_frames)
    
    print(f"   Added {extra_frames} frames for final pause (total: {len(frames)})")
    print("   Encoding animation...")
    
    # Optimized encoding
    _save_animation(frames, output_path, fps, output_format)


def _compute_animation_frames(
    mapping: List[Dict[str, Any]],
    width: int,
    height: int,
    output_width: int,
    output_height: int,
    scale: int,
    num_frames: int,
    frames_dir: Optional[Path] = None
) -> List[np.ndarray]:
    """Compute all animation frames efficiently."""
    frames = []
    
    # Pre-extract data for vectorization
    src_pos = np.array([p['src_pos'] for p in mapping], dtype=np.float32)
    dst_pos = np.array([p['dst_pos'] for p in mapping], dtype=np.float32)
    colors = np.array([p['color'] for p in mapping], dtype=np.uint8)
    
    for frame_idx in tqdm(range(num_frames), desc="Rendering frames"):
        t = frame_idx / (num_frames - 1) if num_frames > 1 else 1.0
        
        # Vectorized interpolation
        current_pos = src_pos + (dst_pos - src_pos) * t
        positions = np.round(current_pos).astype(np.int32)
        
        # Create frame using optimized drawing
        frame = _create_frame_from_arrays(
            positions, colors, output_width, output_height, scale
        )
        
        if frames_dir:
            frame_path = frames_dir / f"frame_{frame_idx:04d}.png"
            cv2.imwrite(str(frame_path), frame[..., ::-1])  # RGB to BGR
        
        frames.append(frame)
    
    return frames


def _create_frame_from_arrays(
    positions: np.ndarray,
    colors: np.ndarray,
    output_width: int,
    output_height: int,
    scale: int
) -> np.ndarray:
    """Create a single frame from pre-computed arrays."""
    frame = np.zeros((output_height, output_width, 3), dtype=np.uint8)
    
    # Vectorized scaling
    scaled_positions = positions * scale
    x1 = scaled_positions[:, 0]
    y1 = scaled_positions[:, 1]
    
    # Batch draw rectangles
    for i in range(len(positions)):
        x1_i, y1_i = x1[i], y1[i]
        x2_i, y2_i = x1_i + scale, y1_i + scale
        frame[y1_i:y2_i, x1_i:x2_i] = colors[i]
    
    return frame


def _save_animation(
    frames: List[np.ndarray],
    output_path: Path,
    fps: int,
    output_format: str
) -> None:
    """Save animation with optimized parameters."""
    if output_format == "gif":
        imageio.mimsave(
            str(output_path), 
            frames, 
            fps=fps,
            loop=0
        )
    else:  # mp4
        # Use faster codec and optimized settings
        imageio.mimsave(
            str(output_path), 
            frames, 
            fps=fps,
            quality=7,  # Slightly reduced quality for speed
            codec='libx264',  # Fast H.264 encoding
            pixelformat='yuv420p'  # Standard pixel format
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
    
    # Create figure without tight_layout initially
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    
    # Plot images
    axes[0, 0].imshow(source_small)
    axes[0, 0].set_title('Source Image (B)', fontsize=10)
    axes[0, 0].axis('off')
    
    axes[0, 1].imshow(target_small)
    axes[0, 1].set_title('Target Image (A)', fontsize=10)
    axes[0, 1].axis('off')
    
    # Create final reconstruction efficiently
    final_image = _create_final_reconstruction(mapping, target_small.shape)
    axes[1, 0].imshow(final_image)
    axes[1, 0].set_title('Reconstructed Image', fontsize=10)
    axes[1, 0].axis('off')
    
    # Optimized arrow plotting
    _plot_arrow_samples(mapping, target_small, axes[1, 1])
    
    # Use constrained_layout instead of tight_layout for better performance
    plt.savefig(output_path, dpi=150, bbox_inches='tight', 
                facecolor='white', edgecolor='none')
    plt.close(fig)  # Explicitly close to free memory


def _create_final_reconstruction(
    mapping: List[Dict[str, Any]], 
    shape: Tuple[int, int, int]
) -> np.ndarray:
    """Create final reconstruction image efficiently."""
    final_image = np.zeros(shape, dtype=np.uint8)
    
    # Vectorized assignment
    dst_positions = np.array([p['dst_pos'] for p in mapping])
    colors = np.array([p['color'] for p in mapping])
    
    for (x, y), color in zip(dst_positions, colors):
        final_image[y, x] = color
    
    return final_image


def _plot_arrow_samples(
    mapping: List[Dict[str, Any]],
    target_small: np.ndarray,
    ax: plt.Axes
) -> None:
    """Plot sampled arrows efficiently."""
    ax.imshow(target_small, alpha=0.3)
    
    num_arrows = min(100, len(mapping))
    step = max(1, len(mapping) // num_arrows)
    
    # Pre-compute positions and filter
    arrows_data = []
    for i in range(0, len(mapping), step):
        pixel_data = mapping[i]
        src_x, src_y = pixel_data['src_pos']
        dst_x, dst_y = pixel_data['dst_pos']
        
        if abs(src_x - dst_x) > 2 or abs(src_y - dst_y) > 2:
            arrows_data.append((src_x, src_y, dst_x - src_x, dst_y - src_y))
    
    # Batch plot arrows
    for src_x, src_y, dx, dy in arrows_data:
        ax.arrow(
            src_x, src_y, dx, dy,
            head_width=1, head_length=1, 
            fc='red', ec='red', alpha=0.7,
            length_includes_head=True
        )
    
    ax.set_title('Pixel Mapping (sample arrows)', fontsize=10)
    ax.axis('off')


def verify_color_preservation(
    source_small: np.ndarray, 
    final_frame: np.ndarray,
    scale: int
) -> bool:
    """
    Verify that final frame uses exactly the same colors as source image.
    """
    h, w = source_small.shape[:2]
    
    # Use more efficient downsampling
    if scale > 1:
        # Sample every 'scale'th pixel instead of full resize
        final_small = final_frame[scale//2::scale, scale//2::scale][:h, :w]
        # Ensure dimensions match
        if final_small.shape != source_small.shape:
            final_small = cv2.resize(final_small, (w, h), interpolation=cv2.INTER_NEAREST)
    else:
        final_small = final_frame[:h, :w]
    
    # Compare color sets more efficiently using numpy
    source_colors = np.unique(source_small.reshape(-1, 3), axis=0)
    final_colors = np.unique(final_small.reshape(-1, 3), axis=0)
    
    return np.array_equal(source_colors, final_colors)