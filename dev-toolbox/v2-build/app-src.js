/* ============================================================
   前端百宝箱 v2.0 —— antd 版（React 17 + antd 4 UMD，零构建、单文件、离线可用）
   与 v1.x（原生 JS 版 dev-toolbox.html）并存；localStorage key 与 v1 兼容（dsk-coll / dsk-env）
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;
const A = antd;
const { Layout, Menu, Input, Button, Table, Tabs, Select, Space, Tag, Row, Col, Card, Divider, Modal, Checkbox, Upload, Tooltip, Alert } = A;
const { Sider, Content, Header } = Layout;
const TextArea = Input.TextArea;
const html = htm.bind(React.createElement);
const message = A.message;

/* ---------------- 通用工具 ---------------- */
const LS = {
  get(k, d){ try{ const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); message.success('已复制到剪贴板'); }
  catch(e){
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove(); message.success('已复制到剪贴板');
  }
}
function download(name, content, mime){
  const b = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function envResolve(s){ return String(s || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => { const env = LS.get('dsk-env', {}); return env[k] !== undefined ? env[k] : m; }); }
function fmtJson(t, indent){
  try{ return JSON.stringify(JSON.parse(t), null, indent === 0 ? 0 : (indent || 2)); }
  catch(e){ return null; }
}
function prettyAuto(t){ const p = fmtJson(t); return p === null ? t : p; }
const FORBIDDEN = new Set(['host','content-length','connection','origin','referer','user-agent','cookie','accept-encoding','accept-language','set-cookie']);
function headersTextToPairs(t){
  return String(t || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.indexOf(':'); if(i < 0) return null;
    return { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() };
  }).filter(Boolean);
}
function bytesToB64(u){
  let s = '';
  for(let i = 0; i < u.length; i += 0x8000) s += btoa(String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)));
  return s;
}
function b64ToU8(b){
  const bin = atob(String(b).replace(/\s+/g, ''));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function gmInputBytes(str, enc){
  if(enc === 'Hex') return hexToBytes(str);
  if(enc === 'Base64') return b64ToU8(str);
  return new TextEncoder().encode(str);
}
function gmHexToBN(hex){ const h = String(hex).replace(/[^0-9a-fA-F]/g, ''); let x = 0n; for(let i = 0; i < h.length; i += 2) x = (x << 8n) | BigInt(parseInt(h.substr(i, 2), 16)); return x; }
function gmBNToHex64(bn){ return bytesToHex(i2b(bn, 32)); }
function gmPtToPubHex(P, with04){ return (with04 ? '04' : '') + bytesToHex(i2b(P.x, 32)) + bytesToHex(i2b(P.y, 32)); }
function gmPubHexToPt(hex){
  let h = String(hex).replace(/[^0-9a-fA-F]/g, '');
  if(h.length === 128) h = '04' + h;
  if(h.length !== 130) throw new Error('公钥应为 64 字节(无04)或 65 字节(含04)，当前 ' + (h.length / 2) + ' 字节');
  if(h.substr(0, 2).toLowerCase() !== '04') throw new Error('公钥须以 04 开头（非压缩点）');
  return { x: gmHexToBN(h.substr(2, 64)), y: gmHexToBN(h.substr(66, 64)) };
}

/* ---------------- v1 已验证核心逻辑（原样移植） ---------------- */
/*__PARTS__*/

async function fetchReq(req, opt){
  opt = opt || {};
  const headers = {};
  (req.headers || []).forEach(h => {
    const i = h.indexOf(':'); if(i < 0) return;
    const k = h.slice(0, i).trim(); let v = envResolve(h.slice(i + 1).trim());
    if(opt.resolveKeys) v = envResolve(v);
    if(!FORBIDDEN.has(k.toLowerCase()) && !(opt.noCt && k.toLowerCase() === 'content-type')) headers[k] = v;
  });
  const method = (req.method || 'GET').toUpperCase();
  const t0 = performance.now();
  const body = ['GET', 'HEAD'].includes(method) ? undefined : (req.data ? envResolve(req.data) : undefined);
  try{
    const r = await fetch(envResolve(req.url), { method, headers, body });
    const text = await r.text();
    return { ok: true, status: r.status, statusText: r.statusText, ms: Math.round(performance.now() - t0), text, headers: [...r.headers.entries()] };
  }catch(e){
    return { ok: false, err: e.message + '（若为跨域请求，浏览器受 CORS 限制；可复制 Node 脚本在服务端执行验证）' };
  }
}
const StatusLine = ({ res }) => res ? (res.ok
  ? html`<${Space} wrap style=${{ marginBottom: 8 }}>
      <${Tag} color=${res.status < 400 ? 'green' : 'red'}>${res.status} ${res.statusText}</>
      <${Tag}>${res.ms} ms</${Tag}>
      <${Button} size="small" onClick=${() => copyText(res.text)}>复制响应体</${Button}>
      <${Button} size="small" onClick=${() => download('response.txt', res.text)}>下载</${Button}>
    <//>`
  : html`<${Alert} type="error" showIcon message=${res.err} style=${{ marginBottom: 8 }} />`) : null;

/* ============================================================
   1. cURL 转换器
   ============================================================ */
function CurlMod(){
  const [inp, setInp] = useState('');
  const [req, setReq] = useState(null);
  const [lang, setLang] = useState('fetch');
  const [res, setRes] = useState(null);
  const doParse = () => {
    try{
      const r = parseCurl(tokenizeCurl(inp));
      if(!r || !r.url) throw new Error('未解析到 URL');
      r.method = (r.method || 'GET').toUpperCase();
      setReq(r); setRes(null);
      message.success('解析成功：' + r.method + ' ' + r.url.slice(0, 60));
    }catch(e){ message.error('解析失败：' + e.message); }
  };
  const code = useMemo(() => {
    if(!req) return '';
    let jsonBody = false; try{ JSON.parse(req.data || ''); jsonBody = true; }catch(e){}
    return lang === 'fetch' ? genFetchCode(req, jsonBody) : genAxiosCode(req, jsonBody);
  }, [req, lang]);
  const send = async () => { if(!req) return; setRes({ loading: true }); const r = await fetchReq(req); setRes(r); };
  const params = useMemo(() => { if(!req) return []; const { base, params } = splitQuery(req.url); return params; }, [req]);
  return html`
    <${Card} title="🌀 cURL 转换器" extra=${html`<${Space}>
        <${Button} type="primary" size="small" onClick=${doParse}>解析</${Button}>
        <${Button} size="small" disabled=${!req} onClick=${send}>🚀 直接执行</${Button}>
      <//>`}>
      <${TextArea} rows="6" value=${inp} onChange=${e => setInp(e.target.value)}
        placeholder="粘贴 DevTools → Copy as cURL 的内容，支持续行符与引号转义" />
      ${req && html`<${Divider} plain style=${{ fontSize: 12 }}>解析结果<//>`}
      ${req && html`<p style=${{ marginBottom: 4 }}><${Tag} color="blue">${req.method}</> <code>${req.url}</code></p>`}
      ${req && params.length ? html`<${Table} size="small" style=${{ marginBottom: 12 }} pagination=${false}
          dataSource=${params.map((p, i) => ({ key: i, k: decodeURIComponent(p.k), v: decodeURIComponent(p.v) }))}
          columns=${[{ title: 'Query Key', dataIndex: 'k' }, { title: 'Value', dataIndex: 'v', ellipsis: true }]} />` : null}
      ${req && req.headers.length ? html`<p style=${{ margin: '4px 0' }}><b>Headers (${req.headers.length})</b>：${req.headers.map(h => html`<${Tag} key=${h} style=${{ marginBottom: 4 }}>${h.split(':')[0]}</>`)}</p>` : null}
      ${req && req.data ? html`<p style=${{ margin: '4px 0' }}><b>Body</b></p><pre className="code-out">${req.data}</pre>` : null}
      <${Divider} plain style=${{ fontSize: 12 }}>生成代码<//>
      <${Space} style=${{ marginBottom: 8 }}>
        <${Select} value=${lang} onChange=${setLang} style=${{ width: 120 }} options=${[{ value: 'fetch', label: 'fetch' }, { value: 'axios', label: 'axios' }]} />
        <${Button} size="small" onClick=${() => copyText(code)}>复制代码</${Button}>
      <//>
      <pre className="code-out">${code}</pre>
      <${Divider} plain style=${{ fontSize: 12 }}>直接执行结果<//>
      ${res && res.loading ? html`<p>请求中…</p>` : html`<${StatusLine} res=${res} />`}
      ${res && res.ok ? html`<pre className="code-out">${prettyAuto(res.text)}</pre>` : null}
    <//>`;
}

/* ============================================================
   2. JSON 工具
   ============================================================ */
function jsonToTs(name, v){
  const lines = [];
  const t = x => x === null ? 'null' : Array.isArray(x) ? 'array' : typeof x === 'number' ? 'number' : typeof x === 'boolean' ? 'boolean' : typeof x === 'object' ? 'object' : 'string';
  function walk(n, val){
    if(t(val) === 'object'){
      const iface = 'I' + n;
      const fields = Object.entries(val).map(([k, x]) => '  ' + (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ': ' + walk(String(k).replace(/[^A-Za-z0-9]/g, '') || 'Field', x) + ';');
      lines.unshift('export interface ' + iface + ' {\n' + fields.join('\n') + '\n}');
      return iface;
    }
    if(t(val) === 'array') return val.length ? walk(n + 'Item', val[0]) + '[]' : 'unknown[]';
    return t(val);
  }
  walk(String(name).replace(/[^A-Za-z0-9]/g, '') || 'Root', v);
  return lines.join('\n\n');
}
function JsonMod(){
  const [inp, setInp] = useState('');
  const [out, setOut] = useState('');
  const [err, setErr] = useState('');
  const run = f => {
    try{ const o = JSON.parse(inp); setErr(''); setOut(f(o)); }
    catch(e){ setErr(e.message); setOut(''); }
  };
  return html`
    <${Card} title="🧩 JSON 工具">
      <${TextArea} rows="8" value=${inp} onChange=${e => setInp(e.target.value)} placeholder="粘贴 JSON（支持格式化 / 压缩 / 校验 / 生成 TS 类型）" />
      ${err && html`<${Alert} type="error" showIcon message=${'JSON 无效：' + err} style=${{ marginTop: 8 }} />`}
      <${Space} wrap style=${{ margin: '10px 0' }}>
        <${Button} size="small" type="primary" onClick=${() => run(o => JSON.stringify(o, null, 2))}>格式化</${Button}>
        <${Button} size="small" onClick=${() => run(o => JSON.stringify(o))}>压缩</${Button}>
        <${Button} size="small" onClick=${() => run(o => jsonToTs('Root', o))}>生成 TS 类型</${Button}>
        <${Button} size="small" onClick=${() => copyText(out)}>复制结果</${Button}>
        <${Button} size="small" onClick=${() => { setInp(''); setOut(''); setErr(''); }}>清空</${Button}>
      <//>
      ${out && html`<pre className="code-out">${out}</pre>`}
    <//>`;
}

/* ============================================================
   3. 接口日志解析
   ============================================================ */
function LogsMod(){
  const [inp, setInp] = useState('');
  const rows = useMemo(() => {
    const re = /(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+((?:https?:\/\/|\/)[^\s"'\)<>]+)/g;
    const out = []; let m;
    while((m = re.exec(inp))) out.push({ key: out.length, method: m[1], url: m[2] });
    return out;
  }, [inp]);
  const toApi = r => { localStorage.setItem('dsk-api-prefill', JSON.stringify(r)); message.success('已发送到 API 调试台，请切到该模块查看'); };
  return html`
    <${Card} title="📡 接口日志解析">
      <${TextArea} rows="10" value=${inp} onChange=${e => setInp(e.target.value)} placeholder="粘贴抓包日志 / nginx 日志 / 代码输出，自动提取 METHOD + URL" />
      <p style=${{ margin: '10px 0 6px' }}>识别出 <b>${rows.length}</b> 条请求</p>
      <${Table} size="small" pagination=${{ pageSize: 10 }}
        dataSource=${rows}
        columns=${[
          { title: 'Method', dataIndex: 'method', width: 90, render: m => html`<${Tag} color=${m === 'GET' ? 'green' : m === 'POST' ? 'orange' : 'red'}>${m}</>` },
          { title: 'URL', dataIndex: 'url', ellipsis: true, render: (u, r) => html`<code>${u}</code>` },
          { title: '操作', width: 130, render: (_, r) => html`<${Button} size="small" onClick=${() => toApi(r)}>→ API 调试台</${Button}>` }
        ]} />
    <//>`;
}

/* ============================================================
   4. JSON 对比
   ============================================================ */
function flattenJson(o, p, m){
  p = p || ''; m = m || {};
  if(o !== null && typeof o === 'object' && !Array.isArray(o)){ for(const k in o) flattenJson(o[k], p ? p + '.' + k : k, m); }
  else if(Array.isArray(o)) o.forEach((x, i) => flattenJson(x, p + '[' + i + ']', m));
  else m[p || '(root)'] = o;
  return m;
}
function DiffMod(){
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [rows, setRows] = useState(null);
  const run = () => {
    const ma = flattenJson(JSON.parse(a)), mb = flattenJson(JSON.parse(b));
    const out = [];
    Object.keys(ma).forEach(k => { if(!(k in mb)) out.push({ key: out.length, path: k, a: String(ma[k]), b: '—', st: 'removed' }); });
    Object.keys(mb).forEach(k => {
      if(!(k in ma)) out.push({ key: out.length, path: k, a: '—', b: String(mb[k]), st: 'added' });
      else if(String(ma[k]) !== String(mb[k])) out.push({ key: out.length, path: k, a: String(ma[k]), b: String(mb[k]), st: 'changed' });
    });
    setRows(out);
  };
  return html`
    <${Card} title="⚖️ JSON 对比" extra=${html`<${Button} type="primary" size="small" onClick=${() => { try{ run(); }catch(e){ message.error('JSON 无效：' + e.message); } }}>对比</${Button}>`}>
      <${Row} gutter=${12}>
        <${Col} span=${12}><${TextArea} rows="9" value=${a} onChange=${e => setA(e.target.value)} placeholder="JSON A" /></${Col}>
        <${Col} span=${12}><${TextArea} rows="9" value=${b} onChange=${e => setB(e.target.value)} placeholder="JSON B" /></${Col}>
      <//>
      ${rows && html`<div style=${{ marginTop: 12 }}>
        <p>差异 <b>${rows.length}</b> 处（<${Tag} color="green">+新增 ${rows.filter(r => r.st === 'added').length}</> <${Tag} color="red">-删除 ${rows.filter(r => r.st === 'removed').length}</> <${Tag} color="orange">~修改 ${rows.filter(r => r.st === 'changed').length}</>）</p>
        <${Table} size="small" pagination=${{ pageSize: 10 }} dataSource=${rows}
          columns=${[
            { title: '路径', dataIndex: 'path', render: p => html`<code>${p}</code>` },
            { title: 'A 值', dataIndex: 'a', ellipsis: true },
            { title: 'B 值', dataIndex: 'b', ellipsis: true },
            { title: '状态', dataIndex: 'st', width: 80, render: s => html`<${Tag} color=${s === 'added' ? 'green' : s === 'removed' ? 'red' : 'orange'}>${s === 'added' ? '新增' : s === 'removed' ? '删除' : '修改'}</>` }
          ]} />
      <//>`}
    <//>`;
}

/* ============================================================
   5. 时间戳
   ============================================================ */
function TsMod(){
  const [now, setNow] = useState(Date.now());
  const [ts, setTs] = useState(String(Math.floor(Date.now() / 1000)));
  const [dt, setDt] = useState('');
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const tsToDate = v => { const n = Number(v); if(!n) return '无效时间戳'; const ms = String(v).length > 10 ? n : n * 1000; return moment(ms).format('YYYY-MM-DD HH:mm:ss') + '（' + moment(ms).fromNow() + '）'; };
  return html`
    <${Card} title="⏱️ 时间戳转换">
      <p>当前：<code>${now}</code> ms = <code>${Math.floor(now / 1000)}</code> s = ${moment(now).format('YYYY-MM-DD HH:mm:ss')}</p>
      <${Divider} plain style=${{ fontSize: 12 }}>时间戳 → 日期<//>
      <${Space}>
        <${Input} style=${{ width: 240 }} value=${ts} onChange=${e => setTs(e.target.value)} placeholder="秒或毫秒" />
        <span><b>${tsToDate(ts)}</b></span>
      <//>
      <${Divider} plain style=${{ fontSize: 12 }}>日期 → 时间戳<//>
      <${Space}>
        <${Input} style=${{ width: 240 }} value=${dt} onChange=${e => setDt(e.target.value)} placeholder="2026-01-01 12:00:00" />
        <span><b>${(() => { const m = moment(dt, 'YYYY-MM-DD HH:mm:ss'); return dt && m.isValid() ? m.unix() + ' s / ' + m.valueOf() + ' ms' : '—'; })()}</b></span>
      <//>
    <//>`;
}

/* ============================================================
   6. 编解码
   ============================================================ */
function CodecMod(){
  const [inp, setInp] = useState('');
  const [out, setOut] = useState('');
  const apply = f => { try{ setOut(f(inp)); }catch(e){ message.error('失败：' + e.message); } };
  const b64enc = s => bytesToB64(new TextEncoder().encode(s));
  const b64dec = s => new TextDecoder().decode(b64ToU8(s));
  return html`
    <${Card} title="🔐 编解码">
      <${TextArea} rows="5" value=${inp} onChange=${e => setInp(e.target.value)} placeholder="输入内容" />
      <${Space} wrap style=${{ margin: '10px 0' }}>
        <${Button} size="small" onClick=${() => apply(s => encodeURIComponent(s))}>URL 编码</${Button}>
        <${Button} size="small" onClick=${() => apply(s => decodeURIComponent(s))}>URL 解码</${Button}>
        <${Button} size="small" onClick=${() => apply(b64enc)}>Base64 编码</${Button}>
        <${Button} size="small" onClick=${() => apply(b64dec)}>Base64 解码</${Button}>
        <${Button} size="small" onClick=${() => apply(s => s.replace(/[^\x00-\x7F]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')))}>Unicode 转义</${Button}>
        <${Button} size="small" onClick=${() => apply(s => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))))}>Unicode 还原</${Button}>
        <${Button} size="small" onClick=${() => apply(s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])))}>HTML 转义</${Button}>
        <${Button} size="small" onClick=${() => copyText(out)}>复制结果</${Button}>
      <//>
      <${TextArea} rows="5" value=${out} readOnly placeholder="结果" />
    <//>`;
}

/* ============================================================
   7. JWT 解析
   ============================================================ */
function JwtMod(){
  const [tk, setTk] = useState('');
  const parts = useMemo(() => tk.trim().split('.').filter(Boolean), [tk]);
  const dec = s => { try{ return JSON.stringify(JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/'))), null, 2); }catch(e){ return '(无法解码：' + e.message + ')'; } };
  const claim = i => { try{ return JSON.parse(atob((parts[i] || '').replace(/-/g, '+').replace(/_/g, '/'))); }catch(e){ return {}; } };
  const pl = claim(1);
  return html`
    <${Card} title="🎫 JWT 解析">
      <${TextArea} rows="4" value=${tk} onChange=${e => setTk(e.target.value)} placeholder="粘贴 JWT（eyJ...）" />
      ${parts.length >= 2 && html`<div style=${{ marginTop: 10 }}>
        <p><b>Header</b></p><pre className="code-out">${dec(parts[0])}</pre>
        <p><b>Payload</b></p><pre className="code-out">${dec(parts[1])}</pre>
        <${Space} wrap>${Object.entries(pl).filter(([k]) => ['exp', 'iat', 'nbf'].includes(k)).map(([k, v]) => html`<${Tag} key=${k} color=${k === 'exp' && v * 1000 < Date.now() ? 'red' : 'blue'}>${k} = ${v}（${moment(v * 1000).format('YYYY-MM-DD HH:mm:ss')}）</>`)}</${Space}>
        ${pl.exp && pl.exp * 1000 < Date.now() && html`<${Alert} type="error" message="Token 已过期" showIcon style=${{ marginTop: 8 }} />`}
        <p style=${{ marginTop: 8 }}><b>Signature</b>：<code>${parts[2] || '(无)'}</code></p>
      <//>`}
    <//>`;
}

/* ============================================================
   8. 正则测试
   ============================================================ */
function ReMod(){
  const [pat, setPat] = useState('');
  const [flags, setFlags] = useState(['g']);
  const [txt, setTxt] = useState('');
  const [rows, setRows] = useState(null);
  const run = () => {
    try{
      const re = new RegExp(pat, flags.join(''));
      const out = [];
      if(re.global){
        let m;
        while((m = re.exec(txt))){
          out.push({ key: out.length, idx: m.index, match: m[0], groups: m.slice(1).map((g, i) => '$' + (i + 1) + '=' + g) });
          if(m.index === re.lastIndex) re.lastIndex++;
        }
      } else {
        const m = re.exec(txt);
        if(m) out.push({ key: 0, idx: m.index, match: m[0], groups: m.slice(1).map((g, i) => '$' + (i + 1) + '=' + g) });
      }
      setRows(out);
    }catch(e){ message.error('正则无效：' + e.message); }
  };
  return html`
    <${Card} title="🔍 正则测试">
      <${Space} style=${{ width: '100%', marginBottom: 8 }} direction="vertical">
        <${Input} value=${pat} onChange=${e => setPat(e.target.value)} placeholder="正则表达式，如 (\\d{4})-(\\d{2})" addonBefore="/" />
        <${Space}>${['g', 'i', 'm', 's', 'u'].map(f => html`<${Checkbox} key=${f} checked=${flags.includes(f)} onChange=${e => setFlags(e.target.checked ? [...flags, f] : flags.filter(x => x !== f))}>${f}</>`)}</${Space}>
        <${TextArea} rows="6" value=${txt} onChange=${e => setTxt(e.target.value)} placeholder="测试文本" />
        <${Button} type="primary" size="small" onClick=${run}>匹配</${Button}>
      <//>
      ${rows && html`<p>命中 <b>${rows.length}</b> 处</p>`}
      ${rows && html`<${Table} size="small" pagination=${{ pageSize: 10 }} dataSource=${rows}
        columns=${[
          { title: '#', dataIndex: 'key', width: 50 },
          { title: '位置', dataIndex: 'idx', width: 70 },
          { title: '匹配', dataIndex: 'match', render: m => html`<code>${m}</code>` },
          { title: '分组', dataIndex: 'groups', render: g => g.join('  ') }
        ]} />`}
    <//>`;
}

/* ============================================================
   9. 颜色工具
   ============================================================ */
function hexToRgb(hex){
  let h = hex.replace('#', '').trim();
  if(h.length === 3) h = h.split('').map(c => c + c).join('');
  if(!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function rgbToHsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if(mx !== mn){
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if(mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if(mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function ColorMod(){
  const [c, setC] = useState('#8fae9d');
  const rgb = hexToRgb(c);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
  return html`
    <${Card} title="🎨 颜色工具">
      <${Space}>
        <input type="color" value=${rgb ? c : '#000000'} onChange=${e => setC(e.target.value)} style=${{ width: 46, height: 32, border: 'none', cursor: 'pointer' }} />
        <${Input} style=${{ width: 160 }} value=${c} onChange=${e => setC(e.target.value)} placeholder="#8fae9d" />
      <//>
      ${rgb ? html`<div style=${{ marginTop: 12 }}>
        <div style=${{ width: '100%', height: 60, borderRadius: 8, background: c, marginBottom: 10 }} />
        <p>HEX：<code>${c}</code> <${Button} type="link" size="small" onClick=${() => copyText(c)}>复制</></p>
        <p>RGB：<code>rgb(${rgb.r}, ${rgb.g}, ${rgb.b})</code> <${Button} type="link" size="small" onClick=${() => copyText('rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')')}>复制</></p>
        <p>HSL：<code>hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)</code> <${Button} type="link" size="small" onClick=${() => copyText('hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)')}>复制</></p>
      </div>` : html`<p style=${{ marginTop: 8 }}><${Tag} color="red">无效 HEX</></p>`}
    <//>`;
}

/* ============================================================
   10. 生成器 & px/rem/vw
   ============================================================ */
function GenMod(){
  const [uuid, setUuid] = useState('');
  const [pwdLen, setPwdLen] = useState(16);
  const [pwd, setPwd] = useState('');
  const genUuid = () => { const u = crypto.getRandomValues(new Uint8Array(16)); u[6] = (u[6] & 0x0f) | 0x40; u[8] = (u[8] & 0x3f) | 0x80; const h = Array.from(u, x => x.toString(16).padStart(2, '0')).join(''); setUuid(h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20)); };
  const genPwd = () => { const cs = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*'; const a = crypto.getRandomValues(new Uint8Array(pwdLen)); setPwd(Array.from(a, x => cs[x % cs.length]).join('')); };
  /* px / rem / vw */
  const [rootFs, setRootFs] = useState(16);
  const [vwWidth, setVwWidth] = useState(375);
  const [u, setU] = useState({ px: '24', rem: '', vw: '' });
  const lock = useRef(false);
  const conv = (from, val) => {
    if(lock.current) return; lock.current = true;
    const v = parseFloat(val); const r = parseFloat(rootFs) || 16; const w = parseFloat(vwWidth) || 375;
    const next = { ...u, [from]: val };
    if(!isNaN(v)){
      const px = from === 'px' ? v : from === 'rem' ? v * r : v * w / 100;
      if(from !== 'px') next.px = +px.toFixed(2);
      if(from !== 'rem') next.rem = +(px / r).toFixed(4);
      if(from !== 'vw') next.vw = +(px / w * 100).toFixed(4);
    }
    setU(next); setTimeout(() => { lock.current = false; }, 0);
  };
  return html`
    <${Card} title="🎲 生成器 & 单位换算">
      <p><b>UUID v4</b></p>
      <${Space} style=${{ marginBottom: 12 }}>
        <${Input} style=${{ width: 320 }} value=${uuid} readOnly placeholder="点击生成" />
        <${Button} size="small" type="primary" onClick=${genUuid}>生成</${Button}>
        ${uuid && html`<${Button} size="small" onClick=${() => copyText(uuid)}>复制</${Button}>`}
      <//>
      <p><b>随机密码</b></p>
      <${Space} style=${{ marginBottom: 12 }}>
        <${Input} style=${{ width: 320 }} value=${pwd} readOnly placeholder="点击生成" />
        <${Input} style=${{ width: 80 }} type="number" value=${pwdLen} onChange=${e => setPwdLen(+e.target.value || 16)} />
        <${Button} size="small" type="primary" onClick=${genPwd}>生成</${Button}>
        ${pwd && html`<${Button} size="small" onClick=${() => copyText(pwd)}>复制</${Button}>`}
      <//>
      <${Divider} plain style=${{ fontSize: 12 }}>px / rem / vw 三向换算</${Divider}>
      <${Space} wrap>
        <span>根字号<${Input} style=${{ width: 70 }} type="number" value=${rootFs} onChange=${e => setRootFs(e.target.value)} />px</span>
        <span>视口宽<${Input} style=${{ width: 70 }} type="number" value=${vwWidth} onChange=${e => setVwWidth(e.target.value)} />px</span>
        <span>px<${Input} style=${{ width: 110 }} value=${u.px} onChange=${e => conv('px', e.target.value)} /></span>
        <span>rem<${Input} style=${{ width: 110 }} value=${u.rem} onChange=${e => conv('rem', e.target.value)} /></span>
        <span>vw<${Input} style=${{ width: 110 }} value=${u.vw} onChange=${e => conv('vw', e.target.value)} /></span>
      <//>
    <//>`;
}

/* ============================================================
   11. API 调试台
   ============================================================ */
function ApiMod(){
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [env, setEnv] = useState(() => JSON.stringify(LS.get('dsk-env', {}), null, 2));
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const p = localStorage.getItem('dsk-api-prefill');
    if(p){ try{ const o = JSON.parse(p); setMethod(o.method); setUrl(o.url); localStorage.removeItem('dsk-api-prefill'); }catch(e){} }
  }, []);
  const saveEnv = () => { try{ LS.set('dsk-env', JSON.parse(env || '{}')); message.success('环境变量已保存（{{key}} 可在 URL/Headers/Body 中使用）'); }catch(e){ message.error('环境变量 JSON 无效'); } };
  const send = async () => {
    if(!url.trim()){ message.warning('请填写 URL'); return; }
    setBusy(true); setRes(null);
    const r = await fetchReq({ method, url, headers: headersTextToPairs(headers).map(h => h.k + ': ' + h.v), data: body });
    setRes(r); setBusy(false);
  };
  const saveToColl = () => {
    const list = LS.get('dsk-coll', []);
    list.unshift({ id: Date.now(), name: url.slice(0, 60) || '未命名', project: '', method, url, headers: headersTextToPairs(headers), body });
    LS.set('dsk-coll', list);
    message.success('已保存到请求集合（切到「请求集合」模块查看）');
  };
  return html`
    <${Card} title="🚀 API 调试台" extra=${html`<${Space}>
      <${Button} type="primary" size="small" loading=${busy} onClick=${send}>发送</${Button}>
      <${Button} size="small" onClick=${saveToColl}>💾 存入请求集合</${Button}>
    <//>`}>
      <${Space} style=${{ width: '100%', marginBottom: 8 }} direction="vertical">
        <${Space} style=${{ width: '100%' }}>
          <${Select} style=${{ width: 110 }} value=${method} onChange=${setMethod} options=${['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => ({ value: m, label: m }))} />
          <${Input} style=${{ flex: 1 }} value=${url} onChange=${e => setUrl(e.target.value)} placeholder="https://api.example.com/v1/users?name={{name}}" onPressEnter=${send} />
        <//>
        <${TextArea} rows="4" value=${headers} onChange=${e => setHeaders(e.target.value)} placeholder="请求头，每行一条：&#10;Content-Type: application/json&#10;Authorization: Bearer {{token}}" />
        ${!['GET', 'HEAD'].includes(method) && html`<${TextArea} rows="4" value=${body} onChange=${e => setBody(e.target.value)} placeholder='请求体（支持 {{var}} 环境变量），如 {"page": 1}' />`}
      <//>
      <${Divider} plain style=${{ fontSize: 12 }}>环境变量（localStorage: dsk-env，与 v1 共用）</${Divider}>
      <${Space} style=${{ width: '100%' }} direction="vertical">
        <${TextArea} rows="2" value=${env} onChange=${e => setEnv(e.target.value)} placeholder='{"token": "abc123"}' />
        <${Button} size="small" onClick=${saveEnv}>保存环境变量</${Button}>
      <//>
      <${Divider} plain style=${{ fontSize: 12 }}>响应</${Divider}>
      ${res && res.loading ? null : html`<${StatusLine} res=${res} />`}
      ${res && res.ok && html`
        ${res.headers.length ? html`<details style=${{ marginBottom: 8 }}><summary style=${{ cursor: 'pointer', fontSize: 12 }}>响应头 (${res.headers.length})</summary><pre className="code-out">${res.headers.map(h => h[0] + ': ' + h[1]).join('\n')}</pre></details>` : null}
        <pre className="code-out">${prettyAuto(res.text)}</pre>`}
    <//>`;
}

/* ============================================================
   12. AES 加解密（WebCrypto：CBC / GCM，口令经 SHA-256 派生密钥，IV 前置）
   ============================================================ */
async function aesCrypt(mode, isEnc, pass, text){
  const enc = new TextEncoder(), dec = new TextDecoder();
  const keyMat = await crypto.subtle.digest('SHA-256', enc.encode(pass));
  const alg = mode === 'GCM' ? 'AES-GCM' : 'AES-CBC';
  const key = await crypto.subtle.importKey('raw', keyMat, { name: alg }, false, ['encrypt', 'decrypt']);
  const ivLen = mode === 'GCM' ? 12 : 16;
  if(isEnc){
    const iv = crypto.getRandomValues(new Uint8Array(ivLen));
    const ct = await crypto.subtle.encrypt({ name: alg, iv }, key, enc.encode(text));
    const all = new Uint8Array(iv.length + ct.byteLength);
    all.set(iv); all.set(new Uint8Array(ct), iv.length);
    return bytesToB64(all);
  }
  const all = b64ToU8(text);
  if(all.length <= ivLen) throw new Error('密文太短');
  const iv = all.slice(0, ivLen);
  const pt = await crypto.subtle.decrypt({ name: alg, iv }, key, all.slice(ivLen));
  return dec.decode(pt);
}
function AesMod(){
  const [mode, setMode] = useState('GCM');
  const [pass, setPass] = useState('');
  const [inp, setInp] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async isEnc => {
    if(!pass){ message.warning('请填写口令'); return; }
    setBusy(true);
    try{ setOut(await aesCrypt(mode, isEnc, pass, inp)); message.success(isEnc ? '加密成功（Base64，IV 前置）' : '解密成功'); }
    catch(e){ message.error('失败：' + e.message); }
    setBusy(false);
  };
  return html`
    <${Card} title="🔒 AES 加解密（WebCrypto）">
      <${Space} style=${{ marginBottom: 8 }}>
        <${Select} value=${mode} onChange=${setMode} style=${{ width: 160 }} options=${[{ value: 'GCM', label: 'AES-256-GCM（推荐）' }, { value: 'CBC', label: 'AES-256-CBC' }]} />
        <${Input} style=${{ width: 240 }} type="password" value=${pass} onChange=${e => setPass(e.target.value)} placeholder="口令（SHA-256 派生密钥）" />
      <//>
      <${TextArea} rows="4" value=${inp} onChange=${e => setInp(e.target.value)} placeholder="明文或密文（Base64，加密时 IV 随机生成并前置于密文）" />
      <${Space} style=${{ margin: '10px 0' }}>
        <${Button} size="small" type="primary" loading=${busy} onClick=${() => run(true)}>加密</${Button}>
        <${Button} size="small" loading=${busy} onClick=${() => run(false)}>解密</${Button}>
        <${Button} size="small" onClick=${() => copyText(out)}>复制结果</${Button}>
      <//>
      <${TextArea} rows="4" value=${out} readOnly placeholder="结果" />
    <//>`;
}

/* ============================================================
   13. WebSocket 调试台
   ============================================================ */
function WsMod(){
  const [url, setUrl] = useState('wss://echo.websocket.org');
  const [msg, setMsg] = useState('');
  const [st, setSt] = useState('未连接');
  const [log, setLog] = useState([]);
  const sock = useRef(null);
  const idRef = useRef(0);
  const push = (lvl, text) => setLog(l => [{ key: ++idRef.current, lvl, text, t: moment().format('HH:mm:ss.SSS') }, ...l].slice(0, 500));
  const connect = () => {
    if(sock.current){ sock.current.close(); return; }
    try{
      const s = new WebSocket(url);
      sock.current = s;
      s.onopen = () => setSt('已连接 ' + url);
      s.onmessage = e => push('recv', typeof e.data === 'string' ? e.data : '(二进制 ' + e.data.size + 'B)');
      s.onclose = () => { setSt('已关闭'); sock.current = null; };
      s.onerror = () => setSt('连接错误');
      setSt('连接中…');
    }catch(e){ message.error('连接失败：' + e.message); }
  };
  const sendMsg = () => {
    const s = sock.current;
    if(!s || s.readyState !== 1){ message.warning('未连接'); return; }
    s.send(msg); push('send', msg); setMsg('');
  };
  return html`
    <${Card} title="🔌 WebSocket 调试台" extra=${html`<${Tag} color=${st.startsWith('已连接') ? 'green' : st.includes('错误') ? 'red' : 'default'}>${st}</>`}>
      <${Space} style=${{ width: '100%', marginBottom: 8 }}>
        <${Input} style=${{ width: 360 }} value=${url} onChange=${e => setUrl(e.target.value)} placeholder="wss://..." />
        <${Button} type="primary" size="small" onClick=${connect}>${sock.current ? '断开' : '连接'}</${Button}>
        <${Button} size="small" onClick=${() => setLog([])}>清空日志</${Button}>
      <//>
      <${Space} style=${{ width: '100%', marginBottom: 8 }} direction="vertical">
        <${TextArea} rows="2" value=${msg} onChange=${e => setMsg(e.target.value)} placeholder="要发送的消息（支持多行）" />
        <${Button} size="small" type="primary" onClick=${sendMsg}>发送</${Button}>
      <//>
      <div className="ws-log">${log.map(l => html`<div key=${l.key} className="ws-line ws-${l.lvl}"><span className="ws-t">${l.t}</span> <b>${l.lvl === 'send' ? '↑ 发送' : '↓ 接收'}</b> <pre className="code-out" style=${{ display: 'inline', whiteSpace: 'pre-wrap' }}>${l.text}</pre></div>`)}</div>
    <//>`;
}

/* ============================================================
   14. 国密 SM2 / SM3 / SM4
   ============================================================ */
function GmMod(){
  const [tab, setTab] = useState('sm3');
  /* SM3 */
  const [s3in, setS3in] = useState(''); const [s3enc, setS3enc] = useState('Text'); const [s3out, setS3out] = useState('');
  const sm3run = () => {
    try{
      const bytes = s3enc === 'Hex' ? hexToBytes(s3in) : s3enc === 'Base64' ? b64ToU8(s3in) : new TextEncoder().encode(s3in);
      setS3out(SM3.hex(bytes));
    }catch(e){ message.error('SM3 失败：' + e.message); }
  };
  /* SM4 */
  const [s4, setS4] = useState({ mode: 'ECB', key: '', keyEnc: 'Hex', iv: '', ivEnc: 'Hex', plain: '', plainEnc: 'Text', cipher: '', outEnc: 'hex' });
  const s4run = isEnc => {
    try{
      const key = gmInputBytes(s4.key, s4.keyEnc);
      if(key.length !== 16) throw new Error('SM4 密钥必须为 16 字节（128 位），当前 ' + key.length + ' 字节');
      let iv = null;
      if(s4.mode === 'CBC'){ iv = gmInputBytes(s4.iv, s4.ivEnc); if(iv.length !== 16) throw new Error('SM4 IV 必须为 16 字节'); }
      if(isEnc){
        const plain = gmInputBytes(s4.plain, s4.plainEnc);
        const enc = s4.mode === 'CBC' ? SM4.cbc(key, iv, pkcs7Pad(plain), false) : SM4.ecb(key, pkcs7Pad(plain), false);
        const text = s4.outEnc === 'b64' ? bytesToB64(enc) : bytesToHex(enc);
        setS4({ ...s4, cipher: text }); message.success('SM4-' + s4.mode + ' 加密成功');
      } else {
        const t = s4.cipher.trim();
        const cipherEnc = /^[0-9a-fA-F\s]+$/.test(t) && t.length % 2 === 0 ? 'Hex' : 'Base64';
        const data = gmInputBytes(t, cipherEnc);
        if(data.length % 16) throw new Error('密文长度必须是 16 字节的整数倍');
        const dec = s4.mode === 'CBC' ? SM4.cbc(key, iv, data, true) : SM4.ecb(key, data, true);
        setS4({ ...s4, plain: new TextDecoder().decode(pkcs7Unpad(dec)), plainEnc: 'Text' }); message.success('SM4-' + s4.mode + ' 解密成功');
      }
    }catch(e){ message.error('SM4：' + e.message); }
  };
  /* SM2 */
  const [s2, setS2] = useState({ userId: '1234567812345678', priv: '', pub: '', msg: '', msgEnc: 'Text', sig: '', cipher: '', c104: true, out: '' });
  const s2msgBytes = () => s2.msgEnc === 'Hex' ? hexToBytes(s2.msg) : new TextEncoder().encode(s2.msg);
  const s2gen = () => {
    let d; do{ d = rand256() % SM2_N; }while(d <= 0n || d >= SM2_N);
    const P = ecMul(d, { x: SM2_GX, y: SM2_GY });
    setS2(s => ({ ...s, priv: gmBNToHex64(d), pub: gmPtToPubHex(P, true), out: '✅ 已生成密钥对' }));
  };
  const s2run = act => {
    try{
      if(act === 'sign'){
        const d = gmHexToBN(s2.priv);
        if(d <= 0n || d >= SM2_N) throw new Error('私钥超出范围 [1, n-1]');
        const sig = SM2.sign(d, new TextEncoder().encode(s2.userId || '1234567812345678'), s2msgBytes());
        const hex = gmBNToHex64(sig.r) + gmBNToHex64(sig.s);
        setS2(s => ({ ...s, sig: hex, out: '✅ 签名成功（r‖s，64 字节 Hex）' }));
      } else if(act === 'verify'){
        const P = gmPubHexToPt(s2.pub);
        const sigHex = s2.sig.replace(/[^0-9a-fA-F]/g, '');
        if(sigHex.length !== 128) throw new Error('签名应为 64 字节(128 hex)');
        const ok = SM2.verify(P.x, P.y, new TextEncoder().encode(s2.userId || '1234567812345678'), s2msgBytes(), gmHexToBN(sigHex.substr(0, 64)), gmHexToBN(sigHex.substr(64, 64)));
        setS2(s => ({ ...s, out: ok ? '✅ 验签通过' : '❌ 验签失败（签名/公钥/明文/UserId 不匹配）' }));
      } else if(act === 'enc'){
        const P = gmPubHexToPt(s2.pub);
        const ct = SM2.encrypt(P.x, P.y, s2msgBytes());
        const hex = bytesToHex(s2.c104 ? ct : ct.slice(1));
        setS2(s => ({ ...s, cipher: hex, out: '🔒 加密成功（C1C3C2' + (s2.c104 ? '，含 04 前缀' : '，无 04 前缀') + '）' }));
      } else if(act === 'dec'){
        const d = gmHexToBN(s2.priv);
        if(d <= 0n || d >= SM2_N) throw new Error('私钥超出范围 [1, n-1]');
        const dec = SM2.decrypt(d, hexToBytes(s2.cipher));
        if(!dec) throw new Error('解密失败：C3 校验不通过（密钥或密文不正确）');
        setS2(s => ({ ...s, msg: s.msgEnc === 'Hex' ? bytesToHex(dec) : new TextDecoder().decode(dec), out: '🔓 解密成功' }));
      }
    }catch(e){ setS2(s => ({ ...s, out: '❌ ' + e.message })); }
  };
  const pre = s2.out.startsWith('❌');
  return html`
    <${Card} title="🔏 国密 SM2 / SM3 / SM4（纯 JS，GB/T 32918，C1C3C2）">
      <${Tabs} activeKey=${tab} onChange=${setTab} items=${[
        { key: 'sm3', label: 'SM3 哈希', children: html`
          <${Space} style=${{ width: '100%' }} direction="vertical">
            <${Space}><${Select} value=${s3enc} onChange=${setS3enc} style=${{ width: 110 }} options=${['Text', 'Hex', 'Base64'].map(v => ({ value: v, label: '输入：' + v }))} /><${Button} type="primary" size="small" onClick=${sm3run}>计算</${Button}>${s3out && html`<${Button} size="small" onClick=${() => copyText(s3out)}>复制</${Button}>`}</${Space}>
            <${TextArea} rows="3" value=${s3in} onChange=${e => setS3in(e.target.value)} placeholder="输入内容" />
            <${TextArea} rows="2" value=${s3out} readOnly placeholder="SM3 摘要（64 位 Hex）" />
          <//>` },
        { key: 'sm4', label: 'SM4 加解密', children: html`
          <${Space} style=${{ width: '100%' }} direction="vertical">
            <${Space} wrap>
              <${Select} value=${s4.mode} onChange=${v => setS4({ ...s4, mode: v })} style=${{ width: 100 }} options=${['ECB', 'CBC'].map(v => ({ value: v, label: v }))} />
              <${Input} style=${{ width: 320 }} value=${s4.key} onChange=${e => setS4({ ...s4, key: e.target.value })} placeholder="密钥（16 字节）" addonBefore=${'Key(' + s4.keyEnc + ')'} />
              <${Select} value=${s4.keyEnc} onChange=${v => setS4({ ...s4, keyEnc: v })} style=${{ width: 100 }} options=${['Hex', 'Base64', 'Text'].map(v => ({ value: v, label: v }))} />
            </${Space}>
            ${s4.mode === 'CBC' && html`<${Space} wrap><${Input} style=${{ width: 320 }} value=${s4.iv} onChange=${e => setS4({ ...s4, iv: e.target.value })} placeholder="IV（16 字节）" addonBefore="IV" /><${Select} value=${s4.ivEnc} onChange=${v => setS4({ ...s4, ivEnc: v })} style=${{ width: 100 }} options=${['Hex', 'Base64', 'Text'].map(v => ({ value: v, label: v }))} /></${Space}>`}
            <${TextArea} rows="3" value=${s4.plain} onChange=${e => setS4({ ...s4, plain: e.target.value })} placeholder="明文（PKCS7 自动填充）" />
            <${Space} wrap>
              <${Button} size="small" type="primary" onClick=${() => s4run(true)}>🔒 加密</${Button}>
              <${Button} size="small" onClick=${() => s4run(false)}>🔓 解密</${Button}>
              <${Select} value=${s4.outEnc} onChange=${v => setS4({ ...s4, outEnc: v })} style=${{ width: 130 }} options=${[{ value: 'hex', label: '密文输出 Hex' }, { value: 'b64', label: '密文输出 Base64' }]} />
            </${Space}>
            <${TextArea} rows="3" value=${s4.cipher} onChange=${e => setS4({ ...s4, cipher: e.target.value })} placeholder="密文" />
          <//>` },
        { key: 'sm2', label: 'SM2 签名 / 加解密', children: html`
          <${Space} style=${{ width: '100%' }} direction="vertical">
            <${Space} wrap>
              <${Button} size="small" type="primary" onClick=${s2gen}>生成密钥对</${Button}>
              <${Input} style=${{ width: 220 }} value=${s2.userId} onChange=${e => setS2({ ...s2, userId: e.target.value })} placeholder="UserId（默认 1234567812345678）" />
            </${Space}>
            <${TextArea} rows="1" value=${s2.priv} onChange=${e => setS2({ ...s2, priv: e.target.value })} placeholder="私钥（32 字节 Hex）" />
            <${TextArea} rows="1" value=${s2.pub} onChange=${e => setS2({ ...s2, pub: e.target.value })} placeholder="公钥（64/65 字节 Hex）" />
            <${Space} wrap>
              <${Select} value=${s2.msgEnc} onChange=${v => setS2({ ...s2, msgEnc: v })} style=${{ width: 110 }} options=${['Text', 'Hex'].map(v => ({ value: v, label: '消息：' + v }))} />
              <${Checkbox} checked=${s2.c104} onChange=${e => setS2({ ...s2, c104: e.target.checked })}>密文含 04 前缀</${Checkbox}>
            </${Space}>
            <${TextArea} rows="2" value=${s2.msg} onChange=${e => setS2({ ...s2, msg: e.target.value })} placeholder="消息" />
            <${Space} wrap>
              <${Button} size="small" type="primary" onClick=${() => s2run('sign')}>签名</${Button}>
              <${Button} size="small" onClick=${() => s2run('verify')}>验签</${Button}>
              <${Button} size="small" type="primary" onClick=${() => s2run('enc')}>🔒 加密</${Button}>
              <${Button} size="small" onClick=${() => s2run('dec')}>🔓 解密</${Button}>
            </${Space}>
            <${TextArea} rows="1" value=${s2.sig} onChange=${e => setS2({ ...s2, sig: e.target.value })} placeholder="签名（r‖s，128 hex）" />
            <${TextArea} rows="2" value=${s2.cipher} onChange=${e => setS2({ ...s2, cipher: e.target.value })} placeholder="密文（C1C3C2 Hex）" />
            ${s2.out && html`<${Alert} type=${pre ? 'error' : 'success'} showIcon message=${s2.out} />`}
          <//>` }
      ]} />
    <//>`;
}

/* ============================================================
   15. 请求集合（Postman 式，localStorage: dsk-coll，与 v1 数据互通）
   ============================================================ */
function CollMod(){
  const [list, setList] = useState(() => LS.get('dsk-coll', []));
  const [cur, setCur] = useState({ name: '', project: '', method: 'GET', url: '', headers: '', body: '' });
  const [editIdx, setEditIdx] = useState(-1);
  const [curlOpen, setCurlOpen] = useState(false);
  const [curlText, setCurlText] = useState('');
  const [res, setRes] = useState(null);
  const reload = () => setList(LS.get('dsk-coll', []));
  const loadInto = r => { setEditIdx(-1); setCur({ name: r.name || '', project: r.project || '', method: r.method || 'GET', url: r.url || '', headers: (r.headers || []).map(h => h.k + ': ' + h.v).join('\n'), body: r.body || '' }); setRes(null); };
  const save = () => {
    if(!cur.url.trim()){ message.warning('请填写 URL'); return; }
    const l = LS.get('dsk-coll', []);
    const rec = { id: editIdx >= 0 ? l[editIdx].id : Date.now(), name: cur.name.trim() || cur.url, project: cur.project.trim() || '默认', method: cur.method, url: cur.url.trim(), headers: headersTextToPairs(cur.headers), body: cur.body };
    if(editIdx >= 0) l[editIdx] = rec; else l.unshift(rec);
    LS.set('dsk-coll', l); reload(); setEditIdx(-1); message.success('已保存');
  };
  const del = i => { const l = LS.get('dsk-coll', []); l.splice(i, 1); LS.set('dsk-coll', l); reload(); message.success('已删除'); };
  const importCurl = () => {
    try{
      const r = parseCurl(tokenizeCurl(curlText));
      if(!r || !r.url) throw new Error('未解析到 URL');
      setEditIdx(-1);
      setCur({ name: r.url.slice(0, 60), project: '', method: (r.method || 'GET').toUpperCase(), url: r.url, headers: (r.headers || []).join('\n'), body: r.data || '' });
      setCurlOpen(false); setCurlText(''); message.success('cURL 已导入编辑区，请保存');
    }catch(e){ message.error('解析失败：' + e.message); }
  };
  const toCurl = r => {
    let s = "curl -X " + r.method + " '" + r.url + "'";
    (r.headers || []).forEach(h => { s += " \\\n  -H '" + h.k + ': ' + h.v + "'"; });
    if(r.body) s += " \\\n  --data-raw '" + r.body.replace(/'/g, "'\\''") + "'";
    copyText(s);
  };
  const send = async r => { setRes({ loading: true, for: r.id }); const x = await fetchReq({ method: r.method, url: r.url, headers: (r.headers || []).map(h => h.k + ': ' + h.v), data: r.body }); setRes(x); };
  const groups = {};
  list.forEach((r, i) => { (groups[r.project || '默认'] = groups[r.project || '默认'] || []).push({ ...r, idx: i }); });
  return html`
    <${Card} title="📚 请求集合（与 v1 数据互通）" extra=${html`<${Space}>
      <${Button} size="small" onClick=${() => { setEditIdx(-1); setCur({ name: '', project: '', method: 'GET', url: '', headers: '', body: '' }); }}>＋ 新建</${Button}>
      <${Button} size="small" type="primary" onClick=${save}>保存</${Button}>
      <${Button} size="small" onClick=${() => setCurlOpen(true)}>从 cURL 导入</${Button}>
    <//>`}>
      <${Row} gutter=${12}>
        <${Col} span=${10}>
          ${!list.length && html`<p style=${{ color: '#999' }}>暂无保存的请求。</p>`}
          ${Object.keys(groups).map(g => html`<div key=${g}>
            <p style=${{ margin: '8px 0 4px', fontWeight: 600, fontSize: 12 }}>📁 ${g} (${groups[g].length})</p>
            ${groups[g].map(r => html`<div key=${r.id} style=${{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6, cursor: 'pointer', background: '#f5f5f5', marginBottom: 4 }} onClick=${() => loadInto(r)}>
              <${Tag} color=${r.method === 'GET' ? 'green' : r.method === 'POST' ? 'orange' : 'red'} style=${{ margin: 0 }}>${r.method}</>
              <span style=${{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title=${r.url}>${r.name}</span>
              <${Button} size="small" type="text" onClick=${e => { e.stopPropagation(); send(r); }}>▶</${Button}>
              <${Button} size="small" type="text" onClick=${e => { e.stopPropagation(); toCurl(r); }}>cURL</${Button}>
              <${Button} size="small" type="text" danger onClick=${e => { e.stopPropagation(); del(r.idx); }}>✕</${Button}>
            </div>`)}
          <//>`)}
        </${Col}>
        <${Col} span=${14}>
          <${Space} style=${{ width: '100%' }} direction="vertical">
            <${Space} wrap>
              <${Select} value=${cur.method} onChange=${v => setCur({ ...cur, method: v })} style=${{ width: 100 }} options=${['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => ({ value: m, label: m }))} />
              <${Input} style=${{ width: 160 }} value=${cur.name} onChange=${e => setCur({ ...cur, name: e.target.value })} placeholder="名称" />
              <${Input} style=${{ width: 120 }} value=${cur.project} onChange=${e => setCur({ ...cur, project: e.target.value })} placeholder="项目分组" />
            </${Space}>
            <${Input} value=${cur.url} onChange=${e => setCur({ ...cur, url: e.target.value })} placeholder="URL" />
            <${TextArea} rows="4" value=${cur.headers} onChange=${e => setCur({ ...cur, headers: e.target.value })} placeholder="请求头，每行 Key: Value" />
            <${TextArea} rows="3" value=${cur.body} onChange=${e => setCur({ ...cur, body: e.target.value })} placeholder="请求体" />
          <//>
          <${Divider} plain style=${{ fontSize: 12 }}>重放结果</${Divider}>
          <${StatusLine} res=${res && !res.loading && res.for === undefined ? res : res} />
          ${res && res.ok && html`<pre className="code-out">${prettyAuto(res.text)}</pre>`}
        </${Col}>
      <//>
      <${Modal} title="从 cURL 导入" open=${curlOpen} onOk=${importCurl} onCancel=${() => setCurlOpen(false)} width=${640}>
        <${TextArea} rows="10" value=${curlText} onChange=${e => setCurlText(e.target.value)} placeholder="粘贴 DevTools → Copy as cURL 内容" />
      <//>
    <//>`;
}

/* ============================================================
   16. SSE 调试台
   ============================================================ */
function SseMod(){
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState('es');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [reconn, setReconn] = useState(false);
  const [st, setSt] = useState('未连接');
  const [log, setLog] = useState([]);
  const ref = useRef({ es: null, ac: null, id: 0, count: 0, manual: false });
  const push = (lvl, text) => setLog(l => [{ key: ++ref.current.id, lvl, text, t: moment().format('HH:mm:ss.SSS') }, ...l].slice(0, 1000));
  const stop = () => {
    ref.current.manual = true;
    if(ref.current.es){ ref.current.es.close(); ref.current.es = null; }
    if(ref.current.ac){ ref.current.ac.abort(); ref.current.ac = null; }
    setSt('未连接');
  };
  const connect = () => {
    if(ref.current.es || ref.current.ac) stop();
    ref.current.manual = false; ref.current.count = 0;
    if(mode === 'es'){
      try{
        const es = new EventSource(envResolve(url));
        ref.current.es = es;
        es.onopen = () => setSt('已连接');
        es.onmessage = e => { ref.current.count++; push('data', (e.event ? '[event:' + e.event + '] ' : '') + e.data); };
        es.addEventListener('message', e => {});
        es.onerror = () => { if(!ref.current.manual){ setSt('连接中断' + (es.readyState === 0 ? '（自动重连中）' : '')); if(!reconn && es.readyState !== 0) stop(); } };
        setSt('连接中…');
      }catch(e){ message.error('连接失败：' + e.message); }
    } else {
      (async () => {
        const ac = new AbortController(); ref.current.ac = ac;
        try{
          const r = await fetch(envResolve(url), {
            method: 'GET', headers: headersTextToPairs(headers).reduce((o, h) => (o[h.k] = h.v, o), {}), signal: ac.signal
          });
          setSt('已连接（HTTP ' + r.status + '）');
          const reader = r.body.getReader();
          const dec = new TextDecoder();
          let buf = '';
          while(true){
            const { done, value } = await reader.read();
            if(done) break;
            buf += dec.decode(value, { stream: true });
            const blocks = buf.split('\n\n');
            buf = blocks.pop();
            blocks.forEach(b => {
              const lines = b.split('\n'); let evt = 'message', data = [];
              lines.forEach(l => {
                if(l.startsWith('event:')) evt = l.slice(6).trim();
                else if(l.startsWith('data:')) data.push(l.slice(5).trim());
                else if(l.startsWith('id:')) push('meta', 'id: ' + l.slice(3).trim());
                else if(l.startsWith('retry:')) push('meta', 'retry: ' + l.slice(6).trim());
              });
              if(data.length){ ref.current.count++; push('data', (evt !== 'message' ? '[event:' + evt + '] ' : '') + data.join('\n')); }
            });
          }
          if(!ref.current.manual) setSt('流结束');
        }catch(e){ if(e.name !== 'AbortError' && !ref.current.manual) setSt('错误：' + e.message); }
      })();
    }
  };
  useEffect(() => () => { ref.current.manual = true; if(ref.current.es) ref.current.es.close(); if(ref.current.ac) ref.current.ac.abort(); }, []);
  return html`
    <${Card} title="🌊 SSE 调试台" extra=${html`<${Tag} color=${st.startsWith('已连接') ? 'green' : st.startsWith('错误') ? 'red' : 'default'}>${st}</>`}>
      <${Space} style=${{ width: '100%', marginBottom: 8 }} direction="vertical">
        <${Space} wrap>
          <${Select} value=${mode} onChange=${setMode} style=${{ width: 220 }} options=${[{ value: 'es', label: 'EventSource（GET，自动重连）' }, { value: 'fetch', label: 'fetch 流（自定义头/体）' }]} />
          <${Checkbox} checked=${reconn} onChange=${e => setReconn(e.target.checked)} disabled=${mode === 'fetch'}>断开自动重连</${Checkbox}>
        </${Space}>
        <${Input} value=${url} onChange=${e => setUrl(e.target.value)} placeholder="https://example.com/stream" />
        ${mode === 'fetch' && html`<${TextArea} rows="2" value=${headers} onChange=${e => setHeaders(e.target.value)} placeholder="自定义请求头（每行 Key: Value）" />`}
        <${Space}>
          <${Button} type="primary" size="small" onClick=${connect}>连接</${Button}>
          <${Button} size="small" onClick=${stop}>断开</${Button}>
          <${Button} size="small" onClick=${() => setLog([])}>清空</${Button}>
          <span style=${{ fontSize: 12, color: '#999' }}>已接收 ${ref.current.count} 条</span>
        </${Space}>
      <//>
      <div className="ws-log">${log.map(l => html`<div key=${l.key} className="ws-line"><span className="ws-t">${l.t}</span> <${Tag} style=${{ margin: 0 }} color=${l.lvl === 'data' ? 'blue' : 'default'}>${l.lvl}</> <span style=${{ whiteSpace: 'pre-wrap' }}>${l.text}</span></div>`)}</div>
    <//>`;
}

/* ============================================================
   17. 凭证泄露扫描
   ============================================================ */
function SecretMod(){
  const [inp, setInp] = useState('');
  const [rows, setRows] = useState(null);
  const run = () => {
    const out = [];
    SEC_RULES.forEach(r => {
      r.re.lastIndex = 0;
      let m;
      while((m = r.re.exec(inp))){
        const val = m[r.grp || 0];
        out.push({ key: out.length, rule: r.name, sev: r.sev, line: secLineOf(inp, m.index), val: maskHit(val) });
        if(m.index === r.re.lastIndex) r.re.lastIndex++;
      }
    });
    const seen = new Set(out.map(o => o.line + o.val));
    const tokRe = /[A-Za-z0-9_\-=+/]{20,}/g;
    let m;
    while((m = tokRe.exec(inp))){
      const e = secEntropy(m[0]);
      if(e > 4.0){
        const key = 'line' + m.index;
        if(!seen.has(key)){ seen.add(key); out.push({ key: out.length, rule: '高熵疑似密钥（entropy=' + e.toFixed(1) + '）', sev: 'Medium', line: secLineOf(inp, m.index), val: maskHit(m[0]) }); }
      }
    }
    setRows(out);
    message[out.length ? 'warning' : 'success'](out.length ? '发现 ' + out.length + ' 处疑似泄露' : '未发现泄露');
  };
  return html`
    <${Card} title="🕵️ 凭证泄露扫描" extra=${html`<${Button} type="primary" size="small" onClick=${run}>扫描</${Button}>`}>
      <${TextArea} rows="10" value=${inp} onChange=${e => setInp(e.target.value)} placeholder="粘贴代码 / 日志 / 配置，扫描 AK/SK、token、私钥、JWT、高熵密钥" />
      ${rows && html`<div style=${{ marginTop: 12 }}>
        <${Table} size="small" pagination=${{ pageSize: 10 }} dataSource=${rows}
          columns=${[
            { title: '规则', dataIndex: 'rule' },
            { title: '级别', dataIndex: 'sev', width: 80, render: s => html`<${Tag} color=${s === 'High' ? 'red' : 'orange'}>${s}</>` },
            { title: '行', dataIndex: 'line', width: 60 },
            { title: '内容（已脱敏）', dataIndex: 'val', render: v => html`<code>${v}</code>` }
          ]} />
      <//>`}
    <//>`;
}

/* ============================================================
   18. 文件 Base64 & multipart
   ============================================================ */
function B64Mod(){
  const [file, setFile] = useState(null);
  const [inB64, setInB64] = useState('');
  const [mp, setMp] = useState({ url: 'https://api.example.com/upload', fields: [], res: '' });
  const readFile = f => {
    const r = new FileReader();
    r.onload = () => setFile({ name: f.name, size: f.size, mime: f.type || 'application/octet-stream', dataUrl: r.result });
    r.readAsDataURL(f);
  };
  const addField = t => setMp({ ...mp, fields: [...mp.fields, { id: Date.now() + Math.random(), type: t, name: '', value: '' }] });
  const genCurl = () => {
    let s = "curl -X POST '" + mp.url + "'";
    mp.fields.forEach(f => { s += f.type === 'file' ? " \\\n  -F '" + (f.name || 'file') + "=@" + (f.value || '文件路径') + "'" : " \\\n  -F '" + (f.name || 'field') + "=" + (f.value || '') + "'"; });
    return s;
  };
  const genFetch = () => {
    const lines = mp.fields.map(f => f.type === 'file'
      ? "fd.append(" + JSON.stringify(f.name || 'file') + ", document.querySelector('input[name=" + JSON.stringify(f.value || f.name || 'file') + "]').files[0]);"
      : "fd.append(" + JSON.stringify(f.name || 'field') + ", " + JSON.stringify(f.value) + ");");
    return "const fd = new FormData();\n" + lines.join('\n') + "\nconst r = await fetch(" + JSON.stringify(mp.url) + ", { method: 'POST', body: fd });\nconsole.log('[api:result]', await r.text());";
  };
  const sendMultipart = async () => {
    const fd = new FormData();
    mp.fields.forEach(f => fd.append(f.name || (f.type === 'file' ? 'file' : 'field'), f.type === 'file' ? f.file : f.value));
    try{
      const t0 = performance.now();
      const r = await fetch(envResolve(mp.url), { method: 'POST', body: fd });
      setMp({ ...mp, res: 'HTTP ' + r.status + '（' + Math.round(performance.now() - t0) + ' ms）\n' + await r.text() });
    }catch(e){ setMp({ ...mp, res: '❌ ' + e.message }); }
  };
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2, 14);
  const rawPreview = mp.fields.filter(f => f.type === 'text').map(f => '--' + boundary + '\nContent-Disposition: form-data; name="' + (f.name || 'field') + '"\n\n' + f.value).join('\n');
  return html`
    <${Card} title="📎 文件 Base64 & multipart">
      <${Tabs} items=${[
        { key: 'f2b', label: '文件 → Base64', children: html`
          <${Space} direction="vertical" style=${{ width: '100%' }}>
            <${Space}>
              <${Upload} beforeUpload=${f => { readFile(f); return false; }} showUploadList=${false} maxCount=${1}>
                <${Button} size="small" type="primary">选择文件</${Button}>
              </${Upload}>
              ${file && html`<span style=${{ fontSize: 12, color: '#666' }}>${file.name}（${(file.size / 1024).toFixed(1)} KB，${file.mime}）</span>`}
            </${Space}>
            ${file && file.mime.startsWith('image/') && html`<img src=${file.dataUrl} style=${{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid #eee' }} />`}
            ${file && html`<${Space}>
              <${Button} size="small" onClick=${() => copyText(file.dataUrl.split(',')[1])}>复制纯 Base64</${Button}>
              <${Button} size="small" onClick=${() => copyText(file.dataUrl)}>复制 Data URL</${Button}>
              <${Button} size="small" onClick=${() => { const a = document.createElement('a'); a.href = file.dataUrl; a.download = file.name; a.click(); }}>下载原文件</${Button}>
            </${Space}>`}
            ${file && html`<${TextArea} rows="5" readOnly value=${file.dataUrl} />`}
          <//>` },
        { key: 'b2f', label: 'Base64 → 文件', children: html`
          <${Space} direction="vertical" style=${{ width: '100%' }}>
            <${TextArea} rows="6" value=${inB64} onChange=${e => setInB64(e.target.value)} placeholder="粘贴 Data URL（data:image/png;base64,...）或纯 Base64" />
            <${Button} size="small" type="primary" onClick=${() => {
              try{
                const t = inB64.trim();
                const m = t.match(/^data:([^;]+);base64,(.*)$/s);
                const mime = m ? m[1] : 'application/octet-stream';
                const b64 = m ? m[2] : t;
                const u8 = b64ToU8(b64);
                const ext = (mime.split('/')[1] || 'bin').split(';')[0];
                download('download.' + ext, new Blob([u8], { type: mime }));
                message.success('已按 ' + mime + ' 生成下载');
              }catch(e){ message.error('解析失败：' + e.message); }
            }}>解码并下载</${Button}>
          <//>` },
        { key: 'mp', label: 'multipart/form-data 构造', children: html`
          <${Space} direction="vertical" style=${{ width: '100%' }}>
            <${Input} value=${mp.url} onChange=${e => setMp({ ...mp, url: e.target.value })} placeholder="上传接口 URL" />
            <${Space}>
              <${Button} size="small" onClick=${() => addField('text')}>＋ 文本字段</${Button}>
              <${Button} size="small" onClick=${() => addField('file')}>＋ 文件字段</${Button}>
              <${Button} size="small" type="primary" onClick=${sendMultipart}>🚀 直接上传</${Button}>
            </${Space}>
            ${mp.fields.map(f => html`<${Space} key=${f.id} wrap>
              <${Tag} color=${f.type === 'file' ? 'orange' : 'blue'}>${f.type === 'file' ? '文件' : '文本'}</>
              <${Input} style=${{ width: 140 }} placeholder="字段名" value=${f.name} onChange=${e => setMp({ ...mp, fields: mp.fields.map(x => x.id === f.id ? { ...x, name: e.target.value } : x) })} />
              ${f.type === 'text'
                ? html`<${Input} style=${{ width: 260 }} placeholder="字段值" value=${f.value} onChange=${e => setMp({ ...mp, fields: mp.fields.map(x => x.id === f.id ? { ...x, value: e.target.value } : x) })} />`
                : html`<${Upload} beforeUpload=${file => { setMp({ ...mp, fields: mp.fields.map(x => x.id === f.id ? { ...x, value: file.name, file } : x) }); return false; }} showUploadList=${false} maxCount=${1}><${Button} size="small">${f.value || '选择文件'}</${Button}></${Upload}>`}
              <${Button} size="small" type="text" danger onClick=${() => setMp({ ...mp, fields: mp.fields.filter(x => x.id !== f.id) })}>✕</${Button}>
            </${Space}>`)}
            ${mp.fields.length ? html`<div>
              <p style=${{ margin: '6px 0 4px', fontSize: 12, color: '#666' }}>原始请求体结构（boundary: ${boundary}，二进制字段以占位展示）</p>
              <pre className="code-out">${rawPreview}${mp.fields.some(f => f.type === 'file') ? '\n--' + boundary + '\nContent-Disposition: form-data; name="文件字段"; filename="..."\nContent-Type: ...\n\n(二进制内容)' : ''}\n--${boundary}--</pre>
            </div>` : null}
            <${Space}>
              <${Button} size="small" onClick=${() => copyText(genFetch())}>复制 fetch 代码</${Button}>
              <${Button} size="small" onClick=${() => copyText(genCurl())}>复制 cURL -F</${Button}>
            </${Space}>
            ${mp.res && html`<pre className="code-out">${mp.res}</pre>`}
          <//>` }
      ]} />
    <//>`;
}

/* ============================================================
   19. Cookie / 请求头解析
   ============================================================ */
function HdrsMod(){
  const [inp, setInp] = useState('');
  const rows = useMemo(() => { try{ return hdrsParse(inp).map((r, i) => ({ ...r, key: i })); }catch(e){ return []; } }, [inp]);
  const expJson = () => JSON.stringify(Object.fromEntries(rows.map(r => [r.k, r.v])), null, 2);
  const expJs = () => 'const headers = ' + JSON.stringify(Object.fromEntries(rows.map(r => [r.k, r.v])), null, 2) + ';';
  const expCurl = () => rows.map(r => "-H '" + r.k + ': ' + r.v + "'").join(' \\\n  ');
  return html`
    <${Card} title="🍪 Cookie / 请求头解析">
      <${TextArea} rows="8" value=${inp} onChange=${e => setInp(e.target.value)} placeholder="粘贴 Cookie 串（k=v; k2=v2）或 DevTools 请求头 dump（每行 Key: Value，Cookie: 行自动展开）" />
      ${rows.length > 0 && html`<div style=${{ marginTop: 10 }}>
        <p>解析出 <b>${rows.length}</b> 条（header ${rows.filter(r => r.kind === 'header').length} / cookie ${rows.filter(r => r.kind === 'cookie').length}）</p>
        <${Table} size="small" pagination=${{ pageSize: 12 }} dataSource=${rows}
          columns=${[
            { title: 'Key', dataIndex: 'k', width: '30%', render: k => html`<code>${k}</code>` },
            { title: 'Value', dataIndex: 'v', ellipsis: true, render: v => html`<code>${v}</code>` },
            { title: '类型', dataIndex: 'kind', width: 80, render: k => html`<${Tag} color=${k === 'cookie' ? 'gold' : 'blue'}>${k}</>` }
          ]} />
        <${Space} wrap style=${{ marginTop: 10 }}>
          <${Button} size="small" onClick=${() => copyText(expJson())}>复制 JSON</${Button}>
          <${Button} size="small" onClick=${() => copyText(expJs())}>复制 JS 对象</${Button}>
          <${Button} size="small" onClick=${() => copyText(expCurl())}>复制 cURL -H</${Button}>
          <${Button} size="small" onClick=${() => download('headers.json', expJson(), 'application/json')}>下载 JSON</${Button}>
        </${Space}>
      <//>`}
    <//>`;
}

/* ============================================================
   20. JS 控制台（F12 式）
   ============================================================ */
function consoleRun(code, cb){
  const orig = { log: console.log.bind(console), info: console.info.bind(console), warn: console.warn.bind(console), error: console.error.bind(console) };
  const entries = [];
  ['log', 'info', 'warn', 'error'].forEach(lv => {
    console[lv] = (...a) => { entries.push({ lvl: lv, text: a.map(x => consoleFmtArg(x)).join(' ') }); orig[lv](...a); };
  });
  const restore = () => { console.log = orig.log; console.info = orig.info; console.warn = orig.warn; console.error = orig.error; };
  const finish = extra => { restore(); cb({ entries, extra }); };
  try{
    const fn = new Function('return (async () => {\n' + consoleWrapLastExpr(code) + '\n})();');
    Promise.resolve(fn()).then(v => finish({ returnVal: v })).catch(e => finish({ error: e }));
  }catch(e){ finish({ error: e }); }
}
function ConsoleMod(){
  const [code, setCode] = useState('');
  const [entries, setEntries] = useState([]);
  const idRef = useRef(0);
  const run = () => {
    if(!code.trim()) return;
    consoleRun(code, ({ entries: es, extra }) => {
      const all = es.map(e => ({ ...e, key: ++idRef.current }));
      if(extra){
        if(extra.error !== undefined && extra.error !== null){
          const e = extra.error instanceof Error ? extra.error : new Error(String(extra.error));
          all.push({ key: ++idRef.current, lvl: 'error', text: e.stack || (e.name + ': ' + e.message) });
        } else if(extra.returnVal !== undefined){
          all.push({ key: ++idRef.current, lvl: 'ret', text: '↩ ' + consoleFmtArg(extra.returnVal) });
        }
      }
      setEntries(l => [...l, ...all].slice(-500));
    });
  };
  const example = `const r = await fetch('https://httpbin.org/get');\nconst j = await r.json();\nconsole.log('headers:', j.headers);\nj.origin;`;
  return html`
    <${Card} title="🖥️ JS 控制台（F12 式）" extra=${html`<${Space}>
      <${Button} type="primary" size="small" onClick=${run}>▶ 运行（末行表达式自动返回）</${Button}>
      <${Button} size="small" onClick=${() => setCode(example)}>填充示例</${Button}>
      <${Button} size="small" onClick=${() => setEntries([])}>清空</${Button}>
    <//>`}>
      <${TextArea} rows="7" value=${code} onChange=${e => setCode(e.target.value)}
        onKeyDown=${e => { if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){ e.preventDefault(); run(); } }}
        placeholder="支持 top-level await / 循环引用安全 / console.log 捕获\nCtrl(⌘)+Enter 运行" />
      <div className="ws-log" style=${{ marginTop: 10 }}>
        ${entries.map(en => html`<div key=${en.key} className="ws-line" style=${{ color: en.lvl === 'error' ? '#cf1322' : en.lvl === 'warn' ? '#d46b08' : en.lvl === 'info' ? '#1668dc' : en.lvl === 'ret' ? '#722ed1' : 'inherit' }}>
          <span className="ws-t">${en.lvl === 'error' ? '⛔' : en.lvl === 'warn' ? '⚠' : en.lvl === 'info' ? 'ℹ' : en.lvl === 'ret' ? '↩' : '›'}</span>
          <span style=${{ whiteSpace: 'pre-wrap' }}>${en.text}</span>
        </div>`)}
      </div>
    <//>`;
}

/* ============================================================
   应用外壳
   ============================================================ */
const MODS = [
  { k: 'curl',    icon: '🌀', label: 'cURL 转换器',      Comp: CurlMod },
  { k: 'json',    icon: '🧩', label: 'JSON 工具',        Comp: JsonMod },
  { k: 'logs',    icon: '📡', label: '接口日志解析',      Comp: LogsMod },
  { k: 'diff',    icon: '⚖️', label: 'JSON 对比',        Comp: DiffMod },
  { k: 'ts',      icon: '⏱️', label: '时间戳',           Comp: TsMod },
  { k: 'codec',   icon: '🔐', label: '编解码',           Comp: CodecMod },
  { k: 'jwt',     icon: '🎫', label: 'JWT 解析',         Comp: JwtMod },
  { k: 're',      icon: '🔍', label: '正则测试',          Comp: ReMod },
  { k: 'color',   icon: '🎨', label: '颜色工具',          Comp: ColorMod },
  { k: 'gen',     icon: '🎲', label: '生成器 & 单位换算', Comp: GenMod },
  { k: 'api',     icon: '🚀', label: 'API 调试台',       Comp: ApiMod },
  { k: 'aes',     icon: '🔒', label: 'AES 加解密',       Comp: AesMod },
  { k: 'ws',      icon: '🔌', label: 'WebSocket 调试台',  Comp: WsMod },
  { k: 'gm',      icon: '🔏', label: '国密 SM2/SM3/SM4',  Comp: GmMod },
  { k: 'coll',    icon: '📚', label: '请求集合',          Comp: CollMod },
  { k: 'sse',     icon: '🌊', label: 'SSE 调试台',        Comp: SseMod },
  { k: 'secret',  icon: '🕵️', label: '凭证泄露扫描',      Comp: SecretMod },
  { k: 'b64',     icon: '📎', label: '文件 Base64 & multipart', Comp: B64Mod },
  { k: 'hdrs',    icon: '🍪', label: 'Cookie/请求头解析', Comp: HdrsMod },
  { k: 'console', icon: '🖥️', label: 'JS 控制台',        Comp: ConsoleMod },
];
function App(){
  const [cur, setCur] = useState(() => localStorage.getItem('dsk2-cur') || 'curl');
  const [about, setAbout] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { localStorage.setItem('dsk2-cur', cur); }, [cur]);
  return html`
    <${Layout} style=${{ minHeight: '100vh' }}>
      <${Header} style=${{ background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', position: 'sticky', top: 0, zIndex: 100 }}>
        <span style=${{ fontSize: 17, fontWeight: 700, color: 'rgba(0,0,0,.85)' }}>🧰 前端百宝箱</span>
        <span style=${{ color: 'rgba(0,0,0,.45)', fontSize: 12 }}>v2.0 · antd 版 · 单文件 · 离线可用 · 数据不出浏览器</span>
        <span style=${{ flex: 1 }}></span>
        <${Button} size="small" onClick=${() => setAbout(true)}>关于</${Button}>
      <//>
      <${Layout}>
        <${Sider} theme="light" width=${210} collapsible collapsed=${collapsed} onCollapse=${setCollapsed} style=${{ position: 'sticky', top: 64, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
          <${Menu} theme="light" mode="inline" selectedKeys=${[cur]} onClick=${e => setCur(e.key)} style=${{ borderRight: 0, paddingBottom: 48 }}>
            ${MODS.map(m => html`<${Menu.Item} key=${m.k}>${m.icon}${collapsed ? '' : ' ' + m.label}<//>`)}
          <//>
        <//>
        <${Content} style=${{ padding: 16, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          ${MODS.map(m => html`<div key=${m.k} style=${{ display: m.k === cur ? 'block' : 'none' }}><${m.Comp} /></div>`)}
        <//>
      <//>
      <${Modal} title="关于 前端百宝箱" open=${about} onCancel=${() => setAbout(false)} footer=${html`<${Button} type="primary" onClick=${() => setAbout(false)}>好的</${Button}>`}>
        <p><b>前端百宝箱 v2.0（antd 版）</b></p>
        <p>React 17 + antd 4.24 UMD 内嵌，单文件、零构建、离线可用。</p>
        <p>20 个模块：cURL 转换/直执行、JSON 工具、日志解析、JSON 对比、时间戳、编解码、JWT、正则、颜色、生成器与 px/rem/vw、API 调试台、AES、WebSocket、国密 SM2/SM3/SM4（已交叉验证）、请求集合、SSE、凭证扫描、文件 Base64/multipart、请求头解析、JS 控制台。</p>
        <p>请求集合与环境变量（dsk-coll / dsk-env）与 v1 原生版互通。</p>
      <//>
    <//>`;
}
ReactDOM.render(html`<${App} />`, document.getElementById('root'));
