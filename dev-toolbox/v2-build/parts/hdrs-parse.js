function hdrsParse(text){
  const raw = String(text).trim();
  if(!raw) return [];
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if(lines.length === 1 && /^[^\s:]+=/.test(raw) && raw.includes(';')){
    const out = [];
    raw.split(';').forEach(p => {
      const i = p.indexOf('='); if(i < 0) return;
      out.push({ k: p.slice(0, i).trim(), v: p.slice(i + 1).trim(), kind: 'cookie' });
    });
    return out;
  }
  const out = [];
  lines.forEach(l => {
    const i = l.indexOf(':'); if(i < 0) return;
    const k = l.slice(0, i).trim(); const v = l.slice(i + 1).trim();
    if(/^cookie$/i.test(k)){
      v.split(';').forEach(p => {
        const j = p.indexOf('='); if(j < 0) return;
        out.push({ k: p.slice(0, j).trim(), v: p.slice(j + 1).trim(), kind: 'cookie' });
      });
    } else {
      out.push({ k, v, kind: 'header' });
    }
  });
  return out;
}
let hdrsData = [];