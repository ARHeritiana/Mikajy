import asyncio
from playwright.async_api import async_playwright
JS="""([specs,set])=>{Object.assign(SET,set);
 const mk=(spec)=>{const o=[];let sup=false;for(const c of spec){if(c=='{'){sup=true;continue}if(c=='}'){sup=false;continue}o.push({c:[{c,p:1}],i:0,sup,b:null,w:0,tx:0})}return{syms:o,ans:[]}};
 return specs.map(s=>{const r=computeAns(mk(s));return r?r.text:null})}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/Mikajy-source/android/assets/index.html');await pg.wait_for_timeout(400)
        async def run(title,specs,**set):
            s=dict(mode='instant',angle='rad',fmt='dec');s.update(set)
            r=await pg.evaluate(JS,[specs,s]);print(title.ljust(10),[f'{a} -> {b}' for a,b in zip(specs,r)])
        await run('equations',['2*+3=7','*{2}=9','2*+1=*+5','3*=12','*{2}+1=0','2*-3=2*+1','5*3','2*3+1'])
        await run('rad',['sin(30)','asin(1)','sin{-1}(1)','cos(60°)','sinh(0)','cosh(1)','abs(-5)','50+10%','200*15%','20%','50-10%'])
        await run('deg',['sin(30)','asin(.5)','cos(60°)','tan(45)'],angle='deg')
        await run('fraction',['3/4','1.75','.5','7','0.333333333','π','-2.5','0.1+0.2'],fmt='frac')
        await run('mixed',['7/4','-7/4','1.75','2.5','1/3'],fmt='mixed')
        await run('demand',['2+3','2+3='],mode='demand')
        print(errs);await b.close()
asyncio.run(main())
