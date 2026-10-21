// The one swap point between Part C and Parts A and B. At integration (plan
// Task 7) these re-exports point at the real room and plugin modules.
export { StubPluginScreen as PluginScreen } from './StubPluginScreen';
export type { PluginScreenProps } from './StubPluginScreen';
export { SEAT_POSE, updateRoom, makeHeadphones, STUB_SOURCES as SOURCES } from './stubRoom';
export type { DrySource } from './stubRoom';
