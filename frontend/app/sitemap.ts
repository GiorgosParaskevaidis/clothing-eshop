import type { MetadataRoute } from 'next';
export default function sitemap():MetadataRoute.Sitemap{return ['','/policies/shipping','/policies/returns','/policies/terms','/policies/privacy'].map(path=>({url:`${process.env.NEXT_PUBLIC_SITE_URL??'http://localhost:3000'}${path}`,changeFrequency:'weekly',priority:path?0.3:1}));}
