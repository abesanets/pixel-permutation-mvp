# 🎨 Pixel Permutation MVP 🚀

**Transform one image into another by playing musical chairs with pixels!** 🪑→🎨

> *Warning: This project contains extreme pixel rearrangement. No colors were harmed in the making of these animations!*

## ✨ What Magic Is This?

Ever wanted to see your cat's fur rearrange itself into a portrait of your dog? 🐱→🐶  
Or watch a sunset slowly organize into a city skyline? 🌅→🌆  

This tool takes two images and creates a mesmerizing animation where pixels from the **source image** play musical chairs to form the **target image** - without changing their colors! It's like watching a cosmic pixel dance! 💫

## 🎯 Features That'll Blow Your Mind

- 🖼️ **Dual Image Alchemy**: Upload any two images and watch the transformation
- ⚡ **Real-time Processing**: See what's happening with live console logs and progress bars
- 🎬 **Smooth Animations**: Buttery-smooth pixel movements (no pixel left behind!)
- 🎛️ **Total Control**: Adjust size, speed, duration, and more
- 📊 **Instant Downloads**: Get your animation, final image, and mapping data
- 🐍 **Python Power**: All the machine learning cred without the machine learning complexity
- 🎨 **Color Faithful**: Pinky promise - no colors are changed, only positions!

## 🚀 Quick Start: Become a Pixel Wizard in 60 Seconds!

### Prerequisites (The Boring Stuff)

- Python 3.10+ (because we're fancy like that)
- pip (Python's package delivery service)

### Step 1: Clone This Magical Repository

```bash
git clone https://github.com/your-username/pixel-permutation-mvp.git
cd pixel-permutation-mvp
```

### Step 2: Install the Magic Potion (Dependencies)

```bash
pip install -r requirements.txt
```

*This installs: numpy, opencv, flask, and other magical ingredients 🧙‍♂️*

### Step 3: Choose Your Adventure!

#### Option A: 🖥️ Web Interface (Recommended for Humans)

```bash
python web_interface.py
```

Then open your browser to: `http://localhost:5000`

**What happens next:**
1. 📤 Upload your source and target images
2. ⚙️ Tweak settings (or don't - we're not the boss of you)
3. 🎬 Click "Generate Animation" and watch the magic happen!
4. 📥 Download your masterpiece when it's done!

#### Option B: 🖋️ Command Line (For Terminal Wizards)

```bash
python run_mvp.py --source examples/source.jpg --target examples/target.jpg --out results
```

*Pro tip: Add `--help` to see all the secret options!*

## 🎮 How to Use the Web Interface (It's Easier Than IKEA Furniture!)

### 1. **Upload Your Images** 📸
- **Source Image**: Provides the pixel colors (the "paint")
- **Target Image**: Provides the structure (the "blueprint")

### 2. **Adjust Settings** ⚙️ (Optional Tinkering)
- **Image Size**: How many pixels to play with (64 = 4096 pixels = lots of moving parts!)
- **FPS**: Frames per second (30 = smooth like butter 🧈)
- **Duration**: How long the animation should be (4 seconds = perfect for TikTok)
- **Scale**: How big to make the output (8 = 512x512 pixels = HD goodness)
- **Random Seed**: For reproducible results (42 = the answer to everything)

### 3. **Watch the Magic** 🔮
- Real-time progress bar (so you know it's not just pretending)
- Live console logs (peek behind the curtain!)
- Seconds counter (how long until pixel nirvana?)

### 4. **Download Your Goodies** 📦
- **Animation**: The main event! Watch pixels dance!
- **Final Image**: The end result in static form
- **Diagnostic**: A nerdy diagram showing what happened
- **Mapping Data**: JSON file for the truly curious

## 🎪 Example Command Line Fun

```bash
# Transform your cat into a dog (the internet's favorite pastime)
python run_mvp.py --source cat.jpg --target dog.jpg --out my_animation

# Make a sunset become a city, but faster!
python run_mvp.py --source sunset.jpg --target city.jpg --out results --fps 60 --duration 2

# Reproduce that one perfect animation from last time
python run_mvp.py --source art.jpg --target monalisa.jpg --out masterpiece --seed 12345
```

## 🧪 For the Scientists Among Us

### Run Tests (Make Sure the Magic Still Works)

```bash
python test_mvp.py
```

*Expected output: Lots of green checkmarks ✅ and feeling smug*

### How It Actually Works (The Nerdy Part)

1. **Shrink Both Images** to 64x64 pixels (because 4096 pixels is enough for anyone)
2. **Extract Pixel Data** like a digital archaeologist
3. **Match Pixels** using luminance-based sorting (fancy color brightness math)
4. **Animate Movement** with smooth linear interpolation (pixels on rails!)
5. **Upscale Carefully** using nearest-neighbor (no color cheating!)

## 🗂️ Project Structure (Where the Magic Lives)

```
pixel-permutation-mvp/
├── 🎨 web_interface.py          # Fancy web UI
├── 🖥️ run_mvp.py               # Command-line version
├── 📁 templates/
│   └── index.html              # The beautiful frontend
├── 🔧 io.py                    # File input/output wizardry
├── 🎯 proc.py                  # Image processing magic
├── 🔄 assign.py                # Pixel matching algorithms
├── 🎬 render.py                # Animation rendering
├── 🧪 test_mvp.py              # Quality control
├── 📋 requirements.txt         # Dependency list
└── 📁 examples/                # Sample images to play with
```

## 🐛 Common Issues & Solutions

**"It's taking forever!"** ⏳
- 64x64 images = 4096 pixels = lots of calculations. Be patient, young padawan!

**"The colors look wrong!"** 🌈
- We promise we don't change colors! Check your source image has good contrast.

**"The animation is blocky!"** 🧊
- That's the charm! We're moving discrete pixels, not blending colors.

**"Flask won't start!"** 🚫
- Make sure you installed requirements: `pip install -r requirements.txt`
- Check if port 5000 is busy: try `python web_interface.py --port 5001`

## 🚀 Next-Level Magic (Future Enhancements)

- [ ] Multi-scale refinement (because sometimes 64x64 isn't enough)
- [ ] GPU acceleration (make it go brrrrrr 🏎️)
- [ ] WebGL rendering (browser-powered pixel parties)
- [ ] Face-aware alignment (put eyes where eyes should go)
- [ ] Real-time parameter tweaking (change settings mid-animation!)

## 🎉 Success Stories from Happy Users

> "I turned my selfie into a pizza and it was the best thing I've done all week!" 🍕
> - *Probably someone, somewhere*

> "My cat watched the animation for 3 hours. I'm concerned." 😼
> - *Cat owner, probably*

## 📜 License

MIT License - do whatever you want, just don't blame us if you get addicted to watching pixels move! 😄

## 🆘 Getting Help

Found a bug? Have a feature request? Think this is the coolest thing since sliced bread?

1. Check the issues page
2. Create a new issue (with pretty pictures!)
3. Wait patiently while we marvel at your creativity

---

**Made with ❤️, 🐍, and probably too much ☕**

*Now go forth and permute some pixels! The world is your pixelated oyster! 🦪*
```

## Additional Files to Create

### 1. Create `examples/README.md`

```markdown
# 🎨 Example Images

This folder contains sample images to test the pixel permutation magic!

## Recommended Test Images

### Basic Tests:
- `source.jpg` - A colorful, high-contrast image
- `target.jpg` - An image with clear structure and shapes

### Pro Tips for Best Results:
1. **High Contrast** works better than subtle gradients
2. **Clear Subjects** are easier to recognize than busy scenes  
3. **Similar Aspect Ratios** prevent weird stretching
4. **Good Lighting** means better luminance matching

## Create Your Own Test Images

Don't have images? No problem! Create some:

### Using Python:
```python
from PIL import Image, ImageDraw
import numpy as np

# Create a simple gradient
gradient = np.linspace(0, 255, 64*64).reshape(64, 64).astype(np.uint8)
Image.fromarray(gradient).save('gradient.jpg')

# Create geometric patterns
img = Image.new('RGB', (64, 64), color='white')
draw = ImageDraw.Draw(img)
draw.rectangle([10, 10, 30, 30], fill='red')
draw.ellipse([40, 40, 60, 60], fill='blue')
img.save('pattern.jpg')
```

### Using Online Tools:
- [Pixlr](https://pixlr.com) - Free online image editor
- [Canva](https://canva.com) - Easy design tool
- Your phone's camera! 📱

## Example Image Ideas:
- 🌅 Sunset → 🏙️ City skyline  
- 🐱 Cat → 🐶 Dog
- 🎨 Abstract art → 🖼️ Famous painting
- 🌸 Flower → 🦋 Butterfly
- Your face → Your favorite meme! 😂

Happy pixel permuting! 🎉