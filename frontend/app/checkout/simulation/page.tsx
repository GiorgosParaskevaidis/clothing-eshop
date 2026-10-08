import { Suspense } from 'react';
import { ReceiptView } from '@/components/receipt';
export default function Simulation(){return <Suspense fallback={<p>Loading order…</p>}><ReceiptView simulation/></Suspense>;}
