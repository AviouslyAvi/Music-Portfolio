export type Plugin = { slug: string; name: string; tagline: string; formats: string[] };

// Adding a plugin is a data addition: append an entry here.
export const PLUGINS: Plugin[] = [
  { slug: 'premonition', name: 'PREMONITION', tagline: 'Echoes of the future.', formats: ['VST3', 'AU', 'CLAP'] },
];
