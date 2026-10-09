import html from '@/lib/avatar-profile-html';
import {member,fail} from '@/lib/server';
export async function GET(){try{await member();return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})}catch(e){return fail(e)}}
