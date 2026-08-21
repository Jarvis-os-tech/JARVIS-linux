import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const BAREHANDS_STATE_DIR = path.join(ROOT_DIR, 'barehands', 'state');
const VISUALIZER_DIR = path.join(ROOT_DIR, 'ai-visualizer');

let currentVoiceState: 'idle' | 'listening' | 'thinking' | 'speaking' = 'idle';
let currentWaveform: number[] = new Array(64).fill(0);
let currentLevel: number = 0;

try {
  if (!fs.existsSync(BAREHANDS_STATE_DIR)) {
    fs.mkdirSync(BAREHANDS_STATE_DIR, { recursive: true });
  }
} catch {}

/**
 * Updates the voice state signal across all HUDs and the visualizers.
 */
export function updateVoiceStateSignal(state: 'idle' | 'listening' | 'thinking' | 'speaking', level: number = 0): void {
  currentVoiceState = state;
  currentLevel = level;
  try {
    fs.writeFileSync(path.join(ROOT_DIR, '.voice_state'), state, 'utf8');
    fs.writeFileSync(path.join(BAREHANDS_STATE_DIR, 'state'), state, 'utf8');
    if (fs.existsSync(VISUALIZER_DIR)) {
      fs.writeFileSync(path.join(VISUALIZER_DIR, '.voice_state'), state, 'utf8');
    }
  } catch {}
}

/**
 * Updates the real-time audio waveform amplitude snapshot.
 */
export function updateVoiceWaveformSignal(samples: number[]): void {
  currentWaveform = samples;
  try {
    const payload = JSON.stringify({ ts: Date.now(), samples });
    fs.writeFileSync(path.join(ROOT_DIR, '.voice_waveform'), payload, 'utf8');
    fs.writeFileSync(path.join(BAREHANDS_STATE_DIR, 'wave.json'), payload, 'utf8');
  } catch {}
}

export function getCurrentVoiceStatePayload() {
  return {
    state: currentVoiceState,
    level: currentLevel,
    samples: currentWaveform,
    alert: false,
    loading: currentVoiceState === 'thinking'
  };
}
