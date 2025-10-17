"""
Unit tests and verification for Pixel Permutation MVP.
"""

import unittest
import tempfile
import json
from pathlib import Path
import numpy as np
import cv2

from fileio import load_image, save_mapping
from proc import preprocess_images, extract_pixels, calculate_luminance
from assign import create_assignment
from render import verify_color_preservation


class TestMVP(unittest.TestCase):
    
    def setUp(self):
        """Create test images."""
        # Create simple test images
        self.source_img = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        self.target_img = np.random.randint(0, 255, (120, 80, 3), dtype=np.uint8)
        
        # Save temporary images
        self.temp_dir = tempfile.mkdtemp()
        self.source_path = Path(self.temp_dir) / "source.jpg"
        self.target_path = Path(self.temp_dir) / "target.jpg"
        
        cv2.imwrite(str(self.source_path), cv2.cvtColor(self.source_img, cv2.COLOR_RGB2BGR))
        cv2.imwrite(str(self.target_path), cv2.cvtColor(self.target_img, cv2.COLOR_RGB2BGR))
    
    def test_image_loading(self):
        """Test image loading and conversion."""
        img = load_image(str(self.source_path))
        self.assertEqual(img.shape[2], 3)  # 3 channels
        self.assertEqual(img.dtype, np.uint8)
    
    def test_image_resize(self):
        """Test image resizing to 128x128."""
        source_small, target_small = preprocess_images(
            str(self.source_path), 
            str(self.target_path)
        )
        
        self.assertEqual(source_small.shape, (128, 128, 3))
        self.assertEqual(target_small.shape, (128, 128, 3))
        self.assertEqual(source_small.dtype, np.uint8)
        self.assertEqual(target_small.dtype, np.uint8)
    
    def test_pixel_extraction(self):
        """Test pixel data extraction."""
        source_small, _ = preprocess_images(
            str(self.source_path), 
            str(self.target_path)
        )
        pixels = extract_pixels(source_small)
        
        self.assertEqual(len(pixels), 128 * 128)  # 16384 pixels
        self.assertIn('id', pixels[0])
        self.assertIn('color', pixels[0])
        self.assertIn('src_pos', pixels[0])
        self.assertEqual(len(pixels[0]['color']), 3)  # RGB
    
    def test_luminance_calculation(self):
        """Test luminance calculation."""
        # Test with known values
        black = [0, 0, 0]
        white = [255, 255, 255]
        gray = [128, 128, 128]
        
        self.assertAlmostEqual(calculate_luminance(black), 0.0)
        self.assertAlmostEqual(calculate_luminance(white), 255.0)
        self.assertAlmostEqual(calculate_luminance(gray), 128.0)
    
    def test_assignment_creation(self):
        """Test pixel assignment creation."""
        source_small, target_small = preprocess_images(
            str(self.source_path), 
            str(self.target_path)
        )
        source_pixels = extract_pixels(source_small)
        target_pixels = extract_pixels(target_small)
        
        mapping = create_assignment(source_pixels, target_pixels)
        
        self.assertEqual(len(mapping), 16384)
        
        # Check mapping structure
        for item in mapping:
            self.assertIn('id', item)
            self.assertIn('color', item)
            self.assertIn('src_pos', item)
            self.assertIn('dst_pos', item)
            
            # Check color preservation
            original_color = next(p['color'] for p in source_pixels if p['id'] == item['id'])
            self.assertEqual(item['color'], original_color)
    
    def test_mapping_io(self):
        """Test mapping JSON save/load."""
        test_mapping = [
            {'id': 0, 'color': [255, 0, 0], 'src_pos': [0, 0], 'dst_pos': [10, 10]},
            {'id': 1, 'color': [0, 255, 0], 'src_pos': [1, 0], 'dst_pos': [11, 10]}
        ]
        
        temp_file = Path(self.temp_dir) / "test_mapping.json"
        save_mapping(test_mapping, temp_file)
        
        # Verify file exists and can be loaded
        self.assertTrue(temp_file.exists())
        
        with open(temp_file, 'r') as f:
            loaded = json.load(f)
        
        self.assertEqual(loaded, test_mapping)
    
    def test_color_preservation(self):
        """Test that colors are preserved in final rendering."""
        source_small, target_small = preprocess_images(
            str(self.source_path), 
            str(self.target_path)
        )
        
        # Create a test final frame (scaled version of source)
        scale = 8
        test_frame = cv2.resize(
            source_small, 
            (128 * scale, 128 * scale), 
            interpolation=cv2.INTER_NEAREST
        )
        
        # Verify color preservation
        self.assertTrue(verify_color_preservation(source_small, test_frame, scale))


def run_verification():
    """Run comprehensive verification on a test case."""
    print("Running MVP verification...")
    
    # Create simple test case
    source = np.zeros((128, 128, 3), dtype=np.uint8)
    target = np.ones((128, 128, 3), dtype=np.uint8) * 255
    
    # Add some pattern for testing
    source[0:32, 0:32] = [255, 0, 0]    # Red quadrant
    source[0:32, 32:64] = [0, 255, 0]   # Green quadrant  
    source[32:64, 0:32] = [0, 0, 255]   # Blue quadrant
    source[32:64, 32:64] = [255, 255, 0] # Yellow quadrant
    
    temp_dir = Path(tempfile.mkdtemp())
    source_path = temp_dir / "test_source.jpg"
    target_path = temp_dir / "test_target.jpg"
    
    cv2.imwrite(str(source_path), cv2.cvtColor(source, cv2.COLOR_RGB2BGR))
    cv2.imwrite(str(target_path), cv2.cvtColor(target, cv2.COLOR_RGB2BGR))
    
    try:
        # Run pipeline
        source_small, target_small = preprocess_images(
            str(source_path), str(target_path)
        )
        
        source_pixels = extract_pixels(source_small)
        target_pixels = extract_pixels(target_small)
        
        mapping = create_assignment(source_pixels, target_pixels, seed=42)
        
        # Verify results
        assert source_small.shape == (128, 128, 3), f"Wrong shape: {source_small.shape}"
        assert target_small.shape == (128, 128, 3), f"Wrong shape: {target_small.shape}"
        assert len(mapping) == 16384, f"Wrong mapping length: {len(mapping)}"
        
        # Verify color preservation in mapping
        source_colors = set(tuple(p['color']) for p in source_pixels)
        mapping_colors = set(tuple(p['color']) for p in mapping)
        assert source_colors == mapping_colors, "Colors not preserved in mapping"
        
        print("✓ All tests passed!")
        print(f"✓ Images resized to 128x128")
        print(f"✓ Mapping contains 16384 pixels") 
        print(f"✓ Colors preserved: {len(source_colors)} unique colors")
        
        return True
        
    except Exception as e:
        print(f"✗ Test failed: {e}")
        return False


if __name__ == "__main__":
    # Run unit tests
    unittest.main(argv=[''], exit=False, verbosity=2)
    
    # Run verification
    print("\n" + "="*50)
    run_verification()