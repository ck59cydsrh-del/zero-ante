(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.GameSound = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const SOURCES = Object.freeze({
        action: "check.mp3",
        check: "check.mp3",
        fold: "fold.mp3",
        call: "call.mp3",
        raise: "raise.mp3",
        allin: "allin.mp3",
        street: "street.mp3",
        attack: "attack.mp3",
        info: "info.mp3",
        guard: "info.mp3",
        chaos: "chaos.mp3",
        reward: "reward.mp3",
        win: "win.mp3",
        defeat: "defeat.mp3",
        system: "check.mp3",
    });
    const VOLUME = Object.freeze({
        action: 0.42,
        check: 0.42,
        fold: 0.5,
        call: 0.5,
        raise: 0.58,
        allin: 0.72,
        street: 0.48,
        attack: 0.62,
        info: 0.46,
        guard: 0.46,
        chaos: 0.66,
        reward: 0.66,
        win: 0.78,
        defeat: 0.56,
        system: 0.38,
    });

    function create(AudioCtor, basePath = "assets/audio/") {
        if (typeof AudioCtor !== "function") return null;
        const bank = new Map();
        const active = new Set();
        let enabled = false;

        function getBase(kind) {
            const file = SOURCES[kind] || SOURCES.system;
            if (!bank.has(file)) {
                const audio = new AudioCtor(basePath + file);
                audio.preload = "auto";
                bank.set(file, audio);
            }
            return bank.get(file);
        }

        function preload() {
            [...new Set(Object.keys(SOURCES))].forEach(getBase);
            return bank.size;
        }

        function stopAll() {
            active.forEach((audio) => {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (_) {}
            });
            active.clear();
        }

        function setEnabled(next) {
            enabled = Boolean(next);
            if (enabled) preload();
            else stopAll();
            return enabled;
        }

        function play(kind) {
            if (!enabled) return false;
            while (active.size >= 6) {
                const oldest = active.values().next().value;
                try { oldest.pause(); } catch (_) {}
                active.delete(oldest);
            }
            const sound = getBase(kind).cloneNode(true);
            sound.volume = VOLUME[kind] ?? VOLUME.system;
            sound.playbackRate = 0.985 + Math.random() * 0.03;
            active.add(sound);
            const done = () => active.delete(sound);
            sound.addEventListener("ended", done, { once: true });
            sound.addEventListener("error", done, { once: true });
            try {
                const result = sound.play();
                if (result && typeof result.catch === "function") result.catch(done);
            } catch (_) {
                done();
                return false;
            }
            return true;
        }

        return {
            play,
            preload,
            setEnabled,
            stopAll,
            isEnabled: () => enabled,
            activeCount: () => active.size,
        };
    }

    return { SOURCES, VOLUME, create };
});
