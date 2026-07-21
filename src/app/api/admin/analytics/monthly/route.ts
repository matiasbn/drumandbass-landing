import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getMonthlyOverview } from '@/src/lib/ga';
import { verifyAdmin } from '@/src/lib/authz';

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
          // no-op
        },
      },
    }
  );
}

async function isAdmin(supabase: Awaited<ReturnType<typeof createSupabaseServer>>): Promise<boolean> {
  return (await verifyAdmin(supabase)).isAdmin;
}

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createSupabaseServer(cookieStore);

  if (!(await isAdmin(supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const data = await getMonthlyOverview();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'No se pudieron obtener los datos mensuales de Google Analytics.' },
      { status: 502 }
    );
  }
}
