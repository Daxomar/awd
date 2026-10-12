"""Create editable, rigged adult GLBs from the licensed MakeHuman surface.

Run after build-human.py. Coordinates are authored centimetre-like source units;
the root transform converts the model to a 1.76 metre grounded adult.
"""
import json
import struct
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'client/public/assets/models'
DATA = json.loads((DEST / 'human.json').read_text())
JOINTS = {'Hips':'pelvis','Spine':'spine-4','Spine1':'spine-2',
          'Spine2':'spine-1','Neck':'neck','Head':'head'}
PARENTS = {'Hips':None,'Spine':'Hips','Spine1':'Spine','Spine2':'Spine1',
           'Neck':'Spine2','Head':'Neck'}
for side, prefix in [('Left','l-'),('Right','r-')]:
    for name, joint, parent in [('Shoulder','clavicle','Spine2'),('Arm','shoulder',side+'Shoulder'),
                               ('ForeArm','elbow',side+'Arm'),('Hand','hand',side+'ForeArm'),
                               ('UpLeg','upper-leg','Hips'),('Leg','knee',side+'UpLeg'),('Foot','ankle',side+'Leg')]:
        JOINTS[side+name]=prefix+joint
        PARENTS[side+name]=parent

def normals(p, faces):
    n=np.zeros_like(p)
    face_normals=np.cross(p[faces[:,1]]-p[faces[:,0]],p[faces[:,2]]-p[faces[:,0]])
    for k in range(3): np.add.at(n,faces[:,k],face_normals)
    return n/np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-12)

def export(sex):
    p=np.array(DATA[sex],dtype=np.float32).reshape(-1,3)
    faces=np.array(DATA['triangles'],dtype=np.uint32).reshape(-1,3)
    J=DATA['joints'][sex]; names=DATA['weightBones']
    g={'asset':{'version':'2.0','generator':'Accra We Dey character asset builder'},
       'scene':0,'scenes':[{'nodes':[0,1]}],'nodes':[], 'meshes':[], 'skins':[],
       'bufferViews':[],'accessors':[], 'materials':[
         {'name':'Skin','pbrMetallicRoughness':{'baseColorFactor':[.42,.23,.13,1],'metallicFactor':0,'roughnessFactor':.72}},
         {'name':'Shirt','pbrMetallicRoughness':{'baseColorFactor':[.88,.89,.84,1],'metallicFactor':0,'roughnessFactor':.85}},
         {'name':'Trousers','pbrMetallicRoughness':{'baseColorFactor':[.055,.09,.15,1],'metallicFactor':0,'roughnessFactor':.85}}]}
    blob=bytearray()
    def accessor(values,kind,dtype,component,target=None,bounds=False):
        a=np.asarray(values,dtype=dtype)
        while len(blob)%4: blob.append(0)
        view={'buffer':0,'byteOffset':len(blob),'byteLength':a.nbytes}
        if target: view['target']=target
        g['bufferViews'].append(view);blob.extend(a.tobytes())
        item={'bufferView':len(g['bufferViews'])-1,'componentType':component,'count':len(a),'type':kind}
        if bounds: item.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
        g['accessors'].append(item);return len(g['accessors'])-1

    def sparse_target(delta):
        selected=np.flatnonzero(np.max(np.abs(delta),axis=1)>1e-5)
        a={'componentType':5126,'count':len(delta),'type':'VEC3',
           'min':delta.min(axis=0).tolist(),'max':delta.max(axis=0).tolist()}
        if len(selected):
            refs=[]
            for values,dtype in [(selected,'<u2'),(delta[selected],'<f4')]:
                while len(blob)%4:blob.append(0)
                values=np.asarray(values,dtype=dtype)
                g['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':values.nbytes})
                refs.append(len(g['bufferViews'])-1);blob.extend(values.tobytes())
            a['sparse']={'count':len(selected),'indices':{'bufferView':refs[0],'componentType':5123},
                         'values':{'bufferView':refs[1]}}
        g['accessors'].append(a);return len(g['accessors'])-1

    unit=1.76/float(np.ptp(p[:,1]));ground=float(p[:,1].min())
    root={'name':'Accra Adult '+sex.title(),'scale':[unit]*3,'translation':[0,-ground*unit,0],
          'children':[], 'extras':{'source':'MakeHuman Community CC0 derivative',
             'sourceJoints':J,'rawScale':unit,'rawGround':ground,'anatomyVersion':2}}
    g['nodes'].append(root)
    g['nodes'].append({'name':'HumanSurface','mesh':0,'skin':0})
    bone_nodes={name:i+2 for i,name in enumerate(names)}
    for name in names:
        position=np.array(J[JOINTS[name]])
        parent=PARENTS[name]
        local=position-np.array(J[JOINTS[parent]]) if parent else position
        node={'name':name,'translation':local.tolist()}
        children=[bone_nodes[k] for k in names if PARENTS[k]==name]
        if children:node['children']=children
        g['nodes'].append(node)
    root['children'].append(bone_nodes['Hips'])
    inverse=[]
    for name in names:
        m=np.eye(4,dtype=np.float32);m[:3,3]=-np.array(J[JOINTS[name]])
        inverse.append(m.T.reshape(-1))
    g['skins'].append({'name':'HumanRig','joints':[bone_nodes[n] for n in names],
                       'skeleton':bone_nodes['Hips'],'inverseBindMatrices':accessor(inverse,'MAT4','<f4',5126)})
    uv=np.column_stack(((1.75-np.arctan2(p[:,0],p[:,2]-J['pelvis'][2])/(2*np.pi))%1,
                        (p[:,1]-J['pelvis'][1])/(J['neck'][1]-J['pelvis'][1])))
    weights=np.array(DATA['skinWeights'],dtype=np.float32).reshape(-1,4)
    weights/=weights.sum(axis=1,keepdims=True)
    for row in weights:
        largest=int(row.argmax());row[largest]=np.float32(1-sum(float(row[i]) for i in range(4) if i!=largest))
    attrs={'POSITION':accessor(p,'VEC3','<f4',5126,34962,True),
           'NORMAL':accessor(normals(p,faces),'VEC3','<f4',5126,34962),
           'TEXCOORD_0':accessor(uv,'VEC2','<f4',5126,34962),
           'JOINTS_0':accessor(np.array(DATA['skinIndices']).reshape(-1,4),'VEC4','<u2',5123,34962),
           'WEIGHTS_0':accessor(weights,'VEC4','<f4',5126,34962)}
    y=p[:,1]; arm=np.abs(p[:,0])>abs(J['l-shoulder'][0])*.92
    delta_names=['build','hips','bust','waist','shoulders','muscle','faceWidth','nose','lips']
    targets=[]
    for key in delta_names:
        d=np.zeros_like(p);torso=np.exp(-((y-J['spine-2'][1])/3.2)**2)*(~arm)
        hip=np.exp(-((y-J['pelvis'][1])/1.9)**2)*(~arm)
        if key=='build':d[:,0]=p[:,0]*.15*torso;d[:,2]=(p[:,2]-J['pelvis'][2])*.14*torso
        elif key=='hips':d[:,0]=p[:,0]*.14*hip;d[:,2]=(p[:,2]-J['pelvis'][2])*.10*hip
        elif key=='waist':d[:,0]=p[:,0]*.125*np.exp(-((y-J['spine-4'][1])/1.4)**2)*(~arm)
        elif key=='bust' and sex=='female':
            chest=np.exp(-((y-(J['spine-1'][1]-.25))/1.0)**2)
            d[:,2]=.9*chest*(np.exp(-((p[:,0]-.7)/.55)**2)+np.exp(-((p[:,0]+.7)/.55)**2))*(p[:,2]>J['pelvis'][2])*(~arm)
        elif key=='shoulders':d[:,0]=p[:,0]*.09*np.exp(-((y-J['l-shoulder'][1])/1.2)**2)
        elif key=='muscle':d[:,2]=np.sign(p[:,2]-J['pelvis'][2])*.14*torso;d[:,0]=np.sign(p[:,0])*.12*arm*np.exp(-((y-J['l-elbow'][1])/1.8)**2)
        elif key=='faceWidth':d[:,0]=p[:,0]*.125*(y>J['head'][1]-.15)
        elif key=='nose':d[:,2]=.06*np.exp(-(p[:,0]/.20)**2)*np.exp(-((y-(J['l-eye'][1]-.30))/.35)**2)*(p[:,2]>J['head'][2]+.6)
        elif key=='lips':d[:,2]=.045*np.exp(-(p[:,0]/.36)**2)*np.exp(-((y-(J['l-eye'][1]-.8))/.16)**2)*(p[:,2]>J['head'][2]+.6)
        targets.append({'POSITION':sparse_target(d)})
    # Simple editor-preview clothes; the game fits its full wardrobe to this surface.
    centre=p[faces].mean(axis=1)
    region=np.where(centre[:,1]<J['pelvis'][1]+.15,2,
                    np.where((centre[:,1]<J['neck'][1])&(np.abs(centre[:,0])<abs(J['l-shoulder'][0])*1.45),1,0))
    primitives=[{'attributes':attrs,'indices':accessor(faces[region==i].reshape(-1),'SCALAR','<u4',5125,34963),
                 'material':i,'targets':targets} for i in range(3)]
    g['meshes'].append({'name':'Adult '+sex.title()+' Anatomy','primitives':primitives,
                        'weights':[0]*len(targets),'extras':{'targetNames':delta_names}})
    g['buffers']=[{'byteLength':len(blob)}]
    js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    blob.extend(b'\0'*((-len(blob))%4))
    output=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(blob))
    output+=struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(blob),0x004e4942)+blob
    path=DEST/f'accra-{sex}.glb';path.write_bytes(output)
    print(path.name,len(p),'vertices',len(faces),'triangles',len(output),'bytes',flush=True)

if __name__=='__main__':
    for sex in ['male','female']:export(sex)
