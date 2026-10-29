const fs = require("fs"),
  path = require("path"),
  http = require("http"),
  assert = require("assert/strict"),
  { chromium } = require("@playwright/test");
const root = path.resolve(__dirname, "../dist"),
  output = path.resolve(__dirname, "../test-results");
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  let file = path.resolve(
    root,
    "." + decodeURIComponent(new URL(req.url, "http://local").pathname),
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  if (!path.extname(file)) file += ".html";
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader(
    "Content-Type",
    {
      ".html": "text/html",
      ".js": "application/javascript",
      ".ttf": "font/ttf",
      ".png": "image/png",
    }[path.extname(file)] || "application/octet-stream",
  );
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
      channel: process.env.BROWSER_CHANNEL || "msedge",
    }),
    errors = [];
  try {
    for (const width of [320, 390, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        "http://127.0.0.1:" +
          server.address().port +
          "/auth/signup?selectedRole=mechanic",
      );
      await page
        .getByRole("textbox", { name: "Full name", exact: true })
        .waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page
        .locator("img")
        .evaluateAll((images) =>
          Promise.all(images.map((image) => image.decode().catch(() => {}))),
        );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: output + "/registration-" + width + ".png",
      });
      await page
        .getByRole("button", { name: "Choose city", exact: true })
        .click();
      await page.getByRole("button", { name: "Ramallah", exact: true }).click();
      assert.equal(
        await page
          .getByRole("textbox", { name: "City", exact: true })
          .inputValue(),
        "Ramallah",
      );
      await page
        .getByRole("button", { name: "Read registration terms", exact: true })
        .click();
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: output + "/registration-lower-" + width + ".png",
      });
      if (width === 390) {
        await page.getByRole("radio", { name: "العربية", exact: true }).click();
        await page.getByRole("radio", { name: "ليلي", exact: true }).click();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        await page
          .getByRole("textbox", { name: "الاسم الكامل", exact: true })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: output + "/registration-arabic-dark.png",
        });
      }
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS visual: 320/390/430px, no horizontal overflow, city selection, terms modal, Arabic and dark mode. No API requests or accounts created.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
