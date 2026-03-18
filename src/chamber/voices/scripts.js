/**
 * Voice schedule: maps phase → voice category → [{file, delay}]
 * Delay is seconds from phase start.
 */
export const VOICE_SCHEDULE = {
  intro: {
    admirer: [
      { file: '/voices/admirer/admirer-01-dark.mp3', delay: 12 },
      { file: '/voices/admirer/admirer-02-phone.mp3', delay: 25 },
      { file: '/voices/admirer/admirer-03-begin.mp3', delay: 30 },
    ],
  },
  throne: {
    admirer: [
      { file: '/voices/admirer/admirer-04-listen.mp3', delay: 5 },
      { file: '/voices/admirer/admirer-05-moved.mp3', delay: 20 },
      { file: '/voices/admirer/admirer-06-texture.mp3', delay: 38 },
      { file: '/voices/admirer/admirer-07-noteveryone.mp3', delay: 58 },
      { file: '/voices/admirer/admirer-08-belongs.mp3', delay: 78 },
      { file: '/voices/admirer/admirer-09-weight.mp3', delay: 95 },
      { file: '/voices/admirer/admirer-10-room.mp3', delay: 108 },
    ],
  },
  ascent: {
    admirer: [
      { file: '/voices/admirer/admirer-11-deep.mp3', delay: 15 },
      { file: '/voices/admirer/admirer-12-moved.mp3', delay: 50 },
      { file: '/voices/admirer/admirer-13-noneed.mp3', delay: 90 },
      { file: '/voices/admirer/admirer-14-hand.mp3', delay: 130 },
    ],
    guide: [
      { file: '/voices/guide/guide-01-larger.mp3', delay: 20 },
      { file: '/voices/guide/guide-02-walls.mp3', delay: 45 },
      { file: '/voices/guide/guide-03-everyone.mp3', delay: 70 },
      { file: '/voices/guide/guide-04-hearing.mp3', delay: 95 },
      { file: '/voices/guide/guide-05-drift.mp3', delay: 115 },
      { file: '/voices/guide/guide-06-stopped.mp3', delay: 135 },
      { file: '/voices/guide/guide-07-above.mp3', delay: 155 },
      { file: '/voices/guide/guide-08-below.mp3', delay: 170 },
    ],
  },
  dissolution: {
    admirer: [
      { file: '/voices/admirer/admirer-15-arousal.mp3', delay: 30 },
      { file: '/voices/admirer/admirer-16-depth.mp3', delay: 60 },
      { file: '/voices/admirer/admirer-17-twelve.mp3', delay: 90 },
    ],
    guide: [
      { file: '/voices/guide/guide-09-inside.mp3', delay: 15 },
      { file: '/voices/guide/guide-10-edges.mp3', delay: 50 },
      { file: '/voices/guide/guide-11-good.mp3', delay: 100 },
    ],
    witness: [
      { file: '/voices/witness/witness-01-another.mp3', delay: 20 },
      { file: '/voices/witness/witness-02-conducting.mp3', delay: 70 },
      { file: '/voices/witness/witness-03-stopped.mp3', delay: 120 },
      { file: '/voices/witness/witness-04-always.mp3', delay: 170 },
    ],
    whispers: [
      { file: '/whispers/whisper-where.mp3', delay: 40 },
      { file: '/whispers/whisper-still.mp3', delay: 80 },
      { file: '/whispers/whisper-dissolving.mp3', delay: 110 },
      { file: '/whispers/whisper-everyone.mp3', delay: 140 },
      { file: '/whispers/whisper-always.mp3', delay: 180 },
    ],
    fragments: [
      { file: '/fragments/fragment-always.mp3', delay: 55 },
      { file: '/fragments/fragment-everyone.mp3', delay: 85 },
      { file: '/fragments/fragment-listen.mp3', delay: 115 },
      { file: '/fragments/fragment-mmm.mp3', delay: 145 },
      { file: '/fragments/fragment-there.mp3', delay: 160 },
      { file: '/fragments/fragment-yes.mp3', delay: 195 },
    ],
  },
};

// Ambient crowd sounds (play throughout from Phase 3 onward)
export const AMBIENT_SOUNDS = [
  '/crowd/crowd-murmur-01.mp3',
  '/crowd/crowd-murmur-02.mp3',
  '/crowd/crowd-murmur-03.mp3',
  '/crowd/crowd-murmur-04.mp3',
  '/crowd/crowd-breath-01.mp3',
  '/crowd/crowd-breath-02.mp3',
  '/crowd/crowd-applause.mp3',
];

export const COLLECTIVE_TRACK = '/music/collectiveend.mp3';

export const DEMO_TRACK = '/pldemoex.mp3';
