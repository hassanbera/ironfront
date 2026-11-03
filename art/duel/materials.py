"""Generate seamless weave, hammered brass, steel and painted shield tiles in Blender Python."""
import struct
import zlib
import numpy as np

TILE = 192
PAD = 4

def atlas_uv(tile, u, v):
    return ((tile % 4 + (PAD + u * (TILE-2*PAD)) / TILE) / 4,
            (tile // 4 + (PAD + v * (TILE-2*PAD)) / TILE) / 2)

def write_png(path, rgb):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    height, width, _ = rgb.shape
    rows = b"".join(b"\0" + row.tobytes() for row in rgb)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">2I5B", width,height,8,2,0,0,0))
                     + chunk(b"IDAT",zlib.compress(rows,9)) + chunk(b"IEND",b""))

def generate(output):
    base = np.zeros((TILE*2,TILE*4,3), dtype=np.uint8)
    finish = np.zeros_like(base)
    normal = np.zeros_like(base)
    y,x = (np.indices((TILE,TILE)) - PAD) / (TILE-2*PAD)
    x,y = np.clip(x,0,1),np.clip(y,0,1)
    wave = lambda a: np.cos(2*np.pi*a)
    weave = wave(x*43)*wave(y*39)*.45 + wave(y*39)*.35
    pores = np.sin(x*455+np.sin(y*53)*4)*np.sin(y*319+np.cos(x*39)*3)
    grain = np.sin(y*175 + 3*np.sin(x*5)+np.sin(y*21))
    radius = np.hypot(x-.5,y-.5)*2
    angle = np.arctan2(y-.5,x-.5)
    for tile in range(8):
        # Albedo tiles 0–3 modulate inherited skin/clothing colours in linear space.
        tint = np.full(x.shape+(3,),255.0)
        metal = np.zeros_like(x)
        rough = np.full_like(x,.8)
        height = np.zeros_like(x)
        if tile == 0: # woven cloth
            height = weave*.14
            tint *= (.94+.05*weave+.018*wave(y*5+x))[...,None]
        elif tile == 1: # oiled leather
            height = pores*.19 + grain*.05
            rough = .61+.08*pores
            tint *= (.92+.065*pores+.02*grain)[...,None]
        elif tile == 2: # brushed steel
            height = grain*.045
            metal[:] = .56
            rough = .43+.035*grain
            tint *= (.96+.02*grain+.014*wave(y*2))[...,None]
        elif tile == 3: # skin, eyes
            rough[:] = .76
        elif tile in (4,5):
            if tile == 4: # kalkan: repousse rim, radial eight-point ornament, red woven field
                brass = (abs(radius-.85)<.022)|(abs(radius-.91)<.013)
                brass |= (abs(radius-(.56+.115*np.cos(8*angle)))<.018)
                brass |= (abs(radius-(.56-.115*np.cos(8*angle)))<.018)
                brass |= (radius<.25)|(radius>.96)
                brass |= (abs(np.sin(angle*8))<.12)&(radius>.72)&(radius<.79)
                tint[:]=[169,31,35]
                tint[brass]=[212,162,77]
                metal[brass]=.70
                height = weave*.18 + brass*.55 + np.maximum(0,.25-radius)*3
            else: # heater: divided silver/charcoal field with a double chevron
                tint[:]=[66,76,84]
                tint[x<.5]=[158,168,172]
                band = abs(y-(.34+abs(x-.5)*.65))
                brass = (band<.055)|((band>.077)&(band<.089))
                tint[brass]=[231,218,178]
                height = grain*.16 + brass*.19
            rough = .66+.05*grain-.24*metal
            tint *= (.94+.035*grain+.025*weave)[...,None]
        elif tile == 6:
            tint[:]=[103,61,38]
            height = grain*.24
            tint *= (.88+.11*grain)[...,None]
        else:
            tint[:]=[205,153,73]
            metal[:]=.74
            rough=.39+.08*pores
            height=pores*.12
        dy,dx=np.gradient(height)
        n=np.stack([-dx,dy,np.ones_like(dx)],axis=2)
        n/=np.linalg.norm(n,axis=2,keepdims=True)
        target=np.s_[tile//4*TILE:(tile//4+1)*TILE,tile%4*TILE:(tile%4+1)*TILE]
        base[target]=np.clip(tint,0,255).astype('u1')
        finish[target]=np.stack([np.ones_like(x),rough,metal],axis=2).clip(0,1)*255
        normal[target]=(n*.5+.5)*255
    for name,image in [('color',base),('finish',finish),('normal',normal)]:
        write_png(output / ('duel-'+name+'.png'),image)
