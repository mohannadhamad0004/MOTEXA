const fs = require("fs"),
  path = require("path"),
  http = require("http"),
  assert = require("assert/strict"),
  { randomUUID } = require("crypto"),
  { createRequire } = require("module"),
  { pathToFileURL } = require("url");
const { chromium } = require("@playwright/test"),
  backend = path.resolve(__dirname, "../../backend"),
  br = createRequire(backend + "/package.json");
br("dotenv").config({ path: backend + "/.env", quiet: true });
(async () => {
  const { prisma } = await import(pathToFileURL(backend + "/dist/prisma.js"));
  const { default: mechanics } = await import(
    pathToFileURL(backend + "/dist/routes/mechanics.routes.js")
  );
  const { default: workflow } = await import(
    pathToFileURL(backend + "/dist/routes/mechanic-workflow.routes.js")
  );
  const { default: auth } = await import(
    pathToFileURL(backend + "/dist/routes/auth.routes.js")
  );
  const express = br("express"),
    app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use("/api/auth", auth);
  app.use("/api/mechanics", mechanics);
  app.use("/api/mechanic-workflow", workflow);
  const api = app.listen(0, "127.0.0.1");
  await new Promise((r) => api.once("listening", r));
  const apiBase = "http://127.0.0.1:" + api.address().port;
  const webRoot = path.resolve(__dirname, "../dist");
  const web = http.createServer((req, res) => {
    let file = path.resolve(
      webRoot,
      "." + decodeURIComponent(new URL(req.url, "http://local").pathname),
    );
    if (!file.startsWith(webRoot + path.sep) && file !== webRoot) {
      res.writeHead(403);
      return res.end();
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, "index.html");
    if (!fs.existsSync(file) && !path.extname(file)) file += ".html";
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      return res.end();
    }
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".ttf": "font/ttf",
        ".png": "image/png",
      }[path.extname(file)] || "application/octet-stream",
    );
    res.end(fs.readFileSync(file));
  });
  web.listen(0, "127.0.0.1");
  await new Promise((r) => web.once("listening", r));
  const site = "http://127.0.0.1:" + web.address().port;
  const tag = "workspace-" + randomUUID(),
    ids = [],
    profiles = [],
    qids = [],
    files = [],
    errors = [],
    pass = "Workspace!Pass123";
  let browser;
  const output = path.resolve(__dirname, "../test-results");
  fs.mkdirSync(output, { recursive: true });
  async function context() {
    const c = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await c.route("**/api/**", async (route) => {
      const incoming = new URL(route.request().url());
      const response = await route.fetch({
        url: apiBase + incoming.pathname + incoming.search,
      });
      await route.fulfill({ response });
    });
    return c;
  }
  async function signIn(page, email, role) {
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(15000);
    await page.goto(site + "/auth/login?selectedRole=" + role);
    await page.locator('input[aria-label="Email address"]:visible').fill(email);
    await page.locator('input[aria-label="Password"]:visible').fill(pass);
    await page
      .getByRole("button", { name: "Enter workspace", exact: true })
      .click();
  }
  try {
    const passwordHash = await br("argon2").hash(pass);
    const admin = await prisma.user.create({
      data: {
        fullName: "Workspace Reviewer",
        email: tag + "-admin@example.invalid",
        role: "ADMIN",
        status: "ACTIVE",
        passwordHash,
        adminPermissions: { create: { permission: "MANAGE_MECHANICS" } },
      },
    });
    ids.push(admin.id);
    const owner = await prisma.user.create({
      data: {
        fullName: "Workspace Fixture Mechanic",
        email: tag + "-mechanic@example.invalid",
        role: "MECHANIC",
        status: "ACTIVE",
        passwordHash,
      },
    });
    ids.push(owner.id);
    const privateRoot = path.resolve(
      process.env.MECHANIC_DOCUMENT_DIR || ".private/mechanic-documents",
    );
    fs.mkdirSync(privateRoot, { recursive: true });
    const docs = ["IDENTITY", "CERTIFICATE"].map((kind) => {
      const key = randomUUID(),
        file = path.join(privateRoot, key);
      files.push(file);
      fs.writeFileSync(
        file,
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
          "base64",
        ),
      );
      return {
        kind,
        fileName: kind.toLowerCase() + ".png",
        mimeType: "image/png",
        size: 68,
        storageKey: key,
      };
    });
    const p = await prisma.mechanicProfile.create({
      data: {
        userId: owner.id,
        verificationStatus: "PENDING",
        submittedAt: new Date(),
        submissionVersion: 1,
        specializations: ["PETROL_ENGINES"],
        city: "Ramallah",
        phoneNumber: "0599999999",
        yearsOfExperience: 5,
        experienceSummary: "Five years of safe professional service.",
        offersOnSite: true,
        coverageAreas: ["Ramallah"],
        documents: { create: docs },
      },
    });
    profiles.push(p.id);
    for (let i = 0; i < 2; i++) {
      let q = await prisma.mechanicQuestion.create({
        data: {
          specialization: "PETROL_ENGINES",
          prompt: `Fixture professional question ${i + 1}: choose the safe answer.`,
          options: [
            "Safe procedure",
            "Unsafe option B",
            "Unsafe option C",
            "Unsafe option D",
          ],
          correctIndex: 0,
          createdById: admin.id,
          active: true,
          reviewStatus: "APPROVED",
          reviewerName: "Fixture reviewer",
          reviewedAt: new Date(),
          explanation: "Fixture technical explanation for browser tests.",
          sourceUrl: "https://www.fluke.com/",
          sourceReference: "Fixture reference",
        },
      });
      qids.push(q.id);
    }
    browser = await chromium.launch({ channel: "msedge" });
    const ac = await context(),
      mc = await context(),
      a = await ac.newPage(),
      m = await mc.newPage();
    await signIn(a, admin.email, "mechanics-admin");
    await a.getByText("Your mechanics", { exact: false }).first().waitFor();
    await a
      .getByLabel("Search mechanics", { exact: true })
      .fill(owner.fullName);
    await a
      .getByRole("button", { name: "Review request", exact: true })
      .click();
    await a.getByRole("tab", { name: "Documents", exact: true }).click();
    await a
      .getByRole("button", { name: "View document", exact: true })
      .first()
      .click();
    await a.getByRole("button", { name: "Close preview", exact: true }).click();
    for (const file of ["identity.png", "certificate.png"]) {
      await a
        .getByRole("checkbox", {
          name: file + " · Reviewed and clear",
          exact: true,
        })
        .click();
      await a.waitForFunction(
        () => !document.querySelector('[aria-label="Loading"]'),
      );
    }
    await a
      .getByRole("button", { name: "Continue to assessment", exact: true })
      .click();
    for (let i = 0; i < 2; i++)
      await a
        .getByRole("checkbox", {
          name: `Fixture professional question ${i + 1}: choose the safe answer.`,
          exact: true,
        })
        .click();
    await a
      .getByRole("button", {
        name: "Preview & send two questions",
        exact: true,
      })
      .click();
    await a.getByRole("button", { name: "Confirm", exact: true }).click();
    await a
      .getByText("The test was sent to the mechanic account.", { exact: true })
      .waitFor();
    await signIn(m, owner.email, "mechanic");
    await m
      .getByRole("button", {
        name: "Open test & administrator conversation",
        exact: true,
      })
      .click();
    await m
      .getByRole("checkbox", { name: "Safe procedure", exact: true })
      .click();
    await m.getByRole("button", { name: "Next question", exact: true }).click();
    await m
      .getByRole("checkbox", { name: "Safe procedure", exact: true })
      .click();
    await m
      .getByRole("button", { name: "Submit answers", exact: true })
      .click();
    await m
      .getByRole("button", { name: "Submit answers", exact: true })
      .last()
      .click();
    await m.getByText("Answers submitted", { exact: true }).waitFor();
    await a
      .getByRole("button", { name: "Refresh answers", exact: true })
      .click();
    await a.getByText("2 / 2", { exact: true }).waitFor();
    await a
      .getByLabel("Admin assessment notes", { exact: true })
      .fill("Both answers demonstrate safe procedures.");
    await a
      .getByRole("button", { name: "Save assessment", exact: true })
      .click();
    await a
      .getByText("Assessment saved. Final approval remains your decision.", {
        exact: true,
      })
      .waitFor();
    await a.getByRole("tab", { name: "Conversation", exact: true }).click();
    await a
      .getByLabel("Write a message", { exact: true })
      .fill("Your professional assessment is complete.");
    await a.getByRole("button", { name: "Send message", exact: true }).click();
    await a
      .getByText("Your professional assessment is complete.", { exact: true })
      .waitFor();
    await m.getByRole("button", { name: "Conversation", exact: true }).click();
    await m.reload();
    await m.getByRole("button", { name: "Conversation", exact: true }).click();
    await m
      .getByText("Your professional assessment is complete.", { exact: true })
      .waitFor();
    await m
      .getByLabel("Write a message", { exact: true })
      .fill("Thank you for reviewing my application.");
    await m.getByRole("button", { name: "Send message", exact: true }).click();
    await m
      .getByText("Thank you for reviewing my application.", { exact: true })
      .waitFor();
    await a.getByRole("tab", { name: "Decision", exact: true }).click();
    await a
      .getByRole("button", { name: "Approve application", exact: true })
      .click();
    await a.getByRole("button", { name: "Confirm", exact: true }).click();
    await a
      .getByRole("button", { name: "Suspend account", exact: true })
      .waitFor();
    await a.screenshot({
      path: output + "/workspace-decision.png",
      fullPage: true,
    });
    await a
      .getByRole("button", { name: "Back to applications", exact: true })
      .click();
    await a.setViewportSize({ width: 1440, height: 1000 });
    await a.getByRole("button", { name: "Overview", exact: true }).click();
    await a.screenshot({
      path: output + "/workspace-desktop.png",
      fullPage: true,
    });
    for (const w of [320, 390, 600, 1440]) {
      await a.setViewportSize({ width: w, height: 844 });
      await a.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      if (
        await a.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        console.log(
          await a.evaluate(() =>
            [...document.querySelectorAll("body *")]
              .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 15)
              .map((e) => ({
                text: e.textContent.slice(0, 50),
                right: e.getBoundingClientRect().right,
                style: e.getAttribute("style"),
              })),
          ),
        );
      assert.equal(
        await a.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "Overflow at " + w,
      );
    }
    await a.setViewportSize({ width: 390, height: 844 });
    await a.screenshot({
      path: output + "/workspace-mobile.png",
      fullPage: true,
    });

    await a.getByRole("button", { name: "Tests", exact: true }).click();
    await a.getByRole("button", { name: "Add question", exact: true }).click();
    await a
      .getByLabel("Question text", { exact: true })
      .fill(`UI-added fixture question about a safe procedure. ${tag}`);
    for (let i = 0; i < 4; i++)
      await a
        .getByLabel("Answer " + (i + 1), { exact: true })
        .fill(
          [
            "Correct safe choice",
            "Other answer B",
            "Other answer C",
            "Other answer D",
          ][i],
        );
    await a
      .getByLabel("Answer explanation", { exact: true })
      .fill("Technical explanation reviewed in this browser test fixture.");
    await a
      .getByLabel("Source URL (HTTPS)", { exact: true })
      .fill("https://www.fluke.com/");
    await a
      .getByLabel("Source section / page", { exact: true })
      .fill("Technical browser fixture reference");
    await a.getByRole("button", { name: "Save question", exact: true }).click();
    await a
      .getByText(
        "Draft saved. Technical review is required before sending. Previously sent tests remain unchanged.",
        {
          exact: true,
        },
      )
      .waitFor();
    let created = await prisma.mechanicQuestion.findFirst({
      where: {
        createdById: admin.id,
        prompt: `UI-added fixture question about a safe procedure. ${tag}`,
      },
    });
    qids.push(created.id);
    const card = a.getByText(created.prompt, { exact: true }).locator("..");
    assert.equal(created.reviewStatus, "DRAFT");
    await card
      .getByRole("button", { name: "Review & approve", exact: true })
      .click();
    await a
      .getByLabel("Technical reviewer name", { exact: true })
      .fill("Browser fixture reviewer");
    await a
      .getByLabel("Technical review notes", { exact: true })
      .fill("Reviewed all options and supporting reference in this fixture.");
    await a
      .getByRole("checkbox", {
        name: "I confirm the technical review has been completed",
        exact: true,
      })
      .click();
    await a
      .getByRole("button", { name: "Approve question", exact: true })
      .click();
    await a
      .getByRole("button", { name: "Approve question", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(
      (await prisma.mechanicQuestion.findUnique({ where: { id: created.id } }))
        .reviewStatus,
      "APPROVED",
    );
    await card
      .getByRole("button", { name: "Edit question", exact: true })
      .click();
    await a
      .getByLabel("Question text", { exact: true })
      .fill(`UI-edited fixture question about a safe procedure. ${tag}`);
    await a.getByRole("button", { name: "Save question", exact: true }).click();
    await a
      .getByText(`UI-edited fixture question about a safe procedure. ${tag}`, {
        exact: true,
      })
      .waitFor();
    assert.equal(
      (await prisma.mechanicQuestion.findUnique({ where: { id: created.id } }))
        .active,
      false,
    );
    await a
      .getByRole("button", { name: "Save question", exact: true })
      .waitFor({ state: "hidden" });
    await a.getByRole("radio", { name: "العربية", exact: true }).click();
    await a.getByText("بنك الأسئلة المهنية", { exact: true }).waitFor();
    await a.getByRole("radio", { name: "ليلي", exact: true }).click();
    await a.screenshot({
      path: output + "/workspace-arabic-dark.png",
      fullPage: true,
    });
    await a.getByRole("radio", { name: "English", exact: true }).click();
    await a.getByRole("radio", { name: "light", exact: true }).click();
    await a.getByRole("button", { name: "Notifications", exact: true }).click();
    await a.getByRole("button", { name: "Mark all read", exact: true }).click();
    await a.getByRole("button", { name: "Home", exact: true }).click();
    await a
      .getByRole("button", { name: "All applications", exact: true })
      .click();
    await a.getByRole("checkbox", { name: "Approved", exact: true }).click();
    await a.getByRole("button", { name: "Approved", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    assert.equal(
      (await prisma.mechanicProfile.findUnique({ where: { id: p.id } }))
        .verificationStatus,
      "VERIFIED",
    );
    assert.equal(
      await prisma.mechanicMessage.count({ where: { profileId: p.id } }),
      2,
    );
    console.log(
      "PASS real RN web + PostgreSQL + two independent logins: admin review → test assignment → mechanic answers → score → admin assessment → two-way messages → approval. Four viewport widths, no JS errors.",
    );
  } catch (e) {
    if (browser)
      for (const c of browser.contexts())
        for (const p of c.pages())
          await p
            .screenshot({
              path: output + "/workspace-failure-" + Date.now() + ".png",
              fullPage: true,
            })
            .catch(() => {});
    throw e;
  } finally {
    if (browser) await browser.close();
    await prisma.notification.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { relatedUserId: { in: ids } }] },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: ids } },
          { targetId: { in: [...ids, ...profiles, ...qids] } },
        ],
      },
    });
    await prisma.mechanicQuestion.deleteMany({ where: { OR: [{ id: { in: qids } }, {createdById:{in:ids}}] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    for (const f of files) fs.unlinkSync(f);
    await prisma.$disconnect();
    await new Promise((r) => api.close(r));
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
