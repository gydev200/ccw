import {member,owner,fail} from '@/lib/server';
import {badgePurchaseBrief} from '@/lib/badge-purchase-brief';
export const dynamic='force-dynamic';
export async function GET(){try{owner(await member());return new Response(badgePurchaseBrief,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"}})}catch(e){return fail(e)}}
