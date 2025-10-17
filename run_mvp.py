"""
Main CLI entry point for Pixel Permutation MVP.
"""

import argparse
import os
import sys
import time
from pathlib import Path

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
        default=30,
        help="Frames per second (default: 30)"
    )
    parser.add_argument(
        "--duration", 
        type=float, 
        default=4.0,
        help="Animation duration in seconds (default: 4.0)"
    )
    parser.add_argument(
        "--seed", 
        type=int, 
        default=42,
        help="Random seed for reproducibility"
    )
    parser.add_argument(
        "--size",
        type=int,
        default=128,
        help="Working square size for preprocessing (e.g., 64, 128, 256)"
    )
    parser.add_argument(
        "--scale", 
        type=int, 
        default=8,
        help="Output scale factor (default: 8)"
    )
    parser.add_argument(
        "--format", 
        choices=["mp4", "gif"], 
        default="mp4",
        help="Output format: mp4 or gif (default: mp4)"
    )
    
    args = parser.parse_args()
    
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
        print("\n1. Preprocessing images...")
        source_small, target_small = preprocess_images(args.source, args.target, size=args.size)
        print(f"   Resized to: {source_small.shape[1]}x{source_small.shape[0]}")
        
        # 2. Extract pixel data
        print("2. Extracting pixel data...")
        source_pixels = extract_pixels(source_small)
        target_pixels = extract_pixels(target_small)
        print(f"   Source pixels: {len(source_pixels)}")
        print(f"   Target pixels: {len(target_pixels)}")
        
        # 3. Create assignment
        print("3. Creating pixel assignment...")
        mapping = create_assignment(source_pixels, target_pixels, args.seed)
        print(f"   Mapped pixels: {len(mapping)}")
        
        # 4. Save mapping
        print("4. Saving mapping...")
        mapping_path = output_dir / "mapping.json"
        save_mapping(mapping, mapping_path)
        
        # 5. Create animation
        print("5. Creating animation...")
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
        
        # 6. Create diagnostic
        print("6. Creating diagnostic visualization...")
        diagnostic_path = output_dir / "diagnostic.png"
        create_diagnostic(source_small, target_small, mapping, diagnostic_path)
        
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
        print(f"\nError: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()