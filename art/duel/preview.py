"""Build a portable .blend from the game meshes and editable source armatures/actions."""
import bpy
import numpy as np
import json, math, struct
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector
from build import OUT, channel

def material():
    mat=bpy.data.materials.new("Duel | weave, leather and steel")
    mat.use_nodes=True
    tree=mat.node_tree
    bsdf=tree.nodes.get("Principled BSDF")
    def connect(a,b): tree.links.new(a,b)
    def image(kind):
        im=bpy.data.images.load(str(OUT/('duel-'+kind+'.png')),check_existing=False)
        im.colorspace_settings.name='sRGB' if kind=='color' else 'Non-Color'
        im.pack()
        node=tree.nodes.new('ShaderNodeTexImage'); node.image=im
        return node.outputs['Color']
    ink=tree.nodes.new('ShaderNodeVertexColor'); ink.layer_name='Pigment'
    mix=tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
    connect(image('color'),mix.inputs[1]);connect(ink.outputs['Color'],mix.inputs[2])
    connect(mix.outputs[0],bsdf.inputs['Base Color'])
    channels=tree.nodes.new('ShaderNodeSeparateColor')
    connect(image('finish'),channels.inputs[0])
    connect(channels.outputs[1],bsdf.inputs['Roughness']);connect(channels.outputs[2],bsdf.inputs['Metallic'])
    n=tree.nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.55
    connect(image('normal'),n.inputs['Color']);connect(n.outputs[0],bsdf.inputs['Normal'])
    return mat

def bind_slots(path):
    raw=path.read_bytes(); doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
    nodes=doc['nodes']; joints=doc['skins'][0]['joints']
    slots=[(nodes[i]['name'],Matrix.Identity(4)) for i in joints]
    worlds={}; extras=[]
    def visit(i,parent,parent_name):
        node=nodes[i]; q=node.get('rotation',[0,0,0,1])
        local=Matrix.LocRotScale(Vector(node.get('translation',[0,0,0])),Quaternion((q[3],*q[:3])),Vector(node.get('scale',[1,1,1])))
        world=parent@local; name=node['name']; worlds[name]=world
        if 'mesh' in node and 'skin' not in node and name.endswith(('_Helmet','_Hat','_Cape')):
            extras.append((parent_name,world))
        for child in node.get('children',[]):visit(child,world,name)
    for i in doc['scenes'][0]['nodes']:visit(i,Matrix.Identity(4),'')
    return slots+extras+[(n,worlds[n]) for n in ('handslot.r','handslot.l','handslot.l')]

def add_mesh(scene,rig,kind,fields,blob,slots,mat):
    pos=channel(blob,fields,'position')
    idx=channel(blob,fields,'skinIndex').astype(int)
    weights=channel(blob,fields,'skinWeight')
    positions=[]
    for co,joints in zip(pos,idx):
        x,y,z=slots[joints[0]][1]@Vector(co)
        positions.append((x,-z,y))
    mesh=bpy.data.meshes.new(rig.name+' '+kind)
    mesh.from_pydata(positions,[],channel(blob,fields,'index').astype(int).reshape(-1,3).tolist())
    mesh.update()
    uv=mesh.uv_layers.new(name='Atlas')
    uvs=channel(blob,fields,'uv')
    for loop in mesh.loops:
        u,v=uvs[loop.vertex_index];uv.data[loop.index].uv=(u,1-v)
    pigment=mesh.color_attributes.new(name='Pigment',type='FLOAT_COLOR',domain='POINT')
    paint=channel(blob,fields,'paint').copy();paint[:,3]=1
    pigment.data.foreach_set('color',paint.ravel())
    obj=bpy.data.objects.new(mesh.name,mesh);scene.collection.objects.link(obj)
    obj.parent=rig;mesh.materials.append(mat)
    groups={n:obj.vertex_groups.new(name=n) for n in dict(slots)}
    for i,(joints,row) in enumerate(zip(idx,weights)):
        for j,w in zip(joints,row):
            if w>0:groups[slots[j][0]].add([i],w,'ADD')
    arm=obj.modifiers.new('Pose','ARMATURE');arm.object=rig

def build_preview(source, destination, workshop):
    scene=bpy.data.scenes.new("IRONFRONT - Duel")
    bpy.context.window.scene=scene
    mat=material()
    actions=set()
    for model,label,src,side in [('ranger','Turks Guardian','Rogue_Hooded.glb',-1),('knight','Knights Infantry','Knight.glb',1)]:
        rig,clips=workshop[model];scene.collection.objects.link(rig)
        slots=bind_slots(Path(source)/src)
        meta=json.loads((OUT/(model+'.json')).read_text());blob=(OUT/(model+'-mesh.bin')).read_bytes()
        for kind in ('duelBody','duelSword'): add_mesh(scene,rig,kind,meta['geometries'][kind],blob,slots,mat)
        for track in list(rig.animation_data.nla_tracks): rig.animation_data.nla_tracks.remove(track)
        rig.animation_data.action=clips['blockHit' if side<0 else 'slash']
        actions.update(clips.values())
        scale=2.15/meta['height']*(1.16 if side<0 else 1)
        rig.scale=(scale*.92,scale*.95,scale*1.16);rig.location.x=side*1.03
        rig.rotation_mode='XYZ'
        rig.rotation_euler.z=-.48
        rig.hide_set(True)
    def aim(obj,at): obj.rotation_euler=(Vector(at)-obj.location).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.objects.new('Duel camera',bpy.data.cameras.new('Duel camera'))
    scene.collection.objects.link(cam);cam.location=(.4,-6.8,2.65);aim(cam,(0,0,1.18));scene.camera=cam
    for name,loc,power,size in [('Key',(-3,-3,5),590,4),('Rim',(2,2,4),650,3),('Fill',(4,-2,3),290,4)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
        light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=loc;aim(light,(0,0,1))
    scene.world=bpy.data.worlds.new('Workshop');scene.world.color=(.18,.19,.2)
    scene.render.resolution_x=1280;scene.render.resolution_y=720
    scene.frame_start=0;scene.frame_end=26;scene.frame_set(11)
    for frame,label in [(0,'Ready'),(6,'Load'),(11,'Contact'),(16,'Follow-through'),(26,'Guard')]:
        scene.timeline_markers.new(label,frame=frame)
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.color_type='TEXTURE'
    bpy.data.libraries.write(str(destination.resolve()),{scene,*actions},compress=True)
    print('Saved',destination, 'with',len(actions),'editable actions')
