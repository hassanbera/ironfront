"""Author FK accents in Blender and bake world-space corrections into the shared GPU pose atlas."""
import bpy
import json
import math
import struct
from pathlib import Path
import numpy as np
from mathutils import Matrix, Vector

# (output phase, source phase). Contact crosses the body centre at the server phase.
CUTS={
    'slash': ('1H_Melee_Attack_Slice_Horizontal', .266),
    'backslash': ('1H_Melee_Attack_Slice_Diagonal', .405),
    'stab': ('1H_Melee_Attack_Stab', .33),
}
OTHERS={'blockHit':'Block_Hit','hit':'Hit_A','walk':'Walking_A','run':'Running_A',
        'dodgeLeft':'Dodge_Left','dodgeRight':'Dodge_Right'}
TO_GAME=np.array([[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]],dtype=float)

def curve(phase, keys):
    return float(np.interp(phase,*zip(*keys)))

def rotate_bone(rig,name,axis,degrees):
    bone=rig.pose.bones[name]
    matrix=bone.matrix.copy()
    rotation=Matrix.Rotation(math.radians(degrees),4,axis)
    result=rotation @ matrix
    result.translation=matrix.translation
    bone.matrix=result
    bpy.context.view_layer.update()

def key_pose(rig,action,frame,shrink_head=False):
    saved=[(p,p.location.copy(),p.rotation_quaternion.copy(),p.scale.copy()) for p in rig.pose.bones]
    rig.animation_data.action=action
    for bone,loc,rot,scale in saved:
        bone.location, bone.rotation_quaternion, bone.scale=loc,rot,scale
        if shrink_head and bone.name=='head': bone.scale*=.60
        for prop in ('location','rotation_quaternion','scale'):
            bone.keyframe_insert(data_path=prop,frame=frame,group=bone.name)

def rising_cut(scene,rig,slots,source,poses,tip,source_contact,beat):
    # Lift from the sword side with the edge leading, then open the wrist
    # for the return cut. Rotate around the blade tip to retain its contact.
    action=bpy.data.actions.new(rig.name+' / risingCut')
    action.use_fake_user=True
    baked=[]
    impact=beat['impact']
    for i in range(26):
        t=i/25
        s=curve(t,[(0,.79),(.22,.56),(impact,source_contact),(.68,.29),(1,.22)])
        rig.animation_data.action=source
        frame=s*source.frame_range[1]
        scene.frame_set(int(frame),subframe=frame-int(frame))
        source_matrices={p.name:p.matrix.copy() for p in rig.pose.bones}
        f=s*(len(poses)-1)
        lo=int(f)
        pose=poses[lo].astype(float)*(1-(f-lo))+poses[min(lo+1,len(poses)-1)].astype(float)*(f-lo)
        target=Vector((TO_GAME.T @ pose[-3].T @ [*tip,1])[:3])
        roll=curve(t,[(0,22),(.22,105),(impact,142),(.68,110),(1,12)])
        for name,share in [('lowerarm.r',.35),('hand.r',.65)]:
            axis=(target-rig.pose.bones[name].matrix.translation).normalized()
            rotate_bone(rig,name,axis,roll*share)
        rotate_bone(rig,'upperarm.l','X',-8*math.sin(math.pi*t))
        delta=np.stack([TO_GAME @ np.asarray(rig.pose.bones[n].matrix @ source_matrices[n].inverted_safe()) @ TO_GAME.T for n in slots])
        baked.append((delta @ pose.transpose(0,2,1)).transpose(0,2,1).astype('<f2'))
        key_pose(rig,action,t*beat['duration']*24)
    return action,np.stack(baked)

def accent(rig, motion, t, impact, turk):
    if motion in CUTS:
        reverse=-1 if motion=='stab' else 1
        turn=curve(t,[(0,0),(.24,15),(.32,13),(impact,0),(.59,-17),(.77,-9),(1,0)])
        lean=curve(t,[(0,0),(.25,-7),(impact,8),(.57,11),(.8,3),(1,0)])
        rotate_bone(rig,'spine','Z',turn*(1.0 if turk else .75)*reverse)
        rotate_bone(rig,'chest','X',lean)
        rotate_bone(rig,'upperarm.l','Z',turn*.32)
    elif motion in ('blockHit','hit'):
        recoil=curve(t,[(0,0),(.13,1),(.26,.72),(.50,.22),(1,0)])
        rotate_bone(rig,'chest','X',-12*recoil)
        rotate_bone(rig,'spine','Z',-8*recoil)
        rotate_bone(rig,'upperarm.l','Z',16*recoil)
    elif motion.startswith('dodge'):
        lean=math.sin(t*math.pi)**2
        rotate_bone(rig,'spine','Y',(-14 if motion=='dodgeLeft' else 14)*lean)
        rotate_bone(rig,'chest','X',8*lean)
    else:
        stride=math.sin(t*math.tau)
        rotate_bone(rig,'chest','Z',stride*(4 if motion=='walk' else 7))
        rotate_bone(rig,'upperarm.l','Z',-stride*3)

def import_rig(source):
    original=set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=str(source))
    rig=next(o for o in bpy.context.selected_objects if o.type=='ARMATURE')
    # Importers also create NLA strips. Sample just the action selected below.
    for track in rig.animation_data.nla_tracks: track.mute=True
    actions=list(set(bpy.data.actions)-original)
    contents=source.read_bytes()
    gltf=json.loads(contents[20:20+struct.unpack_from('<I',contents,12)[0]])
    nodes=gltf['nodes']
    parents={child:i for i,n in enumerate(nodes) for child in n.get('children',[])}
    names=[nodes[i]['name'] for i in gltf['skins'][0]['joints']]
    static=[]
    def walk(i):
        n=nodes[i]
        if 'mesh' in n and 'skin' not in n and n['name'].endswith(('_Helmet','_Hat','_Cape')):
            static.append(nodes[parents[i]]['name'])
        for child in n.get('children',[]): walk(child)
    for i in gltf['scenes'][gltf.get('scene',0)]['nodes']: walk(i)
    return rig,actions,names+static+['handslot.r','handslot.l','handslot.l']

def run(out, source_dir):
    scene=bpy.context.scene
    scene.render.fps=24
    workshop={}
    for model,src in [('ranger','Rogue_Hooded.glb'),('knight','Knight.glb')]:
        rig,actions,slots=import_rig(Path(source_dir)/src)
        rig.name='Turks Guardian' if model=='ranger' else 'Knights Infantry'
        meta_path=out/(model+'.json')
        meta=json.loads(meta_path.read_text())
        clips=meta['animations']
        assert len(slots)==meta['bones'], (model,len(slots),meta['bones'])
        pose_path=out/(model+'-poses.bin')
        end=max(c['start']+c['frames'] for k,c in clips.items() if not k.startswith('duel_'))
        atlas=np.fromfile(pose_path,dtype='<f2').reshape(-1,len(slots),4,4)[:end]
        chunks=[atlas]; next_frame=end
        authored_clips={}
        rules=json.loads((out.parents[3]/'server/rules.json').read_text())
        impact=.42 if model=='ranger' else rules['combat']['impactFraction']
        for motion,source_name in {**{k:v[0] for k,v in CUTS.items()},**OTHERS}.items():
            base=clips[motion]
            source=next(a for a in actions if a.name.startswith(source_name+'_Rig'))
            # Choose grids containing the exact impact sample (.42 or .45).
            samples=(51 if model=='ranger' else 41) if motion in CUTS else base['frames']
            contact=CUTS[motion][1] if motion in CUTS else 0
            if motion in ('slash','backslash'):
                tip=[*meta['duelBladeTip'],1]
                sweep=atlas[base['start']:base['start']+base['frames'],-3].transpose(0,2,1)@tip
                # The curved tip of the kilij crosses at a different source frame.
                for k,(left,right) in enumerate(zip(sweep,sweep[1:])):
                    if left[0]>0>=right[0] and min(left[2],right[2])>.5:
                        contact=(k+left[0]/(left[0]-right[0]))/(base['frames']-1)
                        break
            baked=[]
            # Preserve an editable Blender Action for both characters.
            authored=bpy.data.actions.new(rig.name+' / '+motion)
            authored.use_fake_user=True
            authored_clips[motion]=authored
            for i in range(samples):
                t=i/(samples-1)
                s=t
                if motion in CUTS:
                    s=curve(t,[(0,0),(.24,contact*.63),(.32,contact*.75),(impact,contact),
                               (.56,min(.67,contact+.16)),(.78,.76),(1,1)])
                elif motion in ('blockHit','hit'):
                    s=curve(t,[(0,0),(.15,.28),(.44,.52),(1,1)])
                rig.animation_data.action=None
                for bone in rig.pose.bones:
                    bone.matrix_basis=Matrix.Identity(4)
                rig.animation_data.action=source
                frame=source.frame_range[0]+s*(source.frame_range[1]-source.frame_range[0])
                scene.frame_set(int(frame),subframe=frame-int(frame))
                reference={n:p.matrix.copy() for n,p in rig.pose.bones.items()}
                accent(rig,motion,t,impact,model=='ranger')
                delta={n:TO_GAME@np.asarray(p.matrix @ reference[n].inverted_safe())@TO_GAME.T
                       for n,p in rig.pose.bones.items()}
                # The base bake includes head proportion and hand-socket corrections.
                # Reuse those matrices and transform all their descendants together.
                f=s*(base['frames']-1); lo=int(f); hi=min(lo+1,base['frames']-1)
                src_pose=atlas[base['start']+lo].astype(float)*(1-(f-lo))+atlas[base['start']+hi].astype(float)*(f-lo)
                result=np.stack([delta[n] for n in slots])@src_pose.transpose(0,2,1)
                baked.append(result.transpose(0,2,1).astype('<f2'))
                # Source keys are never edited. Key the sampled local pose into the new action.
                key_pose(rig,authored,t*base['duration']*24,shrink_head=True)
            clips['duel_'+motion]={'start':next_frame,'frames':samples,'duration':base['duration']}
            next_frame+=samples
            chunks.append(np.stack(baked))
            if motion=='backslash':
                opening=rules['swordChain']['steps'][0]
                rising,frames=rising_cut(scene,rig,slots,authored,chunks[-1],meta['duelBladeTip'],impact,opening)
                authored_clips['risingCut']=rising
                clips['duel_risingCut']={'start':next_frame,'frames':len(frames),'duration':opening['duration']}
                chunks.append(frames)
                next_frame+=len(frames)
        meta['frames']=next_frame
        np.concatenate(chunks).tofile(pose_path)
        meta_path.write_text(json.dumps(meta,separators=(',',':'))+'\n')
        rig.animation_data.action=authored_clips['slash']
        workshop[model]=(rig,authored_clips)
        print(model, 'authored',len(authored_clips),'actions; contact phase',impact)
    return workshop
