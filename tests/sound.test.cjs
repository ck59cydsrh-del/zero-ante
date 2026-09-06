const { test } = require("node:test");
const assert = require("node:assert/strict");
const GameSound = require("../sound.js");

class FakeAudio {
    static made = [];
    constructor(src) {
        this.src = src;
        this.events = {};
        this.paused = false;
        FakeAudio.made.push(this);
    }
    cloneNode() { return new FakeAudio(this.src); }
    addEventListener(name, fn) { this.events[name] = fn; }
    play() { this.played = true; return Promise.resolve(); }
    pause() { this.paused = true; }
}

test("all major poker and reward events have assigned samples", () => {
    const required = ["check", "fold", "call", "raise", "allin", "street", "attack", "info", "chaos", "reward", "win", "defeat"];
    required.forEach((kind) => assert.match(GameSound.SOURCES[kind], /\.mp3$/));
    assert.equal(new Set(required.map((kind) => GameSound.SOURCES[kind])).size, required.length);
});

test("sound stays silent until enabled and mute stops every active cue", () => {
    const engine = GameSound.create(FakeAudio, "audio/");
    assert.equal(engine.play("check"), false);
    engine.setEnabled(true);
    assert.equal(engine.play("check"), true);
    assert.equal(engine.activeCount(), 1);
    const playing = FakeAudio.made.at(-1);
    engine.setEnabled(false);
    assert.equal(engine.activeCount(), 0);
    assert.equal(playing.paused, true);
});

test("polyphony is capped so rapid effects cannot overload the mix", () => {
    const engine = GameSound.create(FakeAudio, "audio/");
    engine.setEnabled(true);
    for (let i = 0; i < 10; i++) engine.play("raise");
    assert.equal(engine.activeCount(), 6);
});
