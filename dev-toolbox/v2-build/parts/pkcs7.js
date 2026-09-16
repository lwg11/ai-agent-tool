function pkcs7Pad(bytes){
  const pad = 16 - (bytes.length % 16);
  const out = new Uint8Array(bytes.length + pad);
  out.set(bytes); out.fill(pad, bytes.length);
  return out;
}
function pkcs7Unpad(bytes){
  if(!bytes.length || bytes.length % 16) throw new Error('数据长度不是 16 的倍数');
  const pad = bytes[bytes.length - 1];
  if(pad < 1 || pad > 16) throw new Error('填充校验失败（密钥或密文可能不对）');
  for(let i = bytes.length - pad; i < bytes.length; i++) if(bytes[i] !== pad) throw new Error('填充校验失败（密钥或密文可能不对）');
  return bytes.slice(0, bytes.length - pad);
}