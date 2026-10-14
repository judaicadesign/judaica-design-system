import './jd-whatsapp-pricing.js';
// X is the final price to forward to the client. No additional margin or shipping.
export function b612Base(net,settings){return globalThis.jdWhatsAppPrice.calculate(net,settings);}
