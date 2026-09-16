function consoleFmtArg(a){
  if(typeof a === 'string') return a;
  if(a instanceof Error) return a.stack || (a.name + ': ' + a.message);
  if(typeof a === 'undefined') return 'undefined';
  if(typeof a === 'function') return a.toString();
  if(typeof a === 'object' && a !== null){
    try{ return JSON.stringify(a, getCircularReplacer(), 2); }catch(e){ return String(a); }
  }
  return String(a);
}
function getCircularReplacer(){
  const seen = new WeakSet();
  return (k, v) => {
    if(typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
    if(typeof v === 'object' && v !== null){
      if(seen.has(v)) return '[Circular]';
      seen.add(v);
    }
    return v;
  };
}
/* 把末尾表达式当成返回值（REPL 风格：块体函数不会自动返回最后一行） */
function consoleWrapLastExpr(code){
  const lines = code.split('\n');
  let lastIdx = lines.length - 1;
  while(lastIdx >= 0 && lines[lastIdx].trim() === '') lastIdx--;
  if(lastIdx < 0) return code;
  const raw = lines[lastIdx].trim();
  if(/^(\/\/|\/\*)/.test(raw)) return code;
  if(/^[{[]/.test(raw)) return code;
  // 取该行末尾最后一个非空分号分段作为候选返回值
  const parts = raw.split(';');
  let li = parts.length - 1;
  while(li >= 0 && parts[li].trim() === '') li--;
  if(li < 0) return code;
  const lastSeg = parts[li].trim();
  if(/^(const|let|var|function|return|if|for|while|do|switch|class|throw|try|break|continue|import|export|debugger|yield)\b/.test(lastSeg)) return code;
  const expr = lastSeg.replace(/\/\/.*$/, '').trim();
  if(!expr) return code;
  const head = parts.slice(0, li).join(';');
  const newLine = head.trim() === '' ? 'return (' + expr + ');' : head + '; return (' + expr + ');';
  lines[lastIdx] = newLine;
  return lines.join('\n');
}
function consoleRender(logs, extra){
  const out = $('#consoleOut');
  out.classList.remove('empty');
  let html = out.innerHTML;
  logs.forEach(l => {
    const cls = l.lvl === 'error' ? 'c-err' : l.lvl === 'warn' ? 'c-warn' : l.lvl === 'info' ? 'c-info' : 'c-log';
    const tag = l.lvl === 'error' ? '⛔' : l.lvl === 'warn' ? '⚠' : l.lvl === 'info' ? 'ℹ' : '›';
    html += '<div class="c-line ' + cls + '">' + tag + ' ' + escapeHtml(l.text) + '</div>';
  });
  if(extra){
    if(extra.error !== undefined && extra.error !== null){
      const e = extra.error instanceof Error ? extra.error : new Error(String(extra.error));
      html += '<div class="c-line c-err">⛔ ' + escapeHtml(e.stack || (e.name + ': ' + e.message)) + '</div>';
    } else if(extra.returnVal !== undefined){
      html += '<div class="c-line c-ret">↩ ' + escapeHtml(consoleFmtArg(extra.returnVal)) + '</div>';
    }
  }
  out.innerHTML = html;
  out.scrollTop = out.scrollHeight;
}