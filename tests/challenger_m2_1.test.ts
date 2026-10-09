/**
/**
 * Empirical Adversarial Challenge Test Suite: Milestone M2
 * Challenger M2-1 (Gen 2): RBAC & Match Lifecycle State Machine Stress
 *
 * Focus Areas:
 * 1. RBAC Violation Vectors (Anonymous mutations, unassigned referee attacks, admin queue boundaries, verify/publish unauthorized)
 * 2. Lifecycle State Machine Edge Cases (Scorecard locking, empty/whitespace rejection validation, rejection revert & resume, invalid jumps, audit logging)
 * 3. Boundary, Unicode, Injection, and Concurrency Resilience
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  api,
  ADMIN_HEADERS,
  REFEREE_HEADERS,
  SPECTATOR_HEADERS,
  ANONYMOUS_HEADERS,
  type RoleHeaders,
} from './e2e/helpers';
import { DatabaseClient } from '../server/db/client.js';
import { initSchema } from '../server/db/schema.js';
import { seedDatabase } from '../server/db/seed.js';
import {
  transitionMatch,
  isScorecardLocked,
  normalizeStatus,
  isAssignedReferee,
} from '../server/services/lifecycle.js';
import {
  normalizeRole,
  hasPermission,
  matchesRefereeId,
} from '../server/services/rbac.js';

describe('Empirical Challenge M2-1: RBAC & Lifecycle State Machine Stress', () => {

  // Helper to schedule a match with deterministic referee
  async function createTestMatch(refereeId: string = 'ref-alpha', initialStatus: string = 'Draft'): Promise<string> {
    const res = await api.post('/api/matches', {
      sport_id: 'football',
      home_cohort_id: 'cohort-seniors',
      away_cohort_id: 'cohort-juniors',
      venue: 'Challenger Stadium',
      scheduled_at: new Date().toISOString(),
      referee_id: refereeId,
      status: initialStatus,
      notes: 'Test fixture for M2-1 challenge',
    }, ADMIN_HEADERS);
    expect([200, 201]).toContain(res.status);
    return res.data.id;
  }

  // =========================================================================
  // VECTOR 1: RBAC VIOLATION VECTORS
  // =========================================================================

  describe('Vector 1A: Anonymous & Unauthenticated Write Mutation Attempts', () => {
    let testMatchId: string = '';

    beforeEach(async () => {
      testMatchId = await createTestMatch('ref-alpha', 'Draft');
    });

    it('1A.1: Anonymous request cannot schedule new matches (assert 401)', async () => {
      const res = await api.post('/api/matches', {
        sport_id: 'football',
        venue: 'Unauthorized Venue',
      }, ANONYMOUS_HEADERS);
      expect(res.status).toBe(401);
    });

    it('1A.2: Anonymous request cannot update match details (assert 401)', async () => {
      const res = await api.put(`/api/matches/${testMatchId}`, {
        venue: 'Hacked Venue',
      }, ANONYMOUS_HEADERS);
      expect(res.status).toBe(401);
    });

    it('1A.3: Anonymous request cannot log scoring events (assert 401)', async () => {
      const res = await api.post(`/api/matches/${testMatchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 12,
      }, ANONYMOUS_HEADERS);
      expect(res.status).toBe(401);
    });

    it('1A.4: Anonymous request cannot delete match events (assert 401)', async () => {
      // First, assigned referee adds an event
      const addRes = await api.post(`/api/matches/${testMatchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 5,
      }, REFEREE_HEADERS('ref-alpha'));
      expect([200, 201]).toContain(addRes.status);
      const eventId = addRes.data.id;

      // Anonymous delete attempt
      const delRes = await api.delete(`/api/matches/${testMatchId}/events/${eventId}`, ANONYMOUS_HEADERS);
      expect(delRes.status).toBe(401);
    });

    it('1A.5: Anonymous request cannot control match timer (assert 401)', async () => {
      const res = await api.post(`/api/matches/${testMatchId}/timer`, {
        action: 'start',
        seconds: 60,
      }, ANONYMOUS_HEADERS);
      expect(res.status).toBe(401);
    });

    it('1A.6: Anonymous request cannot submit match scorecard (assert 401)', async () => {
      const res = await api.post(`/api/matches/${testMatchId}/submit`, {}, ANONYMOUS_HEADERS);
      expect(res.status).toBe(401);
    });

    it('1A.7: Anonymous request cannot verify scorecard (assert 401)', async () => {
      const res = await api.post(`/api/matches/${testMatchId}/verify`, {}, ANONYMOUS_HEADERS);
      expect(res.status).toBe(401);
    });

    it('1A.8: Anonymous request cannot publish match results (assert 401)', async () => {
      const res = await api.post(`/api/matches/${testMatchId}/publish`, {}, ANONYMOUS_HEADERS);
      expect(res.status).toBe(401);
    });

    it('1A.9: Anonymous request cannot reject match (assert 401)', async () => {
      const res = await api.post(`/api/matches/${testMatchId}/reject`, {
        notes: 'Disputed score',
      }, ANONYMOUS_HEADERS);
      expect(res.status).toBe(401);
    });

    it('1A.10: Anonymous request cannot access Admin verification queue (assert 401)', async () => {
      const res = await api.get('/api/admin/verifications', ANONYMOUS_HEADERS);
      expect(res.status).toBe(401);
    });

    it('1A.11: Anonymous request cannot access verification queue action aliases (assert 401)', async () => {
      const vRes = await api.post(`/api/admin/verifications/${testMatchId}/verify`, {}, ANONYMOUS_HEADERS);
      expect(vRes.status).toBe(401);

      const pRes = await api.post(`/api/admin/verifications/${testMatchId}/publish`, {}, ANONYMOUS_HEADERS);
      expect(pRes.status).toBe(401);

      const rRes = await api.post(`/api/admin/verifications/${testMatchId}/reject`, { notes: 'Reject' }, ANONYMOUS_HEADERS);
      expect(rRes.status).toBe(401);
    });

    it('1A.12: Malformed or spoofed role headers are rejected as unauthenticated (assert 401)', async () => {
      const spoofHeaders: RoleHeaders = {
        'x-user-role': 'superuser' as any,
        'x-user-id': 'hacker',
      };
      const res = await api.post('/api/matches', { sport_id: 'football' }, spoofHeaders);
      expect(res.status).toBe(401);

      const emptyRoleHeaders: RoleHeaders = {
        'x-user-role': '' as any,
        'x-user-id': 'admin',
      };
      const res2 = await api.post('/api/matches', { sport_id: 'football' }, emptyRoleHeaders);
      expect(res2.status).toBe(401);
    });
  });

  describe('Vector 1B: Unassigned Referee Segregation & Match Isolation', () => {
    let matchId: string = '';

    beforeEach(async () => {
      matchId = await createTestMatch('ref-alpha', 'Draft');
    });

    it('1B.1: Assigned referee (ref-alpha) can log events successfully (assert 201)', async () => {
      const res = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 10,
      }, REFEREE_HEADERS('ref-alpha'));
      expect([200, 201]).toContain(res.status);
      expect(res.data.score_home).toBe(1);
    });

    it('1B.2: Unassigned referee (ref-beta) is blocked from logging events on ref-alpha match (assert 403)', async () => {
      const res = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'away',
        minute: 15,
      }, REFEREE_HEADERS('ref-beta'));
      expect(res.status).toBe(403);
      expect(res.data.code).toBe('FORBIDDEN_UNASSIGNED_REFEREE');
    });

    it('1B.3: Unassigned referee is blocked from deleting events on ref-alpha match (assert 403)', async () => {
      // Add event as assigned referee
      const addRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 20,
      }, REFEREE_HEADERS('ref-alpha'));
      const eventId = addRes.data.id;

      // Delete attempt by unassigned referee
      const delRes = await api.delete(`/api/matches/${matchId}/events/${eventId}`, REFEREE_HEADERS('ref-beta'));
      expect(delRes.status).toBe(403);
    });

    it('1B.4: Unassigned referee is blocked from controlling match timer (assert 403)', async () => {
      const res = await api.post(`/api/matches/${matchId}/timer`, {
        action: 'start',
        seconds: 120,
      }, REFEREE_HEADERS('ref-beta'));
      expect(res.status).toBe(403);
    });

    it('1B.5: Unassigned referee is blocked from submitting scorecard for verification (assert 403)', async () => {
      const res = await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-beta'));
      expect(res.status).toBe(403);
    });

    it('1B.6: Match with unassigned/null referee blocks any referee scoring (assert 403)', async () => {
      // Create match with no referee assigned
      const unassignedMatchRes = await api.post('/api/matches', {
        sport_id: 'cricket',
        home_cohort_id: 'cohort-seniors',
        away_cohort_id: 'cohort-juniors',
        venue: 'Neutral Ground',
        scheduled_at: new Date().toISOString(),
        referee_id: null,
      }, ADMIN_HEADERS);
      const unassignedMatchId = unassignedMatchRes.data.id;

      const res = await api.post(`/api/matches/${unassignedMatchId}/events`, {
        event_type: 'SCORE_1PT',
        team: 'home',
        minute: 1,
      }, REFEREE_HEADERS('ref-alpha'));
      expect(res.status).toBe(403);
    });

    it('1B.7: Referee ID substring confusion is strictly blocked (ref-alpha vs ref-alphax or ref-alpha-2)', async () => {
      // ref-alpha vs ref-alphax
      const res1 = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 25,
      }, REFEREE_HEADERS('ref-alphax'));
      expect(res1.status).toBe(403);

      // ref-alpha vs ref-alpha-2
      const res2 = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 25,
      }, REFEREE_HEADERS('ref-alpha-2'));
      expect(res2.status).toBe(403);
    });

    it('1B.8: Referee usr- prefix aliasing is honored correctly (usr-ref-alpha matches ref-alpha)', async () => {
      const res = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 30,
      }, REFEREE_HEADERS('usr-ref-alpha'));
      expect([200, 201]).toContain(res.status);
    });
  });

  describe('Vector 1C: Admin-Only Verification Queue Access Boundary', () => {
    it('1C.1: Public Spectator cannot access /api/admin/verifications (assert 403)', async () => {
      const res = await api.get('/api/admin/verifications', SPECTATOR_HEADERS);
      expect(res.status).toBe(403);
      expect(res.data.code).toBe('FORBIDDEN');
    });

    it('1C.2: Referee cannot access /api/admin/verifications (assert 403)', async () => {
      const res = await api.get('/api/admin/verifications', REFEREE_HEADERS('ref-1'));
      expect(res.status).toBe(403);
      expect(res.data.code).toBe('FORBIDDEN');
    });

    it('1C.3: Admin can access /api/admin/verifications (assert 200 array)', async () => {
      const res = await api.get('/api/admin/verifications', ADMIN_HEADERS);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });
  });

  describe('Vector 1D: Verification, Publication, and Scheduling Role Boundaries', () => {
    let matchId: string = '';

    beforeEach(async () => {
      matchId = await createTestMatch('ref-alpha', 'Draft');
      // Conclude & submit to place in Submitted state
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
    });

    it('1D.1: Public Spectator cannot verify matches (assert 403)', async () => {
      const res = await api.post(`/api/matches/${matchId}/verify`, {}, SPECTATOR_HEADERS);
      expect(res.status).toBe(403);
    });

    it('1D.2: Public Spectator cannot publish matches (assert 403)', async () => {
      const res = await api.post(`/api/matches/${matchId}/publish`, {}, SPECTATOR_HEADERS);
      expect(res.status).toBe(403);
    });

    it('1D.3: Public Spectator cannot reject matches (assert 403)', async () => {
      const res = await api.post(`/api/matches/${matchId}/reject`, { notes: 'Spec reject' }, SPECTATOR_HEADERS);
      expect(res.status).toBe(403);
    });

    it('1D.4: Referee cannot verify matches (assert 403)', async () => {
      const res = await api.post(`/api/matches/${matchId}/verify`, {}, REFEREE_HEADERS('ref-alpha'));
      expect(res.status).toBe(403);
    });

    it('1D.5: Referee cannot publish matches (assert 403)', async () => {
      const res = await api.post(`/api/matches/${matchId}/publish`, {}, REFEREE_HEADERS('ref-alpha'));
      expect(res.status).toBe(403);
    });

    it('1D.6: Referee cannot reject matches (assert 403)', async () => {
      const res = await api.post(`/api/matches/${matchId}/reject`, { notes: 'Ref reject' }, REFEREE_HEADERS('ref-alpha'));
      expect(res.status).toBe(403);
    });

    it('1D.7: Spectator and Referee cannot invoke admin verification queue action aliases (assert 403)', async () => {
      // Spectator
      const sVerify = await api.post(`/api/admin/verifications/${matchId}/verify`, {}, SPECTATOR_HEADERS);
      expect(sVerify.status).toBe(403);

      const sPublish = await api.post(`/api/admin/verifications/${matchId}/publish`, {}, SPECTATOR_HEADERS);
      expect(sPublish.status).toBe(403);

      const sReject = await api.post(`/api/admin/verifications/${matchId}/reject`, { notes: 'note' }, SPECTATOR_HEADERS);
      expect(sReject.status).toBe(403);

      // Referee
      const rVerify = await api.post(`/api/admin/verifications/${matchId}/verify`, {}, REFEREE_HEADERS('ref-alpha'));
      expect(rVerify.status).toBe(403);

      const rPublish = await api.post(`/api/admin/verifications/${matchId}/publish`, {}, REFEREE_HEADERS('ref-alpha'));
      expect(rPublish.status).toBe(403);

      const rReject = await api.post(`/api/admin/verifications/${matchId}/reject`, { notes: 'note' }, REFEREE_HEADERS('ref-alpha'));
      expect(rReject.status).toBe(403);
    });

    it('1D.8: Spectator and Referee cannot schedule new matches (assert 403)', async () => {
      const sSched = await api.post('/api/matches', { sport_id: 'football' }, SPECTATOR_HEADERS);
      expect(sSched.status).toBe(403);

      const rSched = await api.post('/api/matches', { sport_id: 'football' }, REFEREE_HEADERS('ref-alpha'));
      expect(rSched.status).toBe(403);
    });

    it('1D.9: Spectator and Referee cannot update match metadata via PUT (assert 403)', async () => {
      const sPut = await api.put(`/api/matches/${matchId}`, { venue: 'New Venue' }, SPECTATOR_HEADERS);
      expect(sPut.status).toBe(403);

      const rPut = await api.put(`/api/matches/${matchId}`, { venue: 'New Venue' }, REFEREE_HEADERS('ref-alpha'));
      expect(rPut.status).toBe(403);
    });
  });

  // =========================================================================
  // VECTOR 2: LIFECYCLE STATE MACHINE EDGE CASES
  // =========================================================================

  describe('Vector 2A: Scorecard Locking in Submitted, Verified & Published States', () => {
    let matchId: string = '';
    let eventId: string = '';

    beforeEach(async () => {
      matchId = await createTestMatch('ref-alpha', 'Draft');
      // Add initial event
      const addRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 10,
      }, REFEREE_HEADERS('ref-alpha'));
      eventId = addRes.data.id;
    });

    it('2A.1: In Submitted state, referee cannot log new events (assert 400 SCORECARD_LOCKED)', async () => {
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));

      const res = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 15,
      }, REFEREE_HEADERS('ref-alpha'));
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('SCORECARD_LOCKED');
    });

    it('2A.2: In Submitted state, admin cannot log new events (assert 400 SCORECARD_LOCKED)', async () => {
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));

      const res = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'away',
        minute: 20,
      }, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.code).toBe('SCORECARD_LOCKED');
    });

    it('2A.3: In Submitted state, neither referee nor admin can delete events (assert 400)', async () => {
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));

      const refDel = await api.delete(`/api/matches/${matchId}/events/${eventId}`, REFEREE_HEADERS('ref-alpha'));
      expect(refDel.status).toBe(400);

      const admDel = await api.delete(`/api/matches/${matchId}/events/${eventId}`, ADMIN_HEADERS);
      expect(admDel.status).toBe(400);
    });

    it('2A.4: In Verified state, scorecard modifications are locked (assert 400)', async () => {
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
      await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);

      // Attempt add event
      const addRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 25,
      }, REFEREE_HEADERS('ref-alpha'));
      expect(addRes.status).toBe(400);
      expect(addRes.data.code).toBe('SCORECARD_LOCKED');

      // Attempt delete event
      const delRes = await api.delete(`/api/matches/${matchId}/events/${eventId}`, ADMIN_HEADERS);
      expect(delRes.status).toBe(400);
    });

    it('2A.5: In Published state, scorecard modifications are locked (assert 400)', async () => {
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
      await api.post(`/api/matches/${matchId}/publish`, {}, ADMIN_HEADERS);

      // Attempt add event
      const addRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 30,
      }, REFEREE_HEADERS('ref-alpha'));
      expect(addRes.status).toBe(400);
      expect(addRes.data.code).toBe('SCORECARD_LOCKED');

      // Attempt delete event
      const delRes = await api.delete(`/api/matches/${matchId}/events/${eventId}`, ADMIN_HEADERS);
      expect(delRes.status).toBe(400);
    });
  });

  describe('Vector 2B: Match Rejection Validation & Notes Integrity', () => {
    let matchId: string = '';

    beforeEach(async () => {
      matchId = await createTestMatch('ref-alpha', 'Draft');
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
    });

    it('2B.1: Rejection with empty string notes ("") returns 400', async () => {
      const res = await api.post(`/api/matches/${matchId}/reject`, { notes: '' }, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/non-empty/i);
    });

    it('2B.2: Rejection with whitespace-only spaces ("   ") returns 400', async () => {
      const res = await api.post(`/api/matches/${matchId}/reject`, { notes: '    ' }, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/non-empty/i);
    });

    it('2B.3: Rejection with whitespace tabs and newlines ("\\t\\r\\n  ") returns 400', async () => {
      const res = await api.post(`/api/matches/${matchId}/reject`, { notes: '\t\r\n   \n' }, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/non-empty/i);
    });

    it('2B.4: Rejection with missing notes property ({}) returns 400', async () => {
      const res = await api.post(`/api/matches/${matchId}/reject`, {}, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/non-empty/i);
    });

    it('2B.5: Rejection with null notes ({ notes: null }) returns 400', async () => {
      const res = await api.post(`/api/matches/${matchId}/reject`, { notes: null }, ADMIN_HEADERS);
      expect(res.status).toBe(400);
    });

    it('2B.6: Rejection with non-string notes ({ notes: 12345 }) returns 400', async () => {
      const res = await api.post(`/api/matches/${matchId}/reject`, { notes: 12345 }, ADMIN_HEADERS);
      expect(res.status).toBe(400);
    });

    it('2B.7: Admin verification queue rejection alias enforces identical 400 validation on empty notes', async () => {
      const res = await api.post(`/api/admin/verifications/${matchId}/reject`, { notes: '   ' }, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/non-empty/i);
    });
  });

  describe('Vector 2C: Rejection Reopen to Draft & Referee Resume Flow', () => {
    let matchId: string = '';

    beforeEach(async () => {
      matchId = await createTestMatch('ref-alpha', 'Draft');
      // Referee logs goal
      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 10,
      }, REFEREE_HEADERS('ref-alpha'));
      // Referee submits
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
    });

    it('2C.1: Valid rejection reverts match status to Draft and preserves notes (assert 200)', async () => {
      const rejectionNote = 'Dispute over goal time: please verify 2nd half footage.';
      const rejRes = await api.post(`/api/matches/${matchId}/reject`, { notes: rejectionNote }, ADMIN_HEADERS);
      expect([200, 201]).toContain(rejRes.status);
      expect(rejRes.data.status).toBe('Draft');
      expect(rejRes.data.notes).toBe(rejectionNote);

      // Verify detail GET
      const detail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
      expect(detail.data.status).toBe('Draft');
      expect(detail.data.notes).toBe(rejectionNote);
    });

    it('2C.2: Referee can resume event logging after rejection (assert 201)', async () => {
      // Admin rejects
      await api.post(`/api/matches/${matchId}/reject`, {
        notes: 'Review second yellow card',
      }, ADMIN_HEADERS);

      // Referee logs corrective event
      const evRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'away',
        minute: 44,
      }, REFEREE_HEADERS('ref-alpha'));
      expect([200, 201]).toContain(evRes.status);
      expect(evRes.data.score_away).toBe(1);

      // Verify updated match score
      const matchDetail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
      expect(matchDetail.data.score_home).toBe(1);
      expect(matchDetail.data.score_away).toBe(1);
    });

    it('2C.3: Referee can resubmit the concluded scorecard after corrections (assert 200)', async () => {
      // Reject
      await api.post(`/api/matches/${matchId}/reject`, {
        notes: 'Fix score',
      }, ADMIN_HEADERS);

      // Resubmit
      const subRes = await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
      expect([200, 201]).toContain(subRes.status);
      expect(subRes.data.status).toBe('Submitted');

      // Now scorecard is locked again
      const lockRes = await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 50,
      }, REFEREE_HEADERS('ref-alpha'));
      expect(lockRes.status).toBe(400);
      expect(lockRes.data.code).toBe('SCORECARD_LOCKED');
    });
  });

  describe('Vector 2D: Invalid Lifecycle Jumps & State Trapping', () => {
    it('2D.1: Draft -> Verified jump (skipping Submitted) is blocked (assert 400)', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Draft');
      const res = await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/invalid lifecycle transition/i);
    });

    it('2D.2: Draft -> Published jump (skipping Submitted) is blocked (assert 400)', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Draft');
      const res = await api.post(`/api/matches/${matchId}/publish`, {}, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/invalid lifecycle transition/i);
    });

    it('2D.3: Scheduled -> Published direct jump is blocked (assert 400)', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Scheduled');
      const res = await api.post(`/api/matches/${matchId}/publish`, {}, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/invalid lifecycle transition/i);
    });

    it('2D.4: Scheduled -> Verified direct jump is blocked (assert 400)', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Scheduled');
      const res = await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/invalid lifecycle transition/i);
    });

    it('2D.5: Scheduled -> Submitted jump without scoring draft is blocked (assert 400)', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Scheduled');
      const res = await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/invalid lifecycle transition/i);
    });

    it('2D.6: Verified -> Draft jump is blocked (assert 400)', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Draft');
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
      await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);

      // Rejection only allowed from Submitted
      const res = await api.post(`/api/matches/${matchId}/reject`, { notes: 'Cannot reject verified' }, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/invalid lifecycle transition/i);
    });

    it('2D.7: Verified -> Submitted jump (reversion) is blocked (assert 400)', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Draft');
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
      await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);

      const res = await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/invalid lifecycle transition/i);
    });

    it('2D.8: Duplicate Verification (Verified -> Verified) is blocked (assert 400)', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Draft');
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
      await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);

      const res = await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/invalid lifecycle transition/i);
    });

    it('2D.9: Published match is an immutable terminal state (assert 400 on any mutation)', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Draft');
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));
      await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);
      await api.post(`/api/matches/${matchId}/publish`, {}, ADMIN_HEADERS);

      // Attempt Published -> Draft
      const rej = await api.post(`/api/matches/${matchId}/reject`, { notes: 'Try reopen' }, ADMIN_HEADERS);
      expect(rej.status).toBe(400);
      expect(rej.data.error).toMatch(/immutable/i);

      // Attempt Published -> Verified
      const ver = await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);
      expect(ver.status).toBe(400);
      expect(ver.data.error).toMatch(/immutable/i);

      // Attempt Published -> Submitted
      const sub = await api.post(`/api/matches/${matchId}/submit`, {}, ADMIN_HEADERS);
      expect(sub.status).toBe(400);
      expect(sub.data.error).toMatch(/immutable/i);

      // Attempt Published -> Published
      const pub = await api.post(`/api/matches/${matchId}/publish`, {}, ADMIN_HEADERS);
      expect(pub.status).toBe(400);
      expect(pub.data.error).toMatch(/immutable/i);
    });

    it('2D.10: Direct transition on non-existent match ID returns 404', async () => {
      const res = await api.post('/api/matches/non-existent-match-999/verify', {}, ADMIN_HEADERS);
      expect(res.status).toBe(404);
    });
  });

  describe('Vector 2E: Audit Logging Integrity & Chain of Custody', () => {
    it('2E.1: Comprehensive lifecycle workflow records complete, chronological audit trail', async () => {
      // 1. SCHEDULE
      const matchId = await createTestMatch('ref-alpha', 'Draft');

      // 2. LOG EVENT & SUBMIT
      await api.post(`/api/matches/${matchId}/events`, {
        event_type: 'GOAL',
        team: 'home',
        minute: 12,
      }, REFEREE_HEADERS('ref-alpha'));
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));

      // 3. REJECT
      const rejNote = 'Disputed foul at min 12 - check clock';
      await api.post(`/api/matches/${matchId}/reject`, { notes: rejNote }, ADMIN_HEADERS);

      // 4. RESUBMIT
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));

      // 5. VERIFY
      await api.post(`/api/matches/${matchId}/verify`, {}, ADMIN_HEADERS);

      // 6. PUBLISH
      await api.post(`/api/matches/${matchId}/publish`, {}, ADMIN_HEADERS);

      // Inspect audit logs via GET /api/matches/:id
      const detail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
      const logs = detail.data.audit_logs;

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThanOrEqual(6);

      // Check actions in chronological descent (newest first)
      const actions = logs.map((l: any) => l.action);
      expect(actions).toContain('SCHEDULE');
      expect(actions).toContain('SUBMIT');
      expect(actions).toContain('REJECT');
      expect(actions).toContain('VERIFY');
      expect(actions).toContain('PUBLISH');

      // Find REJECT log and assert notes
      const rejectLog = logs.find((l: any) => l.action === 'REJECT');
      expect(rejectLog).toBeDefined();
      expect(rejectLog.notes).toBe(rejNote);
      expect(rejectLog.from_status).toBe('Submitted');
      expect(rejectLog.to_status).toBe('Draft');
      expect(rejectLog.user_id).toBe('admin-1');

      // Find PUBLISH log
      const publishLog = logs.find((l: any) => l.action === 'PUBLISH');
      expect(publishLog).toBeDefined();
      expect(publishLog.from_status).toBe('Verified');
      expect(publishLog.to_status).toBe('Published');

      // Verify all rows have non-null required fields
      for (const log of logs) {
        expect(log.id).toBeDefined();
        expect(log.match_id).toBe(matchId);
        expect(log.timestamp).toBeDefined();
        expect(log.action).toBeDefined();
      }
    });

    it('2E.2: Direct shortcut publication (Submitted -> Published) logs PUBLISH_SHORTCUT', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Draft');
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));

      // Admin directly publishes from Submitted without prior Verify step
      const pubRes = await api.post(`/api/matches/${matchId}/publish`, {}, ADMIN_HEADERS);
      expect([200, 201]).toContain(pubRes.status);
      expect(pubRes.data.status).toBe('Published');

      const detail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
      const shortcutLog = detail.data.audit_logs.find((l: any) => l.action === 'PUBLISH_SHORTCUT');

      expect(shortcutLog).toBeDefined();
      expect(shortcutLog.from_status).toBe('Submitted');
      expect(shortcutLog.to_status).toBe('Published');
    });
  });

  // =========================================================================
  // VECTOR 3: ROBUSTNESS, INJECTION & BOUNDARY RESILIENCE
  // =========================================================================

  describe('Vector 3: Robustness, Unicode & Injection Resilience', () => {
    it('3.1: SQL injection payload in rejection notes is safely escaped and stored literally', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Draft');
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));

      const sqlPayload = "'); DROP TABLE matches; --";
      const res = await api.post(`/api/matches/${matchId}/reject`, { notes: sqlPayload }, ADMIN_HEADERS);
      expect([200, 201]).toContain(res.status);

      // Verify matches table still exists and notes match literal
      const detail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
      expect(detail.data.notes).toBe(sqlPayload);
    });

    it('3.2: Multi-byte Unicode, symbols and emojis in notes are preserved without loss', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Draft');
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));

      const unicodeNote = 'Disputed ⚽ Goal: रतंज़ी खेल उत्सव २०२६ (Offside @ 89′) 🚩';
      const res = await api.post(`/api/matches/${matchId}/reject`, { notes: unicodeNote }, ADMIN_HEADERS);
      expect([200, 201]).toContain(res.status);

      const detail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
      expect(detail.data.notes).toBe(unicodeNote);
    });

    it('3.3: High-capacity notes string (2,000 chars) is processed and preserved without truncation', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Draft');
      await api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha'));

      const largeNote = 'REF-NOTE: ' + 'X'.repeat(2000);
      const res = await api.post(`/api/matches/${matchId}/reject`, { notes: largeNote }, ADMIN_HEADERS);
      expect([200, 201]).toContain(res.status);

      const detail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
      expect(detail.data.notes).toBe(largeNote);
      expect(detail.data.notes.length).toBe(2010);
    });

    it('3.4: Concurrent submissions on the same match resolve deterministically without race corruption', async () => {
      const matchId = await createTestMatch('ref-alpha', 'Draft');

      // Dispatch 3 concurrent submission requests
      const promises = [
        api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha')),
        api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha')),
        api.post(`/api/matches/${matchId}/submit`, {}, REFEREE_HEADERS('ref-alpha')),
      ];

      const results = await Promise.all(promises);
      const statuses = results.map((r) => r.status);

      // At least one must succeed (200), and redundant concurrent requests must either succeed or return 400
      expect(statuses).toContain(200);
      for (const st of statuses) {
        expect([200, 400]).toContain(st);
      }

      // Final match state must be clean Submitted
      const detail = await api.get(`/api/matches/${matchId}`, SPECTATOR_HEADERS);
      expect(detail.data.status).toBe('Submitted');
    });
  });

  // =========================================================================
  // VECTOR 4: DIRECT SERVICE & UNIT LEVEL ISOLATION STRESS
  // =========================================================================

  describe('Vector 4: Direct Lifecycle Engine & RBAC Unit Invariants', () => {
    it('4.1: normalizeStatus normalizes mixed-case strings to canonical PascalCase', () => {
      expect(normalizeStatus('draft')).toBe('Draft');
      expect(normalizeStatus('DRAFT')).toBe('Draft');
      expect(normalizeStatus('scheduled')).toBe('Scheduled');
      expect(normalizeStatus('SUBMITTED')).toBe('Submitted');
      expect(normalizeStatus('verified')).toBe('Verified');
      expect(normalizeStatus('PUBLISHED')).toBe('Published');
      expect(normalizeStatus('cancelled')).toBe('Cancelled');
      expect(normalizeStatus(null)).toBe('Scheduled');
    });

    it('4.2: isScorecardLocked returns true only for Submitted, Verified, Published', () => {
      expect(isScorecardLocked('Draft')).toBe(false);
      expect(isScorecardLocked('draft')).toBe(false);
      expect(isScorecardLocked('Scheduled')).toBe(false);
      expect(isScorecardLocked('Submitted')).toBe(true);
      expect(isScorecardLocked('submitted')).toBe(true);
      expect(isScorecardLocked('Verified')).toBe(true);
      expect(isScorecardLocked('Published')).toBe(true);
    });

    it('4.3: normalizeRole rejects invalid or arbitrary strings', () => {
      expect(normalizeRole('admin')).toBe('admin');
      expect(normalizeRole('ADMIN')).toBe('admin');
      expect(normalizeRole('referee')).toBe('referee');
      expect(normalizeRole('spectator')).toBe('spectator');
      expect(normalizeRole('superuser')).toBeNull();
      expect(normalizeRole('hacker')).toBeNull();
      expect(normalizeRole('')).toBeNull();
      expect(normalizeRole(123)).toBeNull();
    });

    it('4.4: matchesRefereeId handles usr- prefix normalization with exact boundary matching', () => {
      expect(matchesRefereeId('ref-1', 'ref-1')).toBe(true);
      expect(matchesRefereeId('usr-ref-1', 'ref-1')).toBe(true);
      expect(matchesRefereeId('ref-1', 'usr-ref-1')).toBe(true);
      expect(matchesRefereeId('usr-ref-1', 'usr-ref-1')).toBe(true);
      expect(matchesRefereeId('ref-1', 'ref-2')).toBe(false);
      expect(matchesRefereeId('ref-1', 'ref-10')).toBe(false);
      expect(matchesRefereeId(null, 'ref-1')).toBe(false);
      expect(matchesRefereeId('ref-1', null)).toBe(false);
    });

    it('4.5: hasPermission strictly enforces role permission boundaries', () => {
      expect(hasPermission('admin', 'matches:verify')).toBe(true);
      expect(hasPermission('admin', 'matches:publish')).toBe(true);
      expect(hasPermission('referee', 'matches:verify')).toBe(false);
      expect(hasPermission('referee', 'matches:publish')).toBe(false);
      expect(hasPermission('referee', 'matches:events:create')).toBe(true);
      expect(hasPermission('spectator', 'matches:events:create')).toBe(false);
      expect(hasPermission('spectator', 'matches:read')).toBe(true);
    });
  });
});
