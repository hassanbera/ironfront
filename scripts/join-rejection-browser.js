// Run on a fresh main page with ?server=wss://your-game-host/ws.
// Three browser WebSockets plus the rendered UI use the real page Origin.
async (page) => {
  const server = new URL(page.url()).searchParams.get("server");
  if (!server) throw Error("Pass the WebSocket server in the page query");
  const room = await page.evaluate(async (url) => {
    const test = (window.__joinTest = { peers: [], room: "" });
    const connect = (faction) =>
      new Promise((resolve, reject) => {
        const peer = { ws: new WebSocket(url), state: null };
        test.peers.push(peer);
        const timer = setTimeout(
          () => reject(Error("Test peer welcome timeout")),
          10000,
        );
        peer.ws.onopen = () =>
          peer.ws.send(
            JSON.stringify({
              type: faction === 0 ? "create" : "join",
              room: test.room,
              name: "Live test " + faction,
              faction,
              heroClass: 0,
              map: 0,
            }),
          );
        peer.ws.onerror = () => {
          clearTimeout(timer);
          reject(Error("Test peer socket error"));
        };
        peer.ws.onmessage = ({ data }) => {
          const message = JSON.parse(data);
          if (message.type === "welcome") {
            clearTimeout(timer);
            test.room = message.room;
            resolve();
          } else if (message.type === "state") peer.state = message;
          else if (message.type === "error") {
            clearTimeout(timer);
            reject(Error(message.message));
          }
        };
      });
    for (const faction of [0, 2, 3]) await connect(faction);
    return test.room;
  }, server);
  try {
    await page.locator("#join-room").click();
    await page.locator("#player-name").fill("Live UI");
    await page.locator("#join-code").fill(room);
    await page.locator("#room-faction").selectOption("0");
    await page.locator('#room-form button[type="submit"]').click();
    await page
      .getByText("Bu faction seçilmiş. Başka bir sancak seç", { exact: true })
      .waitFor({ state: "visible" });
    if (
      (await page.locator("#connection-banner").isVisible()) ||
      !(await page.locator("#practice").isEnabled())
    )
      throw Error("Rejected join kept UI connecting");
    await page.locator("#room-faction").selectOption("1");
    await page.locator('#room-form button[type="submit"]').click();
    await page.locator(".lobby-code strong").waitFor({ state: "visible" });
    if ((await page.locator(".lobby-code strong").textContent()) !== room)
      throw Error("Joined another room");
    await page.waitForFunction(() =>
      window.__joinTest.peers.every(
        (p) => p.state?.players.filter(Boolean).length === 4,
      ),
    );
    await page.evaluate(() =>
      window.__joinTest.peers[0].ws.send(
        JSON.stringify({ type: "start", bots: false }),
      ),
    );
    await page.locator("#hero-toggle").waitFor({ state: "visible" });
    await page.locator("#hero-toggle").click();
    await page.waitForFunction(
      () =>
        window.__joinTest.peers[0].state?.heroes.find((h) => h.owner === 1)
          .active,
    );
    const start = await page.evaluate(() => {
      const h = window.__joinTest.peers[0].state.heroes.find(
        (h) => h.owner === 1,
      );
      return [h.x, h.z];
    });
    await page.keyboard.down("w");
    try {
      await page.waitForFunction(
        ([x, z]) => {
          const h = window.__joinTest.peers[0].state.heroes.find(
            (h) => h.owner === 1,
          );
          return Math.hypot(h.x - x, h.z - z) > 1;
        },
        start,
        { timeout: 5000 },
      );
    } finally {
      await page.keyboard.up("w");
    }
    const state = await page.evaluate(() => {
      const s = window.__joinTest.peers[0].state;
      return {
        connected: s.players.filter((p) => p?.connected).length,
        soldiers: s.squads.reduce((n, s) => n + s.alive, 0),
        heroReplicated: s.heroes.find((h) => h.owner === 1).active,
      };
    });
    if (state.connected !== 4 || state.soldiers !== 400)
      throw Error("Incomplete four player battle");
    await page.locator("#brand").click();
    await page.locator("#leave").click();
    return {
      result: "PASS",
      rejectedJoinReleasedUI: true,
      joinedAfterRejection: true,
      ...state,
      heroMovementReplicated: true,
    };
  } finally {
    await page.evaluate(() => {
      for (const p of window.__joinTest?.peers ?? []) {
        if (p.ws.readyState === 1) p.ws.send(JSON.stringify({ type: "leave" }));
        p.ws.close();
      }
      delete window.__joinTest;
    });
  }
}
