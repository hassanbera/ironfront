// Run on a fresh main page. ?baseline records the old behavior without the mutation threshold.
async (page) => {
  const baseline = new URL(page.url()).searchParams.has("baseline");
  await page.getByRole("button", { name: "MEYDANA ÇIK", exact: true }).click();
  await page.locator("#hero-toggle").waitFor({ state: "visible" });
  const firstRoom = await page.locator("#room-code").textContent();
  await page.locator("#hero-toggle").click();
  const mutations = await page.evaluate(async () => {
    const counts = { army: 0, hero: 0 };
    const observers = Object.entries({
      "army-list": "army",
      "hero-hud": "hero",
    }).map(([id, key]) => {
      const o = new MutationObserver((list) => {
        counts[key] += list.filter((m) => m.type === "childList").length;
      });
      o.observe(document.getElementById(id), {
        childList: true,
        subtree: true,
      });
      return o;
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    for (const o of observers) o.disconnect();
    return counts;
  });
  if (!baseline && (mutations.army !== 0 || mutations.hero > 2))
    throw Error("Unchanged/hidden HUD rebuilt: " + JSON.stringify(mutations));
  await page.locator("#hero-exit").click();
  if ((await page.locator("#army-list [data-squad]").count()) !== 4)
    throw Error("Army HUD not restored");
  await page.locator("#army-list [data-squad]").nth(1).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('#army-list [aria-pressed="true"]').length ===
        1 &&
      document
        .querySelectorAll("#army-list [data-squad]")[1]
        .getAttribute("aria-pressed") === "true",
  );
  await page.locator('[data-formation="1"]').click();
  await page.waitForFunction(() =>
    document.querySelector('[data-formation="1"]').classList.contains("active"),
  );
  await page.locator("#brand").click();
  await page.locator("#leave").click();
  await page.getByRole("button", { name: "MEYDANA ÇIK", exact: true }).click();
  await page.locator("#hero-toggle").waitFor({ state: "visible" });
  const secondRoom = await page.locator("#room-code").textContent();
  if (
    secondRoom === firstRoom ||
    (await page.locator("#army-list [data-squad]").count()) !== 4
  )
    throw Error("HUD cache leaked across matches");
  await page.locator("#brand").click();
  await page.locator("#leave").click();
  return {
    baseline,
    mutations,
    selection: true,
    formation: true,
    heroReturn: true,
    newMatch: true,
  };
}
