export type Variant = { id:string; productId:string; size:string; available:number; version:number };
export type Product = { id:string; name:string; description:string; priceCents:number; edition:number; frontImage:string; backImage:string; active:boolean; variants:Variant[] };
export type Store = { brand:string; dropOpensAt:string; salesEnabled:boolean; shippingCents:number; freeShippingThresholdCents:number; instagramUrl:string; contactEmail:string; checkoutAvailable:boolean; simulation:boolean };
export type CartLine = { variantId:string; quantity:number };
export type OrderItem = { variantId:string; productName:string; size:string; quantity:number; unitPriceCents:number };
export type Receipt = { number:string; status:string; paymentMode:string; totalCents:number; shippingCents:number; items:OrderItem[] };
export type AdminOrder = Receipt & { id:string; email:string; name:string; address:string; city:string; postalCode:string; country:string; createdUtc:string; subtotalCents:number };
export const money = (cents:number) => new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:2}).format(cents/100);
