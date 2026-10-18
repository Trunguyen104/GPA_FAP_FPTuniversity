import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs('icons', exist_ok=True)

def create_icon(size):
    # Create an image with an orange gradient background and graduation cap/calculator glyph
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw rounded rectangle
    radius = int(size * 0.22)
    # Background gradient approximation (FPT Orange)
    for y in range(size):
        ratio = y / size
        r = int(245 * (1 - ratio) + 230 * ratio)
        g = int(110 * (1 - ratio) + 70 * ratio)
        b = int(30 * (1 - ratio) + 20 * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Mask with rounded rectangle
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)

    # Scale elements
    scale = size / 128.0

    # Draw graduation cap top rhombus
    # points: center (64, 38)
    top_points = [
        (int(64 * scale), int(26 * scale)),
        (int(102 * scale), int(44 * scale)),
        (int(64 * scale), int(62 * scale)),
        (int(26 * scale), int(44 * scale))
    ]
    draw.polygon(top_points, fill=(255, 255, 255, 255))

    # Cap base
    base_points = [
        (int(42 * scale), int(54 * scale)),
        (int(64 * scale), int(65 * scale)),
        (int(86 * scale), int(54 * scale)),
        (int(86 * scale), int(68 * scale)),
        (int(64 * scale), int(80 * scale)),
        (int(42 * scale), int(68 * scale))
    ]
    draw.polygon(base_points, fill=(240, 240, 240, 230))

    # Tassel
    draw.line([(int(102 * scale), int(44 * scale)), (int(102 * scale), int(72 * scale))], fill=(255, 215, 0, 255), width=max(1, int(2 * scale)))
    draw.ellipse([(int(100 * scale), int(72 * scale)), (int(104 * scale), int(76 * scale))], fill=(255, 215, 0, 255))

    # Draw text GPA
    if size >= 32:
        try:
            font = ImageFont.truetype("arialbd.ttf", int(26 * scale))
        except:
            font = ImageFont.load_default()
        text = "GPA"
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        x = (size - w) / 2
        y = int(82 * scale)
        draw.text((x, y), text, font=font, fill=(255, 255, 255, 255))

    return img

for sz in [16, 48, 128]:
    im = create_icon(sz)
    im.save(f'icons/icon{sz}.png')
    print(f'Saved icons/icon{sz}.png')
