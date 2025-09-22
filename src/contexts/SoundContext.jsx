import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Simple, dependency-free sound system using Web Audio API.
// Generates short tones with envelopes for common app events.

const SoundContext = createContext(null);

const STORAGE_KEYS = {
  // Bump key to avoid carrying over older disabled value from previous UI toggle
  enabled: 'qd_sound_enabled_v2',
  volume: 'qd_sound_volume',
};

// Helpers to mute sound on specific routes
function isAllSoundMutedRoute() {
  try {
    if (typeof window === 'undefined') return false;
    const r = (window.location.hash || window.location.pathname || '').toLowerCase();
    // Mute ALL sounds on Login page
    return r.includes('/login');
  } catch {
    return false;
  }
}

function isClickMutedRoute() {
  try {
    if (typeof window === 'undefined') return false;
    const r = (window.location.hash || window.location.pathname || '').toLowerCase();
    // Mute click sounds on Login and any Profile section page
    return r.includes('/login') || r.includes('/profile');
  } catch {
    return false;
  }
}

// Tone presets: frequency (Hz), duration (ms), type, and optional sequence.
// Click variants tailored for a quiz app. You can switch style via localStorage key 'qd_sound_style'
// (values: 'glass' | 'bubble' | 'card'). Default is 'glass'.
const CLICK_VARIANTS = {
  // Pop (lite) — simple and fast: sine tick + bandpass noise
  pop: {
    mix: [
      { type: 'sine', freq: 660, duration: 50, attack: 0.0005, decay: 0.035, sustain: 0, release: 0.02, gainScale: 0.18 },
      { type: 'noise', duration: 12, attack: 0.0004, decay: 0.010, sustain: 0, release: 0.006, filter: { type: 'bandpass', frequency: 3500, Q: 8 }, gainScale: 0.08 },
    ]
  },
};

function chooseClickPreset() {
  try {
    const style = (localStorage.getItem('qd_sound_style') || 'pop').toLowerCase();
    return CLICK_VARIANTS[style] || CLICK_VARIANTS.pop;
  } catch {
    return CLICK_VARIANTS.pop;
  }
}

const TONES = {
  click: () => chooseClickPreset(),
  success: [
    { type: 'sine', freq: 523.25, duration: 80 }, // C5
    { type: 'sine', freq: 659.25, duration: 100 }, // E5
  ],
  error: { type: 'sawtooth', freq: 200, duration: 180, attack: 0.001, decay: 0.12, sustain: 0.0, release: 0.12 },
  correct: [
    { type: 'triangle', freq: 650, duration: 90 },
    { type: 'triangle', freq: 800, duration: 120 },
  ],
  wrong: [
    { type: 'square', freq: 220, duration: 120 },
    { type: 'square', freq: 180, duration: 120 },
  ],
  notify: { type: 'sine', freq: 880, duration: 120 },
};

function useAudioEngine() {
  const ctxRef = useRef(null);
  const noiseBufferRef = useRef(null);

  const ensureContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctxRef.current) {
      // Prefer low-latency interactive hint for snappier response
      try {
        ctxRef.current = new AudioCtx({ latencyHint: 'interactive' });
      } catch {
        // Fallback if options are not supported
        ctxRef.current = new AudioCtx();
      }
    }
    // Some mobile browsers require a resume after a user gesture
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback((preset, volume = 0.5) => {
    const ctx = ensureContext();
    if (!ctx) return;

    const attack = preset.attack ?? 0.005;
    const decay = preset.decay ?? 0.08;
    const sustain = preset.sustain ?? 0.0;
    const release = preset.release ?? 0.08;
    const duration = Math.max(20, preset.duration ?? 100);
    const total = (attack + decay + release) * 1000 + duration;

    const start = () => {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      const delay = (preset.startDelayMs ?? 0) / 1000;
      const t0 = now + delay;
  let source;

      if (preset.type === 'noise') {
        // Reuse a small noise buffer for all noise clicks
        if (!noiseBufferRef.current) {
          const length = Math.max(1, Math.floor(ctx.sampleRate * 0.15));
          const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.9;
          noiseBufferRef.current = buffer;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBufferRef.current;
        source = noise;
      } else {
        const osc = ctx.createOscillator();
        osc.type = preset.type || 'sine';
        const baseFreq = preset.freq || 440;
        try { osc.frequency.setValueAtTime(baseFreq, t0); } catch {}
        source = osc;
      }

      // Optional filter
      let nodeChain = source;
      if (preset.filter && typeof ctx.createBiquadFilter === 'function') {
        const f = ctx.createBiquadFilter();
        f.type = preset.filter.type || 'bandpass';
        if (typeof preset.filter.frequency === 'number') {
          try { f.frequency.setValueAtTime(preset.filter.frequency, now); } catch {}
        }
        if (typeof preset.filter.Q === 'number') {
          try { f.Q.setValueAtTime(preset.filter.Q, now); } catch {}
        }
        nodeChain.connect(f);
        nodeChain = f;
        // Optional filter frequency ramp for transient shaping
        if (typeof preset.filter.toFrequency === 'number' && typeof preset.filter.toMs === 'number') {
          const rampT = Math.max(0, (preset.filter.toMs || 0) / 1000);
          try { f.frequency.linearRampToValueAtTime(preset.filter.toFrequency, t0 + rampT); } catch {}
        }
      }

      // Direct connect without panning or compressor for minimal overhead
      nodeChain.connect(gain);

  gain.gain.setValueAtTime(0, t0);
      // ADSR envelope
      const peak = Math.max(0.0001, volume);
  gain.gain.linearRampToValueAtTime(peak, t0 + attack);
  gain.gain.linearRampToValueAtTime(peak * (sustain || 0.25), t0 + attack + decay);
  const stopTime = t0 + attack + decay + duration / 1000;
  gain.gain.linearRampToValueAtTime(0.0001, stopTime + release);

      gain.connect(ctx.destination);

  if (source.start) source.start(t0);
      if (source.stop) source.stop(stopTime + release + 0.02);

      // Best-effort cleanup
      if ('onended' in source) {
        source.onended = () => {
          try {
            if (source.disconnect) source.disconnect();
            gain.disconnect();
          } catch {}
        };
      }
    };

    // Schedule immediately to minimize latency; request a resume in parallel if needed
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch {}
    }
    start();

    // Return the expected time this tone will complete
    return total;
  }, [ensureContext]);

  const play = useCallback((name, volume = 0.5) => {
    // Route-based mutes
    if (isAllSoundMutedRoute()) return; // Login page: no sounds
    if (name === 'click' && isClickMutedRoute()) return; // Profile section (and Login): no click SFX

    let def = TONES[name];
    if (typeof def === 'function') {
      try { def = def(); } catch { def = null; }
    }
    if (!def) return;
    if (Array.isArray(def)) {
      // Simple sequence: fixed tiny gap without dry-run
      let delay = 0;
      def.forEach((step) => {
        setTimeout(() => playTone(step, volume), delay);
        delay += (step.duration || 100) + 8;
      });
      return;
    }
    if (def && Array.isArray(def.mix)) {
      // Parallel mix: trigger layers near-simultaneously
      def.mix.forEach((layer) => {
        const g = typeof layer.gainScale === 'number' ? Math.max(0, layer.gainScale) : 1;
        playTone(layer, Math.min(1, volume * g));
      });
      return;
    }
    playTone(def, volume);
  }, [playTone]);

  return { play };
}

export function SoundProvider({ children }) {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(0.6);
  const engine = useAudioEngine();

  // Load persisted settings with migration: default to enabled (true)
  useEffect(() => {
    try {
      const eNew = localStorage.getItem(STORAGE_KEYS.enabled);
      const v = localStorage.getItem(STORAGE_KEYS.volume);
      if (eNew == null) {
        // Migrate from legacy key but prefer enabling by default
        const legacy = localStorage.getItem('qd_sound_enabled');
        const initialEnabled = true; // always start with sound on
        setEnabled(initialEnabled);
        localStorage.setItem(STORAGE_KEYS.enabled, initialEnabled ? '1' : '0');
      } else {
        setEnabled(eNew === '1');
      }
      if (v != null) setVolume(Math.min(1, Math.max(0, parseFloat(v))));
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.enabled, enabled ? '1' : '0'); } catch {}
  }, [enabled]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.volume, String(volume)); } catch {}
  }, [volume]);

  const play = useCallback((name) => {
    if (!enabled) return;
    engine.play(name, volume);
    if (name === 'click' && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(2); } catch {}
    }
  }, [enabled, engine, volume]);

  const setClickStyle = useCallback((style) => {
    try { localStorage.setItem('qd_sound_style', String(style)); } catch {}
  }, []);

  const value = useMemo(() => ({
    enabled,
    setEnabled,
    volume,
    setVolume,
    play,
    setClickStyle,
  }), [enabled, volume, play, setClickStyle]);

  // Global pointerdown handler: play click for common interactive elements
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      try {
        // Skip globally muted routes for click
        if (isClickMutedRoute()) return;
        // Ignore right/middle clicks and synthetic events
        if (e.button && e.button !== 0) return;
  const el = e.target instanceof Element ? e.target : null;
        if (!el) return;

  // If inside a container explicitly muting click sounds, skip
  if (el.closest('[data-mute-click-sound]')) return;

        // Traverse up to find a clickable host element
        const clickable = el.closest('button, [role="button"], a, input[type="button"], input[type="submit"], [data-click-sound]');
        if (!clickable) return;

        // Skip disabled or aria-disabled
        if (clickable.hasAttribute('disabled') || clickable.getAttribute('aria-disabled') === 'true') return;

        // Avoid double fire if component already calls play('click') onPointerDown
        if (clickable.__qdClickPlayed) return;
        clickable.__qdClickPlayed = true;
        setTimeout(() => { try { delete clickable.__qdClickPlayed; } catch {} }, 120);

        engine.play('click', volume);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(2); } catch {}
        }
      } catch {}
    };
    document.addEventListener('pointerdown', handler, { capture: true });
    return () => document.removeEventListener('pointerdown', handler, { capture: true });
  }, [enabled, engine, volume]);

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    // Provide a safe fallback in case provider is missing
    return { enabled: true, setEnabled: () => {}, volume: 0.5, setVolume: () => {}, play: () => {} };
  }
  return ctx;
}
