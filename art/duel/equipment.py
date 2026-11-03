"""Low-poly socket-local silhouettes. Coordinates match the KayKit +Y blade sockets."""
import math
from surface import Surface

class Equipment(Surface):
    def __init__(self, sword_joint, shield_joint):
        super().__init__()
        self.sword, self.shield = sword_joint, shield_joint

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

    def make(self,turk,far=False):
        self.shaft([(-.27,.046,.044,0),(-.19,.067,.058,0),(.13,.054,.046,0)],1,(.32,.17,.10))
        self.shaft([(-.30,.025,.024,0),(-.26,.084,.059,-.012),(-.20,.065,.053,-.008)],7)
        self.shaft([(.105,.16,.046,0),(.139,.23 if turk else .20,.05,0),(.177,.13,.045,0)],7 if turk else 2)
        # Grip +Y points towards the opponent; in the ready pose local -X is up.
        # The thick spine follows the concave side, with the edge on the convex side.
        stations = ([(.15,.059,.028,0),(.42,.055,.025,-.004),(.70,.058,.024,-.021),
                     (.91,.062,.022,-.056),(1.08,.079,.020,-.11),
                     (1.20,.072,.017,-.17),(1.28,.042,.012,-.221),
                     (1.34,.002,.002,-.268)] if turk else
                    [(.15,.10,.036,0),(.28,.088,.034,0),(.9,.065,.025,0),(1.24,.046,.019,0),(1.42,.003,.003,0)])
        if far: stations=stations[::2]+([stations[-1]] if len(stations)%2==0 else [])
        rings=[[(c-w,y,0),(c-w*.54 if turk else c,y,d),(c+w,y,0),
                (c-w*.54 if turk else c,y,-d)] for y,w,d,c in stations]
        self.bands(self.sword,rings,2,(.87,.92,.98))
        # Shield front faces +Z. The reverse and edge are closed surfaces too.
        if turk:
            sides=12 if far else 24
            shape=[(.44*math.cos(k*math.tau/sides),.44*math.sin(k*math.tau/sides)) for k in range(sides)]
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
        if turk and not far:
            boss=[[(r*math.cos(k*math.tau/12),r*math.sin(k*math.tau/12),z) for k in range(12)]
                  for r,z in [(.117,.237),(.099,.255),(.048,.306)]]
            self.bands(self.shield,boss,7)
            self.face(self.shield,boss[-1],7)
        return self.fields
