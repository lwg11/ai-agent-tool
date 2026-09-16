function hexToBytes(hex){
  const h = hex.replace(/[^0-9a-fA-F]/g, '');
  if(h.length % 2) throw new Error('Hex 长度应为偶数');
  return Uint8Array.from({length: h.length / 2}, (_, i) => parseInt(h.substr(i * 2, 2), 16));
}
function bytesToHex(b){ return Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); }