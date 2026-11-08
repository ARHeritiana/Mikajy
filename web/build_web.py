#!/usr/bin/env python3
"""Assemble android/assets/index.html (single self-contained page) from the web/ sources.
   The float16 CNN weights (web/model/model4.f16.json, made by training/pack_model.py) are embedded once,
   inside <script id="cnn" type="text/plain"> (run in a Web Worker); the class list is inlined into the main script.
   The Nerdamer CAS (web/vendor/nerdamer.js, Apache-2.0) is embedded in its own <script> so its UMD wrapper sets window.nerdamer.
   The stroke-sequence model (web/model/seq1.json, made by training/pack_seq.py), when present, goes into <script id="seq" type="text/plain">
   together with web/seq-core.js and runs in its own Worker; without it the page falls back to the classic recogniser."""
import base64, json, os
here = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(here, p), encoding='utf-8').read()
model = rd('model/model4.f16.json')
seq_path = os.path.join(here, 'model/seq1.json')
seq_model = open(seq_path, encoding='utf-8').read() if os.path.exists(seq_path) else None
cls = json.dumps(json.loads(model)['cls'])
font = base64.b64encode(open(os.path.join(here, 'fonts/hand.woff2'), 'rb').read()).decode()
css = """<style>@font-face{font-family:H;src:url(data:font/woff2;base64,__FONT__) format('woff2')}

:root,[data-theme="dark"]{--paper:#0e0e0e;--canvas:#000000;--ink:#f4f4f4;--graphite:#9a9a9a;--rule:#2b2b2b;--blue:#ff2a36;--red:#ff2a36;--menu-ink:rgba(255,255,255,.5);--mem-bg:rgba(0,0,0,.94);--mem-hot:rgba(255,42,54,.2);--chip-border:#4a4a4a;--chip-muted:#8a8a8a;--backdrop:rgba(0,0,0,.62);--panel-shadow:rgba(255,42,54,.16);--active-bg:rgba(255,42,54,.14);--toast-ink:#ffffff;color-scheme:dark}
[data-theme="light"]{--paper:#ffffff;--canvas:#ffffff;--ink:#000000;--graphite:#555555;--rule:#d7d7d7;--blue:#d71920;--red:#d71920;--menu-ink:rgba(0,0,0,.58);--mem-bg:rgba(255,255,255,.96);--mem-hot:rgba(215,25,32,.12);--chip-border:rgba(0,0,0,.22);--chip-muted:rgba(0,0,0,.5);--backdrop:rgba(0,0,0,.24);--panel-shadow:rgba(0,0,0,.16);--active-bg:rgba(215,25,32,.08);--toast-ink:#ffffff;color-scheme:light}
*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
html,body{margin:0;height:100%;background:var(--canvas);overflow:hidden}
canvas{position:fixed;inset:0;width:100%;height:100%;touch-action:none;display:block;background:var(--canvas)}
button{font-family:inherit;cursor:pointer}
#mb{position:fixed;top:calc(4px + env(safe-area-inset-top,0px));right:calc(4px + env(safe-area-inset-right,0px));width:46px;height:46px;border:0;background:none;color:var(--menu-ink);padding:0;display:grid;place-items:center;z-index:5}
#zr{position:fixed;right:calc(8px + env(safe-area-inset-right,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));display:none;z-index:5;padding:6px 12px;border-radius:14px;border:1px solid var(--rule);background:var(--paper);color:var(--menu-ink);font:13px system-ui,sans-serif}
#zr:active{color:var(--ink)}
#mb svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
#mb:active{color:var(--ink)}
#mb.upd::after{content:'';position:absolute;top:9px;right:8px;width:9px;height:9px;border-radius:50%;background:var(--red)}
#mem{position:fixed;left:0;right:0;bottom:0;display:none;gap:8px;align-items:center;padding:8px 12px calc(8px + env(safe-area-inset-bottom,0px));background:var(--mem-bg);border-top:1px solid var(--blue);z-index:4;overflow-x:auto}
#mem.hot{background:var(--mem-hot)}
.chip{padding:6px 14px;border-radius:14px;background:var(--paper);border:1.5px solid var(--chip-border);font:28px/1.1 H,cursive;color:var(--ink);white-space:nowrap;touch-action:none}
.chip b{margin-left:10px;color:var(--chip-muted);font-weight:400;font-size:22px}
#sheet{position:fixed;inset:0;display:none;z-index:10;color:var(--ink)}
#back{position:absolute;inset:0;background:var(--backdrop);opacity:0;transition:opacity .2s}
#panel{position:absolute;left:50%;bottom:0;width:min(560px,100%);max-height:86%;overflow:auto;box-sizing:border-box;background:var(--paper);border-radius:22px 22px 0 0;border-top:2px solid var(--blue);box-shadow:0 -14px 40px var(--panel-shadow);padding:4px 22px calc(18px + env(safe-area-inset-bottom,0px));transform:translate(-50%,28px);opacity:0;transition:transform .22s ease-out,opacity .22s}
#sheet.in #back{opacity:1}#sheet.in #panel{transform:translate(-50%,0);opacity:1}
.head{display:flex;align-items:center;justify-content:space-between;padding:12px 0 6px}
h2{font:600 34px/1 H,cursive;margin:0;color:var(--ink)}
.done{font:25px/1 H,cursive;color:var(--blue);background:none;border:0;padding:8px 0 8px 14px}
.tabs{display:flex;gap:2px;border-bottom:1px solid var(--rule);margin:2px 0 6px}
.tab{position:relative;flex:1;font:26px/1 H,cursive;color:var(--graphite);background:none;border:0;padding:12px 6px}
.tab.on{color:var(--ink)}.tab.on::after{content:'';position:absolute;left:14%;right:14%;bottom:-1px;height:2.5px;border-radius:2px;background:var(--blue)}
.tab:active{background:var(--active-bg)}
.tabs+.tools,.tabs+.row{border-top:0}
.row{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px 0;border-top:1px solid var(--rule);flex-wrap:wrap}
.lab{font:24px/1 H,cursive;color:var(--graphite)}
.opts{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.opt{position:relative;font:26px/1 H,cursive;color:var(--graphite);background:none;border:0;padding:8px 12px}
.opt.on{color:var(--ink)}
.ring{position:absolute;left:0;top:0;overflow:visible;pointer-events:none;fill:none;stroke:var(--blue);stroke-width:1.8;stroke-linecap:round}
.ring path{stroke-dasharray:1;stroke-dashoffset:1;opacity:0}
.opt.on .ring path{opacity:1;animation:draw .4s ease-out forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.tools{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--rule);padding-top:6px}
.tool{display:flex;align-items:center;gap:10px;padding:11px 6px;background:none;border:0;border-radius:12px;font:24px/1 H,cursive;color:var(--ink);text-align:left}
.tool span{white-space:nowrap}
.tool:active,.hmain:active{background:var(--active-bg)}
.ic{width:22px;height:22px;flex:none;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;color:var(--graphite)}
.tool.danger,.tool.danger .ic,.textbtn.danger{color:var(--red)}
.hint{font:12.5px/1.45 system-ui,sans-serif;color:var(--graphite);margin:8px 0 0;max-width:44ch}
.iconbtn{width:44px;height:44px;display:grid;place-items:center;background:none;border:0;border-radius:12px;padding:0}
.hrow{display:flex;align-items:center;border-top:1px solid var(--rule)}
.hmain{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;padding:12px 4px;background:none;border:0;border-radius:12px;text-align:left;color:var(--ink)}
.hmain .ex{font:30px/1.1 H,cursive;word-break:break-all}.hmain .an{font:30px/1.1 H,cursive;color:var(--blue)}
.textbtn{font:24px/1 H,cursive;background:none;border:0;padding:14px 4px}
.empty{font:28px/1.25 H,cursive;color:var(--graphite);margin:26px 0 30px;text-align:center}
#toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:var(--blue);color:var(--toast-ink);padding:8px 18px;border-radius:16px;font:24px/1.1 H,cursive;opacity:0;transition:opacity .3s;z-index:20;pointer-events:none;white-space:nowrap}
@media (orientation:landscape) and (max-height:520px){#panel{left:auto;right:0;top:0;bottom:0;max-height:none;width:min(500px,68%);border-radius:22px 0 0 22px;transform:translateX(28px)}#sheet.in #panel{transform:none}.tools{grid-template-columns:repeat(3,1fr)}.tool{font-size:22px;gap:8px}.hint{display:none}.row{padding:4px 0}.head{padding:8px 0 4px}}
@media (prefers-reduced-motion:reduce){#panel,#back{transition:none}.opt.on .ring path{animation:none;stroke-dashoffset:0}}</style>""".replace("__FONT__", font)
app = rd('app.js').replace('/*CLS*/', cls)
CSP = ("default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; "
       "img-src data: blob:; worker-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'")
html = ('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + CSP + '"><meta name="theme-color" content="#000000"><title>Mikajy</title><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover">'
        + css + '</head><body><canvas id="pad" role="img" aria-label="Handwriting canvas: write a calculation with your finger"></canvas><button id="mb" aria-label="Menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/></svg></button><button id="zr" aria-label="Reset view">100%</button><div id="mem"></div><div id="sheet"><div id="back"></div><div id="panel"></div></div>'
        '<script id="cnn" type="text/plain">\n' + rd('core_cnn.js').replace('/*MODEL*/', model) + '\n</script>' + (('<script id="seq" type="text/plain">\n' + rd('seq-core.js') + '\nconst SEQ_MODEL=' + seq_model + ';\n</script>') if seq_model else '') + '<script>\n' + rd('vendor/nerdamer.js') + '\n</script><script>\n' + rd('storage.js') + '\n' + rd('core_main.js') + '\n' + rd('recognizer.js') + '\n' + rd('seq-core.js') + '\n' + rd('poly-core.js') + '\n' + rd('math-core.js') + '\n' + rd('i18n.js') + '\n' + rd('calculus.js') + '\n' + rd('calculator.js') + '\n' + rd('settings.js') + '\n' + rd('updates.js') + '\n' + app + '\n</script></body></html>')
out = os.path.join(here, '..', 'android', 'assets', 'index.html')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print('wrote', os.path.normpath(out), len(html) // 1024, 'KB')
