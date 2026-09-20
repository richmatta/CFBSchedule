import { NextRequest, NextResponse } from 'next/server';
import { getTeams, isDemo } from '@/lib/cfbd';
export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get('year'));
  const current = new Date().getFullYear();
  if (!Number.isInteger(year) || year < current-1 || year > current) return NextResponse.json({error:'Choose last year or this year.'},{status:400});
  try {return NextResponse.json({teams:await getTeams(year),demo:isDemo()});}
  catch (e) {return NextResponse.json({error:e instanceof Error ? e.message : 'Could not load teams.'},{status:502});}
}
