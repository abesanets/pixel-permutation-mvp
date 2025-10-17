"""
Pixel assignment algorithms for matching source pixels to target positions.
"""

from typing import List, Dict, Any
import numpy as np

from proc import calculate_luminance, get_pixel_grid


def create_assignment(
    source_pixels: List[Dict[str, Any]], 
    target_pixels: List[Dict[str, Any]],
    seed: int = 42
) -> List[Dict[str, Any]]:
    """
    Create mapping from source pixels to target positions using luminance sorting.
    
    Args:
        source_pixels: Source pixel data
        target_pixels: Target pixel data  
        seed: Random seed for tie-breaking
        
    Returns:
        List of mapping dictionaries with source and destination info
    """
    np.random.seed(seed)
    
    # Calculate luminance for all pixels
    source_luminance = [calculate_luminance(pixel['color']) for pixel in source_pixels]
    target_luminance = [calculate_luminance(pixel['color']) for pixel in target_pixels]
    
    # Add small random noise to break ties
    noise_scale = 1e-6
    source_luminance = [lum + np.random.uniform(-noise_scale, noise_scale) 
                       for lum in source_luminance]
    target_luminance = [lum + np.random.uniform(-noise_scale, noise_scale) 
                       for lum in target_luminance]
    
    # Sort by luminance
    source_sorted_indices = np.argsort(source_luminance)
    target_sorted_indices = np.argsort(target_luminance)
    
    # Create mapping
    mapping = []
    for src_idx, tgt_idx in zip(source_sorted_indices, target_sorted_indices):
        source_pixel = source_pixels[src_idx]
        target_pixel = target_pixels[tgt_idx]
        
        mapping.append({
            'id': source_pixel['id'],
            'color': source_pixel['color'],
            'src_pos': source_pixel['src_pos'],
            'dst_pos': target_pixel['src_pos']  # Target position from target pixel
        })
    
    return mapping


def create_kdtree_assignment(
    source_pixels: List[Dict[str, Any]], 
    target_pixels: List[Dict[str, Any]],
    seed: int = 42
) -> List[Dict[str, Any]]:
    """
    Alternative assignment using KD-tree for nearest neighbor matching in feature space.
    Features: normalized position (x,y) and luminance.
    """
    from scipy.spatial import KDTree
    import numpy as np
    
    np.random.seed(seed)
    # Infer grid size dynamically from provided pixels (assumes square)
    if len(source_pixels) == 0:
        return []
    # Determine max x,y from source (fallback to target if needed)
    max_src_x = max(p['src_pos'][0] for p in source_pixels)
    max_src_y = max(p['src_pos'][1] for p in source_pixels)
    # +1 because coordinates are 0-indexed
    size_x = max_src_x + 1
    size_y = max_src_y + 1
    # Use average to guard slight mismatches; assume square grid
    size = int(round((size_x + size_y) / 2))
    
    # Create feature vectors for source pixels: [x_norm, y_norm, luminance]
    source_features = []
    for pixel in source_pixels:
        x, y = pixel['src_pos']
        luminance = calculate_luminance(pixel['color'])
        source_features.append([x/size, y/size, luminance])
    
    # Create feature vectors for target positions
    target_features = []
    for pixel in target_pixels:
        x, y = pixel['src_pos']
        luminance = calculate_luminance(pixel['color'])
        target_features.append([x/size, y/size, luminance])
    
    # Build KD-tree and find nearest neighbors
    tree = KDTree(target_features)
    distances, indices = tree.query(source_features, k=1)
    
    # Create mapping
    mapping = []
    used_indices = set()
    
    # Greedy assignment avoiding duplicates
    for src_idx, tgt_idx in enumerate(indices):
        # If target already used, find next available
        while tgt_idx in used_indices and tgt_idx < len(target_pixels) - 1:
            tgt_idx += 1
            
        used_indices.add(tgt_idx)
        source_pixel = source_pixels[src_idx]
        target_pixel = target_pixels[tgt_idx]
        
        mapping.append({
            'id': source_pixel['id'],
            'color': source_pixel['color'],
            'src_pos': source_pixel['src_pos'],
            'dst_pos': target_pixel['src_pos']
        })
    
    return mapping