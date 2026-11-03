"""Indexed polygon writer for baked skinning. Coordinates are in rig bind space."""
import numpy as np
from materials import atlas_uv

class Surface:
    def __init__(self):
        self.fields = {k: [] for k in ('position','normal','uv','skinIndex','skinWeight','paint','index')}

    def face(self, binding, points, tile, tint=(1,1,1), uv=None, normals=None):
        p = np.asarray(points, dtype=float)
        normal = np.cross(p[1] - p[0], p[2] - p[0])
        length = np.linalg.norm(normal)
        if length < 1e-9:
            return
        normal /= length
        first = len(self.fields['position']) // 3
        for i, point in enumerate(points):
            x,y,z = point
            u,v = uv[i] if uv else (min(.99,max(.01,.5+x)), min(.99,max(.01,.51-y*.67)))
            weights = binding(point) if callable(binding) else [(binding,1)]
            indices = [bone for bone,weight in weights]
            values = [weight for bone,weight in weights]
            self.fields['position'].extend(point)
            self.fields['normal'].extend(normals[i] if normals is not None else normal)
            self.fields['uv'].extend(atlas_uv(tile,u,v))
            self.fields['skinIndex'].extend(indices + [0]*(4-len(indices)))
            self.fields['skinWeight'].extend(values + [0]*(4-len(values)))
            self.fields['paint'].extend((*tint,0))
        for i in range(1,len(points)-1):
            self.fields['index'].extend((first,first+i,first+i+1))
