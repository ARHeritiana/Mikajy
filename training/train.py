import numpy as np, math, json, base64
from PIL import Image, ImageDraw
from sklearn.datasets import load_digits
from sklearn.neural_network import MLPClassifier
R=np.random.default_rng(1)
CL=list('0123456789')+['+','-','*','/','(',')','=']
def arc(cx,cy,rx,ry,a0,a1,n=14):
    return [(cx+rx*math.cos(math.radians(a)),cy+ry*math.sin(math.radians(a))) for a in np.linspace(a0,a1,n)]
def six(): return [[(.8,0),(.4,.15),(.12,.55)]+arc(.5,.7,.4,.3,180,-180,22)]
def T(c):
    ch=lambda L:L[R.integers(len(L))]
    if c=='0':
        s=R.uniform(-120,-60);d=R.choice([1,-1]);return [arc(.5,.5,.5,.5,s,s+d*R.uniform(340,380),26)]
    if c=='1': return ch([[[(.5,0),(.5,1)]],[[(.2,.25),(.5,0),(.5,1)]],[[(.2,.25),(.5,0),(.5,1)],[(.15,1),(.85,1)]],[[(.4,0),(.55,1)]]])
    if c=='2': return ch([[arc(.5,.3,.45,.3,-170,25,14)+[(.05,1),(.95,1)]],[[(.1,.2),(.5,0),(.9,.2),(.1,1),(.95,1)]]])
    if c=='3': return ch([[arc(.45,.27,.4,.27,-150,90,12)+arc(.45,.73,.45,.27,-90,150,12)],[[(.1,0),(.9,0),(.4,.45)]+arc(.45,.72,.45,.28,-90,150,14)]])
    if c=='4': return ch([[[(.7,0),(0,.65),(1,.65)],[(.7,0),(.7,1)]],[[(.2,0),(.1,.6),(.9,.6)],[(.7,.2),(.7,1)]]])
    if c=='5': return ch([[[(.9,0),(.15,0),(.1,.45)]+arc(.45,.68,.45,.32,-120,150,16)],[[(.12,0),(.1,.45)]+arc(.45,.68,.45,.32,-120,150,16),[(.12,0),(.9,0)]]])
    if c=='6': return ch([six(),[[(.7,0),(.2,.5),(.15,.75)]+arc(.5,.72,.35,.28,180,-180,22)],[[(.6,.05),(.15,.6)]+arc(.5,.72,.38,.28,170,-190,22)]])
    if c=='7': return ch([[[(.05,0),(.95,0),(.4,1)]],[[(.05,0),(.95,0),(.4,1)],[(.3,.5),(.75,.5)]]])
    if c=='8': return ch([[arc(.5,.27,.3,.27,60,-270,18)+arc(.5,.73,.4,.27,-90,270,20)],[arc(.5,.26,.3,.26,-90,270,18),arc(.5,.74,.4,.26,-90,270,20)]])
    if c=='9': return ch([[[(1-x,1-y) for x,y in s] for s in six()][0:1],[arc(.5,.3,.42,.3,30,-330,22),[(.92,.3),(.85,1)]]])
    if c=='+': return ch([[[(.5,.05),(.5,.95)],[(.05,.5),(.95,.5)]],[[(.55,0),(.45,1)],[(0,.55),(1,.45)]]])
    if c=='-': return [[(0,.5),(1,.5)]]
    if c=='*': return ch([[[(0,0),(1,1)],[(1,0),(0,1)]],[arc(0,.5,1.0,.5,-60,60,10),arc(1,.5,1.0,.5,120,240,10)],[[(.5,0),(.5,1)],[(0,.25),(1,.75)],[(0,.75),(1,.25)]]])
    if c=='/': return ch([[[(.85,0),(.15,1)]],[[(0,.5),(1,.5)],[(.5,0),(.5,.05)],[(.5,.95),(.5,1)]]])
    if c=='(':
        k=R.uniform(.6,1.6);return [arc(1+.1*k,.5,k,.5,180-R.uniform(25,45),180+R.uniform(25,45),12)]
    if c==')':
        k=R.uniform(.6,1.6);return [arc(-.1*k,.5,k,.5,-R.uniform(25,45),R.uniform(25,45),12)]
    if c=='=': return [[(0,.3),(R.uniform(.8,1),.3)],[(R.uniform(0,.2),.7),(1,.7)]]
def dens(s,step=.06):
    o=[]
    for (x0,y0),(x1,y1) in zip(s[:-1],s[1:]):
        n=max(1,int(math.hypot(x1-x0,y1-y0)/step))
        o+=[(x0+(x1-x0)*k/n,y0+(y1-y0)*k/n) for k in range(n)]
    return o+[s[-1]]
def render(c):
    st=[list(s) for s in T(c)]; R.shuffle(st)
    st=[s[::-1] if R.random()<.3 else s for s in st]
    sx=R.uniform(.45,.95);sy=R.uniform(.9,1.1)
    if c=='1':sx=R.uniform(.5,1.1)
    if c in '()':sx=R.uniform(.9,1.8)
    if c in '+*/':sx=R.uniform(.7,1.15)
    if c=='=':sx=R.uniform(.8,1.3);sy=R.uniform(.8,1.3)
    if c=='-':sx=1;sy=1
    th=R.normal(0,.12);sh=R.normal(0,.12)
    A=np.array([[math.cos(th),-math.sin(th)],[math.sin(th),math.cos(th)]])@np.array([[sx,sh],[0,sy]])
    pts=[np.array(dens(s)) for s in st]
    def wob(p):
        n=R.normal(0,R.uniform(.01,.045),p.shape);n=np.apply_along_axis(lambda v:np.convolve(np.pad(v,3,mode='edge'),np.ones(7)/7,'valid'),0,n)*2
        if len(p)>8 and R.random()<.5:
            a=int(len(p)*R.uniform(0,.08));b=len(p)-int(len(p)*R.uniform(0,.08));p=p[a:b]; n=n[a:b]
        return p+n
    pts=[wob(p) for p in pts]
    pts=[((p-.5)@A.T+.5)+R.normal(0,.018,p.shape) for p in pts]
    a=np.vstack(pts);mn=a.min(0);mx=a.max(0);s=80/max((mx-mn).max(),1e-3);ct=(mn+mx)/2
    im=Image.new('L',(112,112),0);d=ImageDraw.Draw(im);lw=R.uniform(1.6,2.8)*4
    for p in pts:
        q=[((x-ct[0])*s+56,(y-ct[1])*s+56) for x,y in p]
        if len(q)>1:d.line(q,fill=255,width=int(lw),joint='curve')
        for x,y in (q[0],q[-1]):d.ellipse([x-lw/2,y-lw/2,x+lw/2,y+lw/2],fill=255)
    return np.asarray(im,dtype=np.float32).reshape(28,4,28,4).mean((1,3)).ravel()/255
D=load_digits();idx=R.permutation(len(D.target));tr,va=idx[:1437],idx[1437:]
def real(i):
    im=Image.fromarray((255*(D.images[i]/16)**R.uniform(1.4,2.5)).astype(np.uint8)).resize((20,20),Image.BICUBIC)
    im=im.rotate(R.normal(0,7),resample=Image.BICUBIC);w=int(R.uniform(13,20));im=im.resize((w,20))
    c=Image.new('L',(28,28));c.paste(im,(4+(20-w)//2,4));return np.asarray(c,dtype=np.float32).ravel()/255
from multiprocessing import Pool
def gen(a):
    global R
    k,seed=a;R=np.random.default_rng(seed);return [render(CL[k]) for _ in range(900)]
X=[];Y=[]
with Pool() as P:
    for k,res in zip([k for k in range(len(CL)) for _ in range(8)],P.map(gen,[(k,1000+k*10+j) for k in range(len(CL)) for j in range(8)])):
        X+=res;Y+=[k]*len(res)
for i in tr:
    for _ in range(14):X.append(real(i));Y.append(int(D.target[i]))
X=np.array(X);Y=np.array(Y);print('data',X.shape,flush=True)
m=MLPClassifier((384,192),batch_size=256,max_iter=28,learning_rate_init=2e-3,random_state=0).fit(X,Y)
Xr=np.array([real(i) for i in va]);print('real-digit val acc',(m.predict(Xr)==D.target[va]).mean(),flush=True)
Xs=[];Ys=[]
for k,c in enumerate(CL):
    for _ in range(60):Xs.append(render(c));Ys.append(k)
print('synthetic val acc',(m.predict(np.array(Xs))==np.array(Ys)).mean(),flush=True)
b=lambda a:base64.b64encode(a.astype('<f4').tobytes()).decode()
json.dump({'cls':CL,'layers':[{'i':w.shape[0],'o':w.shape[1],'w':b(w),'b':b(bi)} for w,bi in zip(m.coefs_,m.intercepts_)]},open('model.json','w'))
print('done',flush=True)
