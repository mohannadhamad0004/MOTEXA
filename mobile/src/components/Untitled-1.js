const fs = require("fs"),
  path = require("path"),
  http = require("http"),
  assert = require("assert/strict"),
  { randomUUID } = require("crypto"),
  { createRequire } = require("module"),
  { pathToFileURL } = require("url");
const { chromium } = require("@playwright/test");
const backend = path.resolve(__dirname, "../../backend"),
  br = createRequire(backend + "/package.json");
br("dotenv").config({ path: backend + "/.env", quiet: true });
const express = br("express"),
  jwt = br("jsonwebtoken");
(async () => {
  const { prisma } = await import(pathToFileURL(backend + "/dist/prisma.js"));
  const { createMechanicRegistrationRouter } = await import(
    pathToFileURL(backend + "/dist/routes/mechanic-registration.routes.js")
  );
  const { default: mechanics } = await import(
    pathToFileURL(backend + "/dist/routes/mechanics.routes.js")
  );
  const { default: auth } = await import(
    pathToFileURL(backend + "/dist/routes/auth.routes.js")
  );
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use("/api/auth", auth);
  app.use("/api/auth/mechanic", createMechanicRegistrationRouter());
  app.use("/api/mechanics", mechanics);
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
  const email = "browser-" + randomUUID() + "@example.invalid",
    ids = [],
    profiles = [],
    errors = [];
  let browser;
  const output = path.resolve(__dirname, "../test-results");
  fs.mkdirSync(output, { recursive: true });
  try {
    const reviewer = await prisma.user.create({
      data: {
        fullName: "Browser Review Admin",
        email: "review-" + randomUUID() + "@example.invalid",
        role: "ADMIN",
        status: "ACTIVE",
        passwordHash: "unused",
        adminPermissions: { create: { permission: "MANAGE_MECHANICS" } },
      },
    });
    ids.push(reviewer.id);
    browser = await chromium.launch(
      process.env.BROWSER_CHANNEL
        ? { channel: process.env.BROWSER_CHANNEL }
        : { channel: "msedge" },
    );
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.route("**/api/**", async (route) => {
      const incoming = new URL(route.request().url());
      const response = await route.fetch({
        url: apiBase + incoming.pathname + incoming.search,
      });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(20000);
    await page.goto(site + "/auth/login");
    await page
      .getByRole("button", { name: "Create a new account", exact: true })
      .click();
    await page.getByRole("button", { name: "Mechanic", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Full name", exact: true })
      .fill("Browser Test Mechanic");
    await page
      .getByRole("textbox", { name: "Email address", exact: true })
      .fill(email);
    await page
      .getByRole("textbox", { name: "Phone number", exact: true })
      .fill("0598888888");
    await page
      .getByRole("textbox", { name: "City", exact: true })
      .fill("Ramallah");
    await page
      .locator('input[aria-label="Password"]:visible')
      .fill("Browser!Pass123");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("Browser!Pass123");
    await page
      .getByRole("checkbox", {
        name: "I agree to these registration and document privacy terms.",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Sign in and continue", exact: true })
      .waitFor();
    const mechanic = await prisma.user.findUnique({
      where: { email },
      include: { mechanicProfile: true },
    });
    ids.push(mechanic.id);
    profiles.push(mechanic.mechanicProfile.id);
    await page
      .getByRole("button", { name: "Sign in and continue", exact: true })
      .click();
    await page.locator('input[aria-label="Email address"]:visible').fill(email);
    await page
      .locator('input[aria-label="Password"]:visible')
      .fill("Browser!Pass123");
    await page
      .getByRole("button", { name: "Enter workspace", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Continue verification", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: "Petrol engines", exact: true })
      .click();
    await page.getByLabel("Years of experience", { exact: true }).fill("5");
    await page
      .getByLabel("Tell us about your experience", { exact: true })
      .fill("Five years diagnosing and safely repairing petrol engines.");
    await page
      .getByRole("button", { name: "Save and continue", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: "Workshop service", exact: true })
      .click();
    await page
      .getByLabel("Workshop name", { exact: true })
      .fill("Browser Workshop");
    await page
      .getByLabel("Workshop location / address", { exact: true })
      .fill("Ramallah test address");
    await page
      .getByRole("button", { name: "Save and continue", exact: true })
      .click();
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Upload document", exact: true })
      .first()
      .click();
    await (
      await chooser
    ).setFiles({
      name: "identity.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page
      .getByText("Document saved privately.", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Save and continue", exact: true })
      .click();
    await page
      .getByRole("checkbox", {
        name: "I confirm my information is accurate and consent to private document review by authorized MOTEXA administrators.",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Submit for verification", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Refresh status", exact: true })
      .waitFor();
    await page.screenshot({
      path: output + "/mechanic-pending.png",
      fullPage: true,
    });
    const admin = await context.newPage();
    admin.on("pageerror", (e) => errors.push(e.message));
    const adminToken = jwt.sign(
      { role: "ADMIN", sessionVersion: 0 },
      process.env.JWT_SECRET,
      { subject: reviewer.id, expiresIn: "10m" },
    );
    await admin.addInitScript(
      (v) => sessionStorage.setItem("motexa_access_token", v),
      adminToken,
    );
    await admin.goto(site + "/mechanics-admin");
    await admin.getByText("Browser Test Mechanic", { exact: true }).waitFor();
    await admin
      .getByRole("button", { name: "Review application", exact: true })
      .first()
      .click();
    await admin
      .getByRole("button", { name: "View document", exact: true })
      .first()
      .click();
    await admin
      .getByRole("button", { name: "Close preview", exact: true })
      .click();
    await admin
      .getByLabel("Interview notes", { exact: true })
      .fill("Passed practical diagnostics and described safe handling.");
    await admin
      .getByRole("button", { name: "Save interview result", exact: true })
      .click();
    await admin
      .getByRole("button", { name: "Approve mechanic", exact: true })
      .click();
    await admin.getByRole("button", { name: "Confirm", exact: true }).click();
    await admin
      .getByRole("button", { name: "Suspend services", exact: true })
      .waitFor();
    await admin.screenshot({
      path: output + "/mechanic-admin-approved.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Refresh status", exact: true })
      .click();
    await page.getByText("Approved service modes", { exact: true }).waitFor();
    await page.screenshot({
      path: output + "/mechanic-approved.png",
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    assert.equal(
      (
        await prisma.mechanicProfile.findUnique({
          where: { userId: mechanic.id },
        })
      ).verificationStatus,
      "VERIFIED",
    );
    console.log(
      "PASS browser + PostgreSQL: registration (no email) → login → professional profile → private upload → submit → admin document review → interview → approval → mechanic sees approved status. No real emails.",
    );
  } catch (e) {
    if (browser) {
      for (const c of browser.contexts())
        for (const p of c.pages())
          await p
            .screenshot({
              path: output + "/failure-" + Date.now() + ".png",
              fullPage: true,
            })
            .catch(() => {});
    }
    throw e;
  } finally {
    if (browser) await browser.close();
    const leftover = await prisma.user.findUnique({
      where: { email },
      include: { mechanicProfile: true },
    });
    if (leftover && !ids.includes(leftover.id)) {
      ids.push(leftover.id);
      if (leftover.mechanicProfile) profiles.push(leftover.mechanicProfile.id);
    }
    const documents = await prisma.mechanicDocument.findMany({
      where: { profileId: { in: profiles } },
      select: { storageKey: true },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: ids } },
          { targetId: { in: [...ids, ...profiles] } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    const privateRoot = path.resolve(
      process.env.MECHANIC_DOCUMENT_DIR || ".private/mechanic-documents",
    );
    for (const d of documents) {
      const f = path.resolve(privateRoot, d.storageKey);
      if (f.startsWith(privateRoot + path.sep) && fs.existsSync(f))
        fs.unlinkSync(f);
    }
    await prisma.$disconnect();
    await new Promise((r) => api.close(r));
    await new Promise((r) => web.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../dist/prisma.js";
import { createMechanicRegistrationRouter } from "../dist/routes/mechanic-registration.routes.js";
import mechanics from "../dist/routes/mechanics.routes.js";
import auth from "../dist/routes/auth.routes.js";

test("mechanic registration without email, private documents, review, resubmission and live approval gating", async () => {
  const tag = "onboarding-" + randomUUID(),
    email = tag + "@example.invalid",
    ids = [],
    profiles = [];
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  app.use("/api/auth", auth);
  app.use("/api/auth/mechanic", createMechanicRegistrationRouter());
  app.use("/api/mechanics", mechanics);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  async function api(route, method = "GET", body, token) {
    const r = await fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json() };
  }
  const token = (u) =>
    jwt.sign({ role: u.role, sessionVersion: 0 }, process.env.JWT_SECRET, {
      subject: u.id,
      expiresIn: "10m",
      algorithm: "HS256",
    });
  let fileKeys = [];
  try {
    const input = {
      fullName: "Test Mechanic",
      email,
      phoneNumber: "0599999999",
      city: "Ramallah",
      password: "Test!Pass1234",
      acceptTerms: true,
      role: "MECHANIC",
    };
    assert.equal(
      (
        await api("/api/auth/mechanic/register", "POST", {
          ...input,
          role: "SUPER_ADMIN",
        })
      ).status,
      400,
    );
    let r = await api("/api/auth/mechanic/register", "POST", input);
    assert.equal(r.status, 201);
    assert.equal(r.body.challengeId, undefined);
    let mechanic = await prisma.user.findUnique({
      where: { email },
      include: { mechanicProfile: true },
    });
    ids.push(mechanic.id);
    profiles.push(mechanic.mechanicProfile.id);
    assert.equal(mechanic.status, "ACTIVE");
    assert.equal(mechanic.emailVerifiedAt, null);
    assert.equal(
      await prisma.mechanicEmailCheck.count({ where: { userId: mechanic.id } }),
      0,
    );
    assert.equal(mechanic.mechanicProfile.verificationStatus, "DRAFT");
    assert.notEqual(mechanic.passwordHash, input.password);
    assert.equal(
      (await api("/api/auth/mechanic/register", "POST", input)).status,
      409,
    );
    r = await api("/api/auth/login", "POST", {
      email,
      password: input.password,
    });
    assert.equal(r.status, 200);
    const mt = r.body.accessToken;
    assert.equal((await api("/api/auth/me", "GET", undefined, mt)).status, 200);
    const reviewer = await prisma.user.create({
      data: {
        fullName: "Test Reviewer",
        email: tag + "-review@example.invalid",
        passwordHash: "unused",
        role: "ADMIN",
        status: "ACTIVE",
        adminPermissions: { create: { permission: "MANAGE_MECHANICS" } },
      },
    });
    const wrong = await prisma.user.create({
      data: {
        fullName: "Other Department",
        email: tag + "-parts@example.invalid",
        passwordHash: "unused",
        role: "ADMIN",
        status: "ACTIVE",
        adminPermissions: { create: { permission: "MANAGE_SPARE_PARTS" } },
      },
    });
    const other = await prisma.user.create({
      data: {
        fullName: "Other Mechanic",
        email: tag + "-other@example.invalid",
        passwordHash: "unused",
        role: "MECHANIC",
        status: "ACTIVE",
      },
    });
    ids.push(reviewer.id, wrong.id, other.id);
    const rt = token(reviewer);
    assert.equal(
      (await api("/api/mechanics/admin", "GET", undefined, token(wrong)))
        .status,
      403,
    );
    assert.equal(
      (await api("/api/mechanics/me/service-access", "GET", undefined, mt))
        .status,
      403,
    );
    assert.equal(
      (
        await api(
          "/api/mechanics/me/submit",
          "POST",
          { acceptPrivacy: true },
          mt,
        )
      ).status,
      400,
    );
    const professional = {
      city: "Ramallah",
      phoneNumber: "0599999999",
      specializations: ["PETROL_ENGINES"],
      yearsOfExperience: 5,
      experienceSummary: "Five years of automotive repair.",
      offersWorkshop: true,
      workshopName: "Test Workshop",
      workshopAddress: "Test address",
      offersOnSite: true,
      coverageAreas: ["Ramallah"],
      offersOnline: true,
    };
    assert.equal(
      (
        await api(
          "/api/mechanics/me",
          "PUT",
          { ...professional, specializations: ["BAD"] },
          mt,
        )
      ).status,
      400,
    );
    assert.equal(
      (await api("/api/mechanics/me", "PUT", professional, mt)).status,
      200,
    );
    assert.equal(
      (
        await api(
          "/api/mechanics/me/documents",
          "POST",
          {
            kind: "IDENTITY",
            base64: Buffer.from("<html>unsafe</html>").toString("base64"),
            mimeType: "image/png",
            fileName: "bad.png",
          },
          mt,
        )
      ).status,
      400,
    );
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
    r = await api(
      "/api/mechanics/me/documents",
      "POST",
      {
        kind: "IDENTITY",
        base64: png,
        mimeType: "image/png",
        fileName: "identity.png",
      },
      mt,
    );
    assert.equal(r.status, 201);
    const documentId = r.body.profile.documents[0].id;
    assert.equal(r.body.profile.documents[0].storageKey, undefined);
    assert.equal(
      (
        await api(
          "/api/mechanics/documents/" + documentId,
          "GET",
          undefined,
          token(other),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await api(
          "/api/mechanics/documents/" + documentId,
          "GET",
          undefined,
          token(wrong),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await api(
          "/api/mechanics/documents/" + documentId,
          "GET",
          undefined,
          rt,
        )
      ).status,
      200,
    );
    r = await api(
      "/api/mechanics/me/submit",
      "POST",
      { acceptPrivacy: true },
      mt,
    );
    assert.equal(r.status, 200);
    let version = r.body.profile.submissionVersion;
    assert.equal(r.body.profile.verificationStatus, "PENDING");
    assert.equal(
      (await api("/api/mechanics/me", "PUT", professional, mt)).status,
      409,
    );
    assert.equal(
      (
        await api(
          "/api/mechanics/admin/" + mechanic.id + "/decision",
          "POST",
          { action: "APPROVE", submissionVersion: version },
          rt,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await api(
          "/api/mechanics/admin/" + mechanic.id + "/decision",
          "POST",
          {
            action: "NEEDS_COMPLETION",
            notes: "Please provide a clearer identity image.",
            submissionVersion: version,
          },
          rt,
        )
      ).status,
      200,
    );
    assert.equal(
      (await api("/api/mechanics/me", "PUT", professional, mt)).status,
      200,
    );
    r = await api(
      "/api/mechanics/me/submit",
      "POST",
      { acceptPrivacy: true },
      mt,
    );
    assert.equal(r.status, 200);
    version = r.body.profile.submissionVersion;
    assert.equal(
      (
        await api(
          "/api/mechanics/admin/" + mechanic.id + "/interview",
          "POST",
          {
            result: "PASSED",
            notes: "Explained safe diagnostic procedures.",
            submissionVersion: version - 1,
          },
          rt,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await api(
          "/api/mechanics/admin/" + mechanic.id + "/interview",
          "POST",
          {
            result: "PASSED",
            notes: "Explained safe diagnostic procedures.",
            submissionVersion: version,
          },
          rt,
        )
      ).status,
      200,
    );
    r = await api(
      "/api/mechanics/admin/" + mechanic.id + "/decision",
      "POST",
      { action: "APPROVE", submissionVersion: version },
      rt,
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.profile.canReceiveServices, true);
    assert.equal(
      (await api("/api/mechanics/me/service-access", "GET", undefined, mt))
        .status,
      200,
    );
    assert.equal(
      (
        await api(
          "/api/mechanics/admin/" + mechanic.id + "/decision",
          "POST",
          { action: "APPROVE", submissionVersion: version },
          rt,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await api(
          "/api/mechanics/admin/" + mechanic.id + "/decision",
          "POST",
          {
            action: "SUSPEND",
            notes: "Services suspended pending an account review.",
            submissionVersion: version,
          },
          rt,
        )
      ).status,
      200,
    );
    assert.equal(
      (await api("/api/mechanics/me/service-access", "GET", undefined, mt))
        .status,
      403,
    );
    assert.equal(
      (await api("/api/mechanics/me", "GET", undefined, mt)).status,
      200,
    );
    r = await api("/api/mechanics/notifications", "GET", undefined, mt);
    assert.ok(r.body.notifications.length >= 4);
    assert.ok(
      (await prisma.auditLog.count({ where: { targetId: profiles[0] } })) >= 8,
    );
  } finally {
    fileKeys = (
      await prisma.mechanicDocument.findMany({
        where: { profileId: { in: profiles } },
        select: { storageKey: true },
      })
    ).map((d) => d.storageKey);
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: ids } },
          { targetId: { in: [...ids, ...profiles] } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    const dir = path.resolve(".private/mechanic-documents");
    for (const k of fileKeys) {
      const f = path.resolve(dir, k);
      if (f.startsWith(dir + path.sep)) await unlink(f).catch(() => {});
    }
    await new Promise((r) => server.close(r));
    await prisma.$disconnect();
  }
});
