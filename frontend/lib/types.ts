export type Variant = {
  sku: string;
  color: string;
  active: boolean;
  id: string;
  productId: string;
  size: string;
  available: number;
  version: number;
};
export type Product = {
  slug: string;
  status: 'draft' | 'published' | 'archived';
  currency: string;
  material: string;
  care: string;
  sizeGuide: string;
  inventoryMode: 'limited' | 'replenishable';
  version: number;
  categories: Category[];
  images: ProductImage[];
  id: string;
  name: string;
  description: string;
  priceCents: number;
  edition: number;
  frontImage: string;
  backImage: string;
  active: boolean;
  variants: Variant[];
};
export type Category = { id: string; name: string; slug: string; version: number };
export type ProductImage = {
  id: string;
  url: string;
  altText: string;
  position: number;
  width: number;
  height: number;
};
export type Store = {
  preview: boolean;
  paymentMethods: {
    id: PaymentMethod;
    name: string;
    available: boolean;
    unavailableReason?: 'NotConfigured' | 'Disabled' | null;
  }[];
  brand: string;
  dropOpensAt: string;
  salesEnabled: boolean;
  shippingCents: number;
  freeShippingThresholdCents: number | null;
  instagramUrl: string;
  contactEmail: string;
  checkoutAvailable: boolean;
  simulation: boolean;
};
export type CheckoutQuote = {
  id: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  expiresUtc: string;
  methodName: string;
  currency: string;
  version: number;
  netCents: number | null;
  taxCents: number | null;
  taxPolicyVersion: string;
};
export type ShippingSettings = {
  country: string;
  currency: string;
  methodName: string;
  costCents: number;
  freeFromCents: number | null;
  enabled: boolean;
  version: number;
};
export type PaymentSettings = {
  bankTransferEnabled: boolean;
  accountHolder: string;
  iban: string;
  bic: string;
  version: number;
};
export type StorePolicy = {
  slug: string;
  title: string;
  body: string;
  version: string;
  approved: boolean;
};
export type CartLine = { variantId: string; quantity: number };
export type OrderItem = {
  productSlug: string;
  sku: string;
  color: string;
  imageUrl: string;
  id: number;
  variantId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
};
export type Receipt = {
  number: string;
  status: string;
  paymentMode: string;
  paymentStatus: string;
  paymentInstructions: string | null;
  totalCents: number;
  shippingCents: number;
  items: OrderItem[];
};
export type PaymentMethod = 'BankTransfer' | 'CashOnDelivery';
export const isManualPayment = (method: string) =>
  method === 'BankTransfer' || method === 'CashOnDelivery';
export const paymentMethodName = (method: string) =>
  method === 'BankTransfer'
    ? 'Bank transfer to Revolut'
    : method === 'CashOnDelivery'
      ? 'Cash on delivery'
      : method;
export type AdminOrder = Receipt & {
  id: string;
  email: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  createdUtc: string;
  subtotalCents: number;
};
export const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export type AuthSession = {
  id: string;
  email: string;
  displayName: string;
  emailConfirmed: boolean;
  scope: 'Customer' | 'Admin';
};
export type PageResult<T> = { items: T[]; page: number; pageSize: number; total: number };
export type CustomerProfile = { id: string; email: string; displayName: string; version: number };
export type CustomerAddress = {
  id: string;
  label: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
  version: number;
};
export type CustomerOrder = AdminOrder & {
  phone: string;
  version: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  currency: string;
  shippingMethod: string;
  policies: StorePolicy[] | null;
};
export type OrderOperations = {
  disputes: { providerId?: string; amountCents: number; currency: string; state: string }[];
  history: { id: number; eventType: string; detail: string; createdUtc: string }[];
  shipments: { courier: string; trackingNumber: string; trackingUrl: string }[];
  refunds: { id: string; amountCents: number; state: string }[];
  returns: { id: string; kind: string; reason: string; state: string; version: number }[];
  returnItems: {
    returnId: string;
    orderItemId: number;
    quantity: number;
    receivedQuantity: number;
    restockedQuantity: number;
  }[];
};
export type AdminLogin = {
  email?: string;
  requiresMfa?: boolean;
  requiresSetup?: boolean;
  challengeToken?: string;
  recoveryCodes?: string[];
};
