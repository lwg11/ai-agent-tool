const SEC_RULES = [
  { name: 'AWS Access Key ID', sev: 'High', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'AWS Secret Access Key', sev: 'High', re: /(?:aws_secret_access_key|awsSecretKey|aws_access_secret)\s*[:=]\s*["']?([A-Za-z0-9/+]{40})["']?/gi, grp: 1 },
  { name: 'GitHub Token', sev: 'High', re: /\b(?:gh[pousr]_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{22,})\b/g },
  { name: 'Private Key Block', sev: 'High', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { name: 'JSON Web Token (JWT)', sev: 'High', re: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  { name: 'Google API Key', sev: 'High', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'Slack Token', sev: 'High', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
  { name: 'Stripe Live Key', sev: 'High', re: /\b(?:sk_live|rk_live|pk_live)_[0-9a-zA-Z]{16,}\b/g },
  { name: 'Twilio API Key (SK)', sev: 'Medium', re: /\bSK[0-9a-fA-F]{32}\b/g },
  { name: 'URL 中嵌入的密码', sev: 'Medium', re: /[a-zA-Z][a-zA-Z0-9+.\-]*:\/\/[^:\/\s]+:[^@\s]+@/g },
  { name: 'Session Cookie', sev: 'Medium', re: /(?:sessionid|PHPSESSID|JSESSIONID)\s*=\s*[0-9A-Za-z]{16,}/gi },
  { name: '疑似密钥赋值 (key/secret/token/password)', sev: 'Medium', re: /(?:api[_-]?key|secret|token|passwd|password)\s*[:=]\s*["']([A-Za-z0-9_\-]{12,})["']/gi, grp: 1 },
];
function secLineOf(text, idx){ let n = 1, i = text.indexOf('\n'); while(i >= 0 && i < idx){ n++; i = text.indexOf('\n', i + 1); } return n; }
function secEntropy(s){ const f = {}; for(const c of s) f[c] = (f[c] || 0) + 1; let e = 0; for(const k in f){ const p = f[k] / s.length; e -= p * Math.log2(p); } return e; }
function maskHit(s){ if(s.length <= 8) return s.slice(0, 2) + '••••' + s.slice(-2); return s.slice(0, 4) + '••••••' + s.slice(-4); }