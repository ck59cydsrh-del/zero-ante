(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.GameSound = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const CUES = Object.freeze({
        action: { notes: [[980, 0, .045, "sine", .055]], noise: [.028, 2600, .022] },
        system: { notes: [[660, 0, .06, "sine", .035]] },
        check: { notes: [[1040, 0, .045, "sine", .06]], noise: [.025, 3100, .025] },
        fold: { notes: [[330, 0, .14, "triangle", .06, 150]], noise: [.08, 900, .025] },
        call: { notes: [[520, 0, .07, "sine", .055], [780, .055, .09, "sine", .052]] },
        raise: { notes: [[220, 0, .11, "triangle", .075], [330, .055, .11, "triangle", .068], [494, .11, .14, "square", .045], [660, .17, .16, "sine", .06]], sub: [86, .16, .09] },
        allin: { notes: [[180, 0, .5, "sawtooth", .045, 920], [440, .22, .25, "square", .035], [660, .25, .27, "square", .03], [880, .29, .3, "sine", .055]], sub: [78, .48, .16], noise: [.22, 520, .065] },
        street: { notes: [[440, 0, .1, "sine", .05], [660, .08, .14, "sine", .052], [880, .17, .16, "triangle", .035]], noise: [.06, 1800, .018] },
        info: { notes: [[1180, 0, .12, "sine", .045], [1770, .065, .18, "sine", .035]] },
        guard: { notes: [[392, 0, .16, "sine", .045], [494, .045, .18, "sine", .04], [659, .09, .22, "triangle", .04]] },
        attack: { notes: [[180, 0, .2, "sawtooth", .05, 72], [270, .035, .16, "square", .03, 115]], sub: [72, .24, .12], noise: [.11, 680, .045] },
        chaos: { notes: [[277, 0, .23, "triangle", .055, 415], [403, .04, .25, "square", .028, 622], [554, .09, .3, "sine", .05, 831]], sub: [62, .3, .1], noise: [.16, 1200, .035] },
        reward: { notes: [[523, 0, .13, "sine", .05], [659, .07, .14, "sine", .048], [784, .14, .15, "triangle", .045], [1047, .21, .24, "sine", .055], [1319, .3, .28, "sine", .035]], noise: [.08, 4200, .018] },
        win: { notes: [[262, 0, .25, "triangle", .06], [392, .06, .28, "triangle", .055], [523, .13, .38, "sine", .065], [659, .2, .42, "sine", .06], [784, .28, .5, "triangle", .055], [1047, .4, .62, "sine", .06], [1319, .56, .7, "sine", .04]], sub: [68, .46, .18], noise: [.16, 2400, .035] },
        defeat: { notes: [[392, 0, .2, "triangle", .05], [311, .11, .22, "triangle", .045], [233, .22, .25, "sine", .04], [174, .34, .32, "sine", .035]], sub: [58, .32, .055] },
    });

    function create(AudioContextCtor) {
        if (typeof AudioContextCtor !== "function") return null;
        let context = null, master = null, enabled = false, momentum = 0;
        const active = new Set();

        function init() {
            if (context) return;
            context = new AudioContextCtor();
            master = context.createGain();
            master.gain.value = .72;
            const compressor = context.createDynamicsCompressor();
            compressor.threshold.value = -18;
            compressor.knee.value = 15;
            compressor.ratio.value = 8;
            compressor.attack.value = .003;
            compressor.release.value = .18;
            master.connect(compressor).connect(context.destination);
        }
        function track(node) {
            while (active.size >= 36) {
                const oldest = active.values().next().value;
                try { oldest.stop(); } catch (_) {}
                active.delete(oldest);
            }
            active.add(node);
            node.onended = () => active.delete(node);
            return node;
        }
        function tone([frequency, offset, duration, type, volume, endFrequency], shift = 1) {
            const start = context.currentTime + offset;
            const oscillator = track(context.createOscillator());
            const gain = context.createGain();
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(Math.max(35, frequency * shift), start);
            if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency * shift), start + duration);
            gain.gain.setValueAtTime(.0001, start);
            gain.gain.exponentialRampToValueAtTime(volume, start + .006);
            gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
            oscillator.connect(gain).connect(master);
            oscillator.start(start);
            oscillator.stop(start + duration + .02);
        }
        function sub([frequency, duration, volume]) { tone([frequency, 0, duration, "sine", volume, 38]); }
        function noise([duration, frequency, volume]) {
            const length = Math.ceil(context.sampleRate * duration);
            const buffer = context.createBuffer(1, length, context.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
            const source = track(context.createBufferSource());
            const filter = context.createBiquadFilter();
            const gain = context.createGain();
            source.buffer = buffer;
            filter.type = "bandpass";
            filter.frequency.value = frequency;
            filter.Q.value = 1.4;
            gain.gain.setValueAtTime(volume, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration);
            source.connect(filter).connect(gain).connect(master);
            source.start();
            source.stop(context.currentTime + duration + .01);
        }
        function play(kind) {
            if (!enabled) return false;
            init();
            if (context.state === "suspended") context.resume().catch(() => {});
            const cue = CUES[kind] || CUES.system;
            if (kind === "raise") momentum = Math.min(4, momentum + 1);
            else if (kind === "allin") momentum = 4;
            else if (["fold", "street", "defeat", "win"].includes(kind)) momentum = 0;
            const shift = kind === "raise" ? 2 ** (momentum / 24) : 1;
            cue.notes.forEach((note) => tone(note, shift));
            if (cue.sub) sub(cue.sub);
            if (cue.noise) noise(cue.noise);
            return true;
        }
        function stopAll() {
            active.forEach((node) => { try { node.stop(); } catch (_) {} });
            active.clear();
        }
        function setEnabled(next) {
            enabled = Boolean(next);
            if (enabled) {
                init();
                if (context.state === "suspended") context.resume().catch(() => {});
            } else stopAll();
            return enabled;
        }
        return { play, setEnabled, stopAll, isEnabled: () => enabled, activeCount: () => active.size };
    }
    return { CUES, create };
});
