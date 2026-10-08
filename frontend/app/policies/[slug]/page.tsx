import Link from 'next/link';
import { notFound } from 'next/navigation';
const policies:Record<string,{title:string;body:string}>= {
  shipping:{title:'Shipping',body:'Delivery options, dispatch dates and shipping details will be published before the drop opens.'},
  returns:{title:'Returns',body:'Return instructions, contact details and the complete returns policy will be published before the drop opens.'},
  terms:{title:'Terms',body:'The store terms, seller details and conditions of purchase will be published before sales open. The current preview accepts test orders only.'},
  privacy:{title:'Privacy',body:'Newsletter signup records your email and consent to receive drop updates. Checkout records the contact and delivery information needed to fulfil an order. The complete privacy notice and store contact details will be published before sales open.'}
};
export default async function Policy({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const policy=policies[slug];if(!policy)notFound();return <main id="main-content" className="wrap page-shell prose"><h1 className="page-title">{policy.title}</h1><p>{policy.body}</p><Link className="btn" href="/">Back to the drop</Link></main>;}
