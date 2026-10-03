import { NextRequest, NextResponse } from 'next/server';
import { getTeam, getOutlook } from '@/lib/cfbd';
import type { ForecastModel } from '@/lib/types';
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const year = Number(query.get('year')), current = new Date().getFullYear();
  const team = query.get('team'), week = query.get('week') ?? undefined, model = query.get('model') ?? 'sp';
  if (!Number.isInteger(year) || year < current-1 || year > current || !team || !['sp','fei','sagarin'].includes(model) || (week && !/^(regular|postseason):\d{1,2}$/.test(week))) return NextResponse.json({error:'Invalid team, season, week, or forecast model.'},{status:400});
  try {
    const selected = await getTeam(team,year);
    if (!selected) return NextResponse.json({error:'This team was not found in the football directory.'},{status:400});
    return NextResponse.json(await getOutlook(selected,year,week,model as ForecastModel));
  } catch(e) {return NextResponse.json({error:e instanceof Error ? e.message : 'Could not load football data.'},{status:502});}
}
