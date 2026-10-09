import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { DatabaseClient } from './client.js';

export interface SeedOptions {
  clean?: boolean;
}

export function seedDatabase(dbInput: DatabaseSync | DatabaseClient | any, options: SeedOptions = { clean: false }): void {
  const db: DatabaseSync = 'raw' in dbInput ? dbInput.raw : dbInput;

  // Ensure foreign keys are active
  db.exec('PRAGMA foreign_keys = ON;');

  if (options.clean) {
    db.exec(`
      DELETE FROM audit_logs;
      DELETE FROM match_events;
      DELETE FROM matches;
      DELETE FROM standings;
      DELETE FROM players;
      DELETE FROM users;
      DELETE FROM sports;
      DELETE FROM cohorts;
      DELETE FROM tournaments;
    `);
  }

  // 1. Tournaments
  const insertTournament = db.prepare(`
    INSERT OR REPLACE INTO tournaments (id, name, year, start_date, end_date)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertTournament.run('tourn-xlri-2026', 'XLRI Delhi Annual Sports Festival 2026', 2026, '2026-10-10', '2026-10-18');

  // 2. Cohorts
  const insertCohort = db.prepare(`
    INSERT OR REPLACE INTO cohorts (id, name, batch, color)
    VALUES (?, ?, ?, ?)
  `);
  insertCohort.run('cohort-seniors', 'Seniors', 'Batch of 2026', '#1E40AF');
  insertCohort.run('cohort-juniors', 'Juniors', 'Batch of 2027', '#DC2626');

  // 3. 15 Sports
  const sportsData: [string, string, string, string, string][] = [
    ['sport-football', 'Football', 'Outdoor', JSON.stringify({ playersPerTeam: 11, halves: 2, halfDurationMinutes: 45, extraTimeMinutes: 30 }), 'FOOTBALL'],
    ['sport-cricket', 'Cricket', 'Outdoor', JSON.stringify({ playersPerTeam: 11, overs: 10, format: 'T10', wickets: 10 }), 'CRICKET'],
    ['sport-basketball-m', 'Basketball M', 'Court', JSON.stringify({ gender: 'Men', playersPerTeam: 5, quarters: 4, quarterDurationMinutes: 10 }), 'BASKETBALL'],
    ['sport-basketball-f', 'Basketball F', 'Court', JSON.stringify({ gender: 'Women', playersPerTeam: 5, quarters: 4, quarterDurationMinutes: 10 }), 'BASKETBALL'],
    ['sport-volleyball', 'Volleyball', 'Court', JSON.stringify({ playersPerTeam: 6, bestOfSets: 3, pointsPerSet: 25, deciderPoints: 15 }), 'GENERIC'],
    ['sport-table-tennis', 'Table Tennis', 'Indoor', JSON.stringify({ type: 'Singles/Doubles', bestOfSets: 5, pointsPerSet: 11 }), 'GENERIC'],
    ['sport-track-field-m', 'Track & Field M', 'Athletics', JSON.stringify({ gender: 'Men', events: ['100m', '200m', '400m', '4x100m Relay', 'Shot Put', 'Long Jump'] }), 'GENERIC'],
    ['sport-track-field-f', 'Track & Field F', 'Athletics', JSON.stringify({ gender: 'Women', events: ['100m', '200m', '400m', '4x100m Relay', 'Shot Put', 'Long Jump'] }), 'GENERIC'],
    ['sport-tennis', 'Tennis', 'Court', JSON.stringify({ bestOfSets: 3, format: 'Standard Sets with Tie-break' }), 'GENERIC'],
    ['sport-chess', 'Chess', 'Mind', JSON.stringify({ boards: 4, timeControlMinutes: 15, incrementSeconds: 10 }), 'GENERIC'],
    ['sport-badminton-m', 'Badminton M', 'Racquet', JSON.stringify({ gender: 'Men', bestOfSets: 3, pointsPerSet: 21, capPoints: 30 }), 'BADMINTON'],
    ['sport-badminton-f', 'Badminton F', 'Racquet', JSON.stringify({ gender: 'Women', bestOfSets: 3, pointsPerSet: 21, capPoints: 30 }), 'BADMINTON'],
    ['sport-pool', 'Pool', 'Indoor', JSON.stringify({ format: '8-Ball Pool', raceTo: 3 }), 'GENERIC'],
    ['sport-throwball', 'Throwball', 'Court', JSON.stringify({ playersPerTeam: 7, bestOfSets: 3, pointsPerSet: 25 }), 'GENERIC'],
    ['sport-futsal', 'Futsal', 'Indoor', JSON.stringify({ playersPerTeam: 5, halves: 2, halfDurationMinutes: 20 }), 'GENERIC'],
  ];

  const insertSport = db.prepare(`
    INSERT OR REPLACE INTO sports (id, name, category, rules_json, scoring_type)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const s of sportsData) {
    insertSport.run(...s);
  }

  // 4. Users (Admin + 3 Referees)
  const usersData: [string, string, string, string][] = [
    ['usr-admin-1', 'Sports Committee Admin', 'admin@sports.xlridelhi.ac.in', 'ADMIN'],
    ['usr-ref-1', 'Rohan Verma', 'rohan.ref@xlridelhi.ac.in', 'REFEREE'],
    ['usr-ref-2', 'Pooja Sharma', 'pooja.ref@xlridelhi.ac.in', 'REFEREE'],
    ['usr-ref-3', 'Amitabh Sen', 'amitabh.ref@xlridelhi.ac.in', 'REFEREE'],
  ];

  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, role)
    VALUES (?, ?, ?, ?)
  `);
  for (const u of usersData) {
    insertUser.run(...u);
  }

  // 5. 154 Players (77 Seniors + 77 Juniors across all 15 sports; 10 Injured, 144 Active)
  const seniorPlayers: [string, string, string, string, number, string, string | null, string, string, Record<string, any>][] = [
    // Football (14)
    ['ply-26bm001', 'cohort-seniors', 'Kabir Mehta', '26BM001', 10, 'sport-football', 'sport-futsal', 'Forward / Captain', 'ACTIVE', { goals: 8, assists: 5 }],
    ['ply-26bm002', 'cohort-seniors', 'Arjun Nair', '26BM002', 7, 'sport-football', 'sport-futsal', 'Left Winger', 'ACTIVE', { goals: 5, assists: 7 }],
    ['ply-26bm003', 'cohort-seniors', 'Rohan Dasgupta', '26BM003', 9, 'sport-football', null, 'Striker', 'ACTIVE', { goals: 11, assists: 2 }],
    ['ply-26bm004', 'cohort-seniors', 'Siddharth Rao', '26BM004', 4, 'sport-football', null, 'Center Back', 'INJURED', { tackles: 24, cleanSheets: 3 }],
    ['ply-26bm005', 'cohort-seniors', 'Varun Pillai', '26BM005', 1, 'sport-football', null, 'Goalkeeper', 'ACTIVE', { saves: 42, cleanSheets: 5 }],
    ['ply-26bm006', 'cohort-seniors', 'Aditya Chopra', '26BM006', 6, 'sport-football', null, 'Central Midfielder', 'ACTIVE', { passAccuracy: 88, assists: 4 }],
    ['ply-26bm007', 'cohort-seniors', 'Nikhil Varma', '26BM007', 8, 'sport-football', null, 'Attacking Midfielder', 'ACTIVE', { goals: 4, assists: 6 }],
    ['ply-26bm008', 'cohort-seniors', 'Tarun Banerjee', '26BM008', 3, 'sport-football', null, 'Left Back', 'ACTIVE', { tackles: 18, crosses: 14 }],
    ['ply-26bm009', 'cohort-seniors', 'Harsh Vardhan', '26BM009', 2, 'sport-football', null, 'Right Back', 'ACTIVE', { tackles: 19, interceptions: 15 }],
    ['ply-26bm010', 'cohort-seniors', 'Gaurav Singhal', '26BM010', 5, 'sport-football', null, 'Center Back', 'ACTIVE', { aerialDuels: 21, cleanSheets: 4 }],
    ['ply-26bm011', 'cohort-seniors', 'Ayush Mathur', '26BM011', 11, 'sport-football', 'sport-track-field-m', 'Right Winger', 'ACTIVE', { goals: 6, assists: 3 }],
    ['ply-26bm012', 'cohort-seniors', 'Pranav Nambiar', '26BM012', 14, 'sport-football', null, 'Defensive Midfielder', 'ACTIVE', { interceptions: 27, yellowCards: 2 }],
    ['ply-26bm013', 'cohort-seniors', 'Kunal Sengupta', '26BM013', 17, 'sport-football', null, 'Forward (Sub)', 'ACTIVE', { goals: 2, appearances: 6 }],
    ['ply-26bm014', 'cohort-seniors', 'Manish Pandey', '26BM014', 21, 'sport-football', null, 'Defender (Sub)', 'ACTIVE', { tackles: 8, appearances: 4 }],

    // Cricket (12)
    ['ply-26bm015', 'cohort-seniors', 'Devansh Mehra', '26BM015', 18, 'sport-cricket', null, 'Fast Bowler', 'INJURED', { wickets: 14, economy: 6.8 }],
    ['ply-26bm016', 'cohort-seniors', 'Raghavendra Joshi', '26BM016', 7, 'sport-cricket', null, 'All-Rounder / Captain', 'ACTIVE', { runs: 320, wickets: 8 }],
    ['ply-26bm017', 'cohort-seniors', 'Sameer Saxena', '26BM017', 45, 'sport-cricket', null, 'Opening Batsman', 'ACTIVE', { runs: 275, strikeRate: 138.5 }],
    ['ply-26bm018', 'cohort-seniors', 'Yashwant Reddy', '26BM018', 12, 'sport-cricket', null, 'Wicketkeeper Batsman', 'ACTIVE', { runs: 210, dismissals: 9 }],
    ['ply-26bm019', 'cohort-seniors', 'Kartik Sundaram', '26BM019', 99, 'sport-cricket', null, 'Spin Bowler', 'ACTIVE', { wickets: 16, economy: 5.4 }],
    ['ply-26bm020', 'cohort-seniors', 'Aman Deep', '26BM020', 33, 'sport-cricket', null, 'Top Order Batsman', 'ACTIVE', { runs: 190, strikeRate: 124.0 }],
    ['ply-26bm021', 'cohort-seniors', 'Rakesh Bhatia', '26BM021', 24, 'sport-cricket', null, 'Medium Pacer', 'ACTIVE', { wickets: 9, economy: 7.2 }],
    ['ply-26bm022', 'cohort-seniors', 'Alok Trivedi', '26BM022', 55, 'sport-cricket', null, 'Middle Order Batsman', 'ACTIVE', { runs: 145, strikeRate: 118.0 }],
    ['ply-26bm023', 'cohort-seniors', 'Chirag Jha', '26BM023', 8, 'sport-cricket', null, 'All-Rounder', 'ACTIVE', { runs: 110, wickets: 6 }],
    ['ply-26bm024', 'cohort-seniors', 'Vishal Goswami', '26BM024', 16, 'sport-cricket', null, 'Off Spinner', 'ACTIVE', { wickets: 11, economy: 6.1 }],
    ['ply-26bm025', 'cohort-seniors', 'Ankit Kaul', '26BM025', 63, 'sport-cricket', null, 'Opening Batsman', 'ACTIVE', { runs: 160, strikeRate: 131.0 }],
    ['ply-26bm026', 'cohort-seniors', 'Saurabh Agarwal', '26BM026', 77, 'sport-cricket', null, 'Bowler (Sub)', 'ACTIVE', { wickets: 4, appearances: 3 }],

    // Basketball Men (6)
    ['ply-26bm027', 'cohort-seniors', 'Vikrant Choudhary', '26BM027', 23, 'sport-basketball-m', null, 'Power Forward / Captain', 'ACTIVE', { ppg: 19.4, rpg: 8.2 }],
    ['ply-26bm028', 'cohort-seniors', 'Gautam Sehgal', '26BM028', 3, 'sport-basketball-m', null, 'Point Guard', 'ACTIVE', { ppg: 14.1, apg: 7.6 }],
    ['ply-26bm029', 'cohort-seniors', 'Ishaan Malhotra', '26BM029', 15, 'sport-basketball-m', null, 'Center', 'ACTIVE', { ppg: 12.0, rpg: 10.5 }],
    ['ply-26bm030', 'cohort-seniors', 'Tushar Kapoor', '26BM030', 11, 'sport-basketball-m', null, 'Shooting Guard', 'ACTIVE', { ppg: 16.8, threePtPct: 38.5 }],
    ['ply-26bm031', 'cohort-seniors', 'Rohan Bhargava', '26BM031', 24, 'sport-basketball-m', null, 'Small Forward', 'ACTIVE', { ppg: 11.2, rpg: 5.4 }],
    ['ply-26bm032', 'cohort-seniors', 'Mihir Shukla', '26BM032', 34, 'sport-basketball-m', null, 'Forward (Sub)', 'INJURED', { ppg: 8.0, rpg: 3.5 }],

    // Basketball Women (5)
    ['ply-26bm033', 'cohort-seniors', 'Ananya Sen', '26BM033', 10, 'sport-basketball-f', null, 'Point Guard / Captain', 'ACTIVE', { ppg: 17.5, apg: 6.2 }],
    ['ply-26bm034', 'cohort-seniors', 'Sneha Chatterjee', '26BM034', 7, 'sport-basketball-f', null, 'Shooting Guard', 'ACTIVE', { ppg: 13.8, spg: 2.4 }],
    ['ply-26bm035', 'cohort-seniors', 'Riya Deshmukh', '26BM035', 14, 'sport-basketball-f', null, 'Center', 'ACTIVE', { ppg: 10.5, rpg: 8.9 }],
    ['ply-26bm036', 'cohort-seniors', 'Tanvi Kulkarni', '26BM036', 21, 'sport-basketball-f', null, 'Power Forward', 'ACTIVE', { ppg: 9.4, rpg: 6.1 }],
    ['ply-26bm037', 'cohort-seniors', 'Shreya Namboodiri', '26BM037', 5, 'sport-basketball-f', null, 'Small Forward', 'ACTIVE', { ppg: 8.2, rpg: 4.0 }],

    // Volleyball (6)
    ['ply-26bm038', 'cohort-seniors', 'Arvind Swaminathan', '26BM038', 6, 'sport-volleyball', null, 'Setter / Captain', 'ACTIVE', { assists: 64, aces: 12 }],
    ['ply-26bm039', 'cohort-seniors', 'Mayank Tiwari', '26BM039', 9, 'sport-volleyball', null, 'Outside Hitter', 'ACTIVE', { kills: 48, digs: 22 }],
    ['ply-26bm040', 'cohort-seniors', 'Rahul Pillai', '26BM040', 12, 'sport-volleyball', null, 'Middle Blocker', 'ACTIVE', { blocks: 31, kills: 24 }],
    ['ply-26bm041', 'cohort-seniors', 'Abhinav Menon', '26BM041', 1, 'sport-volleyball', null, 'Libero', 'ACTIVE', { digs: 78, receptions: 92 }],
    ['ply-26bm042', 'cohort-seniors', 'Dipankar Bose', '26BM042', 8, 'sport-volleyball', null, 'Opposite Hitter', 'ACTIVE', { kills: 36, aces: 9 }],
    ['ply-26bm043', 'cohort-seniors', 'Vivek Chawla', '26BM043', 4, 'sport-volleyball', null, 'Middle Blocker', 'ACTIVE', { blocks: 19, kills: 15 }],

    // Badminton Men (3)
    ['ply-26bm044', 'cohort-seniors', 'Prateek Goel', '26BM044', 1, 'sport-badminton-m', 'sport-table-tennis', 'Singles 1 / Captain', 'ACTIVE', { matches: 15, wins: 13 }],
    ['ply-26bm045', 'cohort-seniors', 'Jayant Mahajan', '26BM045', 2, 'sport-badminton-m', null, 'Doubles 1', 'ACTIVE', { matches: 12, wins: 9 }],
    ['ply-26bm046', 'cohort-seniors', 'Sandeep Rawat', '26BM046', 3, 'sport-badminton-m', null, 'Doubles 2', 'ACTIVE', { matches: 12, wins: 9 }],

    // Badminton Women (3)
    ['ply-26hr001', 'cohort-seniors', 'Priya Nair', '26HR001', 1, 'sport-badminton-f', null, 'Singles 1 / Captain', 'ACTIVE', { matches: 14, wins: 12 }],
    ['ply-26hr002', 'cohort-seniors', 'Divya Sharma', '26HR002', 2, 'sport-badminton-f', null, 'Doubles 1', 'ACTIVE', { matches: 10, wins: 7 }],
    ['ply-26hr003', 'cohort-seniors', 'Meera Iyer', '26HR003', 3, 'sport-badminton-f', null, 'Doubles 2', 'INJURED', { matches: 8, wins: 5 }],

    // Table Tennis (2)
    ['ply-26hr004', 'cohort-seniors', 'Sourav Mukhopadhyay', '26HR004', 1, 'sport-table-tennis', null, 'Singles 1 / Captain', 'ACTIVE', { winRate: 78.5 }],
    ['ply-26hr005', 'cohort-seniors', 'Shweta Paul', '26HR005', 2, 'sport-table-tennis', null, 'Singles 2', 'ACTIVE', { winRate: 65.0 }],

    // Tennis (2)
    ['ply-26hr006', 'cohort-seniors', 'Aditi Srinivas', '26HR006', 1, 'sport-tennis', null, 'Singles / Captain', 'ACTIVE', { ranking: 1, wins: 8 }],
    ['ply-26hr007', 'cohort-seniors', 'Keshav Anand', '26HR007', 2, 'sport-tennis', null, 'Doubles', 'ACTIVE', { wins: 6, aces: 24 }],

    // Track & Field (3)
    ['ply-26hr008', 'cohort-seniors', 'Harshita Yadav', '26HR008', 7, 'sport-track-field-f', null, 'Sprinter (100m, 200m)', 'INJURED', { best100m: '12.4s' }],
    ['ply-26hr009', 'cohort-seniors', 'Deepak Soni', '26HR009', 8, 'sport-track-field-m', null, 'Mid Distance (400m)', 'ACTIVE', { best400m: '49.8s' }],
    ['ply-26hr010', 'cohort-seniors', 'Naman Khattar', '26HR010', 9, 'sport-track-field-m', null, 'Shot Put / Discus', 'ACTIVE', { bestShotPut: '13.4m' }],

    // Chess (4 boards matching rules_json boards: 4)
    ['ply-26bm047', 'cohort-seniors', 'Aditya Singhania', '26BM047', 1, 'sport-chess', null, 'Board 1 / Captain', 'ACTIVE', { elo: 1940, rapidRating: 1980, wins: 8, draws: 3, losses: 1 }],
    ['ply-26bm048', 'cohort-seniors', 'Devika Ramanathan', '26BM048', 2, 'sport-chess', null, 'Board 2', 'ACTIVE', { elo: 1820, rapidRating: 1850, wins: 6, draws: 4, losses: 2 }],
    ['ply-26bm049', 'cohort-seniors', 'Anand Mohan', '26BM049', 3, 'sport-chess', null, 'Board 3', 'ACTIVE', { elo: 1750, rapidRating: 1790, wins: 5, draws: 5, losses: 2 }],
    ['ply-26hr011', 'cohort-seniors', 'Vandana Swamy', '26HR011', 4, 'sport-chess', null, 'Board 4', 'ACTIVE', { elo: 1680, rapidRating: 1720, wins: 4, draws: 4, losses: 3 }],

    // Pool (2)
    ['ply-26bm050', 'cohort-seniors', 'Rishit Shah', '26BM050', 8, 'sport-pool', null, 'Singles 1 / Captain', 'ACTIVE', { breakAndRuns: 14, winRate: 78.5, matchesPlayed: 16 }],
    ['ply-26bm051', 'cohort-seniors', 'Tarini Mukherji', '26BM051', 9, 'sport-pool', null, 'Singles 2 / Doubles', 'ACTIVE', { runOuts: 9, winRate: 69.2, matchesPlayed: 13 }],

    // Throwball (7 players matching rules_json playersPerTeam: 7)
    ['ply-26hr012', 'cohort-seniors', 'Ritu Rajagopalan', '26HR012', 1, 'sport-throwball', null, 'Center / Captain', 'ACTIVE', { catches: 48, aces: 16, points: 32 }],
    ['ply-26hr013', 'cohort-seniors', 'Ananya Mittal', '26HR013', 2, 'sport-throwball', null, 'Left Forward', 'ACTIVE', { catches: 36, drops: 19, points: 24 }],
    ['ply-26hr014', 'cohort-seniors', 'Shalini Pillai', '26HR014', 3, 'sport-throwball', null, 'Right Forward', 'ACTIVE', { catches: 34, drops: 17, points: 22 }],
    ['ply-26hr015', 'cohort-seniors', 'Pallavi Deshmukh', '26HR015', 4, 'sport-throwball', null, 'Center Back', 'ACTIVE', { catches: 58, defensiveReturns: 50, points: 9 }],
    ['ply-26hr016', 'cohort-seniors', 'Deepika Nambiar', '26HR016', 5, 'sport-throwball', null, 'Left Back', 'ACTIVE', { catches: 45, defensiveReturns: 41, points: 7 }],
    ['ply-26bm052', 'cohort-seniors', 'Swati Kulkarni', '26BM052', 6, 'sport-throwball', null, 'Right Back', 'ACTIVE', { catches: 43, defensiveReturns: 38, points: 6 }],
    ['ply-26bm053', 'cohort-seniors', 'Pooja Kashyap', '26BM053', 7, 'sport-throwball', null, 'Setter', 'ACTIVE', { assists: 42, catches: 31, points: 14 }],

    // Futsal (5 players matching rules_json playersPerTeam: 5 - dedicated primary sport)
    ['ply-26bm054', 'cohort-seniors', 'Karthik Subramanian', '26BM054', 10, 'sport-futsal', 'sport-football', 'Pivot / Captain', 'ACTIVE', { goals: 12, assists: 7, shotsOnTarget: 31 }],
    ['ply-26bm055', 'cohort-seniors', 'Zeeshan Khan', '26BM055', 4, 'sport-futsal', null, 'Fixo (Defender)', 'ACTIVE', { tackles: 28, interceptions: 24, cleanSheets: 3 }],
    ['ply-26bm056', 'cohort-seniors', 'Prateek Batra', '26BM056', 7, 'sport-futsal', null, 'Left Ala (Winger)', 'ACTIVE', { goals: 8, assists: 10, dribbleSuccess: 76 }],
    ['ply-26bm057', 'cohort-seniors', 'Chaitanya Joshi', '26BM057', 11, 'sport-futsal', null, 'Right Ala (Winger)', 'ACTIVE', { goals: 7, assists: 8, dribbleSuccess: 72 }],
    ['ply-26bm058', 'cohort-seniors', 'Sameer Kulkarni', '26BM058', 1, 'sport-futsal', null, 'Goalkeeper', 'ACTIVE', { saves: 44, savePct: 82.5, cleanSheets: 3 }],

    // Track & Field Women (2 additions bringing total to 3)
    ['ply-26bm059', 'cohort-seniors', 'Aditi Rathore', '26BM059', 8, 'sport-track-field-f', null, 'Middle Distance (400m)', 'ACTIVE', { best400m: '58.4s', best800m: '2m 16s' }],
    ['ply-26bm060', 'cohort-seniors', 'Neha Sengupta', '26BM060', 9, 'sport-track-field-f', null, 'Long Jump / Relay', 'ACTIVE', { bestLongJump: '5.38m', best4x100m: '50.2s' }],

    // Track & Field Men (1 addition bringing total to 3)
    ['ply-26bm061', 'cohort-seniors', 'Tejaswin Shankar', '26BM061', 7, 'sport-track-field-m', null, 'Sprinter (100m, 200m) / Captain', 'ACTIVE', { best100m: '10.82s', best200m: '21.5s' }],
  ];

  const juniorPlayers: [string, string, string, string, number, string, string | null, string, string, Record<string, any>][] = [
    // Football (14)
    ['ply-27bm001', 'cohort-juniors', "Neil D'Souza", '27BM001', 10, 'sport-football', 'sport-futsal', 'Forward / Captain', 'ACTIVE', { goals: 7, assists: 4 }],
    ['ply-27bm002', 'cohort-juniors', 'Farhan Akhtar', '27BM002', 7, 'sport-football', 'sport-futsal', 'Right Winger', 'ACTIVE', { goals: 5, assists: 6 }],
    ['ply-27bm003', 'cohort-juniors', 'Tanmay Roy', '27BM003', 9, 'sport-football', null, 'Center Forward', 'ACTIVE', { goals: 9, assists: 1 }],
    ['ply-27bm004', 'cohort-juniors', 'Raghav Mittal', '27BM004', 4, 'sport-football', null, 'Center Back', 'ACTIVE', { tackles: 22, cleanSheets: 2 }],
    ['ply-27bm005', 'cohort-juniors', 'Shreyas Bhatt', '27BM005', 5, 'sport-football', null, 'Center Back', 'INJURED', { tackles: 18, cleanSheets: 2 }],
    ['ply-27bm006', 'cohort-juniors', 'Rishabh Jain', '27BM006', 1, 'sport-football', null, 'Goalkeeper', 'ACTIVE', { saves: 38, cleanSheets: 3 }],
    ['ply-27bm007', 'cohort-juniors', 'Dhruv Khurana', '27BM007', 8, 'sport-football', null, 'Central Midfielder', 'ACTIVE', { passAccuracy: 84, assists: 3 }],
    ['ply-27bm008', 'cohort-juniors', 'Anish Hegde', '27BM008', 6, 'sport-football', null, 'Defensive Midfielder', 'ACTIVE', { interceptions: 21, yellowCards: 3 }],
    ['ply-27bm009', 'cohort-juniors', 'Utkarsh Rastogi', '27BM009', 3, 'sport-football', null, 'Left Back', 'ACTIVE', { tackles: 16, crosses: 11 }],
    ['ply-27bm010', 'cohort-juniors', 'Varun Sood', '27BM010', 2, 'sport-football', null, 'Right Back', 'ACTIVE', { tackles: 17, interceptions: 13 }],
    ['ply-27bm011', 'cohort-juniors', 'Ayushman Sinha', '27BM011', 11, 'sport-football', null, 'Left Winger', 'ACTIVE', { goals: 4, assists: 5 }],
    ['ply-27bm012', 'cohort-juniors', 'Siddhant Joshi', '27BM012', 14, 'sport-football', null, 'Attacking Midfielder', 'ACTIVE', { goals: 3, assists: 4 }],
    ['ply-27bm013', 'cohort-juniors', 'Aryan Mathur', '27BM013', 17, 'sport-football', null, 'Forward (Sub)', 'ACTIVE', { goals: 1, appearances: 5 }],
    ['ply-27bm014', 'cohort-juniors', 'Ronit Das', '27BM014', 21, 'sport-football', null, 'Defender (Sub)', 'ACTIVE', { tackles: 7, appearances: 4 }],

    // Cricket (12)
    ['ply-27bm015', 'cohort-juniors', 'Agastya Chauhan', '27BM015', 18, 'sport-cricket', null, 'All-Rounder / Captain', 'ACTIVE', { runs: 290, wickets: 10 }],
    ['ply-27bm016', 'cohort-juniors', 'Madhav Singhania', '27BM016', 7, 'sport-cricket', null, 'Opening Batsman', 'ACTIVE', { runs: 240, strikeRate: 142.0 }],
    ['ply-27bm017', 'cohort-juniors', 'Kabir Sehgal', '27BM017', 45, 'sport-cricket', null, 'Top Order Batsman', 'ACTIVE', { runs: 180, strikeRate: 128.5 }],
    ['ply-27bm018', 'cohort-juniors', 'Samarth Saxena', '27BM018', 12, 'sport-cricket', null, 'Wicketkeeper', 'INJURED', { runs: 130, dismissals: 7 }],
    ['ply-27bm019', 'cohort-juniors', 'Vihaan Kothari', '27BM019', 99, 'sport-cricket', null, 'Fast Bowler', 'ACTIVE', { wickets: 15, economy: 6.5 }],
    ['ply-27bm020', 'cohort-juniors', 'Pratyush Mishra', '27BM020', 33, 'sport-cricket', null, 'Leg Spinner', 'ACTIVE', { wickets: 13, economy: 5.8 }],
    ['ply-27bm021', 'cohort-juniors', 'Arnav Kapoor', '27BM021', 24, 'sport-cricket', null, 'Medium Pacer', 'ACTIVE', { wickets: 8, economy: 7.0 }],
    ['ply-27bm022', 'cohort-juniors', 'Tejas Patel', '27BM022', 55, 'sport-cricket', null, 'Middle Order Batsman', 'ACTIVE', { runs: 115, strikeRate: 115.0 }],
    ['ply-27bm023', 'cohort-juniors', 'Manan Sethi', '27BM023', 8, 'sport-cricket', null, 'All-Rounder', 'ACTIVE', { runs: 95, wickets: 5 }],
    ['ply-27bm024', 'cohort-juniors', 'Reyansh Gill', '27BM024', 16, 'sport-cricket', null, 'Off Spinner', 'ACTIVE', { wickets: 7, economy: 6.3 }],
    ['ply-27bm025', 'cohort-juniors', 'Sparsh Malhotra', '27BM025', 63, 'sport-cricket', null, 'Opening Batsman', 'ACTIVE', { runs: 140, strikeRate: 125.0 }],
    ['ply-27bm026', 'cohort-juniors', 'Eshan Vats', '27BM026', 77, 'sport-cricket', null, 'Bowler (Sub)', 'ACTIVE', { wickets: 3, appearances: 2 }],

    // Basketball Men (6)
    ['ply-27bm027', 'cohort-juniors', 'Armaan Malik', '27BM027', 23, 'sport-basketball-m', null, 'Point Guard / Captain', 'ACTIVE', { ppg: 21.2, apg: 8.4 }],
    ['ply-27bm028', 'cohort-juniors', 'Vedant Somani', '27BM028', 3, 'sport-basketball-m', null, 'Shooting Guard', 'ACTIVE', { ppg: 18.0, threePtPct: 41.2 }],
    ['ply-27bm029', 'cohort-juniors', 'Parth Bansal', '27BM029', 15, 'sport-basketball-m', null, 'Small Forward', 'ACTIVE', { ppg: 13.5, rpg: 6.1 }],
    ['ply-27bm030', 'cohort-juniors', 'Jayesh Agarwal', '27BM030', 11, 'sport-basketball-m', null, 'Power Forward', 'ACTIVE', { ppg: 11.0, rpg: 7.8 }],
    ['ply-27bm031', 'cohort-juniors', 'Ojasvi Sharma', '27BM031', 34, 'sport-basketball-m', null, 'Center', 'ACTIVE', { ppg: 9.4, rpg: 9.6 }],
    ['ply-27bm032', 'cohort-juniors', 'Bhavya Narang', '27BM032', 24, 'sport-basketball-m', null, 'Guard (Sub)', 'ACTIVE', { ppg: 6.5, apg: 2.8 }],

    // Basketball Women (5)
    ['ply-27bm033', 'cohort-juniors', 'Ishita Goyal', '27BM033', 10, 'sport-basketball-f', null, 'Shooting Guard / Captain', 'ACTIVE', { ppg: 16.2, threePtPct: 36.8 }],
    ['ply-27bm034', 'cohort-juniors', 'Radhika Somany', '27BM034', 7, 'sport-basketball-f', null, 'Point Guard', 'ACTIVE', { ppg: 12.4, apg: 7.1 }],
    ['ply-27bm035', 'cohort-juniors', 'Sanjana Reddy', '27BM035', 14, 'sport-basketball-f', null, 'Center', 'ACTIVE', { ppg: 11.8, rpg: 9.2 }],
    ['ply-27bm036', 'cohort-juniors', 'Kritika Sen', '27BM036', 21, 'sport-basketball-f', null, 'Power Forward', 'INJURED', { ppg: 7.5, rpg: 5.4 }],
    ['ply-27bm037', 'cohort-juniors', 'Avani Murthy', '27BM037', 5, 'sport-basketball-f', null, 'Small Forward', 'ACTIVE', { ppg: 8.0, rpg: 4.2 }],

    // Volleyball (6)
    ['ply-27bm038', 'cohort-juniors', 'Chirayu Bajaj', '27BM038', 6, 'sport-volleyball', null, 'Outside Hitter / Captain', 'ACTIVE', { kills: 52, aces: 11 }],
    ['ply-27bm039', 'cohort-juniors', 'Nitesh Chandra', '27BM039', 9, 'sport-volleyball', null, 'Setter', 'ACTIVE', { assists: 59, digs: 20 }],
    ['ply-27bm040', 'cohort-juniors', 'Saksham Verma', '27BM040', 12, 'sport-volleyball', null, 'Middle Blocker', 'ACTIVE', { blocks: 28, kills: 21 }],
    ['ply-27bm041', 'cohort-juniors', 'Hrithik Puri', '27BM041', 1, 'sport-volleyball', null, 'Libero', 'ACTIVE', { digs: 84, receptions: 89 }],
    ['ply-27bm042', 'cohort-juniors', 'Shlok Tandon', '27BM042', 8, 'sport-volleyball', null, 'Opposite Hitter', 'ACTIVE', { kills: 33, aces: 8 }],
    ['ply-27bm043', 'cohort-juniors', 'Lakshya Seth', '27BM043', 4, 'sport-volleyball', null, 'Middle Blocker', 'ACTIVE', { blocks: 17, kills: 12 }],

    // Badminton Men (3)
    ['ply-27bm044', 'cohort-juniors', 'Ranveer Grover', '27BM044', 1, 'sport-badminton-m', null, 'Singles 1 / Captain', 'ACTIVE', { matches: 13, wins: 10 }],
    ['ply-27bm045', 'cohort-juniors', 'Yug Poddar', '27BM045', 2, 'sport-badminton-m', null, 'Doubles 1', 'ACTIVE', { matches: 11, wins: 8 }],
    ['ply-27bm046', 'cohort-juniors', 'Ahaan Mehra', '27BM046', 3, 'sport-badminton-m', null, 'Doubles 2', 'ACTIVE', { matches: 11, wins: 8 }],

    // Badminton Women (3)
    ['ply-27hr001', 'cohort-juniors', 'Tara Kaushik', '27HR001', 1, 'sport-badminton-f', null, 'Singles 1 / Captain', 'ACTIVE', { matches: 13, wins: 11 }],
    ['ply-27hr002', 'cohort-juniors', 'Mallika Bhatnagar', '27HR002', 2, 'sport-badminton-f', null, 'Doubles 1', 'INJURED', { matches: 9, wins: 6 }],
    ['ply-27hr003', 'cohort-juniors', 'Roshni Chhabra', '27HR003', 3, 'sport-badminton-f', null, 'Doubles 2', 'ACTIVE', { matches: 9, wins: 6 }],

    // Table Tennis (2)
    ['ply-27hr004', 'cohort-juniors', 'Manav Thakkar', '27HR004', 1, 'sport-table-tennis', null, 'Singles 1 / Captain', 'ACTIVE', { winRate: 82.0 }],
    ['ply-27hr005', 'cohort-juniors', 'Dia Chitale', '27HR005', 2, 'sport-table-tennis', null, 'Singles 2', 'ACTIVE', { winRate: 71.5 }],

    // Tennis (2)
    ['ply-27hr006', 'cohort-juniors', 'Aryan Goveas', '27HR006', 1, 'sport-tennis', null, 'Singles / Captain', 'ACTIVE', { ranking: 2, wins: 7 }],
    ['ply-27hr007', 'cohort-juniors', 'Zeel Desai', '27HR007', 2, 'sport-tennis', null, 'Doubles', 'INJURED', { wins: 5, aces: 18 }],

    // Track & Field (3)
    ['ply-27hr008', 'cohort-juniors', 'Amlan Borgohain', '27HR008', 7, 'sport-track-field-m', null, 'Sprinter (100m, 200m)', 'ACTIVE', { best100m: '10.88s' }],
    ['ply-27hr009', 'cohort-juniors', 'Jeswin Aldrin', '27HR009', 8, 'sport-track-field-m', null, 'Long Jump', 'ACTIVE', { bestLongJump: '7.85m' }],
    ['ply-27hr010', 'cohort-juniors', 'Rohit Yadav', '27HR010', 9, 'sport-track-field-m', null, 'Javelin / Shot Put', 'ACTIVE', { bestJavelin: '72.4m' }],

    // Chess (4 boards matching rules_json boards: 4)
    ['ply-27bm047', 'cohort-juniors', 'Nihal Sarin Das', '27BM047', 1, 'sport-chess', null, 'Board 1 / Captain', 'ACTIVE', { elo: 1960, rapidRating: 2010, wins: 9, draws: 2, losses: 1 }],
    ['ply-27bm048', 'cohort-juniors', 'Pranav Venkatesh', '27BM048', 2, 'sport-chess', null, 'Board 2', 'ACTIVE', { elo: 1840, rapidRating: 1870, wins: 7, draws: 3, losses: 2 }],
    ['ply-27bm049', 'cohort-juniors', 'Isha Khandeparkar', '27BM049', 3, 'sport-chess', null, 'Board 3', 'ACTIVE', { elo: 1730, rapidRating: 1760, wins: 5, draws: 5, losses: 2 }],
    ['ply-27hr011', 'cohort-juniors', 'Siddharth Kaushik', '27HR011', 4, 'sport-chess', null, 'Board 4', 'ACTIVE', { elo: 1690, rapidRating: 1710, wins: 4, draws: 5, losses: 2 }],

    // Pool (2)
    ['ply-27bm050', 'cohort-juniors', 'Karan Talwar', '27BM050', 8, 'sport-pool', null, 'Singles 1 / Captain', 'ACTIVE', { breakAndRuns: 12, winRate: 75.0, matchesPlayed: 14 }],
    ['ply-27bm051', 'cohort-juniors', 'Meghna Kapoor', '27BM051', 9, 'sport-pool', null, 'Singles 2 / Doubles', 'ACTIVE', { runOuts: 8, winRate: 66.7, matchesPlayed: 12 }],

    // Throwball (7 players matching rules_json playersPerTeam: 7)
    ['ply-27hr012', 'cohort-juniors', 'Simran Kaur', '27HR012', 1, 'sport-throwball', null, 'Center / Captain', 'ACTIVE', { catches: 46, aces: 15, points: 30 }],
    ['ply-27hr013', 'cohort-juniors', 'Lavanya Sundaram', '27HR013', 2, 'sport-throwball', null, 'Left Forward', 'ACTIVE', { catches: 38, drops: 21, points: 26 }],
    ['ply-27hr014', 'cohort-juniors', 'Rhea Chhabra', '27HR014', 3, 'sport-throwball', null, 'Right Forward', 'ACTIVE', { catches: 33, drops: 16, points: 20 }],
    ['ply-27hr015', 'cohort-juniors', 'Aakriti Sen', '27HR015', 4, 'sport-throwball', null, 'Center Back', 'ACTIVE', { catches: 55, defensiveReturns: 47, points: 8 }],
    ['ply-27hr016', 'cohort-juniors', 'Garima Joshi', '27HR016', 5, 'sport-throwball', null, 'Left Back', 'ACTIVE', { catches: 42, defensiveReturns: 39, points: 6 }],
    ['ply-27bm052', 'cohort-juniors', 'Tanya Aggarwal', '27BM052', 6, 'sport-throwball', null, 'Right Back', 'ACTIVE', { catches: 40, defensiveReturns: 36, points: 5 }],
    ['ply-27bm053', 'cohort-juniors', 'Bani Batra', '27BM053', 7, 'sport-throwball', null, 'Setter', 'ACTIVE', { assists: 39, catches: 28, points: 12 }],

    // Futsal (5 players matching rules_json playersPerTeam: 5 - dedicated primary sport)
    ['ply-27bm054', 'cohort-juniors', 'Zaheer Ahmed', '27BM054', 10, 'sport-futsal', 'sport-football', 'Pivot / Captain', 'ACTIVE', { goals: 10, assists: 6, shotsOnTarget: 27 }],
    ['ply-27bm055', 'cohort-juniors', 'Aarav Merchant', '27BM055', 4, 'sport-futsal', null, 'Fixo (Defender)', 'ACTIVE', { tackles: 25, interceptions: 21, cleanSheets: 2 }],
    ['ply-27bm056', 'cohort-juniors', 'Tanishq Vora', '27BM056', 7, 'sport-futsal', null, 'Left Ala (Winger)', 'ACTIVE', { goals: 7, assists: 8, dribbleSuccess: 74 }],
    ['ply-27bm057', 'cohort-juniors', 'Kabeer Dewan', '27BM057', 11, 'sport-futsal', null, 'Right Ala (Winger)', 'ACTIVE', { goals: 6, assists: 7, dribbleSuccess: 70 }],
    ['ply-27bm058', 'cohort-juniors', 'Rohan Nanda', '27BM058', 1, 'sport-futsal', null, 'Goalkeeper', 'ACTIVE', { saves: 40, savePct: 79.4, cleanSheets: 2 }],

    // Track & Field Women (3 additions bringing total to 3)
    ['ply-27bm059', 'cohort-juniors', 'Dutee Chandana', '27BM059', 7, 'sport-track-field-f', null, 'Sprinter (100m, 200m) / Captain', 'ACTIVE', { best100m: '12.05s', best200m: '24.9s' }],
    ['ply-27bm060', 'cohort-juniors', 'Kavita Bind', '27BM060', 8, 'sport-track-field-f', null, 'Middle Distance (400m)', 'ACTIVE', { best400m: '57.6s' }],
    ['ply-27bm061', 'cohort-juniors', 'Ancy Sojan', '27BM061', 9, 'sport-track-field-f', null, 'Long Jump / Shot Put', 'ACTIVE', { bestLongJump: '5.62m', bestShotPut: '11.8m' }],
  ];

  const insertPlayer = db.prepare(`
    INSERT OR REPLACE INTO players (id, cohort_id, name, student_id, jersey_number, primary_sport_id, secondary_sport_id, position, status, stats_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of [...seniorPlayers, ...juniorPlayers]) {
    insertPlayer.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], JSON.stringify(p[9]));
  }

  // 6. 12 Matches Spanning All Lifecycle States
  const matchesData: [string, string, string, string, string, string, string, string, string, number, number, string, number, string, string][] = [
    // 1. Published (Football) - Seniors win 3-1
    [
      'match-01', 'tourn-xlri-2026', 'sport-football', 'cohort-seniors', 'cohort-juniors',
      'Main Football Ground', '2026-10-10T10:00:00.000Z', 'usr-ref-1', 'PUBLISHED',
      3, 1, 'Full Time', 5400,
      JSON.stringify({ halves: 2, homeGoals: 3, awayGoals: 1, yellowCards: 3 }),
      'High-intensity tournament opener. Seniors controlled possession in second half.'
    ],
    // 2. Published (Basketball M) - Juniors win 74-68
    [
      'match-02', 'tourn-xlri-2026', 'sport-basketball-m', 'cohort-seniors', 'cohort-juniors',
      'Outdoor Basketball Court 1', '2026-10-10T14:30:00.000Z', 'usr-ref-1', 'PUBLISHED',
      68, 74, 'Final / Q4', 2400,
      JSON.stringify({ quarters: [18, 16, 17, 17], quartersAway: [15, 18, 19, 22] }),
      'Electrifying fourth quarter surge led by Juniors backcourt.'
    ],
    // 3. Published (Badminton M) - Seniors win 2-0
    [
      'match-03', 'tourn-xlri-2026', 'sport-badminton-m', 'cohort-seniors', 'cohort-juniors',
      'Sports Complex Indoor Court A', '2026-10-11T09:30:00.000Z', 'usr-ref-3', 'PUBLISHED',
      2, 0, 'Match Concluded', 2700,
      JSON.stringify({ sets: [{ home: 21, away: 16 }, { home: 21, away: 18 }] }),
      'Seniors captain delivered clinical straight-sets performance.'
    ],
    // 4. Published (Chess) - Draw 2-2
    [
      'match-04', 'tourn-xlri-2026', 'sport-chess', 'cohort-seniors', 'cohort-juniors',
      'Student Activity Centre Boardroom', '2026-10-11T11:00:00.000Z', 'usr-ref-2', 'PUBLISHED',
      2, 2, 'Round 4 Concluded', 3600,
      JSON.stringify({ boardResults: ['1-0', '0-1', '0.5-0.5', '0.5-0.5'] }),
      'Tight tactical battle ending in a 2-2 deadlock across four boards.'
    ],
    // 5. Verified (Cricket) - Seniors 154 vs Juniors 150 (Awaiting official publish)
    [
      'match-05', 'tourn-xlri-2026', 'sport-cricket', 'cohort-seniors', 'cohort-juniors',
      'Main Cricket Oval', '2026-10-11T14:00:00.000Z', 'usr-ref-2', 'VERIFIED',
      154, 150, 'Innings 2 Finished', 7200,
      JSON.stringify({ innings1: { runs: 154, wickets: 6, overs: '10.0' }, innings2: { runs: 150, wickets: 8, overs: '10.0' } }),
      'Verified by Sports Committee: Seniors won by 4 runs in last-over thriller.'
    ],
    // 6. Verified (Table Tennis) - Juniors win 3-2 (Awaiting official publish)
    [
      'match-06', 'tourn-xlri-2026', 'sport-table-tennis', 'cohort-seniors', 'cohort-juniors',
      'Indoor Sports Hall Table 1', '2026-10-12T10:00:00.000Z', 'usr-ref-3', 'VERIFIED',
      2, 3, 'Final Set 5', 2400,
      JSON.stringify({ sets: ['11-9', '8-11', '11-7', '9-11', '8-11'] }),
      'Scorecard audited and verified. Juniors clinch deciding set 11-8.'
    ],
    // 7. Submitted (Volleyball) - Seniors 3-1 (Awaiting Sports Committee verification)
    [
      'match-07', 'tourn-xlri-2026', 'sport-volleyball', 'cohort-seniors', 'cohort-juniors',
      'Outdoor Volleyball Court', '2026-10-12T15:00:00.000Z', 'usr-ref-1', 'SUBMITTED',
      3, 1, 'Set 4 Completed', 4800,
      JSON.stringify({ sets: [{ home: 25, away: 21 }, { home: 22, away: 25 }, { home: 25, away: 19 }, { home: 25, away: 18 }] }),
      'Submitted by Referee Rohan Verma. Scorecard awaiting committee review.'
    ],
    // 8. Submitted (Basketball W) - Juniors 52-48 (Awaiting Sports Committee verification)
    [
      'match-08', 'tourn-xlri-2026', 'sport-basketball-f', 'cohort-seniors', 'cohort-juniors',
      'Outdoor Basketball Court 2', '2026-10-12T16:30:00.000Z', 'usr-ref-1', 'SUBMITTED',
      48, 52, 'Q4 Ended', 2400,
      JSON.stringify({ quarters: [12, 14, 10, 12], quartersAway: [14, 11, 13, 14] }),
      'Submitted by Referee Rohan Verma. Final foul contest resolved on court.'
    ],
    // 9. Draft (Futsal) - Live / In Progress 2-1 (33rd minute)
    [
      'match-09', 'tourn-xlri-2026', 'sport-futsal', 'cohort-seniors', 'cohort-juniors',
      'Indoor Futsal Arena', '2026-10-13T11:00:00.000Z', 'usr-ref-1', 'DRAFT',
      2, 1, '2nd Half', 1980,
      JSON.stringify({ currentPeriod: '2nd Half', homeFouls: 3, awayFouls: 4 }),
      'Live match active on scoring pad. High intensity indoor play.'
    ],
    // 10. Draft (Badminton W) - Live / In Progress 1-1 sets (Set 3 decider)
    [
      'match-10', 'tourn-xlri-2026', 'sport-badminton-f', 'cohort-seniors', 'cohort-juniors',
      'Sports Complex Indoor Court B', '2026-10-13T11:30:00.000Z', 'usr-ref-3', 'DRAFT',
      1, 1, 'Set 3 (Decider)', 2100,
      JSON.stringify({ sets: [{ home: 21, away: 17 }, { home: 18, away: 21 }], currentSet: 3, homePoints: 14, awayPoints: 13 }),
      'Live scoring active on pad. Deciding set neck-and-neck at 14-13.'
    ],
    // 11. Scheduled (Tennis) - Upcoming
    [
      'match-11', 'tourn-xlri-2026', 'sport-tennis', 'cohort-seniors', 'cohort-juniors',
      'Campus Tennis Courts', '2026-10-14T09:00:00.000Z', 'usr-ref-3', 'SCHEDULED',
      0, 0, 'Scheduled', 0,
      JSON.stringify({}),
      'Singles championship rubber scheduled for Day 5 morning session.'
    ],
    // 12. Scheduled (Throwball) - Upcoming
    [
      'match-12', 'tourn-xlri-2026', 'sport-throwball', 'cohort-seniors', 'cohort-juniors',
      'SAC Ground South', '2026-10-14T16:00:00.000Z', 'usr-ref-2', 'SCHEDULED',
      0, 0, 'Scheduled', 0,
      JSON.stringify({}),
      'Women contingent throwball showdown scheduled for Day 5 afternoon.'
    ]
  ];

  const insertMatch = db.prepare(`
    INSERT OR REPLACE INTO matches (
      id, tournament_id, sport_id, home_cohort_id, away_cohort_id,
      venue, scheduled_at, referee_id, status,
      score_home, score_away, current_period, current_time_seconds,
      sport_state_json, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const m of matchesData) {
    insertMatch.run(...m);
  }

  // 7. Match Events
  const eventsData: [string, string, string, string, string | null, number, number, string][] = [
    ['ev-01', 'match-01', 'GOAL', 'HOME', 'ply-26bm001', 14, 22, JSON.stringify({ goalType: 'Open Play', assistPlayerId: 'ply-26bm002' })],
    ['ev-02', 'match-01', 'YELLOW_CARD', 'AWAY', 'ply-27bm004', 32, 10, JSON.stringify({ reason: 'Tactical foul' })],
    ['ev-03', 'match-01', 'GOAL', 'AWAY', 'ply-27bm001', 41, 55, JSON.stringify({ goalType: 'Penalty' })],
    ['ev-04', 'match-01', 'GOAL', 'HOME', 'ply-26bm003', 68, 14, JSON.stringify({ goalType: 'Header', assistPlayerId: 'ply-26bm001' })],
    ['ev-05', 'match-01', 'GOAL', 'HOME', 'ply-26bm001', 84, 40, JSON.stringify({ goalType: 'Counter Attack' })],

    ['ev-06', 'match-02', 'POINTS', 'AWAY', 'ply-27bm027', 8, 45, JSON.stringify({ points: 3, shotType: 'Three Pointer' })],
    ['ev-07', 'match-02', 'POINTS', 'HOME', 'ply-26bm027', 14, 10, JSON.stringify({ points: 2, shotType: 'Dunk' })],

    ['ev-08', 'match-09', 'GOAL', 'HOME', 'ply-26bm001', 8, 12, JSON.stringify({ goalType: 'Bottom Corner' })],
    ['ev-09', 'match-09', 'GOAL', 'AWAY', 'ply-27bm002', 19, 40, JSON.stringify({ goalType: 'Rebound' })],
    ['ev-10', 'match-09', 'GOAL', 'HOME', 'ply-26bm002', 27, 30, JSON.stringify({ goalType: 'Toe Poke' })],
  ];

  const insertEvent = db.prepare(`
    INSERT OR REPLACE INTO match_events (id, match_id, event_type, team, player_id, minute, second, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const ev of eventsData) {
    insertEvent.run(...ev);
  }

  // 8. Standings (Official Standings Reflecting the 4 Published Matches)
  // Seniors: Played: 4, Won: 2, Drawn: 1, Lost: 1, PF: 75, PA: 77, Diff: -2, Points: 7
  // Juniors: Played: 4, Won: 1, Drawn: 1, Lost: 2, PF: 77, PA: 75, Diff: +2, Points: 4
  const insertStanding = db.prepare(`
    INSERT OR REPLACE INTO standings (cohort_id, played, won, drawn, lost, points_for, points_against, points_diff, total_points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertStanding.run('cohort-seniors', 4, 2, 1, 1, 75, 77, -2, 7);
  insertStanding.run('cohort-juniors', 4, 1, 1, 2, 77, 75, 2, 4);

  // 9. Audit Logs
  const auditLogsData: [string, string, string, string, string, string, string][] = [
    ['aud-01', 'match-01', 'usr-ref-1', 'SUBMIT_SCORE', 'DRAFT', 'SUBMITTED', 'Match concluded at full time (3-1).'],
    ['aud-02', 'match-01', 'usr-admin-1', 'VERIFY_SCORE', 'SUBMITTED', 'VERIFIED', 'Scorecard verified against referee paper log.'],
    ['aud-03', 'match-01', 'usr-admin-1', 'PUBLISH_RESULT', 'VERIFIED', 'PUBLISHED', 'Result officially committed. Standings updated.'],
    ['aud-04', 'match-05', 'usr-ref-2', 'SUBMIT_SCORE', 'DRAFT', 'SUBMITTED', 'Cricket 10-over scorebook submitted.'],
    ['aud-05', 'match-05', 'usr-admin-1', 'VERIFY_SCORE', 'SUBMITTED', 'VERIFIED', 'Match scorecard certified by committee.'],
    ['aud-06', 'match-07', 'usr-ref-1', 'SUBMIT_SCORE', 'DRAFT', 'SUBMITTED', 'Volleyball 3-1 set scorecard submitted.'],
    ['aud-07', 'match-09', 'usr-ref-1', 'START_MATCH', 'SCHEDULED', 'DRAFT', 'Referee blew whistle to initiate 1st half.'],
  ];

  const insertAudit = db.prepare(`
    INSERT OR REPLACE INTO audit_logs (id, match_id, user_id, action, from_status, to_status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const a of auditLogsData) {
    insertAudit.run(...a);
  }
}

// Standalone execution support: npx tsx server/db/seed.ts
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  (async () => {
    const { getDatabase } = await import('./client.js');
    const { initSchema } = await import('./schema.js');
    const client = getDatabase();
    console.log('Initializing schema if not exists...');
    initSchema(client);
    console.log('Seeding Ratanjee Sports Database...');
    seedDatabase(client, { clean: true });
    console.log('Seeding completed successfully!');
  })().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}
