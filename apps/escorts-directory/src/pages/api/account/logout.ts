import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/auth';
export const prerender = false;
export const POST: APIRoute = async () => new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': clearSessionCookie() } });
