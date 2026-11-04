"""Rebuild TinyLink vector artwork and raster exports from checked-in fonts.
Requires Python fontTools, Brotli and the sharp copy already installed with Wrangler.
"""
from pathlib import Path
import subprocess
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'brand'
OUT.mkdir(exist_ok=True)
font = TTFont(ROOT / 'public/fonts/InterVariable.woff2')
font = instantiateVariableFont(font, {'wght': 400, 'opsz': 32}, inplace=False)
mono = TTFont(ROOT / 'public/fonts/IBMPlexMono-Regular.woff2')

def text(value, x, y, size, color, face=font, tracking=0):
    glyphs = face.getGlyphSet()
    cmap = face.getBestCmap()
    scale = size / face['head'].unitsPerEm
    result = []
    for char in value:
        glyph = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(pen)
        result.append(f'<path d="{pen.getCommands()}" transform="translate({x:.3f} {y}) scale({scale:.6f} {-scale:.6f})" fill="{color}"/>')
        x += glyph.width * scale + tracking
    return ''.join(result)

MARK = 'm13 20-2 2a6 6 0 0 1-8-8l6-6a6 6 0 0 1 8 0m-2 4 2-2a6 6 0 0 1 8 8l-6 6a6 6 0 0 1-8 0M11 21l10-10'
def mark(x, y, size, color):
    return f'<g transform="translate({x} {y}) scale({size / 32})"><path d="{MARK}" fill="none" stroke="{color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g>'

icon = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#af50ff"/>{mark(12,12,40,"#090909")}</svg>'
(ROOT / 'public/favicon.svg').write_text(icon)
for theme in ('dark', 'light'):
    bg, ink, muted, line, accent = ('#090909','#f7f9fa','#a9a8af','#423738','#e1bdff') if theme == 'dark' else ('#f7f9fa','#090909','#606064','#dedde1','#7830b2')
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><title>TinyLink — Small links. Lasting impressions.</title><rect width="1200" height="630" fill="{bg}"/>']
    parts += ['<rect x="64" y="54" width="44" height="44" rx="12" fill="#af50ff"/>',mark(72,62,28,'#090909'),text('tinylink',122,87,34,ink,tracking=-1.3)]
    parts += [text('YOUR NEXT CONNECTION',64,173,12,muted,mono,2),text('Small links.',60,263,78,ink,tracking=-3.2),text('Lasting impressions.',60,347,68,accent,tracking=-2.8),text('Create memorable links. See every click.',64,407,22,muted,tracking=-.5)]
    parts += [f'<path d="M865 174h264M865 450h264" stroke="{line}"/>',f'<rect x="887" y="206" width="220" height="220" rx="56" fill="#af50ff"/>',mark(924,243,146,'#090909'),text('/your-next-big-thing',865,486,13,muted,mono,-.2)]
    parts += [f'<path d="M64 525h1072" stroke="{line}"/>',text('tinylink.techtideai.chatgpt.site',64,572,15,muted,mono),'<rect x="872" y="547" width="264" height="44" rx="8" fill="#af50ff"/>',text('Make your link',894,575,18,'#090909',tracking=-.4),'<path d="M1099 561h12v12m-12 0 12-12" fill="none" stroke="#090909" stroke-width="2"/>','</svg>']
    (OUT / f'social-{theme}.svg').write_text(''.join(parts))

sharp = next((ROOT / 'node_modules/.pnpm').glob('sharp@*/node_modules/sharp/dist/index.cjs'))
script = '''const sharp=require(process.argv[1]);const root=process.argv[2];
(async()=>{for(const theme of ['dark','light'])await sharp(root+'/public/brand/social-'+theme+'.svg').png().toFile(root+'/public/brand/social-'+theme+'.png');
for(const [name,size] of [['favicon-32.png',32],['apple-touch-icon.png',180]])await sharp(root+'/public/favicon.svg').resize(size,size).png().toFile(root+'/public/'+name);})();'''
subprocess.run(['node','-e',script,str(sharp),str(ROOT)],check=True)
print('Rendered SVG, 32px favicon, 180px touch icon and two 1200 × 630 social cards.')
