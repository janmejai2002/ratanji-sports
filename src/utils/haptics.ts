// Mobile Haptics Engine via Web Vibration API
// Provides tactile confirmations tailored for athletic scorepads and smartphone ergonomics

export const mobileHaptics = {
  // 1. Navigation & Filter Tab selection (Ultra-light transient click)
  tap: () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(12);
      }
    } catch {}
  },

  // 2. Standard Score Increment (+1 Run, Point, Basket, Ball)
  scoreTick: () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([20, 25, 20]);
      }
    } catch {}
  },

  // 3. High-Impact Event (Boundary 4/6, Goal, Wicket, 3-Pointer, Smash)
  highImpact: () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([45, 40, 70]);
      }
    } catch {}
  },

  // 4. Disciplinary Foul (Yellow / Red Card, Technical Foul, Fault)
  warning: () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([70, 30, 70, 30, 100]);
      }
    } catch {}
  },

  // 5. Match Final Whistle / Buzzer / Verified Committal
  matchEnd: () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([120, 40, 140]);
      }
    } catch {}
  },
};
