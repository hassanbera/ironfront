"""Run in Blender's Python. Extend the existing baked meshes without duplicating body geometry."""
import json
from pathlib import Path
import sys
import bpy
import numpy as np
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from materials import generate, atlas_uv
from equipment import Equipment

ROOT=HERE.parents[1]
OUT=ROOT/'frontend/public/assets/characters'
WIDTHS={'position':3,'normal':3,'uv':2,'skinIndex':4,'skinWeight':4,'paint':4,'index':1}

def channel(blob, fields, key):
    f=fields[key]
    return np.frombuffer(blob, '<f4', count=f['length'], offset=f['offset']).reshape(-1,f['size'])

def append(blob, values, key):
    a=np.asarray(values,dtype='<f4').ravel()
    field={'offset':len(blob),'length':a.size,'size':WIDTHS[key]}
    blob.extend(a.tobytes())
    return field

def linear(rgb):
    return np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)

def body_surface(name, body, blob):
    # The source UVs address palette swatches. Read their colours before unwrapping
    # the visible surfaces into tiles with actual texel density.
    source=bpy.data.images.load(str(OUT/(name+'.png')),check_existing=False)
    source.colorspace_settings.name='Non-Color'
    texture=np.empty(len(source.pixels),dtype='f4')
    source.pixels.foreach_get(texture)
    w,h=source.size
    old_uv=channel(blob,body,'uv')
    col=texture.reshape(h,w,4)[np.clip(((1-old_uv[:,1])*h).astype(int),0,h-1),
                               np.clip((old_uv[:,0]*w).astype(int),0,w-1),:3].copy()
    bpy.data.images.remove(source)
    rgb=linear(col)
    r,g,b=rgb.T
    tag=channel(blob,body,'paint')[:,3]
    green=(g>r*1.2)&(g>b*1.2)
    colored=green|((b>r*1.25)&(b>g*1.08))|((r>g*2.4)&(r>b*2.5))
    cloth=(tag==2)|((tag==3)&colored)|((tag==0)&green)
    neutral=(col.max(axis=1)-col.min(axis=1)<.17)&(col.max(axis=1)>.15)
    leather=(tag==3)&(r>g*1.2)&(g>b*1.1)
    tiles=np.select([cloth,neutral,leather],[0,2,1],default=3)
    faction_tint=linear(np.array([.78,.12,.14] if name=='ranger' else [.65,.70,.73]))
    rgb[cloth]=faction_tint*(.58+.42*col[cloth].max(axis=1,keepdims=True))
    # Orthographic UV projection in rest space. Front/back use X/Y, sides use Z/Y.
    pos=channel(blob,body,'position')
    axis=np.abs(channel(blob,body,'normal')).argmax(axis=1)
    u=np.clip(.5+np.where(axis==0,pos[:,2],pos[:,0])*.44,.015,.985)
    v=np.clip(1-np.where(axis==1,pos[:,2]+1,pos[:,1])*.40,.015,.985)
    uv=np.column_stack(atlas_uv(tiles,u,v))
    return uv,np.column_stack((rgb,np.zeros(len(rgb))))

def build_mesh(name):
    path=OUT/(name+'.json')
    meta=json.loads(path.read_text())
    geos=meta['geometries']
    raw=(OUT/(name+'-mesh.bin')).read_bytes()
    # The two addon geometries may already exist when the artist rebuilds.
    original=[g for key,g in geos.items() if key not in ('duelBody','duelSword')]
    end=max(f['offset']+f['length']*4 for g in original for f in g.values())
    packed=bytearray(raw[:end])
    body=geos['body']
    uv,paint=body_surface(name,body,raw)
    geos['duelBody']={**body,'uv':append(packed,uv,'uv'),'paint':append(packed,paint,'paint')}
    # Last three pose slots are right grip, left grip and bowstring (base baker).
    joint=meta['bones']-3
    fields=Equipment(joint,joint+1).make(name=='ranger')
    vertices=np.array(fields['position']).reshape(-1,3)
    blade=vertices[np.array(fields['skinIndex']).reshape(-1,4)[:,0]==joint]
    top=blade[blade[:,1]==blade[:,1].max()]
    meta['duelBladeTip']=((top.min(0)+top.max(0))*.5).tolist()
    geos['duelSword']={key:append(packed,value,key) for key,value in fields.items()}
    (OUT/(name+'-mesh.bin')).write_bytes(packed)
    path.write_text(json.dumps(meta,separators=(',',':'))+'\n')
    print(name,len(fields['index'])//3,'equipment triangles,',len(packed)-end,'additional mesh bytes')

def build():
    generate(OUT)
    for name in ('knight','ranger'):
        build_mesh(name)

if __name__=='__main__':
    build()
    if '--' in sys.argv:
        import motions
        args=sys.argv[sys.argv.index('--')+1:]
        rigs=motions.run(OUT,Path(args[0]))
        if len(args)>1:
            from preview import build_preview
            build_preview(Path(args[0]),Path(args[1]),rigs)
