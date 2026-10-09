// src/lib/landing-options.ts
//
// Language and level choices for landing pages. Same values the course create
// page offers. Workshops import them from here; the course create page still
// has its own copy of LANGUAGES and can switch to this file when convenient.

export const LANDING_LANGUAGES = [
  'English', 'Hindi', 'Tamil', 'Telugu', 'Marathi',
  'Bengali', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi',
  'Urdu', 'Arabic', 'Spanish', 'French', 'German',
] as const

export const LANDING_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'] as const