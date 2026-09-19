export type Team = { id: string; school: string; mascot: string; abbreviation: string; conference: string; color: string };
export type Game = { id: number; week: number; seasonType: string; startDate: string; startTimeTBD: boolean; completed: boolean; neutralSite: boolean; homeTeam: string; awayTeam: string; homePoints: number | null; awayPoints: number | null; venue?: string | null; status?: string; period?: number | null; clock?: string | null };
export type Week = { week: number; seasonType: string; startDate: string; endDate: string };
export type RecordLine = { wins: number; losses: number; ties: number };
export type Prediction = { probability: number | null; model: 'SP+' | 'Elo' | 'Unavailable' };
export type Outlook = { team: Team; year: number; demo: boolean; games: Game[]; predictions: Record<number, Prediction>; records: Record<string, RecordLine>; weeks: Week[]; selectedWeek: string; currentWeek: string; scoreboard: Game[]; idleTeams: string[]; wins: number; losses: number; expectedWins: number | null; knownExpectedWins: number; missingPredictions: number; fetchedAt: string; warnings: string[] };
