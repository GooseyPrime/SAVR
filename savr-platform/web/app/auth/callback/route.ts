import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSafeRelativeRedirect } from '@/lib/utils/authRedirect';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Apply a sanitized return-path if the OAuth flow was initiated with one.
  // `next` is populated by signInWithGoogle when a return path was provided.
  const safeNext = getSafeRelativeRedirect(requestUrl.searchParams.get('next'), null);

  const destination = safeNext ?? '/';
  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
