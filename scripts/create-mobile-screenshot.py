from PIL import Image, ImageDraw, ImageFont
import os

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'mobile-responsive.png')
OUTPUT_PATH = os.path.abspath(OUTPUT_PATH)

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
width, height = 1080, 2340
img = Image.new('RGB', (width, height), '#0F172A')
d = ImageDraw.Draw(img)

frame = (60, 120, width - 60, height - 120)
d.rounded_rectangle(frame, 80, fill='#0f172a', outline='#2DD4BF', width=18)

screen = (120, 220, width - 120, height - 220)
d.rounded_rectangle(screen, 64, fill='#0f172a')

status = (screen[0] + 40, screen[1] + 30, screen[2] - 40, screen[1] + 110)
d.rectangle(status, fill='#111827')

try:
    font = ImageFont.truetype('arial.ttf', 72)
    small = ImageFont.truetype('arial.ttf', 42)
except OSError:
    font = ImageFont.load_default()
    small = ImageFont.load_default()

heading = 'Stellar-star Mobile View'
d.text((screen[0] + 40, screen[1] + 140), heading, font=font, fill='#A5F3FC')

card_y = screen[1] + 260
cards = ['Dashboard overview', 'Expenses list', 'Trip detail']
for i, text in enumerate(cards):
    y = card_y + i * 200
    d.rounded_rectangle((screen[0] + 40, y, screen[2] - 40, y + 150), 30, fill='#0F172A', outline='#22D3EE', width=4)
    d.text((screen[0] + 80, y + 40), text, font=small, fill='#E0F2FE')

label = 'Proof asset: public/mobile-responsive.png'
d.text((screen[0] + 40, screen[3] - 140), label, font=small, fill='#A5F3FC')

img.save(OUTPUT_PATH)
print(f'Created {OUTPUT_PATH}')
