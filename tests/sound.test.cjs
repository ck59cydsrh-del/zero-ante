const { test } = require("node:test");
const assert = require("node:assert/strict");
const GameSound = require("../sound.js");

test("every poker, ability and reward event has its own synthesis recipe", () => {
    const required = ["check", "fold", "call", "raise", "allin", "street", "attack", "info", "guard", "chaos", "reward", "win", "defeat"];
    required.forEach((kind) => assert.ok(GameSound.CUES[kind]?.notes.length, kind));
    const fingerprints = required.map((kind) => JSON.stringify(GameSound.CUES[kind]));
    assert.equal(new Set(fingerprints).size, required.length);
});

test("the sound engine does not depend on uploaded audio files", () => {
    assert.equal("SOURCES" in GameSound, false);
    assert.equal(GameSound.create(null), null);
});

test("high-impact cues layer tone, bass and noise", () => {
    ["allin", "attack", "chaos", "win"].forEach((kind) => {
        assert.ok(GameSound.CUES[kind].sub, `${kind} sub`);
        assert.ok(GameSound.CUES[kind].noise, `${kind} noise`);
    });
    assert.ok(GameSound.CUES.win.notes.length > GameSound.CUES.call.notes.length);
});
