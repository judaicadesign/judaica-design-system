// User-confirmed transform of the live B612 net amount. Shipping/margin are separate.
export function b612Base(net){
  const amount=Number(net);
  if(!Number.isFinite(amount)||amount<=0||amount>Number.MAX_SAFE_INTEGER/126)throw new Error('Invalid B612 net amount');
  const roundedNet=Math.ceil(amount/500)*500;
  const multiplied=roundedNet*126/100;
  const x=Math.ceil(multiplied/100)*100;
  return {net:amount,roundedNet,multiplier:1.26,multiplied,x};
}
