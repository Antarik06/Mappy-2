// ============================================================
// Sound, synthesised at runtime with WebAudio — no asset files, no loading.
// Everything is short, dry and low in the mix so it reads as feedback
// rather than music.
// ============================================================

let ctx = null;
let master = null;
let enabled = true;

function audio() {
    if (typeof window === "undefined") return null;
    if (!ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = 0.32;
        master.connect(ctx.destination);
    }
    // Browsers hold the context suspended until a user gesture.
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
}

export function setSoundEnabled(on) {
    enabled = on;
    if (master) master.gain.value = on ? 0.32 : 0;
}

export function isSoundEnabled() {
    return enabled;
}

function tone({ freq, to, duration = 0.16, type = "sine", gain = 0.5, delay = 0 }) {
    const ac = audio();
    if (!ac || !enabled) return;
    const t0 = ac.currentTime + delay;

    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);

    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(env);
    env.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
}

function noise({ duration = 0.25, gain = 0.4, bandpass = 900, delay = 0 }) {
    const ac = audio();
    if (!ac || !enabled) return;
    const t0 = ac.currentTime + delay;

    const frames = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
        // Fade the noise out over its length so it reads as an impact.
        data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }

    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = bandpass;
    filter.Q.value = 0.9;

    const env = ac.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    src.start(t0);
}

export const sfx = {
    select: () => tone({ freq: 520, to: 640, duration: 0.07, type: "triangle", gain: 0.22 }),
    deny: () => tone({ freq: 180, to: 120, duration: 0.14, type: "square", gain: 0.16 }),
    dispatch: () => {
        tone({ freq: 300, to: 460, duration: 0.13, type: "triangle", gain: 0.3 });
        noise({ duration: 0.2, gain: 0.16, bandpass: 1600 });
    },
    capture: () => {
        tone({ freq: 392, duration: 0.28, type: "sine", gain: 0.34 });
        tone({ freq: 587, duration: 0.34, type: "sine", gain: 0.28, delay: 0.07 });
        tone({ freq: 784, duration: 0.4, type: "sine", gain: 0.22, delay: 0.14 });
    },
    lost: () => {
        tone({ freq: 300, to: 150, duration: 0.42, type: "sawtooth", gain: 0.26 });
        noise({ duration: 0.4, gain: 0.22, bandpass: 420 });
    },
    battle: () => {
        noise({ duration: 0.3, gain: 0.3, bandpass: 800 });
        tone({ freq: 140, to: 90, duration: 0.24, type: "square", gain: 0.18 });
    },
    build: () => {
        tone({ freq: 620, duration: 0.09, type: "square", gain: 0.18 });
        tone({ freq: 880, duration: 0.12, type: "square", gain: 0.15, delay: 0.08 });
    },
    event: () => {
        tone({ freq: 240, to: 320, duration: 0.5, type: "sine", gain: 0.24 });
        tone({ freq: 360, to: 480, duration: 0.5, type: "sine", gain: 0.16, delay: 0.05 });
    },
    victory: () => {
        [392, 494, 587, 784].forEach((f, i) => tone({ freq: f, duration: 0.7, type: "sine", gain: 0.3, delay: i * 0.13 }));
    },
    defeat: () => {
        [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, duration: 0.8, type: "sine", gain: 0.28, delay: i * 0.17 }));
    },
};
