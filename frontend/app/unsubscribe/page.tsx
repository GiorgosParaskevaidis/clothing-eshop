'use client';
import { Suspense,useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
function Form(){const params=useSearchParams();const [message,setMessage]=useState('');return <main id="main-content" className="wrap page-shell"><h1 className="page-title">Drop updates</h1><button className="btn" onClick={async()=>{try{await api('/newsletter/unsubscribe',{method:'POST',body:JSON.stringify({token:params.get('token')??''})});setMessage('You have been unsubscribed.');}catch{setMessage('Please try again.');}}}>Unsubscribe</button><p role="status">{message}</p></main>;}
export default function Unsubscribe(){return <Suspense><Form/></Suspense>;}
