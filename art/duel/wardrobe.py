"""Original fitted garments, authored around the shared KayKit bind skeleton."""
import math
from surface import Surface

CLOTH, LEATHER, STEEL, PLAIN, GOLD = 0, 1, 2, 3, 7
MAIL, KAFTAN, SURCOAT, PLATES = 8, 9, 10, 11
RED = (.52,.022,.033)
OXBLOOD = (.23,.015,.021)
IVORY = (.80,.78,.68)
IRON = (.31,.36,.40)
BLACK = (.022,.025,.029)
HEAD = 14

def mix(a,b,t):
    t = min(1,max(0,t))
    return [(a,1-t),(b,t)]

def torso(point):
    x,y,_ = point
    if y < .55:
        return mix(1,15 if x>0 else 19,(.55-y)*2.0)
    if y < .84:
        return mix(1,2,(y-.55)/.23)
    return mix(2,3,(y-.84)/.20)

class Garments(Surface):
    def __init__(self, tier):
        super().__init__()
        self.tier=tier
        self.sides={'near':20,'mid':14,'far':8}[tier]

    def shell(self, levels, tile, tint, binding, *, start=0, arc=math.tau, sides=None, flute=0, cap=False, cx=0):
        n=sides or self.sides
        if self.tier=='far' and len(levels)>3:
            levels=[levels[0],levels[len(levels)//2],levels[-1]]
        rings=[]
        for row,(y,rx,rz) in enumerate(levels):
            ring=[]
            for i in range(n+1):
                angle=start+arc*i/n
                relief=1+(flute if i%2 and 0<row<len(levels)-1 else 0)
                ring.append((cx+rx*relief*math.sin(angle),y,rz*relief*math.cos(angle)))
            rings.append(ring)
        for j,(a,b) in enumerate(zip(rings,rings[1:])):
            for i in range(n):
                u,U=i/n,(i+1)/n
                v,V=1-j/(len(rings)-1),1-(j+1)/(len(rings)-1)
                normals=None
                if tile==STEEL and not flute:
                    dy=levels[j+1][0]-levels[j][0]
                    slope=(levels[j][1]-levels[j+1][1])/max(.001,dy)
                    length=math.sqrt(1+slope*slope)
                    normals=[(math.sin(start+arc*k/n)/length,slope/length,math.cos(start+arc*k/n)/length)
                             for k in (i,i+1,i+1,i)]
                self.face(binding,[a[i],a[i+1],b[i+1],b[i]],tile,tint,[(u,v),(U,v),(U,V),(u,V)],normals)
        if cap:
            self.face(binding,rings[-1][:-1],tile,tint)

    def strip(self, binding, path, width, tile, tint=(1,1,1)):
        for (x,y,z),(X,Y,Z) in zip(path,path[1:]):
            self.face(binding,[(x-width,y,z),(x+width,y,z),(X+width,Y,Z),(X-width,Y,Z)],tile,tint)

    def sleeves(self,turk):
        rings=[(.16,.144),(.28,.154),(.42,.119),(.51,.116),(.64,.102),(.78,.078)]
        if self.tier=='far': rings=[rings[i] for i in (0,3,5)]
        for sign,upper in [(1,4),(-1,9)]:
            def arm(point):
                x=abs(point[0])
                if x<.52: return mix(upper,upper+1,(x-.40)/.12)
                return mix(upper+1,upper+2,(x-.68)/.1)
            n=8 if self.tier!='far' else 5
            def ring(x,r):
                return [(sign*x,1.107+r*math.cos(k*math.tau/n),r*.97*math.sin(k*math.tau/n)) for k in range(n)]
            for j,((x,r),(X,R)) in enumerate(zip(rings,rings[1:])):
                a,b=ring(x,r),ring(X,R)
                tile= (KAFTAN if x<.51 else STEEL) if turk else (MAIL if x<.64 else LEATHER)
                tint=(.73,.74,.72) if tile==STEEL else ((.22,.14,.095) if tile==LEATHER else (1,1,1))
                for i in range(n):
                    k=(i+1)%n
                    pts=[a[i],a[k],b[k],b[i]]
                    uv=[(i/n,1),(k/n,1),(k/n,0),(i/n,0)]
                    self.face(arm,pts[::sign],tile,tint,uv[::sign])

    def turk_helmet(self):
        # Open face above the eyes, with mail descending at the neck and cheeks.
        self.shell([(1.20,.48,.40),(1.35,.49,.43),(1.74,.46,.46)],MAIL,(.88,.90,.9),HEAD,
                   start=.89,arc=math.tau-1.78)
        self.shell([(1.73,.476,.50),(1.84,.49,.505),(1.99,.438,.461),
                    (2.115,.31,.335),(2.225,.135,.16),(2.28,.037,.05)],
                   STEEL,(.51,.58,.61),HEAD,flute=.075,cap=True)
        self.shell([(1.71,.49,.509),(1.737,.534,.552),(1.77,.523,.543),
                    (1.793,.543,.56),(1.828,.527,.549),(1.86,.536,.552),
                    (1.882,.513,.536)],CLOTH,RED,HEAD)
        self.shell([(1.872,.524,.542),(1.891,.515,.535)],GOLD,(.79,.72,.58),HEAD)
        self.shell([(2.246,.084,.085),(2.28,.047,.047),(2.318,.012,.012)],GOLD,(.85,.8,.68),HEAD,sides=8,cap=True)
        self.strip(HEAD,[(0,1.482,.517),(0,1.56,.547),(0,1.73,.559),(0,1.885,.548)],.027,GOLD)
        if self.tier!='far':
            self.face(HEAD,[(-.047,1.493,.520),(0,1.448,.54),(.047,1.493,.520),(0,1.54,.547)],STEEL,IRON)

    def turk_coat(self):
        self.shell([(.255,.355,.248),(.34,.368,.252),(.54,.315,.223),(.67,.265,.215),
                    (.91,.286,.224),(1.10,.305,.235),(1.18,.249,.196)],KAFTAN,(1,1,1),torso)
        self.shell([(.70,.274,.226),(.90,.297,.245),(1.065,.311,.244),(1.145,.256,.211)],
                   PLATES,(1,.93,.80),torso)
        self.shell([(.535,.318,.238),(.565,.321,.24),(.604,.305,.235),(.642,.295,.227),
                    (.672,.284,.221)],CLOTH,OXBLOOD,torso)
        self.shell([(.59,.313,.239),(.619,.307,.238)],GOLD,(.72,.62,.48),torso)
        # Overlapping kaftan front, braid following the diagonal fastening.
        self.strip(torso,[(-.07,.27,.253),(-.06,.49,.235),(-.045,.55,.228)],.009,GOLD)
        self.strip(torso,[(-.075,.685,.218),(-.035,.81,.244),(.038,.96,.252),(.13,1.13,.211)],.014,GOLD)
        if self.tier!='far':
            for y in (.765,.865,.965):
                self.face(torso,[(-.111,y,.247),(.061,y,.253),(.057,y+.015,.254),(-.110,y+.017,.247)],CLOTH,RED)
            self.shell([(1.155,.167,.147),(1.236,.166,.15)],CLOTH,RED,3,sides=12)
            # Shallow mirror plate over the laced vest, bordered with hammered brass.
            rings=[[(radius*math.sin(k*math.tau/16),.935+radius*math.cos(k*math.tau/16),z)
                    for k in range(16)] for radius,z in ((.123,.251),(.112,.269),(.089,.278),(.034,.29))]
            for j,(a,b) in enumerate(zip(rings,rings[1:])):
                for k in range(16):
                    i=(k+1)%16
                    self.face(torso,[a[i],a[k],b[k],b[i]],GOLD if j!=1 else STEEL)
            self.face(torso,list(reversed(rings[-1])),GOLD)

    def knight_helm(self):
        # Enclosed helm with a real inset ocular band and a riveted front reinforce.
        self.shell([(1.278,.37,.407),(1.385,.455,.466),(1.548,.49,.496)],STEEL,(.66,.71,.75),HEAD)
        self.shell([(1.545,.475,.48),(1.626,.475,.48)],PLAIN,BLACK,HEAD)
        self.shell([(1.541,.491,.497),(1.63,.50,.506)],STEEL,(.67,.73,.76),HEAD,
                   start=1.04,arc=math.tau-2.08)
        self.shell([(1.622,.498,.505),(1.665,.502,.505),(1.975,.47,.474),
                    (2.10,.388,.399),(2.137,.322,.331)],STEEL,(.71,.77,.80),HEAD,cap=True)
        self.shell([(1.628,.505,.512),(1.669,.506,.512)],GOLD,(.65,.60,.52),HEAD)
        self.shell([(1.977,.473,.48),(1.992,.466,.469)],STEEL,IRON,HEAD)
        self.strip(HEAD,[(0,1.295,.418),(0,1.39,.477),(0,1.565,.509),
                         (0,1.70,.515),(0,1.975,.481),(0,2.108,.398)],.026,GOLD,(.75,.66,.49))
        if self.tier!='far':
            for sign in (-1,1):
                for row in range(2):
                    for column in range(3):
                        x=sign*(.128+column*.071)
                        y=1.412+row*.062
                        z=.498*math.sqrt(1-(x/.49)**2)+.005
                        self.face(HEAD,[(x-.019,y,z),(x,y-.018,z+.001),(x+.019,y,z),(x,y+.018,z+.001)],PLAIN,BLACK)

    def tabard(self):
        levels=[(.255,.242,.272),(.46,.253,.255),(.64,.228,.231),
                (.84,.242,.247),(1.04,.284,.256),(1.16,.295,.202),(1.219,.261,.162)]
        if self.tier=='far': levels=[levels[k] for k in (0,2,4,6)]
        for side in (-1,1):
            for half in (-1,1):
                def point(j,u):
                    y,w,z=levels[j]
                    gap=max(0,.48-y)*.18
                    x=half*(w*u+gap*(1-u))
                    if j==len(levels)-1:y-=.115*(1-u)**2
                    return (x,y,side*(z*(1-.38*u*u)+.018))
                for j in range(len(levels)-1):
                    for u,U in ([(0,1)] if self.tier=='far' else [(0,.5),(.5,1)]):
                        corners=[(j,u),(j,U),(j+1,U),(j+1,u)]
                        points=[point(a,c) for a,c in corners]
                        uv=[(.5+.49*half*c,1-(levels[a][0]-.255)/.964) for a,c in corners]
                        if half*side<0:points.reverse();uv.reverse()
                        self.face(torso,points,SURCOAT,(1,1,1),uv)

    def knight_coat(self):
        self.shell([(.318,.34,.236),(.51,.305,.214),(.66,.25,.204),(.94,.28,.224),
                    (1.12,.30,.213),(1.215,.167,.149)],MAIL,(1,1,1),torso)
        self.tabard()
        self.shell([(.574,.314,.298),(.634,.304,.291)],LEATHER,(.23,.14,.09),torso)
        self.face(torso,[(-.047,.578,.300),(.047,.578,.300),(.047,.632,.297),(-.047,.632,.297)],GOLD)
        self.shell([(1.092,.295,.235),(1.216,.205,.185),(1.324,.221,.218)],MAIL,(.9,.91,.95),3)

    def distant_armor(self,turk):
        # Preserve the distinctive outer profiles and heraldry at army scale.
        if turk:
            self.shell([(.255,.36,.25),(.68,.27,.22),(1.18,.29,.22)],KAFTAN,(1,1,1),torso)
            self.shell([(.70,.28,.23),(1.10,.31,.245)],PLATES,(1,.93,.8),torso)
            self.shell([(1.20,.47,.40),(1.75,.47,.47)],MAIL,(.88,.9,.9),HEAD,start=.89,arc=math.tau-1.78)
            self.shell([(1.73,.52,.54),(1.88,.52,.54)],CLOTH,RED,HEAD)
            self.shell([(1.88,.51,.53),(2.08,.35,.38),(2.31,.014,.014)],STEEL,(.51,.58,.61),HEAD,cap=True)
        else:
            self.shell([(.32,.34,.235),(.65,.25,.205),(1.21,.28,.22)],MAIL,(1,1,1),torso)
            self.tabard()
            self.shell([(1.29,.38,.411),(1.54,.49,.50)],STEEL,(.66,.71,.75),HEAD)
            self.shell([(1.54,.488,.495),(1.64,.49,.50)],PLAIN,BLACK,HEAD)
            self.shell([(1.64,.50,.51),(1.98,.47,.47),(2.135,.33,.34)],STEEL,(.71,.77,.80),HEAD,cap=True)

    def make(self,turk):
        self.sleeves(turk)
        for cx,thigh,shin in [( .17,15,16),(-.17,19,20)]:
            if self.tier=='far':
                self.shell([(.09,.11,.12),(.40,.13,.13)],LEATHER,OXBLOOD if turk else (.16,.12,.093),
                           lambda p:mix(shin,thigh,(p[1]-.18)/.13),cx=cx,sides=5)
                continue
            self.shell([(.211,.092,.103),(.30,.123,.132),(.408,.146,.152),(.51,.129,.136)],
                       CLOTH if turk else MAIL,RED if turk else (.92,.94,.97),thigh,cx=cx,sides=8)
            self.shell([(.089,.112,.121),(.165,.118,.122),(.248,.104,.117),(.273,.119,.122)],
                       LEATHER,OXBLOOD if turk else (.16,.12,.093),shin,cx=cx,sides=8)
        if self.tier=='far':
            self.distant_armor(turk)
        elif turk:
            self.turk_coat()
            self.turk_helmet()
        else:
            self.knight_coat()
            self.knight_helm()
        return self.fields
