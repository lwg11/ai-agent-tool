/* ================= 1. cURL 转换器 ================= */
function tokenizeCurl(input){
  const s = input.replace(/\u547d\u4ee4|\r/g, '').replace(/\\\n\s*/g, ' ');
  const tokens = []; let i = 0; const n = s.length;
  const dbl = {n:'\n', t:'\t', r:'\r', '"':'"', '\\':'\\', "'":"'", '`':'`', '$':'$', ':':':'};
  while(i < n){
    if(/\s/.test(s[i])){ i++; continue; }
    let tok = '';
    while(i < n){
      const c = s[i];
      if(c === "'"){ i++; while(i < n && s[i] !== "'"){ tok += s[i]; i++; } if(i < n) i++; }
      else if(c === '$' && s[i+1] === "'"){
        i += 2;
        while(i < n && s[i] !== "'"){ if(s[i] === '\\' && i+1 < n){ tok += dbl[s[i+1]] || s[i+1]; i += 2; } else { tok += s[i]; i++; } }
        if(i < n) i++;
      }
      else if(c === '"'){
        i++;
        while(i < n && s[i] !== '"'){ if(s[i] === '\\' && i+1 < n){ tok += dbl[s[i+1]] || s[i+1]; i += 2; } else { tok += s[i]; i++; } }
        if(i < n) i++;
      }
      else if(c === '\\' && i + 1 < n){ tok += s[i+1]; i += 2; }
      else if(/\s/.test(c)){ break; }
      else { tok += c; i++; }
    }
    tokens.push(tok);
  }
  return tokens;
}
function parseCurl(tokens){
  const req = {url:'', method:'', headers:[], data:'', user:''};
  for(let k = 0; k < tokens.length; k++){
    const t = tokens[k];
    if(t === 'curl' || t === '') continue;
    if(t.startsWith('-')){
      switch(t){
        case '-H': case '--header': req.headers.push(tokens[++k] || ''); break;
        case '-X': case '--request': req.method = tokens[++k] || ''; break;
        case '-d': case '--data': case '--data-raw': case '--data-binary':
        case '--data-ascii': case '--data-urlencode': case '--json':
          req.data += tokens[++k] || ''; break;
        case '-F': case '--form': req.data += (req.data ? '&' : '') + (tokens[++k] || ''); req.form = true; break;
        case '-b': case '--cookie': req.headers.push('cookie: ' + (tokens[++k] || '')); break;
        case '-A': case '--user-agent': req.headers.push('user-agent: ' + (tokens[++k] || '')); break;
        case '-e': case '--referer': req.headers.push('referer: ' + (tokens[++k] || '')); break;
        case '-u': case '--user': req.user = tokens[++k] || ''; break;
        case '--url': req.url = tokens[++k] || ''; break;
        default:
          if(t.startsWith('--data=')) req.data += t.slice(7);
          else if(t.startsWith('--header=')) req.headers.push(t.slice(9));
          else if(t.startsWith('-H') && t.length > 2) req.headers.push(t.slice(2));
          else if(t.startsWith('--cookie=')) req.headers.push('cookie: ' + t.slice(9));
          else if(t.startsWith('--user-agent=')) req.headers.push('user-agent: ' + t.slice(13));
          break;
      }
    } else if(!req.url && /^https?:\/\//i.test(t)){
      req.url = t;
    }
  }
  if(!req.method) req.method = req.data ? 'POST' : 'GET';
  if(req.user) req.headers.push('authorization: Basic ' + btoa(req.user));
  if(req.data && !req.headers.some(h => /content-type\s*:/i.test(h)))
    req.headers.push('content-type: ' + (req.form ? 'multipart/form-data' : 'application/x-www-form-urlencoded'));
  return req;
}
function splitQuery(url){
  const idx = url.indexOf('?');
  if(idx < 0) return {base:url, params:[]};
  const base = url.slice(0, idx), qs = url.slice(idx + 1);
  const params = [];
  qs.split('&').forEach(kv => {
    if(!kv) return;
    const eq = kv.indexOf('=');
    params.push({k: eq < 0 ? kv : kv.slice(0, eq), v: eq < 0 ? '' : kv.slice(eq + 1)});
  });
  return {base, params};
}
const q1 = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
let curlReq = null, curlTab = 'fetch';

function genFetchCode(req, jsonBody){
  const L = [];
  L.push('const res = await fetch(' + q1(req.url) + ', {');
  L.push('  method: ' + q1(req.method.toUpperCase()) + ',');
  if(req.headers.length){
    L.push('  headers: {');
    req.headers.forEach(h => {
      const i = h.indexOf(':');
      L.push('    ' + q1(h.slice(0, i).trim()) + ': ' + q1(h.slice(i + 1).trim()) + ',');
    });
    L.push('  },');
  }
  if(req.data) L.push('  body: ' + bodyExpr(req.data, jsonBody) + ',');
  L.push('});');
  L.push('if (!res.ok) throw new Error(\'HTTP \' + res.status);');
  L.push('const data = await res.json();');
  L.push('console.log(\'[api:result]\', data);');
  return L.join('\n');
}
function genAxiosCode(req, jsonBody){
  const L = [];
  L.push('const { data } = await axios({');
  L.push('  url: ' + q1(req.url) + ',');
  L.push('  method: ' + q1(req.method.toLowerCase()) + ',');
  if(req.headers.length){
    L.push('  headers: {');
    req.headers.forEach(h => {
      const i = h.indexOf(':');
      L.push('    ' + q1(h.slice(0, i).trim()) + ': ' + q1(h.slice(i + 1).trim()) + ',');
    });
    L.push('  },');
  }
  if(req.data) L.push('  data: ' + bodyExpr(req.data, jsonBody) + ',');
  L.push('});');
  L.push('console.log(\'[api:result]\', data);');
  return L.join('\n');
}
function genConsoleCode(req, jsonBody){
  const h = req.headers.map(h => {
    const i = h.indexOf(':');
    return q1(h.slice(0, i).trim()) + ':' + q1(h.slice(i + 1).trim());
  }).join(',');
  let s = 'fetch(' + q1(req.url) + ',{method:' + q1(req.method.toUpperCase());
  if(req.headers.length) s += ',headers:{' + h + '}';
  if(req.data) s += ',body:' + bodyExpr(req.data, jsonBody);
  s += '}).then(function(r){return r.json()}).then(function(d){console.log(\'[api:result]\', d)}).catch(function(e){console.error(\'[api:error]\', e)});';
  return s;
}
function bodyExpr(body, jsonBody){
  if(jsonBody){
    try{ return 'JSON.stringify(' + JSON.stringify(JSON.parse(body), null, 2) + ')'; }
    catch(e){ /* 落到普通字符串 */ }
  }
  return q1(body);
}