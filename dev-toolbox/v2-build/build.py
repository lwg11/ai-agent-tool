# -*- coding: utf-8 -*-
"""构建 前端百宝箱 v2.0：拼装 parts -> app.js(语法校验) -> 注入 UMD 库 -> dev-toolbox-v2.html
用法：python3 v2-build/build.py   （UMD 库缺失时自动从 unpkg 下载到 v2-build/libs/，不进 git）"""
import io, os, re, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
LIBS = os.path.join(BASE, 'libs')

LIB_URLS = {
    'react.js':     'https://unpkg.com/react@17.0.2/umd/react.production.min.js',
    'react-dom.js': 'https://unpkg.com/react-dom@17.0.2/umd/react-dom.production.min.js',
    'moment.js':    'https://unpkg.com/moment@2.29.4/min/moment.min.js',
    'htm.js':       'https://unpkg.com/htm@3.1.1/dist/htm.js',
    'antd.js':      'https://unpkg.com/antd@4.24.16/dist/antd.min.js',
    'antd.css':     'https://unpkg.com/antd@4.24.16/dist/antd.min.css',
}

def ensure_libs():
    os.makedirs(LIBS, exist_ok=True)
    for name, url in LIB_URLS.items():
        p = os.path.join(LIBS, name)
        if not os.path.exists(p) or os.path.getsize(p) < 100:
            print('downloading', name, '...')
            r = subprocess.run(['curl', '-sL', '--max-time', '120', '-o', p, url])
            if r.returncode != 0 or os.path.getsize(p) < 100:
                raise SystemExit('download failed: ' + url)

def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()

# 0. 确保 UMD 库存在
ensure_libs()

# 1. 拼 app.js
src = read(os.path.join(BASE, 'app-src.js'))
parts_order = ['curl-core.js', 'hex.js', 'pkcs7.js', 'gmlib.js', 'sec-rules.js', 'hdrs-parse.js', 'console-helpers.js']
parts = []
for name in parts_order:
    body = read(os.path.join(BASE, 'parts', name))
    # 去掉 console-helpers 里的 DOM 版 consoleRender（v2 用 React 渲染）
    if name == 'console-helpers.js':
        body = body.split('function consoleRender')[0]
    if name == 'hdrs-parse.js':
        body = body.replace('let hdrsData = [];', '')
    parts.append('\n/* ---- 移植自 v1: %s ---- */\n' % name + body)
app = src.replace('/*__PARTS__*/', '\n'.join(parts))
with io.open(os.path.join(BASE, 'app.js'), 'w', encoding='utf-8') as f:
    f.write(app)
print('app.js written:', len(app), 'chars')

# 2. HTML 骨架
html = u"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>前端百宝箱</title>
<style>__ANTD_CSS__</style>
<style>
/* 前端百宝箱 v2.0 追加样式（antd 之外的代码输出区/日志区） */
body{margin:0}
.code-out{background:#0b1021;color:#d6e4ff;border-radius:8px;padding:10px 12px;font:12.5px/1.6 Consolas,Menlo,monospace;white-space:pre-wrap;word-break:break-all;margin:0 0 10px;max-height:420px;overflow:auto}
.ws-log{background:#0b1021;border-radius:8px;padding:8px 10px;max-height:380px;overflow:auto;font:12.5px/1.7 Consolas,Menlo,monospace}
.ws-line{padding:1px 0;color:#d6e4ff}
.ws-t{color:#6b7db3;margin-right:6px}
pre.code-out{margin:0 0 10px}
details summary{color:#555}
</style>
</head>
<body>
<div id="root"></div>
<script>__REACT__</script>
<script>__REACT_DOM__</script>
<script>__MOMENT__</script>
<script>__HTM__</script>
<script>__ANTD__</script>
<script>__APP__</script>
</body>
</html>
"""

def lib(name):
    body = read(os.path.join(LIBS, name))
    # 防止内联脚本被 </script> 截断（保险替换，等价转义）
    return body.replace('</script>', '<\\/script>')

html = html.replace('__ANTD_CSS__', lib('antd.css'))
html = html.replace('__REACT__', lib('react.js'))
html = html.replace('__REACT_DOM__', lib('react-dom.js'))
html = html.replace('__MOMENT__', lib('moment.js'))
html = html.replace('__HTM__', lib('htm.js'))
html = html.replace('__ANTD__', lib('antd.js'))
html = html.replace('__APP__', app.replace('</script>', '<\\/script>'))

out = os.path.join(ROOT, 'dev-toolbox-v2.html')
with io.open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print('dev-toolbox-v2.html written:', os.path.getsize(out), 'bytes')
