#!/usr/bin/env python3
"""Assemble android/assets/index.html (single self-contained page) from the web/ sources.
   The CNN weights are embedded twice-free: once inside <script id="cnn"> (run in a Web Worker),
   the class list is inlined into the main script."""
import base64, json, os
here = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(here, p), encoding='utf-8').read()
model = rd('model/model4.json')
cls = json.dumps(json.loads(model)['cls'])
font = base64.b64encode(open(os.path.join(here, 'fonts/hand.woff2'), 'rb').read()).decode()
css = """<style>@font-face{font-family:H;src:url(data:font/woff2;base64,__FONT__) format('woff2')}
*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
html,body{margin:0;height:100%;background:#faf8f3;overflow:hidden}
canvas{position:fixed;inset:0;width:100%;height:100%;touch-action:none;display:block}
#mb{position:fixed;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));width:36px;height:36px;border-radius:18px;border:0;background:rgba(31,41,55,.07);color:rgba(31,41,55,.5);font:22px/1 sans-serif;padding:0;z-index:5}
#mem{position:fixed;left:0;right:0;bottom:0;display:none;gap:8px;align-items:center;padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));background:rgba(250,248,243,.92);border-top:1px solid rgba(31,41,55,.12);z-index:4;overflow-x:auto;font-family:sans-serif}
#mem.hot{background:rgba(36,86,196,.15)}
.chip{padding:8px 12px;border-radius:12px;background:#fff;border:1px solid #c9d3e4;font-size:18px;color:#1f2937;white-space:nowrap;touch-action:none}
.chip b{margin-left:8px;color:#9aa5b8;font-weight:400}
#sheet{position:fixed;inset:0;display:none;z-index:10;font-family:sans-serif;color:#1f2937}
#back{position:absolute;inset:0;background:rgba(0,0,0,.25)}
#panel{position:absolute;left:50%;transform:translateX(-50%);bottom:0;width:min(600px,100%);max-height:80%;overflow:auto;background:#fff;border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
#panel h3{margin:0 0 10px;font-size:18px}
#panel .s{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0;flex-wrap:wrap}
#panel .seg{display:flex;border:1px solid #c9d3e4;border-radius:10px;overflow:hidden}
#panel button{font:15px sans-serif;border:0;background:#eef2f8;color:#1f2937;padding:10px 12px;border-radius:10px}
#panel .seg button{border-radius:0;background:#fff}#panel .seg button.on{background:#1f3a5f;color:#fff}
#panel .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
#panel .danger{color:#b42318;margin-top:8px}
#panel .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
#panel .h{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #eef2f8}
#panel .h .t{font-size:16px;word-break:break-all}#panel .h i{color:#2456c4;font-style:normal}
#panel .h .b{display:flex;gap:6px;flex-shrink:0}
.mut{color:#7a869c;font-size:13px}
#toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:rgba(31,41,55,.9);color:#fff;padding:8px 14px;border-radius:14px;font:14px sans-serif;opacity:0;transition:opacity .3s;z-index:20;pointer-events:none}</style>""".replace("__FONT__", font)
app = rd('app.js').replace('/*CLS*/', cls)
html = ('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover">'
        + css + '</head><body><canvas id="pad"></canvas><button id="mb" aria-label="menu">⋯</button><div id="mem"></div><div id="sheet"><div id="back"></div><div id="panel"></div></div>'
        '<script id="cnn" type="text/plain">\n' + rd('core_cnn.js').replace('/*MODEL*/', model) + '\n</script><script>\n' + rd('core_main.js') + app + '\n</script></body></html>')
out = os.path.join(here, '..', 'android', 'assets', 'index.html')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print('wrote', os.path.normpath(out), len(html) // 1024, 'KB')
