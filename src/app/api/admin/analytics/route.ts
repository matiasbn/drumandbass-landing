import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsOverview } from '@/src/lib/ga';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function createSupabaseServer(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op en route handler de solo lectura
        },
      },
    }
  );
}

async function isAdmin(supabase: ReturnType<typeof createSupabaseServer>): Promise<boolean> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();
  return data?.is_admin === true;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const daysParam = Number(request.nextUrl.searchParams.get('days'));
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 30;

  try {
    const data = await getAnalyticsOverview(days);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron obtener los datos de Google Analytics.' },
      { status: 502 }
    );
  }
}
