# Pixel Permutation MVP

Transform one image into another by rearranging pixels while preserving their colors.

## Description

This tool takes a source image and a target image, then creates an animation where pixels from the source are reassigned to form the target image. Pixel colors remain unchanged; only their positions are updated.

## Features

- Process any two images of compatible dimensions
- Generate animation showing pixel rearrangement
- Command-line and web interface options
- Adjustable parameters: image size, FPS, duration, scale, random seed
- Output: animation, final image, mapping data

## Quick Start

### Prerequisites

- Python 3.10+
- pip

### Installation

```bash
git clone https://github.com/abesanets/pixel-permutation-mvp.git
cd pixel-permutation-mvp
pip install -r requirements.txt
```

### Web Interface

```bash
python web_interface.py
```

Open http://localhost:5000 in your browser.

Upload source and target images, adjust settings if needed, and generate the animation.

### Command Line

```bash
python run_mvp.py --source examples/source.jpg --target examples/target.jpg --out results
```

Use `--help` for all options.

## Usage

### Web Interface

1. Upload source image (provides pixel colors)
2. Upload target image (provides target structure)
3. Optional: Adjust size (default 64x64), FPS, duration, scale, seed
4. Generate animation
5. Download results: animation file, final image, diagnostics, mapping JSON

### Command Line Examples

```bash
python run_mvp.py --source cat.jpg --target dog.jpg --out my_animation
python run_mvp.py --source sunset.jpg --target city.jpg --out results --fps 60 --duration 2
python run_mvp.py --source art.jpg --target monalisa.jpg --out masterpiece --seed 12345
```

## How It Works

1. Resize both images to 64x64 pixels
2. Extract pixel data
3. Match pixels using luminance-based sorting
4. Animate pixel movements with linear interpolation
5. Upscale output using nearest-neighbor interpolation

## Project Structure

```
pixel-permutation-mvp/
├── web_interface.py
├── run_mvp.py
├── templates/
│ └── index.html
├── io.py
├── proc.py
├── assign.py
├── render.py
├── test_mvp.py
├── requirements.txt
└── examples/
```

## Testing

```bash
python test_mvp.py
```

## Common Issues

- **Long processing time**: Expected for 64x64 (4096 pixels). Reduce size for faster results.
- **Unexpected colors**: Verify source image contrast and content.
- **Blocky animation**: Due to discrete pixel movement and nearest-neighbor upscaling.
- **Server startup issues**: Ensure dependencies are installed and port 5000 is available.

## License

MIT License
