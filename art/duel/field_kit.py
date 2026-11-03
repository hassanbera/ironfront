"""Fitted campaign outfits. All vertices bind to the existing body bones."""
import json
import math
import numpy as np
from wardrobe import Garments, torso, HEAD, CLOTH, LEATHER, STEEL, MAIL, GOLD, PLATES

KITS={
    'knight':['Knight'],
    'viking':['Norse','NorseBow','NorseFur'],
    'ranger':['Longbow','Arab','ArabCamel','ArabJavelin','ArabBow','Turk','TurkBow'],
}
BLUE=(.045,.16,.34)
GREEN=(.024,.24,.113)
CRIMSON=(.54,.020,.034)
SLATE=(.15,.18,.21)
LINEN=(.77,.66,.46)
HIDE=(.19,.105,.059)
BRASS=(.76,.6,.32)

class FieldKit(Garments):
    def tube(self,joint,base,top,r0,r1,tile,tint,n=7):
        a,b=np.array(base),np.array(top)
        axis=b-a; axis/=np.linalg.norm(axis)
        u=np.cross(axis,[0,0,1]);u/=np.linalg.norm(u)
        v=np.cross(axis,u)
        ends=[[tuple(c+rr*(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))) for i in range(n)]
              for c,rr in [(a,r0),(b,r1)]]
        for i in range(n):
            j=(i+1)%n
            self.face(joint,[ends[0][i],ends[0][j],ends[1][j],ends[1][i]],tile,tint)
        self.face(joint,ends[1],tile,tint)

    def quiver(self):
        # The quiver hangs diagonally from the bow-side shoulder and follows the chest.
        self.tube(3,(-.18,.48,-.26),(.39,1.22,-.31),.075,.105,LEATHER,HIDE)
        self.tube(3,(.34,1.16,-.305),(.40,1.235,-.31),.108,.11,GOLD,BRASS)
        self.strip(torso,[(-.18,.60,.177),(-.06,.76,.249),(.10,.94,.246),(.23,1.125,.18)],.027,LEATHER,HIDE)
        for j in range(2 if self.tier=='far' else 4):
            x=.345+.043*(j%3);y=1.19+.032*(j%2);z=-.30-.04*(j//2)
            tip=(x+.145,y+.24,z)
            self.tube(3,(x,y,z),tip,.010,.010,LEATHER,(.42,.28,.14),4)
            for side in (-1,1):
                self.face(3,[(tip[0]-.068,tip[1]-.10,z),(tip[0],tip[1],z),
                             (tip[0]+.025,tip[1]-.013,z+side*.033)],CLOTH,LINEN)

    def norse(self,bow,fur):
        self.shell([(1.37,.459,.393),(1.58,.482,.454),(1.78,.477,.48)],
                   CLOTH if bow or fur else MAIL,HIDE if bow or fur else (.78,.80,.82),
                   HEAD,start=.98,arc=math.tau-1.96)
        if bow or fur:
            self.shell([(1.76,.49,.51),(1.88,.49,.50),(2.05,.35,.36),(2.11,.13,.14)],CLOTH,BLUE,HEAD,cap=True)
            self.shell([(1.735,.495,.51),(1.81,.503,.52)],LEATHER,HIDE,HEAD)
        else:
            self.shell([(1.74,.48,.5),(1.82,.505,.514),(2.02,.375,.39),(2.15,.085,.10)],STEEL,(.43,.49,.52),HEAD,cap=True)
            self.shell([(1.74,.499,.515),(1.80,.51,.523)],STEEL,(.21,.25,.28),HEAD)
            self.strip(HEAD,[(0,1.51,.513),(0,1.77,.525),(0,1.88,.506),(0,2.11,.20)],.024,STEEL,(.75,.73,.66))
            for sign in (-1,1):
                self.strip(HEAD,[(sign*.37,1.765,.367),(sign*.32,1.94,.347),(sign*.19,2.07,.241),
                                 (sign*.04,2.145,.105)],.015,STEEL,(.77,.73,.65))
                self.strip(HEAD,[(sign*.035,1.71,.503),(sign*.13,1.746,.50),(sign*.25,1.73,.447)],.014,STEEL,(.68,.65,.58))
        # Tapered beard below the mouth, with cheek pieces outside the eyes.
        self.shell([(1.258,.086,.418),(1.345,.246,.47),(1.47,.392,.486)],LEATHER,
                   (.235,.10,.04),HEAD,start=-1.13,arc=2.26)
        collar=(.29,.22,.155) if fur else (.135,.135,.13)
        self.shell([(1.058,.345,.26),(1.145,.39,.272),(1.245,.20,.167)],CLOTH,collar,3)
        # Uneven hide tails make the berserker recognizable in silhouette.
        if fur:
            for i in range(self.sides):
                a=i*math.tau/self.sides;b=(i+1)*math.tau/self.sides
                self.face(3,[(.37*math.sin(a),1.13,.27*math.cos(a)),
                             (.346*math.sin((a+b)/2),.96-.05*(i%2),.263*math.cos((a+b)/2)),
                             (.37*math.sin(b),1.13,.27*math.cos(b))],LEATHER,collar)
        self.tube(3,(.165,1.095,.224),(.165,1.106,.25),.037,.034,GOLD,BRASS)
        if self.tier!='far':
            self.strip(torso,[(-.17,.63,.206),(-.03,.79,.245),(.10,.95,.242),(.19,1.10,.209)],.029,LEATHER,HIDE)
            # Woven lozenges along the apron hem.
            for i in range(-2,3):
                x=i*.077;z=.253*math.sqrt(1-(x/.35)**2)+.012
                self.face(torso,[(x-.031,.426,z),(x,.405,z+.002),(x+.031,.426,z),(x,.448,z+.002)],CLOTH,LINEN)

    def wrap_fold(self,y,tilt,tint):
        n=self.sides
        def point(i,level,r):
            a=i*math.tau/n
            return (.518*r*math.sin(a),y+level+tilt*math.sin(a+.16),.538*r*math.cos(a))
        for i in range(n):
            j=i+1
            self.face(HEAD,[point(i,0,1),point(j,0,1),point(j,.031,1.035),point(i,.031,1.035)],CLOTH,tint)
            self.face(HEAD,[point(i,.031,1.035),point(j,.031,1.035),point(j,.065,.987),point(i,.065,.987)],CLOTH,tint)

    def wrapped(self,style,bow):
        # A wrapped cap, layered brow and draped side/back cloth keep the face open.
        self.shell([(1.22,.47,.37),(1.44,.5,.44),(1.83,.49,.47)],CLOTH,LINEN,HEAD,start=.84,arc=math.tau-1.68)
        self.shell([(1.74,.49,.51),(1.85,.54,.55),(1.99,.49,.495),(2.08,.32,.32),(2.10,.09,.10)],CLOTH,LINEN,HEAD,cap=True)
        self.shell([(1.76,.502,.523),(1.81,.548,.565),(1.865,.53,.545)],CLOTH,GREEN,HEAD)
        self.shell([(1.866,.535,.552),(1.92,.51,.524)],CLOTH,(.59,.50,.33),HEAD)
        self.wrap_fold(1.81,.073,(.84,.74,.55))
        self.wrap_fold(1.855,-.057,(.65,.55,.385))
        if style=='ArabCamel':
            self.shell([(1.34,.392,.431),(1.47,.447,.481),(1.555,.455,.49)],CLOTH,(.51,.41,.278),HEAD)
        if style=='Arab':
            self.shell([(.69,.287,.23),(.92,.30,.244),(1.14,.265,.217)],MAIL,(.82,.84,.74),torso)
        if style=='ArabJavelin':
            for i in range(2):
                x=.29+i*.09
                self.tube(3,(x-.55,.34,-.277),(x+.15,1.57,-.30),.019,.019,LEATHER,HIDE,5)
                self.tube(3,(x+.15,1.57,-.30),(x+.24,1.73,-.306),.046,.003,STEEL,(.73,.75,.71),4)
        self.shell([(1.042,.313,.253),(1.105,.315,.25),(1.22,.197,.179)],CLOTH,
                   (.091,.27,.135) if bow else LINEN,3)
        self.strip(torso,[(-.08,.25,.26),(-.055,.50,.25),(.008,.76,.254),(.18,1.13,.21)],.014,GOLD,BRASS)

    def make(self,style):
        bow=style.endswith('Bow') or style=='Longbow'
        norse=style.startswith('Norse');arab=style.startswith('Arab');turk=style.startswith('Turk')
        tint=BLUE if norse else GREEN if arab else CRIMSON if turk else SLATE
        self.sides={'near':14,'mid':10,'far':7}[self.tier]
        self.sleeves(False,tint if bow or not norse else None)
        for cx,thigh,shin in [(.17,15,16),(-.17,19,20)]:
            self.shell([(.20,.105,.119),(.36,.14,.14),(.50,.129,.134)],CLOTH,tint,thigh,cx=cx,sides=6)
            self.shell([(.085,.11,.12),(.24,.11,.12),(.30,.12,.12)],LEATHER,HIDE,shin,cx=cx,sides=6)
        hem=.245 if arab or turk else .35
        self.shell([(hem,.35,.245),(.54,.32,.237),(.68,.27,.215),(1.08,.305,.24),(1.185,.243,.19)],CLOTH,tint,torso)
        self.shell([(hem,.353,.247),(hem+.028,.35,.246)],CLOTH,LINEN if norse or arab else BRASS,torso)
        self.shell([(.56,.32,.247),(.62,.307,.241),(.66,.291,.227)],CLOTH if arab or turk else LEATHER,
                   (.62,.44,.16) if arab else HIDE,torso)
        if norse:self.norse(bow,style=='NorseFur')
        elif arab:self.wrapped(style,bow)
        elif turk:
            self.shell([(1.75,.49,.51),(1.88,.48,.5),(2.05,.34,.37),(2.19,.066,.09)],CLOTH,CRIMSON,HEAD,cap=True)
            self.shell([(1.73,.5,.515),(1.82,.52,.53),(1.86,.49,.51)],LEATHER,(.24,.055,.049),HEAD)
            if not bow:self.shell([(.70,.285,.23),(1.12,.294,.237)],PLATES,(.88,.79,.73),torso)
        else:
            self.shell([(1.20,.44,.39),(1.55,.475,.446),(1.80,.469,.46)],MAIL if not bow else CLOTH,SLATE,HEAD,start=.87,arc=math.tau-1.74)
            self.shell([(1.75,.47,.49),(1.85,.51,.515),(2.03,.38,.4),(2.115,.105,.13)],LEATHER if bow else STEEL,HIDE if bow else (.45,.48,.50),HEAD,cap=True)
            self.shell([(1.765,.53,.55),(1.805,.505,.525)],CLOTH if bow else STEEL,LINEN,HEAD)
            if not bow:self.tabard()
        if bow:self.quiver()
        return self.fields

def build_kits(out,widths,exposed,merge,append):
    reference=json.loads((out/'ranger.json').read_text())
    source=(out/'ranger-mesh.bin').read_bytes()
    for name,styles in KITS.items():
        meta=json.loads((out/(name+'.json')).read_text())
        geos={key:geo for key,geo in meta['geometries'].items() if not key.startswith('field')}
        meta['geometries']=geos
        raw=(out/(name+'-mesh.bin')).read_bytes()
        end=max(f['offset']+f['length']*4 for g in geos.values() for f in g.values())
        packed=bytearray(raw[:end])
        for tier,suffix in [('near',''),('mid','Mid'),('far','Far')]:
            skin=exposed('ranger',reference['geometries']['body'+suffix],source)
            # Keep shared stock skin and gloves. Boots and gloves are brown leather.
            paint=skin['paint'].reshape(-1,4).copy()
            joints=skin['skinIndex'].reshape(-1,4)[:,0]
            paint[np.isin(joints,[6,7,11,12,17,18,21,22]),:3]=HIDE
            skin['paint']=paint.ravel()
            for style in styles:
                fields=merge(skin,FieldKit(tier).make(style))
                # Weld identical skinned vertices; seams with distinct UVs/normals remain split.
                attributes=[k for k in widths if k!='index']
                rows=np.column_stack([fields[k].reshape(-1,widths[k]) for k in attributes]).astype('<f4')
                vertices,inv=np.unique(rows,axis=0,return_inverse=True)
                indices=inv[fields['index'].astype(int)]
                offset=0; geo={}
                for key in attributes:
                    geo[key]=append(packed,vertices[:,offset:offset+widths[key]],key);offset+=widths[key]
                geo['index']=append(packed,indices,'index')
                geos['field'+style+suffix]=geo
        (out/(name+'-mesh.bin')).write_bytes(packed)
        (out/(name+'.json')).write_text(json.dumps(meta,separators=(',',':'))+'\n')
