import numpy as np, pickle, gzip, json, base64, time, sys, glob, os, math, cv2
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from skimage.morphology import skeletonize
src=open('train.py').read().split("D=load_digits()")[0].replace("if c=='-':sx=1;sy=1","if c=='-':sx=1;sy=1\n    if c in 'acegilnosthbdm':sx=R.uniform(.7,1.35)\n    if c=='∫':sx=R.uniform(.35,.8)\n    if c in '→∞':sx=R.uniform(1,1.6)\n    if c=='Σ':sx=R.uniform(.6,1.1)").replace("R.uniform(1.6,2.8)*4","R.uniform(2.2,3.6)*4")
exec(src)
T0=T
def T(c):
    ch=lambda L:L[R.integers(len(L))]
    if c=='π':
        return ch([[[(0,.12),(1.6,.06)],[(.5,.1),(.42,1)],[(1.1,.08),(1.15,.85),(1.4,.95)]],
                   [[(0,.2),(.3,.06),(1.6,.12)],[(.55,.1),(.5,1)],[(1.15,.1),(1.2,1)]],
                   [[(0,.1),(1.6,.1)],[(.45,.1),(.4,1)],[(1.15,.1),(1.1,.7),(1.3,1),(1.55,.9)]]])
    if c=='√':
        t=R.uniform(.25,.6);return ch([[[(0,.5),(.12*t*3,.45),(.35+.1*t,1),(1.3,0)]],[[(0,.55),(.3,.5),(.5,1),(1.3,.05)]],[[(0,.45),(.15,.4),(.4,1),(1.3,.1)]]])
    if c=='!':
        k=R.uniform(-.1,.1);return ch([[[(.35+k,0),(.3,.72)],[(.3,.93),(.3,.98)]],[[(.4,0),(.4,.7)],[(.4,.9),(.4,.95)]]])
    if c=='%':
        s=1.4;return [[(x*s,y) for x,y in st] for st in ch([[arc(.2,.2,.17,.17,0,360,14),[(.85,.05),(.15,.95)],arc(.8,.8,.17,.17,0,360,14)],[arc(.2,.22,.16,.16,-90,270,14),[(.8,0),(.2,1)],arc(.8,.78,.16,.16,-90,270,14)]])]
    if c in 'acegilnosthbdm':
        A=arc
        V={'l':[[[(.5,0),(.5,1)]],[[(.55,0),(.48,.5),(.42,1)]],[[(.35,.15),(.55,0),(.5,1)]]],
        'i':[[[(.5,.3),(.5,1)],[(.5,0),(.5,.03)]],[[(.5,.3),(.45,1)],[(.55,.02),(.56,.05)]],[[(.5,.28),(.5,.85),(.65,1)],[(.5,0),(.5,.03)]]],
        'n':[[[(.1,.2),(.1,1),(.1,.5)]+A(.5,.55,.4,.3,180,360,14)+[(.9,1)]],[[(.1,.2),(.1,1)],[(.1,.5)]+A(.5,.55,.4,.3,180,360,14)+[(.9,1)]],[[(.1,.3),(.1,1)],[(.12,.45),(.4,.3),(.75,.4),(.85,1)]]],
        'm':[[[(.05,.2),(.05,1),(.05,.5)]+A(.28,.55,.23,.3,180,360,10)+[(.51,1),(.51,.5)]+A(.75,.55,.23,.3,180,360,10)+[(.98,1)]],[[(.05,.2),(.05,1)],[(.05,.5),(.25,.3),(.5,.5),(.5,1)],[(.5,.5),(.75,.3),(.98,.5),(.98,1)]]],
        's':[[[(.85,.12),(.6,0),(.3,.08),(.15,.25),(.3,.45),(.7,.55),(.88,.75),(.7,.95),(.4,1),(.12,.88)]],[[(.8,.15),(.5,0),(.2,.2),(.5,.5),(.85,.8),(.5,1),(.15,.85)]],[[(.9,.1),(.1,.35),(.9,.65),(.1,.95)]]],
        'c':[A(.55,.5,.45,.5,-40,-320,16),[(.85,.15),(.5,0),(.15,.3),(.15,.7),(.5,1),(.9,.85)]],
        'o':[A(.5,.5,.5,.5,-90+R.uniform(-50,50),270+R.uniform(-40,40),22),[A(.5,.5,.5,.5,-60,300,20)][0]],
        'a':[A(.45,.55,.4,.45,-40,-400,22)+[(.85,.2),(.85,1)],[A(.45,.55,.4,.45,-40,-400,22),[(.85,.15),(.85,1)]],[[(.85,.2),(.5,.1),(.15,.5),(.4,1),(.85,.8),(.85,.2),(.9,1)]]],
        'e':[[(.1,.5),(.9,.5),(.8,.2),(.5,0),(.2,.2),(.1,.6),(.3,.95),(.6,1),(.9,.85)],[(.15,.55),(.85,.45),(.85,.2),(.5,0),(.15,.25),(.15,.75),(.5,1),(.9,.85)]],
        't':[[[(.5,0),(.5,1)],[(.15,.35),(.85,.35)]],[[(.5,0),(.5,.85),(.7,1),(.9,.9)],[(.2,.3),(.85,.3)]],[[(.45,0),(.55,1)],[(.1,.4),(.9,.3)]]],
        'h':[[[(.15,0),(.15,1)],[(.15,.55)]+A(.5,.65,.35,.25,180,360,12)+[(.85,1)]],[[(.15,0),(.15,1),(.15,.55)]+A(.5,.65,.35,.25,180,360,12)+[(.85,1)]]],
        'b':[[[(.15,0),(.15,1)],[(.15,.45),(.5,.35),(.85,.6),(.5,.98),(.15,.85)]],[[(.15,0),(.15,1),(.15,.5),(.5,.38),(.85,.65),(.5,1),(.15,.9)]]],
        'd':[[[(.85,0),(.85,1)],[(.85,.45),(.5,.35),(.15,.6),(.5,.98),(.85,.85)]],[[(.85,.45),(.5,.35),(.15,.6),(.5,.98),(.85,.85)],[(.85,0),(.85,1)]],[[(.85,.5),(.45,.38),(.12,.65),(.5,1),(.85,.85),(.85,0)]]],
        'g':[[A(.45,.4,.35,.35,-40,-400,20),[(.8,.1),(.8,.9),(.5,1.1),(.2,.95)]],[[(.8,.15),(.45,.05),(.15,.4),(.5,.75),(.8,.5),(.8,1),(.5,1.2),(.2,1)]]]}
        r=ch(V[c]);return [r] if isinstance(r[0],tuple) else r
    if c=='∫_old':
        k=R.uniform(-.12,.12);return ch([[[(.85+k,.12),(.7+k,0),(.58+k,.12),(.5,.5),(.42-k,.88),(.3-k,1),(.15-k,.88)]],[[(.8,.1),(.65,0),(.55,.1)]+[(.5+.05*k,.5),(.45,.9)]+[(.35,1),(.2,.9)]],[[(.7+k,0),(.3-k,1)],[(.85,.12),(.7,0)],[(.3,1),(.15,.88)]]])
    if c=='∫':
        k=R.uniform(-.3,.3);return ch([[[(.85+k,.12),(.7+k,0),(.58+k,.12),(.5,.5),(.42-k,.88),(.3-k,1),(.15-k,.88)]],[[(.8+k,0),(.55,.1),(.5,.5),(.45,.9),(.3-k,1),(.2,.9)]],[[(.7+k,0),(.3-k,1)],[(.85,.12),(.7,0)],[(.3,1),(.15,.88)]],[[(.9,.05),(.6+k,0),(.55,.4),(.4,1),(.1,.9)]],[[(.6+k,0),(.4-k,1)]]])
    if c=='Σ':
        return ch([[[(.95,0),(0,0),(.55,.5),(0,1),(.95,1)]],[[(1,.05),(.05,0),(.55,.5)],[(.55,.5),(.05,1),(1,1)]],[[(.95,.1),(.9,0),(0,0),(.55,.5),(0,1),(.9,1),(.95,.9)]]])
    if c=='→':
        return ch([[[(0,.5),(1,.5)],[(.7,.2),(1,.5),(.7,.8)]],[[(0,.5),(1,.5),(.7,.2)],[(1,.5),(.7,.8)]],[[(0,.5),(1,.5)],[(.65,.15),(1,.5)],[(1,.5),(.65,.85)]]])
    if c=='∞':
        t=np.linspace(0,2*math.pi,36);L=[(.5+.5*math.cos(a)/(1+math.sin(a)**2),.5+.55*math.sin(a)*math.cos(a)/(1+math.sin(a)**2)) for a in t]
        return ch([[L],[arc(.25,.5,.25,.3,0,360,16),arc(.75,.5,.25,.3,180,540,16)],[arc(.25,.5,.25,.3,-40,320,16)+arc(.75,.5,.25,.3,140,500,16)]])
    return T0(c)
CL=list('0123456789')+['+','-','*','/','(',')','=']+list('acegilnost')+['π','√','!']+['h','b','%']+['d','m','∫','Σ','→','∞']
NC=len(CL);print('classes',NC,flush=True)
HELD=['Kalam-Regular','Handlee-Regular','Mali-Regular','ReenieBeanie']
fonts=[f for f in glob.glob('/tmp/fonts/*.ttf')]+['/tmp/caveat.ttf']
CH={'+':['+'],'-':['-'],'*':['×','x'],'/':['/','÷'],'(':['('],')':[')'],'=':['='],'π':['π'],'!':['!']}
for d in '0123456789':CH[d]=[d]
for l in 'acegilnosthbdm':CH[l]=[l,l.upper()]
CH['%']=['%']
SK={}
def skel(fp,ch):
    k=(fp,ch)
    if k in SK:return SK[k]
    try:
        if ord(ch) not in TTFont(fp,lazy=True).getBestCmap():SK[k]=None;return None
        if fp.endswith('caveat.ttf'):SK[k]=None;return None
        f=ImageFont.truetype(fp,200);im=Image.new('L',(500,500),0);ImageDraw.Draw(im).text((100,120),ch,font=f,fill=255)
        a=np.asarray(im)>127;ys,xs=np.where(a)
        if len(ys)<20:SK[k]=None;return None
        a=a[ys.min():ys.max()+1,xs.min():xs.max()+1];s=skeletonize(a).astype(np.uint8)*255
        s=np.pad(s,12);SK[k]=s;return s
    except Exception as e:SK[k]=None;return None
def fsample(sk):
    h,w=sk.shape;S=int(max(h,w)*1.6);cv=np.zeros((S,S),np.uint8);y0=(S-h)//2;x0=(S-w)//2;cv[y0:y0+h,x0:x0+w]=cv2.dilate(sk,np.ones((3,3),np.uint8))
    th=R.normal(0,.1);sh=R.normal(0,.15);sx=R.uniform(.7,1.25);c,s_=math.cos(th),math.sin(th)
    A=np.array([[sx*c,-s_+sh,0],[sx*s_,c,0]],np.float32);cen=np.array([S/2,S/2]);A[:,2]=cen-A[:,:2]@cen
    m=cv2.warpAffine(cv,A,(S,S),flags=cv2.INTER_LINEAR)
    n=lambda:cv2.GaussianBlur(R.normal(0,1,(S,S)).astype(np.float32),(0,0),S*.08)
    dx,dy=n(),n();dx=dx/dx.std()*S*R.uniform(.008,.03);dy=dy/dy.std()*S*R.uniform(.008,.03)
    gx,gy=np.meshgrid(np.arange(S,dtype=np.float32),np.arange(S,dtype=np.float32))
    m=cv2.remap(m,gx+dx,gy+dy,cv2.INTER_LINEAR)>50;ys,xs=np.where(m)
    if len(ys)<5:return None
    m=m[ys.min():ys.max()+1,xs.min():xs.max()+1].astype(np.uint8)*255;h2,w2=m.shape;k=80/max(h2,w2)
    m=cv2.resize(m,(max(1,round(w2*k)),max(1,round(h2*k))),interpolation=cv2.INTER_AREA)>25;h3,w3=m.shape
    img=np.zeros((112,112),np.uint8);y=(112-h3)//2;x=(112-w3)//2;img[y:y+h3,x:x+w3]=m.astype(np.uint8)*255
    lw=int(R.uniform(2.2,3.6)*4)|1;img=cv2.dilate(img,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(lw,lw)))
    return cv2.resize(img,(28,28),interpolation=cv2.INTER_AREA).astype(np.float32).ravel()/255
def fgen(k,n,pool,seed):
    global R;R=np.random.default_rng(seed);c=CL[k];out=[]
    if c not in CH:return out
    tries=0
    while len(out)<n and tries<n*3:
        tries+=1;fp=pool[R.integers(len(pool))];sk=skel(fp,CH[c][R.integers(len(CH[c]))])
        if sk is None:continue
        v=fsample(sk)
        if v is not None:out.append(v)
    return out
def sgen(k,n,seed):
    global R;R=np.random.default_rng(seed);return [render(CL[k]) for _ in range(n)]
def norm(v):
    a=v.reshape(28,28);ys,xs=np.where(a>.25)
    if len(ys)==0:return np.zeros(784,np.float32)
    c=a[ys.min():ys.max()+1,xs.min():xs.max()+1];h,w=c.shape;s=20/max(h,w);nh,nw=max(1,round(h*s)),max(1,round(w*s))
    im=Image.fromarray((c*255).astype(np.uint8)).resize((nw,nh),Image.BILINEAR)
    o=np.zeros((28,28),np.float32);y0=(28-nh)//2;x0=(28-nw)//2;o[y0:y0+nh,x0:x0+nw]=np.asarray(im)/255;return o.ravel()
tr,va,te=pickle.load(gzip.open('/tmp/mnist.pkl.gz','rb'),encoding='latin1')
Xm=np.array([norm(v) for v in np.vstack([tr[0],va[0]])[:42000]]);Ym=np.concatenate([tr[1],va[1]])[:42000]
Xt=np.array([norm(v) for v in te[0]]);Yt=te[1]
trainf=[f for f in fonts if os.path.basename(f)[:-4] not in HELD];heldf=[f for f in fonts if os.path.basename(f)[:-4] in HELD]
print('fonts',len(trainf),len(heldf),flush=True)
X=[Xm];Y=[Ym];t0=time.time()
for k,c in enumerate(CL):
    ns=1200 if k<10 else 2500;nf=1500 if k<10 else (3500 if c in 'acegilnosthbdm' else 2500)
    if c in 'acegilnosthbdm':ns=3000
    if c=='√':ns,nf=7000,0
    if c in '∫Σ→∞':ns,nf=4500,0
    if c=='π':ns=3500;nf=2500
    if c=='!':ns=2500;nf=2500
    cf='cache/%d.npy'%k
    if os.path.exists(cf):
        Z=np.load(cf);X.append(Z);Y.append(np.full(len(Z),k));print(c,'cached',len(Z),flush=True);continue
    a=sgen(k,ns,500+k) if ns else [];b=fgen(k,nf,trainf,700+k) if nf else []
    Z=np.array(a+b,np.float32);np.save(cf,Z)
    if len(Z):X.append(Z);Y.append(np.full(len(Z),k))
    print(c,len(a),len(b),int(time.time()-t0),'s',flush=True)
# Optional REAL online handwriting (Google MathWriting symbols, converted to Spark's exact raster format).
# Keep these datasets and any derived model weights local until the CC BY-NC-SA license is reviewed.
MW_XV=MW_YV=None
if os.environ.get('MIKAJY_MATHWRITING_TRAIN_NPZ'):
    if not os.environ.get('MIKAJY_MATHWRITING_VALID_NPZ'):
        raise RuntimeError('Set MIKAJY_MATHWRITING_VALID_NPZ for held-out validation')
    def read_ink_npz(path):
        with np.load(path) as data:
            arr=np.asarray(data['X'], dtype=np.float32)
            labels=[str(x) for x in data['labels']]
        if arr.ndim != 2 or arr.shape[1] != 784 or len(arr) != len(labels):
            raise ValueError('Expected (N,784) features and N labels in '+path)
        good=[i for i, label in enumerate(labels) if label in CL]
        if not good:
            raise ValueError('No supported glyph labels in '+path)
        return arr[good], np.asarray([CL.index(labels[i]) for i in good], dtype=np.int64)
    mwx,mwy=read_ink_npz(os.environ['MIKAJY_MATHWRITING_TRAIN_NPZ'])
    MW_XV,MW_YV=read_ink_npz(os.environ['MIKAJY_MATHWRITING_VALID_NPZ'])
    X.append(mwx);Y.append(mwy)
    print('MathWriting: train',len(mwx),'held-out',len(MW_XV),flush=True)
X=np.concatenate(X).astype(np.float32);Y=np.concatenate(Y).astype(np.int64);print('data',X.shape,flush=True)
Xs=[];Ys=[];Xh=[];Yh=[]
for k in range(NC):
    if True:Xs+=sgen(k,50,9000+k);Ys+=[k]*50
    h=fgen(k,60,heldf,9500+k);Xh+=h;Yh+=[k]*len(h)
Xs=np.array(Xs,np.float32);Ys=np.array(Ys);Xh=np.array(Xh,np.float32);Yh=np.array(Yh)
import jax,jax.numpy as jnp,optax
C1,C2,FC=24,48,192
def init(k):
    k1,k2,k3,k4=jax.random.split(k,4);he=lambda k,s,f:jax.random.normal(k,s)*np.sqrt(2/f)
    return dict(w1=he(k1,(3,3,1,C1),9),b1=jnp.zeros(C1),w2=he(k2,(3,3,C1,C2),9*C1),b2=jnp.zeros(C2),w3=he(k3,(49*C2,FC),49*C2),b3=jnp.zeros(FC),w4=he(k4,(FC,NC),FC),b4=jnp.zeros(NC))
conv=lambda x,w,b:jax.nn.relu(jax.lax.conv_general_dilated(x,w,(1,1),'SAME',dimension_numbers=('NHWC','HWIO','NHWC'))+b)
pool=lambda x:jax.lax.reduce_window(x,-jnp.inf,jax.lax.max,(1,2,2,1),(1,2,2,1),'VALID')
def net(p,x,key=None):
    h=pool(conv(x,p['w1'],p['b1']));h=pool(conv(h,p['w2'],p['b2']));h=h.reshape(h.shape[0],-1)
    h=jax.nn.relu(h@p['w3']+p['b3'])
    if key is not None:h=h*jax.random.bernoulli(key,.7,h.shape)/.7
    return h@p['w4']+p['b4']
def loss(p,x,y,key):return optax.softmax_cross_entropy(net(p,x,key),jax.nn.one_hot(y,NC)*.95+.05/NC).mean()
EP=int(sys.argv[1]);B=256;steps=EP*(len(X)//B);opt=optax.adam(optax.cosine_decay_schedule(2e-3,steps))
P=init(jax.random.PRNGKey(0));S=opt.init(P)
@jax.jit
def step(P,S,x,y,key):
    g=jax.grad(loss)(P,x,y,key);u,S=opt.update(g,S);return optax.apply_updates(P,u),S
acc=jax.jit(lambda P,x:net(P,x).argmax(1))
def ev(Xv,Yv):return float(np.mean(np.concatenate([np.asarray(acc(P,Xv[i:i+1000].reshape(-1,28,28,1))) for i in range(0,len(Xv),1000)])==Yv))
b64=lambda a:base64.b64encode(np.asarray(a,dtype='<f4').tobytes()).decode()
def save():json.dump({'cls':CL,**{k:b64(v) for k,v in P.items()}},open('model4.json','w'))
key=jax.random.PRNGKey(1);t0=time.time();E0=0
if os.path.exists('ckpt4.pkl'):
    P,S,E0=pickle.load(open('ckpt4.pkl','rb'));P=jax.tree_util.tree_map(jnp.asarray,P);S=jax.tree_util.tree_map(jnp.asarray,S);E0+=1;print('resume from epoch',E0,flush=True)
for e in range(E0,EP):
    perm=np.random.permutation(len(X))
    for i in range(len(X)//B):
        j=perm[i*B:(i+1)*B];xb=X[j].reshape(B,28,28)
        xb=np.roll(xb,(np.random.randint(-1,2),np.random.randint(-1,2)),(1,2))
        key,k=jax.random.split(key);P,S=step(P,S,jnp.asarray(xb[...,None]),jnp.asarray(Y[j]),k)
    print(e,'mnist',ev(Xt,Yt),'synthetic',ev(Xs,Ys),'heldout-fonts',ev(Xh,Yh), 'mathwriting-valid', (ev(MW_XV,MW_YV) if MW_XV is not None else 'not provided'), int(time.time()-t0),'s',flush=True);save();pickle.dump((jax.tree_util.tree_map(np.asarray,P),jax.tree_util.tree_map(np.asarray,S),e),open('ckpt4.pkl','wb'))
print('done',flush=True)
