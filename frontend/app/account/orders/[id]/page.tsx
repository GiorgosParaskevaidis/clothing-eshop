import { CustomerOrderPage } from '@/components/account/orders';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerOrderPage id={id} />;
}
