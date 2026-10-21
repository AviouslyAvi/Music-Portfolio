export const HERO = {
  eyebrow: 'Music producer and world-builder',
  title: "I don't make beats. I build worlds you can live in.",
  sub: 'Textured, human and a little unexpected. Raw emotion, turned into sound you can feel.',
  quote:
    "I make music that feels like stepping inside someone's inner world while they are living through it: imperfect, moving and quietly unforgettable.",
};

export const PHILOSOPHY = {
  title: 'Every song is a room. I make sure you want to stay.',
  cards: [
    {
      title: 'Journey, not formula',
      body: 'My tracks have direction and life: moments that bend, quiet surprises, the sense that you are moving with the music and not past it. Nothing stays flat.',
    },
    {
      title: 'Something from nothing',
      body: 'I record rooms, voices and everyday actions, then sculpt them into instruments and textures that only exist in my world. Every sound has a story.',
    },
    {
      title: 'Human fingerprint',
      body: 'There is a bit of me in every track. Compassionate, quietly detail-obsessed, and playful with small things most people miss on the first listen but feel anyway.',
    },
    {
      title: 'Precision in service of art',
      body: 'I learn my tools deeper than most, not to show off but to be intentional. Every decision is clean, so the music feels purposeful and never accidental.',
    },
  ],
};

export const EMOTIONAL_PALETTE = {
  title: 'The feelings I know how to hold',
  tags: ['Nostalgia', 'Euphoria', 'Introspection', 'Solitude', 'Regret', 'Appreciation', 'Stillness'],
  body: 'These are not manufactured feelings. They come from lived experience: my own struggles, phases and quiet moments of clarity. The music sits with you in those spaces. It does not try to fix anything. It makes them feel less lonely.',
};

export const SERVICES = {
  title: 'From abstract vision to something you can press play on',
  items: [
    {
      title: 'Production and arrangement',
      body: 'Songs with direction and life: journeys that breathe, move and surprise. I build the groove, the space and the story arc, then let it unfold.',
    },
    {
      title: 'Sound design',
      body: 'Field recordings, voices and found sounds become textures that exist nowhere else: pads, bass, drums and risers with a fingerprint nobody can copy.',
    },
    {
      title: 'Finishing and finalization',
      body: 'I help projects cross the line in a practical, efficient and intentional way, without losing the soul that made the song worth making.',
    },
    {
      title: 'Teaching and mentorship',
      body: 'Personal lessons that explain an idea several ways until it lands. I meet you where you are and help you reach your own creative potential.',
    },
  ],
};

export const DAWS = ['FL Studio', 'Ableton', 'Studio One', 'Logic Pro', 'Cubase', 'Reaper'] as const;

export const ABOUT = {
  title: 'The Alchemist',
  lede: 'I care less about being a hitmaker and more about building a space an artist can step into: the lighting, the gravity, the mood, and then room to move around inside it.',
  story: [
    'At my core I am a problem-solver and a maker. I love starting from silence, and I do just as well with scraps: odd fragments, half-finished ideas, rough voice notes. I take what exists and turn it into something organic, intentional and alive.',
    'I am obsessed with texture. Not only clean sounds, but sounds that feel touchable. I might record the air of a room, bend a voice, catch an ordinary moment and sculpt it into a pad, a bass hit or a transition that exists nowhere else. My tracks carry a fingerprint that cannot be reproduced.',
  ],
  traits: [
    { label: 'Identity', value: 'World-builder, not hitmaker' },
    { label: 'Approach', value: 'Vision first, genre fluid' },
    { label: 'Style', value: 'Minimal and texture forward' },
    { label: 'Strength', value: 'Finishing without sanding off the soul' },
    { label: 'Signature', value: 'Quiet easter eggs and organic detail' },
    { label: 'Role', value: 'Educator and mentor' },
  ],
  motivator: {
    title: 'Motivator, and a believer in efficiency',
    body: 'Structure is what frees a session to be playful. I keep sessions moving, keep decisions clean and keep the energy up, so the time goes into the music and not into friction. I am the one who nudges a project toward the finish line, kindly and without losing the thread.',
  },
  dawTitle: 'Fluent across the major DAWs',
  dawBody: 'I work in whatever you already use, and I can step into your session as it stands.',
  legacy: {
    quote:
      'In ten years I want people to say my music helped them process feelings they could not put into words, took them somewhere they do not usually go, and gave them permission to be human, whatever flavor of human they are.',
    pillars: [
      { title: 'Inspire', body: 'Be the catalyst that helps other creatives find their voice and bring their experience to life through music.' },
      { title: 'Clarify', body: 'Help people see and feel through their ears, so sound becomes a lens that brings the blurry parts of life into focus.' },
      { title: 'Optimize', body: 'Leave behind a practice where efficiency and structure open space for spontaneity and meaningful creativity.' },
    ],
  },
};

export const COLLAB = {
  title: 'Work with me',
  body: 'Send a rough idea, a voice note, or just a mood. I will turn it into something you can live in.',
};

export const CONTACT = {
  title: 'Say hello',
  lede: 'Send a link to a voice note, a rough idea, or a mood. Nothing needs to be finished, and nothing needs to be explained well.',
  invitation: 'A link to a voice note, a rough idea, or a mood.',
  labels: {
    name: 'Your name',
    email: 'Your email',
    message: 'What are you imagining',
    link: 'Link (optional)',
    submit: 'Send',
    pending: 'Sending',
  },
  errors: {
    name: 'Please add your name.',
    email: 'Please enter a valid email address.',
    message: 'Please write a message of up to 5000 characters.',
    link: 'Please use a link starting with http or https.',
    send: 'That did not go through. Your message is still here, so you can try again in a moment.',
  },
  success: 'Thank you. Your message is in, and I will reply by email.',
};

export const WORK = {
  title: 'Finished work, ready to play',
  lede: 'A few finished tracks. Press play on any of them; only one plays at a time.',
};

export const PREMONITION = {
  wordmark: 'PREMONITION',
  tagline: 'Echoes of the future.',
  lede: 'A plugin for building risers. It is an offline renderer, not a live insert effect: you hand it a sound, it renders the swell, and you take the result back to your session.',
  formatsLabel: 'Formats',
  formats: 'VST3, AU, CLAP',
  stepsTitle: 'Drop, render, drag',
  steps: [
    { title: 'Drop', body: 'Drop a sound onto the plugin.' },
    { title: 'Render', body: 'It renders the riser offline, ending on the downbeat.' },
    { title: 'Drag', body: 'Drag the finished audio back into your session.' },
  ],
  demoTitle: 'Hear it before you read about it',
  demoLede: 'Choose a sound. It runs through the plugin as a short rendered riser that lands on the downbeat.',
  priceTitle: 'Price',
  price: 'Launch price $19.99, then $24.99.',
  priceNote: 'A free demo is available if you want to try it in your own session first.',
  buy: 'Buy Premonition',
  demo: 'Download the free demo',
};

// The home page's pointer to the plugin page.
export const HOME_PREMONITION = {
  label: 'The plugin',
  body: 'An offline riser renderer for VST3, AU and CLAP. Drop a sound in, render the swell, drag it back into your session.',
  cta: 'Hear it',
};

export const ROOM = {
  enterLabel: 'Enter the room',
  enterEyebrow: 'AVIOUS',
  enterTitle: 'Step into the studio',
  enterBody:
    'A small walk-in room with sound. Play a track on the iPod, then sit at the computer to hear Premonition. You can skip to the site at any time.',
  enter: 'Enter',
  skip: 'Skip',
  loading: 'Loading the room',
  canvasLabel: 'AVIOUS studio room. Use the buttons below or the keyboard to move and interact.',
  hint: 'WASD or arrow keys to move. Mouse to look (click to capture the mouse). E to use what is nearby. Esc releases the mouse.',
  nowPlaying: 'Now playing',
  audioUnavailable: 'Audio unavailable',
  nearbyIpod: 'Near the iPod. Press E to interact.',
  nearbyComputer: 'Near the computer. Press E to interact.',
  promptText: 'Press E to interact',
  promptIpodLabel: 'iPod: press E to interact',
  promptComputerLabel: 'Computer: press E to interact',
  skipToSite: 'Skip to site',
  leaveButton: 'Leave the room',
  demoLabel: 'Premonition demo',
  ipodLabel: 'iPod',
};

// Short pages shown on the iPod screen; each links to the full page on the site.
export const IPOD = {
  openLink: 'Press the centre button to open the page',
  pages: {
    services: {
      title: 'Services',
      body: 'Production and arrangement, sound design, finishing and finalization, teaching and mentorship.',
    },
    about: {
      title: 'About',
      body: 'Worlds built from texture, with a human fingerprint. Experience with FL Studio, Ableton, Studio One, Logic Pro, Cubase and Reaper.',
    },
    contact: {
      title: 'Contact',
      body: 'Send a rough idea, a link to a voice note, or a mood.',
    },
  },
};
