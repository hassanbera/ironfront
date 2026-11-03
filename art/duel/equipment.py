"""Low-poly socket-local silhouettes. Coordinates match the KayKit +Y blade sockets."""
import math
import numpy as np
from materials import atlas_uv

class Equipment:
    def __init__(self, sword_joint, shield_joint):
        self.sword, self.shield = sword_joint, shield_joint
        self.fields = {key: [] for key in ('position','normal','uv','skinIndex','skinWeight','paint','index')}

    def face(self, joint, points, tile, tint=(1,1,1), uv=None):
        p = np.asarray(points)
        normal = np.cross(p[1]-p[0],p[2]-p[0])
        normal /= np.linalg.norm(normal)
        first = len(self.fields['position'])//3
        for i,(x,y,z) in enumerate(points):
            u,v = uv[i] if uv else (min(.99,max(.01,.5+x)), min(.99,max(.01,.51-y*.67)))
            for key,values in [('position',(x,y,z)),('normal',normal),('uv',atlas_uv(tile,u,v)),
                               ('skinIndex',(joint,0,0,0)),('skinWeight',(1,0,0,0)),('paint',(*tint,0))]:
                self.fields[key].extend(values)
        for i in range(1,len(p)-1):
            self.fields['index'].extend((first,first+i,first+i+1))

    def bands(self, joint, rings, tile, tint=(1,1,1)):
        for a,b in zip(rings,rings[1:]):
            for j in range(len(a)):
                k=(j+1)%len(a)
                self.face(joint,[a[j],a[k],b[k],b[j]],tile,tint)

    def shaft(self, layers, tile, tint=(1,1,1)):
        rings = [[(cx+rx*math.cos(-k*math.tau/8),y,rz*math.sin(-k*math.tau/8))
                  for k in range(8)] for y,rx,rz,cx in layers]
        self.bands(self.sword,rings,tile,tint)
        self.face(self.sword,list(reversed(rings[0])),tile,tint)
        self.face(self.sword,rings[-1],tile,tint)

    def make(self,turk):
        self.shaft([(-.27,.046,.044,0),(-.19,.067,.058,0),(.13,.054,.046,0)],1,(.32,.17,.10))
        self.shaft([(-.30,.025,.024,0),(-.26,.084,.059,-.012),(-.20,.065,.053,-.008)],7)
        self.shaft([(.105,.16,.046,0),(.139,.23 if turk else .20,.05,0),(.177,.13,.045,0)],7 if turk else 2)
        stations = ([(.15,.066,.031,0),(.54,.064,.027,.018),(.90,.082,.024,.08),
                     (1.13,.094,.020,.16),(1.32,.005,.005,.29)] if turk else
                    [(.15,.10,.036,0),(.28,.088,.034,0),(.9,.065,.025,0),(1.24,.046,.019,0),(1.42,.003,.003,0)])
        rings=[[(c-w,y,0),(c,y,d),(c+w,y,0),(c,y,-d)] for y,w,d,c in stations]
        self.bands(self.sword,rings,2,(.87,.92,.98))
        # Shield front faces +Z. The reverse and edge are closed surfaces too.
        if turk:
            shape=[(.44*math.cos(k*math.tau/24),.44*math.sin(k*math.tau/24)) for k in range(24)]
        else:
            shape=[(.405,.42),(.25,.47),(-.25,.47),(-.405,.42),(-.39,.03),(-.32,-.22),
                   (-.18,-.42),(0,-.56),(.18,-.42),(.32,-.22),(.39,.03)]
        rings=[[(x*s,y*s,z) for x,y in shape] for s,z in [(1,.11),(1,.16),(.948,.176),(.25,.236)]]
        self.bands(self.shield,rings[:3],7 if turk else 2)
        tile=4 if turk else 5
        def panel(points):
            uv=[(.5+x/(.88 if turk else .84), .5-y/(.88 if turk else 1.15)) for x,y,z in points]
            self.face(self.shield,points,tile,uv=uv)
        for i in range(len(shape)):
            k=(i+1)%len(shape)
            panel([rings[2][i],rings[2][k],rings[3][k],rings[3][i]])
        panel(rings[3])
        self.face(self.shield,list(reversed(rings[0])),6)
        if turk:
            boss=[[(r*math.cos(k*math.tau/12),r*math.sin(k*math.tau/12),z) for k in range(12)]
                  for r,z in [(.117,.237),(.099,.255),(.048,.306)]]
            self.bands(self.shield,boss,7)
            self.face(self.shield,boss[-1],7)
        return self.fields
