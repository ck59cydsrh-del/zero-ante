/* ZERO//ANTE — ローカル通信（WebRTC データチャネル）
   ------------------------------------------------------------
   合図の受け渡しに中継サーバを置かない。片方が出した「合図コード」を
   もう片方に貼るだけで、同じ回線の中で直接つながる。
   同じ Wi-Fi なら STUN も要らない（host 候補だけで届く）ので、
   外に一切出ないまま二台で遊べる。
   ------------------------------------------------------------ */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.Net = factory();
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    // 合図は SDP の丸ごと。素の文字列は 2000 字を超えるので、必ず縮めてから渡す。
    async function pack(obj) {
        const bytes = new TextEncoder().encode(JSON.stringify(obj));
        if (typeof CompressionStream !== "function") return "R" + b64(bytes);
        const cs = new CompressionStream("deflate-raw");
        const writer = cs.writable.getWriter();
        writer.write(bytes); writer.close();
        const packed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
        return "Z" + b64(packed);
    }
    async function unpack(code) {
        const body = unb64(code.replace(/\s+/g, "").slice(1));
        if (code[0] === "R") return JSON.parse(new TextDecoder().decode(body));
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        writer.write(body); writer.close();
        return JSON.parse(await new Response(ds.readable).text());
    }
    const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const unb64 = (s) => {
        const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
        return Uint8Array.from(raw, (c) => c.charCodeAt(0));
    };

    // 候補集めが終わるまで待つ。trickle をやめると、貼るコードが1本で済む。
    function settled(pc) {
        return new Promise((done) => {
            if (pc.iceGatheringState === "complete") return done();
            const timer = setTimeout(done, 2500);
            pc.addEventListener("icegatheringstatechange", () => {
                if (pc.iceGatheringState === "complete") { clearTimeout(timer); done(); }
            });
        });
    }

    function wire(session, channel) {
        session.channel = channel;
        channel.onopen = () => session.onopen && session.onopen();
        channel.onclose = () => session.onclose && session.onclose();
        channel.onmessage = (e) => {
            let data; try { data = JSON.parse(e.data); } catch { return; }
            session.onmessage && session.onmessage(data);
        };
    }

    function make() {
        const pc = new RTCPeerConnection(ICE);
        const session = { pc, channel: null, onopen: null, onmessage: null, onclose: null };
        session.send = (obj) => {
            if (session.channel && session.channel.readyState === "open") session.channel.send(JSON.stringify(obj));
        };
        session.close = () => { try { session.channel && session.channel.close(); pc.close(); } catch {} };
        session.open = () => !!session.channel && session.channel.readyState === "open";
        pc.onconnectionstatechange = () => {
            if (["failed", "disconnected", "closed"].includes(pc.connectionState) && session.onclose) session.onclose();
        };
        return session;
    }

    async function host() {
        const session = make();
        wire(session, session.pc.createDataChannel("ante", { ordered: true }));
        await session.pc.setLocalDescription(await session.pc.createOffer());
        await settled(session.pc);
        session.code = await pack(session.pc.localDescription);
        session.accept = async (answerCode) => {
            await session.pc.setRemoteDescription(await unpack(answerCode));
        };
        return session;
    }

    async function join(offerCode) {
        const session = make();
        session.pc.ondatachannel = (e) => wire(session, e.channel);
        await session.pc.setRemoteDescription(await unpack(offerCode));
        await session.pc.setLocalDescription(await session.pc.createAnswer());
        await settled(session.pc);
        session.code = await pack(session.pc.localDescription);
        return session;
    }

    /* ── 合言葉で合流する。sshhooggii と同じやり方 ──────────────
       PeerJS の公開ブローカーに `zero-ante-<合言葉>` という決め打ちの id で
       部屋を開き、相手は同じ id に繋ぐ。こちらでサーバを持たないので
       静的配信のままで動く。ブローカーが使えないときのために、
       合図コードの手渡し（host / join）も残してある。
       ------------------------------------------------------------ */
    const ROOM_ID = (code) => "zero-ante-" + String(code).trim().toLowerCase().replace(/\s+/g, "-");

    function fromPeer(peer) {
        const session = {
            peer, channel: null, onopen: null, onmessage: null, onclose: null,
            send: (obj) => { if (session.channel && session.channel.open) { try { session.channel.send(obj); } catch (e) {} } },
            open: () => !!session.channel && session.channel.open,
            close: () => { try { session.channel && session.channel.close(); peer.destroy(); } catch (e) {} },
        };
        session.bind = (conn) => {
            session.channel = conn;
            conn.on("open", () => session.onopen && session.onopen());
            conn.on("data", (d) => { if (d && typeof d === "object") session.onmessage && session.onmessage(d); });
            conn.on("close", () => session.onclose && session.onclose());
            conn.on("error", () => session.onclose && session.onclose());
        };
        return session;
    }

    function room(code, asHost) {
        return new Promise((resolve, reject) => {
            if (typeof Peer === "undefined") return reject(new Error("peerjs-missing"));
            const peer = asHost ? new Peer(ROOM_ID(code), { debug: 0 }) : new Peer({ debug: 0 });
            const session = fromPeer(peer);
            let settled = false;
            const done = (fn, v) => { if (!settled) { settled = true; fn(v); } };
            peer.on("open", () => {
                if (asHost) {
                    peer.on("connection", (c) => session.bind(c));
                    done(resolve, session);
                } else {
                    const c = peer.connect(ROOM_ID(code), { reliable: true });
                    session.bind(c);
                    c.on("open", () => done(resolve, session));
                    setTimeout(() => done(reject, new Error("timeout")), 12000);
                }
            });
            peer.on("error", (e) => {
                const kind = String((e && e.type) || e);
                done(reject, new Error(
                    kind.includes("unavailable-id") ? "room-taken" :
                    kind.includes("peer-unavailable") ? "no-host" : kind));
            });
            setTimeout(() => done(reject, new Error("timeout")), 15000);
        });
    }

    return { host, join, pack, unpack, room, ROOM_ID };
});
