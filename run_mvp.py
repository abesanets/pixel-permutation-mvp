"""
Main CLI entry point for Pixel Permutation MVP.
"""

import argparse
import os
import sys
import time
from pathlib import Path

from config import (MIN_SIZE, MAX_SIZE, MIN_FPS, MAX_FPS, MIN_DURATION, MAX_DURATION,
                    MIN_SCALE, MAX_SCALE, MIN_SEED, MAX_SEED, ALLOWED_FORMATS,
                    DEFAULT_SIZE, DEFAULT_FPS, DEFAULT_DURATION, DEFAULT_SCALE,
                    DEFAULT_FORMAT, DEFAULT_SEED)

from fileio import load_image, save_mapping, create_output_dir
from proc import preprocess_images, extract_pixels
from assign import create_assignment
from render import create_animation, create_diagnostic


def main():
    parser = argparse.ArgumentParser(
        description="Animate pixel permutation from source to target image"
    )
    parser.add_argument(
        "--source", "-s", 
        required=True,
        help="Source image path (provides pixel colors)"
    )
    parser.add_argument(
        "--target", "-t", 
        required=True,
        help="Target image path (provides target structure)"
    )
    parser.add_argument(
        "--out", "-o", 
        required=True,
        help="Output directory"
    )
    parser.add_argument(
        "--fps", 
        type=int, 
        default=DEFAULT_FPS,
        help=f"Frames per second (default: {DEFAULT_FPS}, min: {MIN_FPS}, max: {MAX_FPS})"
    )
    parser.add_argument(
        "--duration", 
        type=float, 
        default=DEFAULT_DURATION,
        help=f"Animation duration in seconds (default: {DEFAULT_DURATION}, min: {MIN_DURATION}, max: {MAX_DURATION})"
    )
    parser.add_argument(
        "--seed", 
        type=int, 
        default=DEFAULT_SEED,
        help=f"Random seed for reproducibility (default: {DEFAULT_SEED}, min: {MIN_SEED}, max: {MAX_SEED})"
    )
    parser.add_argument(
        "--size",
        type=int,
        default=DEFAULT_SIZE,
        help=f"Working square size for preprocessing (default: {DEFAULT_SIZE}, min: {MIN_SIZE}, max: {MAX_SIZE})"
    )
    parser.add_argument(
        "--scale", 
        type=int, 
        default=DEFAULT_SCALE,
        help=f"Output scale factor (default: {DEFAULT_SCALE}, min: {MIN_SCALE}, max: {MAX_SCALE})"
    )
    parser.add_argument(
        "--format", 
        choices=ALLOWED_FORMATS, 
        default=DEFAULT_FORMAT,
        help=f"Output format: {', '.join(ALLOWED_FORMATS)} (default: {DEFAULT_FORMAT})"
    )
    
    args = parser.parse_args()
    
    # Validate parameters against config limits
    if not (MIN_SIZE <= args.size <= MAX_SIZE):
        print(f"Error: Size must be between {MIN_SIZE} and {MAX_SIZE}")
        sys.exit(1)
    if not (MIN_FPS <= args.fps <= MAX_FPS):
        print(f"Error: FPS must be between {MIN_FPS} and {MAX_FPS}")
        sys.exit(1)
    if not (MIN_DURATION <= args.duration <= MAX_DURATION):
        print(f"Error: Duration must be between {MIN_DURATION} and {MAX_DURATION}")
        sys.exit(1)
    if not (MIN_SCALE <= args.scale <= MAX_SCALE):
        print(f"Error: Scale must be between {MIN_SCALE} and {MAX_SCALE}")
        sys.exit(1)
    if not (MIN_SEED <= args.seed <= MAX_SEED):
        print(f"Error: Seed must be between {MIN_SEED} and {MAX_SEED}")
        sys.exit(1)
    
    # Validate inputs
    if not os.path.exists(args.source):
        print(f"Error: Source image not found: {args.source}")
        sys.exit(1)
    if not os.path.exists(args.target):
        print(f"Error: Target image not found: {args.target}")
        sys.exit(1)
    
    # Create output directory
    output_dir = create_output_dir(args.out)
    
    print("=== Pixel Permutation MVP ===")
    print(f"Source: {args.source}")
    print(f"Target: {args.target}")
    print(f"Output: {output_dir}")
    print(f"Settings: {args.fps} FPS, {args.duration}s, seed={args.seed}, size={args.size}")
    
    start_time = time.time()
    
    try:
        # 1. Load and preprocess images
        print("\n1. Starting preprocessing images...")
        source_small, target_small = preprocess_images(args.source, args.target, size=args.size)
        print(f"   Resized to: {source_small.shape[1]}x{source_small.shape[0]}")
        print("   Preprocessing complete.")
        
        # 2. Extract pixel data
        print("2. Starting extracting pixel data...")
        source_pixels = extract_pixels(source_small)
        target_pixels = extract_pixels(target_small)
        print(f"   Source pixels: {len(source_pixels)}")
        print(f"   Target pixels: {len(target_pixels)}")
        print("   Extraction complete.")
        
        # 3. Create assignment
        print("3. Starting creating pixel assignment...")
        mapping = create_assignment(source_pixels, target_pixels, args.seed)
        print(f"   Mapped pixels: {len(mapping)}")
        print("   Assignment complete.")
        
        # 4. Save mapping
        print("4. Starting saving mapping...")
        mapping_path = output_dir / "mapping.json"
        save_mapping(mapping, mapping_path)
        print("   Saving complete.")
        
        # 5. Create animation
        print("5. Starting creating animation...")
        anim_path = output_dir / f"animation.{args.format}"
        frames_dir = output_dir / "frames"
        create_animation(
            mapping, 
            source_small.shape,
            anim_path, 
            frames_dir,
            fps=args.fps,
            duration=args.duration,
            scale=args.scale,
            output_format=args.format
        )
        print("   Animation creation complete.")
        
        # 6. Create diagnostic
        print("6. Starting creating diagnostic visualization...")
        diagnostic_path = output_dir / "diagnostic.png"
        create_diagnostic(source_small, target_small, mapping, diagnostic_path)
        print("   Diagnostic creation complete.")
        
        # Calculate statistics
        total_time = time.time() - start_time
        num_frames = int(args.fps * args.duration)
        
        print("\n=== COMPLETE ===")
        print(f"Total time: {total_time:.2f}s")
        print(f"Animation: {num_frames} frames")
        print(f"Output files:")
        print(f"  - {anim_path}")
        print(f"  - {mapping_path}")
        print(f"  - {diagnostic_path}")
        if frames_dir.exists():
            print(f"  - {frames_dir}/ (frame PNGs)")
        
    except Exception as e:
        print(f"\nError during processing: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()