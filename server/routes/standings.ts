import { Router, type Request, type Response } from 'express';
import { standingsService } from '../services/standings.js';

export const standingsRouter = Router();

standingsRouter.get('/', (req: Request, res: Response) => {
  try {
    const tournamentId = req.query.tournament_id as string | undefined;
    const standings = standingsService.getStandings(tournamentId);
    const sports = standingsService.getSportBreakdowns();

    res.json({
      standings,
      sports,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to calculate standings', message: err.message });
  }
});
