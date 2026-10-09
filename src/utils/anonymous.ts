/**
 * Fixed Anonymous Spectator Account Engine
 * Ensures all campus visitors enter seamlessly without forced login.
 */

export interface AnonymousUser {
  id: string;
  name: string;
  role: 'spectator';
  batchAffiliation: string;
  badge: string;
}

const STORAGE_KEY = 'ratanjee_anon_user_session';

export function getOrCreateAnonymousUser(): AnonymousUser {
  try {
    const cached = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('ratanji_anon_user_session');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.id && parsed.role === 'spectator') {
        return parsed;
      }
    }
  } catch {}

  // Generate a friendly, persistent campus spectator session
  const randomNum = Math.floor(100 + Math.random() * 900);
  const affiliations = ['Senior Supporter', 'Junior Supporter', 'XLRI Fan'];
  const affiliation = affiliations[Math.floor(Math.random() * affiliations.length)];

  const newUser: AnonymousUser = {
    id: `anon-${randomNum}`,
    name: `Spectator #${randomNum}`,
    role: 'spectator',
    batchAffiliation: affiliation,
    badge: 'Campus Spectator',
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  } catch {}

  return newUser;
}
