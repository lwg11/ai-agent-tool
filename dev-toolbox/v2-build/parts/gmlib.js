
/* ---------- SM4 专用 S 盒（非 AES S 盒；取值 GB/T 32907 / IETF draft-ribose-cfrg-sm4-03 §4.1） ---------- */
const SM4_S = new Uint8Array([
  0xD6,0x90,0xE9,0xFE,0xCC,0xE1,0x3D,0xB7,0x16,0xB6,0x14,0xC2,0x28,0xFB,0x2C,0x05,
  0x2B,0x67,0x9A,0x76,0x2A,0xBE,0x04,0xC3,0xAA,0x44,0x13,0x26,0x49,0x86,0x06,0x99,
  0x9C,0x42,0x50,0xF4,0x91,0xEF,0x98,0x7A,0x33,0x54,0x0B,0x43,0xED,0xCF,0xAC,0x62,
  0xE4,0xB3,0x1C,0xA9,0xC9,0x08,0xE8,0x95,0x80,0xDF,0x94,0xFA,0x75,0x8F,0x3F,0xA6,
  0x47,0x07,0xA7,0xFC,0xF3,0x73,0x17,0xBA,0x83,0x59,0x3C,0x19,0xE6,0x85,0x4F,0xA8,
  0x68,0x6B,0x81,0xB2,0x71,0x64,0xDA,0x8B,0xF8,0xEB,0x0F,0x4B,0x70,0x56,0x9D,0x35,
  0x1E,0x24,0x0E,0x5E,0x63,0x58,0xD1,0xA2,0x25,0x22,0x7C,0x3B,0x01,0x21,0x78,0x87,
  0xD4,0x00,0x46,0x57,0x9F,0xD3,0x27,0x52,0x4C,0x36,0x02,0xE7,0xA0,0xC4,0xC8,0x9E,
  0xEA,0xBF,0x8A,0xD2,0x40,0xC7,0x38,0xB5,0xA3,0xF7,0xF2,0xCE,0xF9,0x61,0x15,0xA1,
  0xE0,0xAE,0x5D,0xA4,0x9B,0x34,0x1A,0x55,0xAD,0x93,0x32,0x30,0xF5,0x8C,0xB1,0xE3,
  0x1D,0xF6,0xE2,0x2E,0x82,0x66,0xCA,0x60,0xC0,0x29,0x23,0xAB,0x0D,0x53,0x4E,0x6F,
  0xD5,0xDB,0x37,0x45,0xDE,0xFD,0x8E,0x2F,0x03,0xFF,0x6A,0x72,0x6D,0x6C,0x5B,0x51,
  0x8D,0x1B,0xAF,0x92,0xBB,0xDD,0xBC,0x7F,0x11,0xD9,0x5C,0x41,0x1F,0x10,0x5A,0xD8,
  0x0A,0xC1,0x31,0x88,0xA5,0xCD,0x7B,0xBD,0x2D,0x74,0xD0,0x12,0xB8,0xE5,0xB4,0xB0,
  0x89,0x69,0x97,0x4A,0x0C,0x96,0x77,0x7E,0x65,0xB9,0xF1,0x09,0xC5,0x6E,0xC6,0x84,
  0x18,0xF0,0x7D,0xEC,0x3A,0xDC,0x4D,0x20,0x79,0xEE,0x5F,0x3E,0xD7,0xCB,0x39,0x48
]);

/* ===================== SM3 ===================== */
const SM3_IV = [0x7380166f,0x4914b2b9,0x172442d7,0xda8a0600,0xa96f30bc,0x163138aa,0xe38dee4d,0xb0fb0e4e];
function rotl32(x, n){ n &= 31; return ((x << n) | (x >>> (32 - n))) >>> 0; }
function sm3FF(x, y, z, j){ return j < 16 ? (x ^ y ^ z) : ((x & y) | (x & z) | (y & z)); }
function sm3GG(x, y, z, j){ return j < 16 ? (x ^ y ^ z) : ((x & y) | ((~x >>> 0) & z)); }
function sm3P0(x){ return (x ^ rotl32(x, 9) ^ rotl32(x, 17)) >>> 0; }
function sm3P1(x){ return (x ^ rotl32(x, 15) ^ rotl32(x, 23)) >>> 0; }
function sm3Compress(V, B){
  const W = new Array(68), W1 = new Array(64);
  for(let i = 0; i < 16; i++) W[i] = B[i];
  for(let i = 16; i < 68; i++) W[i] = sm3P1(W[i-16] ^ W[i-9] ^ rotl32(W[i-3], 15)) ^ rotl32(W[i-13], 7) ^ W[i-6];
  for(let i = 0; i < 64; i++) W1[i] = (W[i] ^ W[i+4]) >>> 0;
  let A = V[0], Bb = V[1], C = V[2], D = V[3], E = V[4], F = V[5], G = V[6], H = V[7];
  for(let j = 0; j < 64; j++){
    const Tj = (j < 16) ? 0x79cc4519 : 0x7a879d8a;
    const SS1 = rotl32((rotl32(A, 12) + E + rotl32(Tj, j)) >>> 0, 7);
    const SS2 = (SS1 ^ rotl32(A, 12)) >>> 0;
    const TT1 = (sm3FF(A, Bb, C, j) + D + SS2 + W1[j]) >>> 0;
    const TT2 = (sm3GG(E, F, G, j) + H + SS1 + W[j]) >>> 0;
    D = C; C = rotl32(Bb, 9); Bb = A; A = TT1;
    H = G; G = rotl32(F, 19); F = E; E = sm3P0(TT2);
  }
  return [ (V[0]^A)>>>0,(V[1]^Bb)>>>0,(V[2]^C)>>>0,(V[3]^D)>>>0,(V[4]^E)>>>0,(V[5]^F)>>>0,(V[6]^G)>>>0,(V[7]^H)>>>0 ];
}
function sm3Bytes(msg){
  let V = SM3_IV.slice();
  const l = msg.length;
  const bitlen = l * 8;
  const k = (56 - ((l + 1) % 64) + 64) % 64;
  const total = l + 1 + k + 8;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[l] = 0x80;
  const hi = Math.floor(bitlen / 0x100000000);
  const lo = bitlen >>> 0;
  buf[total-8] = (hi >>> 24) & 0xff; buf[total-7] = (hi >>> 16) & 0xff; buf[total-6] = (hi >>> 8) & 0xff; buf[total-5] = hi & 0xff;
  buf[total-4] = (lo >>> 24) & 0xff; buf[total-3] = (lo >>> 16) & 0xff; buf[total-2] = (lo >>> 8) & 0xff; buf[total-1] = lo & 0xff;
  for(let off = 0; off < total; off += 64){
    const B = new Array(16);
    for(let i = 0; i < 16; i++){
      B[i] = (((buf[off+i*4] << 24) | (buf[off+i*4+1] << 16) | (buf[off+i*4+2] << 8) | buf[off+i*4+3]) >>> 0);
    }
    V = sm3Compress(V, B);
  }
  return V;
}
function sm3Hex(msgBytes){ return sm3Bytes(msgBytes).map(w => ('00000000' + (w >>> 0).toString(16)).slice(-8)).join(''); }
const SM3 = { hashBytes: sm3Bytes, hex: sm3Hex };

/* ===================== SM4 ===================== */
const SM4_FK = [0xa3b1bac6, 0x56aa3350, 0x677d9197, 0xb27022dc];
function sm4CK(){
  const a = new Array(32);
  for(let i = 0; i < 32; i++){
    let w = 0;
    for(let j = 0; j < 4; j++) w = (w << 8) | (((4 * i + j) * 7) % 256);
    a[i] = w >>> 0;
  }
  return a;
}
const SM4_CK = sm4CK();
function sm4Tau(x){
  return ((SM4_S[(x >>> 24) & 0xff] << 24) | (SM4_S[(x >>> 16) & 0xff] << 16) |
          (SM4_S[(x >>> 8) & 0xff] << 8) | SM4_S[x & 0xff]) >>> 0;
}
function sm4L(x){ return (x ^ rotl32(x, 2) ^ rotl32(x, 10) ^ rotl32(x, 18) ^ rotl32(x, 24)) >>> 0; }
function sm4Lp(x){ return (x ^ rotl32(x, 13) ^ rotl32(x, 23)) >>> 0; }
function sm4KeySchedule(mk){
  const K = new Array(36);
  for(let i = 0; i < 4; i++) K[i] = (mk[i] ^ SM4_FK[i]) >>> 0;
  for(let i = 0; i < 32; i++){
    const t = sm4Lp(sm4Tau(K[i+1] ^ K[i+2] ^ K[i+3] ^ SM4_CK[i]));
    K[i+4] = (K[i] ^ t) >>> 0;
  }
  return K.slice(4, 36); // rk[0..31]
}
function sm4OneRound(rk, X){
  const Xo = new Array(36);
  for(let i = 0; i < 4; i++) Xo[i] = X[i] >>> 0;
  for(let i = 0; i < 32; i++){
    const t = sm4L(sm4Tau(Xo[i+1] ^ Xo[i+2] ^ Xo[i+3] ^ rk[i]));
    Xo[i+4] = (Xo[i] ^ t) >>> 0;
  }
  return [Xo[35], Xo[34], Xo[33], Xo[32]];
}
function sm4EncBlock(mk, block){
  const rk = sm4KeySchedule(mk);
  return sm4OneRound(rk, block);
}
function sm4DecBlock(mk, block){
  const rk = sm4KeySchedule(mk).reverse();
  return sm4OneRound(rk, block);
}
function b2u32(buf){ const a = []; for(let i = 0; i < buf.length; i += 4){ a.push(((buf[i] << 24) | (buf[i+1] << 16) | (buf[i+2] << 8) | buf[i+3]) >>> 0); } return a; }
function u32ToBytes(w){ return [(w >>> 24) & 0xff, (w >>> 16) & 0xff, (w >>> 8) & 0xff, w & 0xff]; }
function bufXor(a, b){ const r = new Uint8Array(a.length); for(let i = 0; i < a.length; i++) r[i] = a[i] ^ b[i]; return r; }

// ECB
function sm4Ecb(mk, data, decrypt){
  const out = new Uint8Array(data.length);
  for(let off = 0; off < data.length; off += 16){
    const blk = decrypt ? sm4DecBlock(mk, b2u32(data.subarray(off, off+16))) : sm4EncBlock(mk, b2u32(data.subarray(off, off+16)));
    const b = blk.flatMap(u32ToBytes);
    out.set(b, off);
  }
  return out;
}
// CBC
function sm4Cbc(mk, iv, data, decrypt){
  const out = new Uint8Array(data.length);
  if(!decrypt){
    let prev = iv.slice();
    for(let off = 0; off < data.length; off += 16){
      const inBlk = bufXor(data.subarray(off, off+16), prev);
      const enc = sm4EncBlock(mk, b2u32(inBlk));
      const b = enc.flatMap(u32ToBytes);
      out.set(b, off); prev = b;
    }
  } else {
    let prev = iv.slice();
    for(let off = 0; off < data.length; off += 16){
      const dec = sm4DecBlock(mk, b2u32(data.subarray(off, off+16)));
      const b = dec.flatMap(u32ToBytes);
      out.set(bufXor(b, prev), off); prev = data.subarray(off, off+16);
    }
  }
  return out;
}
const SM4 = { ecb: sm4Ecb, cbc: sm4Cbc };

/* ===================== SM2 ===================== */
const SM2_P  = 0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFFn;
const SM2_A  = 0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFCn;
const SM2_B  = 0x28E9FA9E9D9F5E344D5A9E4BCF6509A7F39789F515AB8F92DDBCBD414D940E93n;
const SM2_GX = 0x32C4AE2C1F1981195F9904466A39C9948FE30BBFF2660BE1715A4589334C74C7n;
const SM2_GY = 0xBC3736A2F4F6779C59BDCEE36B692153D0A9877CC62A474002DF32E52139F0A0n;
const SM2_N  = 0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123n;
function mod2(a, m){ a %= m; if(a < 0n) a += m; return a; }
function modpow(a, e, m){ a %= m; let r = 1n; while(e > 0n){ if(e & 1n) r = (r * a) % m; a = (a * a) % m; e >>= 1n; } return r; }
function invMod(a, m){ return modpow(mod2(a, m), m - 2n, m); }
function i2b(v, len){ const u = new Uint8Array(len); let x = mod2(v, SM2_P); for(let i = len - 1; i >= 0; i--){ u[i] = Number(x & 0xffn); x >>= 8n; } return u; }
function bytesToBigInt(u){ let x = 0n; for(let i = 0; i < u.length; i++) x = (x << 8n) | BigInt(u[i]); return x; }
function concatArr(arrs){ let n = 0; arrs.forEach(a => n += a.length); const o = new Uint8Array(n); let p = 0; arrs.forEach(a => { o.set(a, p); p += a.length; }); return o; }
function wordsToBytes(w){ const u = new Uint8Array(w.length * 4); for(let i = 0; i < w.length; i++){ u[i*4] = (w[i] >>> 24) & 0xff; u[i*4+1] = (w[i] >>> 16) & 0xff; u[i*4+2] = (w[i] >>> 8) & 0xff; u[i*4+3] = w[i] & 0xff; } return u; }
function ecAdd(P, Q){
  if(!P) return Q; if(!Q) return P;
  if(P.x === Q.x && mod2(P.y + Q.y, SM2_P) === 0n) return null;
  let lam;
  if(P.x === Q.x && P.y === Q.y) lam = mod2((3n*P.x*P.x + SM2_A) * invMod(2n*P.y, SM2_P), SM2_P);
  else lam = mod2((Q.y - P.y) * invMod(Q.x - P.x, SM2_P), SM2_P);
  const x3 = mod2(lam*lam - P.x - Q.x, SM2_P);
  const y3 = mod2(lam*(P.x - x3) - P.y, SM2_P);
  return { x: x3, y: y3 };
}
function ecMul(k, P){
  k = mod2(k, SM2_N);
  if(k === 0n) return null;
  let R = null, Q = P;
  while(k > 0n){ if(k & 1n) R = ecAdd(R, Q); Q = ecAdd(Q, Q); k >>= 1n; }
  return R;
}
function sm2ZA(idBytes, Px, Py){
  const entl = idBytes.length * 8;
  const head = new Uint8Array([(entl >>> 8) & 0xff, entl & 0xff]);
  return sm3Bytes(concatArr([head, idBytes, i2b(SM2_A,32), i2b(SM2_B,32), i2b(SM2_GX,32), i2b(SM2_GY,32), i2b(Px,32), i2b(Py,32)]));
}
function sm2E(ZAwords, Mbytes){ return sm3Bytes(concatArr([wordsToBytes(ZAwords), Mbytes])); }
function rand256(){ const u = new Uint8Array(32); (globalThis.crypto || globalThis.msCrypto).getRandomValues(u); return bytesToBigInt(u); }
function sm2KDF(z, klenBits){
  const klBytes = Math.ceil(klenBits / 8); const out = []; let ct = 1;
  while(out.length < klBytes){
    const buf = new Uint8Array(z.length + 4); buf.set(z);
    buf[z.length] = (ct >>> 24) & 0xff; buf[z.length+1] = (ct >>> 16) & 0xff; buf[z.length+2] = (ct >>> 8) & 0xff; buf[z.length+3] = ct & 0xff;
    out.push(...wordsToBytes(sm3Bytes(buf))); ct++;
  }
  return out.slice(0, klBytes);
}
function sm2Sign(d, idBytes, Mbytes, fixedK){
  const PA = ecMul(d, { x: SM2_GX, y: SM2_GY });
  const ZA = sm2ZA(idBytes, PA.x, PA.y);
  const eBar = bytesToBigInt(wordsToBytes(sm2E(ZA, Mbytes)));
  let k, r, s, C1;
  while(true){
    k = (fixedK != null) ? fixedK : (rand256() % SM2_N);
    if(k <= 0n || k >= SM2_N) continue;
    C1 = ecMul(k, { x: SM2_GX, y: SM2_GY });
    r = mod2(eBar + C1.x, SM2_N);
    if(r === 0n || r + k === SM2_N) continue;
    s = mod2(invMod(1n + d, SM2_N) * mod2(k - r*d, SM2_N), SM2_N);
    if(s === 0n) continue;
    return { r, s };
  }
}
function sm2Verify(Px, Py, idBytes, Mbytes, r, s){
  if(r < 1n || r >= SM2_N || s < 1n || s >= SM2_N) return false;
  const ZA = sm2ZA(idBytes, Px, Py);
  const eBar = bytesToBigInt(wordsToBytes(sm2E(ZA, Mbytes)));
  const t = mod2(r + s, SM2_N);
  if(t === 0n) return false;
  const R = ecAdd(ecMul(s, { x: SM2_GX, y: SM2_GY }), ecMul(t, { x: Px, y: Py }));
  if(!R) return false;
  return mod2(eBar + R.x, SM2_N) === r;
}
function sm2Encrypt(Px, Py, Mbytes){
  const klen = Mbytes.length * 8;
  while(true){
    const k = rand256() % SM2_N; if(k <= 0n || k >= SM2_N) continue;
    const C1 = ecMul(k, { x: SM2_GX, y: SM2_GY });
    const S = ecMul(k, { x: Px, y: Py });
    const t = sm2KDF(concatArr([i2b(S.x,32), i2b(S.y,32)]), klen);
    if(t.every(b => b === 0)) continue;
    const C2 = Mbytes.map((b, i) => b ^ t[i]);
    const C3 = sm3Bytes(concatArr([i2b(S.x,32), Mbytes, i2b(S.y,32)]));
    return concatArr([new Uint8Array([0x04]), i2b(C1.x,32), i2b(C1.y,32), wordsToBytes(C3), new Uint8Array(C2)]);
  }
}
function sm2Decrypt(d, cipher){
  const off = (cipher[0] === 0x04) ? 1 : 0; // 兼容带/不带 0x04 前缀两种密文格式
  const C1 = { x: bytesToBigInt(cipher.slice(off, off+32)), y: bytesToBigInt(cipher.slice(off+32, off+64)) };
  const C3 = cipher.slice(off+64, off+96);
  const C2 = cipher.slice(off+96);
  const S = ecMul(d, C1);
  const t = sm2KDF(concatArr([i2b(S.x,32), i2b(S.y,32)]), C2.length * 8);
  const M = C2.map((b, i) => b ^ t[i]);
  const C3chk = wordsToBytes(sm3Bytes(concatArr([i2b(S.x,32), M, i2b(S.y,32)])));
  for(let i = 0; i < 32; i++) if(C3chk[i] !== C3[i]) return null;
  return M;
}
const SM2 = { sign: sm2Sign, verify: sm2Verify, encrypt: sm2Encrypt, decrypt: sm2Decrypt, mul: ecMul, params: { P: SM2_P, A: SM2_A, B: SM2_B, GX: SM2_GX, GY: SM2_GY, N: SM2_N } };