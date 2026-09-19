import { NextRequest, NextResponse } from 'next/server';
import { getTeams, getOutlook } from '@/lib/cfbd';
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const year = Number(query.get('year')), current = new Date().getFullYear();
  const team = query.get('team'), week = query.get('week') ?? undefined;
  if (!Number.isInteger(year) || year < current-1 || year > current+1 || !team || (week && !/^(regular|postseason):\d{1,2}$/.test(week))) return NextResponse.json({error:'Invalid team, season, or week.'},{status:400});
  try {
    const selected = (await getTeams(year)).find(t=>t.school===team);
    if (!selected) return NextResponse.json({error:'This team is not listed as FBS for the selected season.'},{status:400});
    return NextResponse.json(await getOutlook(selected,year,week));
  } catch(e) {return NextResponse.json({error:e instanceof Error ? e.message : 'Could not load football data.'},{status:502});}
}
