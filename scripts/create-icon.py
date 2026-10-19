from PIL import Image, ImageDraw
from pathlib import Path
root = Path(__file__).resolve().parent.parent
im = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((16, 16, 496, 496), radius=130, fill='#f5cf52')
navy = '#192d53'
d.line([(256, 112), (256, 300)], fill=navy, width=34)
d.line([(174, 230), (256, 312), (338, 230)], fill=navy, width=34, joint='curve')
d.line([(145, 327), (145, 386), (367, 386), (367, 327)], fill=navy, width=28, joint='curve')
for x,y,r in [(256,112,17),(174,230,17),(338,230,17),(145,327,14),(367,327,14)]:
    d.ellipse((x-r,y-r,x+r,y+r), fill=navy)
im.save(root/'assets/icon.png')
im.save(root/'assets/icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
