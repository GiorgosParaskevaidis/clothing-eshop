import { Suspense } from 'react';
import { ReceiptView } from '@/components/receipt';
export default function Success(){return <Suspense fallback={<p>Loading order…</p>}><ReceiptView/></Suspense>;}
