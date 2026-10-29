import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { prisma } from "../dist/prisma.js";
import mechanics from "../dist/routes/mechanics.routes.js";
import workflow from "../dist/routes/mechanic-workflow.routes.js";

test("live two-account workflow: permissions, snapshots, private grading, document review, manual approval and messages", async () => {
  const tag = "workflow-" + randomUUID(),
    ids = [],
    qids = [],
    pids = [];
  const app = express();
  app.use(express.json());
  app.use("/api/mechanics", mechanics);
  app.use("/api/mechanic-workflow", workflow);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const token = (u) =>
    jwt.sign({ sessionVersion: 0 }, process.env.JWT_SECRET, {
      subject: u.id,
      algorithm: "HS256",
      expiresIn: "10m",
    });
  async function api(path, method = "GET", body, t) {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: "Bearer " + t } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json() };
  }
  async function user(role, permission) {
    const u = await prisma.user.create({
      data: {
        fullName: "Workflow " + role,
        email: tag + "-" + ids.length + "@example.invalid",
        passwordHash: "unused",
        role,
        status: "ACTIVE",
        ...(permission ? { adminPermissions: { create: { permission } } } : {}),
      },
    });
    ids.push(u.id);
    return u;
  }
  try {
    const admin = await user("ADMIN", "MANAGE_MECHANICS"),
      wrong = await user("ADMIN", "MANAGE_SPARE_PARTS"),
      owner = await user("MECHANIC"),
      other = await user("MECHANIC");
    const at = token(admin),
      mt = token(owner),
      ot = token(other),
      wt = token(wrong);
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
        experienceSummary: "Experienced mechanic",
        offersWorkshop: false,
        offersOnSite: true,
        coverageAreas: ["Ramallah"],
        documents: {
          create: ["IDENTITY", "CERTIFICATE"].map((kind) => ({
            kind,
            fileName: kind + ".png",
            mimeType: "image/png",
            size: 100,
            storageKey: randomUUID(),
          })),
        },
      },
      include: { documents: true },
    });
    pids.push(p.id);
    assert.equal((await api("/api/mechanic-workflow/questions")).status, 401);
    assert.equal(
      (await api("/api/mechanic-workflow/questions", "GET", undefined, mt))
        .status,
      403,
    );
    assert.equal(
      (await api("/api/mechanic-workflow/questions", "GET", undefined, wt))
        .status,
      403,
    );
    const original = {
      specialization: "PETROL_ENGINES",
      prompt: "Which tool measures the test pressure?",
      options: ["Gauge", "Hammer", "Pliers", "Ruler"],
      correctIndex: 0,
      explanation:
        "Fixture technical explanation for testing review requirements.",
      sourceUrl: "https://www.fluke.com/",
      sourceReference: "Fixture technical reference",
    };
    for (let i = 0; i < 2; i++) {
      let r = await api(
        "/api/mechanic-workflow/questions",
        "POST",
        { ...original, prompt: original.prompt + " " + i },
        at,
      );
      assert.equal(r.status, 201, JSON.stringify(r.body));
      qids.push(r.body.question.id);
    }
    const testPath =
      "/api/mechanic-workflow/applications/" + owner.id + "/tests";
    assert.equal(
      (
        await api(
          testPath,
          "POST",
          { questionIds: [qids[0]], submissionVersion: 1 },
          at,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await api(
          testPath,
          "POST",
          { questionIds: [qids[0], qids[0]], submissionVersion: 1 },
          at,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await api(
          testPath,
          "POST",
          { questionIds: qids, submissionVersion: 0 },
          at,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await api(
          testPath,
          "POST",
          { questionIds: qids, submissionVersion: 1 },
          at,
        )
      ).status,
      400,
    );
    for (const id of qids) {
      assert.equal(
        (
          await api(
            "/api/mechanic-workflow/questions/" + id + "/review",
            "POST",
            { status: "APPROVED", revision: 1 },
            at,
          )
        ).status,
        400,
      );
      const approved = await api(
        "/api/mechanic-workflow/questions/" + id + "/review",
        "POST",
        {
          status: "APPROVED",
          revision: 1,
          reviewerName: "Fixture reviewer",
          reviewNotes: "Technical fixture reviewed for this test.",
          confirmReviewed: true,
        },
        at,
      );
      assert.equal(approved.status, 200, JSON.stringify(approved.body));
    }
    let r = await api(
      testPath,
      "POST",
      { questionIds: qids, submissionVersion: 1 },
      at,
    );
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const t = r.body.test;
    assert.equal(
      (
        await api(
          testPath,
          "POST",
          { questionIds: qids, submissionVersion: 1 },
          at,
        )
      ).status,
      409,
    );
    r = await api(
      "/api/mechanic-workflow/questions/" + qids[0],
      "PUT",
      {
        ...original,
        prompt: "An edited bank question, not the sent snapshot.",
        options: ["Hammer", "Gauge", "Pliers", "Ruler"],
        correctIndex: 1,
        revision: 2,
        active: false,
      },
      at,
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.question.reviewStatus, "DRAFT");
    assert.equal(r.body.question.active, false);
    assert.equal(
      (
        await api(
          "/api/mechanic-workflow/questions/" + qids[0],
          "PUT",
          { ...original, revision: 1 },
          at,
        )
      ).status,
      409,
    );
    r = await api(testPath, "GET", undefined, mt);
    assert.equal(r.status, 200);
    assert.equal(r.body.tests[0].items[0].correctIndex, undefined);
    assert.equal(r.body.tests[0].items[0].prompt, original.prompt + " 0");
    assert.equal((await api(testPath, "GET", undefined, ot)).status, 403);
    assert.equal(
      (
        await api(
          "/api/mechanic-workflow/tests/" + t.id + "/submit",
          "POST",
          { answers: [] },
          ot,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await api(
          "/api/mechanic-workflow/tests/" + t.id + "/submit",
          "POST",
          { answers: [] },
          mt,
        )
      ).status,
      400,
    );
    const answers = t.items.map((i) => ({ itemId: i.id, answerIndex: 0 }));
    r = await api(
      "/api/mechanic-workflow/tests/" + t.id + "/submit",
      "POST",
      { answers },
      mt,
    );
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(
      (
        await api(
          "/api/mechanic-workflow/tests/" + t.id + "/submit",
          "POST",
          { answers },
          mt,
        )
      ).status,
      409,
    );
    r = await api(testPath, "GET", undefined, at);
    assert.equal(r.body.tests[0].score, 2);
    assert.equal(r.body.tests[0].items[0].correctIndex, 0);
    r = await api(testPath, "GET", undefined, mt);
    assert.equal(r.body.tests[0].items[0].correctIndex, undefined);
    const decision = "/api/mechanics/admin/" + owner.id + "/decision",
      approve = { action: "APPROVE", submissionVersion: 1 };
    assert.equal((await api(decision, "POST", approve, at)).status, 400);
    r = await api(
      "/api/mechanic-workflow/tests/" + t.id + "/review",
      "POST",
      { assessment: "PASSED", notes: "Explained safe and correct procedures." },
      at,
    );
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await api(decision, "POST", approve, at)).status, 400);
    const reviews =
      "/api/mechanic-workflow/applications/" + owner.id + "/reviews";
    for (const d of p.documents)
      assert.equal(
        (
          await api(
            reviews,
            "POST",
            { documentId: d.id, reviewed: true, submissionVersion: 1 },
            at,
          )
        ).status,
        200,
      );
    assert.equal((await api(reviews, "GET", undefined, mt)).status, 403);
    r = await api(decision, "POST", approve, at);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.profile.canReceiveServices, true);
    const msg = "/api/mechanic-workflow/applications/" + owner.id + "/messages";
    assert.equal((await api(msg, "POST", { body: " " }, mt)).status, 400);
    assert.equal(
      (await api(msg, "POST", { body: "Not allowed" }, ot)).status,
      403,
    );
    assert.equal(
      (await api(msg, "POST", { body: "Could you explain the next step?" }, mt))
        .status,
      201,
    );
    assert.equal(
      (
        await api(
          msg,
          "POST",
          { body: "Your application has been approved." },
          at,
        )
      ).status,
      201,
    );
    r = await api(msg, "GET", undefined, mt);
    assert.equal(r.body.messages.length, 2);
    assert.equal(r.body.messages[1].sender.id, admin.id);
    assert.equal(
      (await api(msg + "?before=not-a-message", "GET", undefined, at)).status,
      400,
    );
    const ns = await api("/api/mechanics/notifications", "GET", undefined, mt);
    assert.ok(ns.body.notifications.some((n) => n.kind === "TEST_ASSIGNED"));
    assert.ok(ns.body.notifications.some((n) => n.kind === "MESSAGE"));
    assert.equal(
      (
        await api(
          "/api/mechanic-workflow/notifications/read-all",
          "POST",
          {},
          mt,
        )
      ).status,
      200,
    );
    r = await api("/api/mechanics/notifications", "GET", undefined, mt);
    assert.ok(r.body.notifications.every((n) => n.readAt));
    assert.equal(
      (
        await api(
          decision,
          "POST",
          {
            action: "SUSPEND",
            notes: "Needs a review of service quality.",
            submissionVersion: 1,
          },
          at,
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
      (
        await api(
          decision,
          "POST",
          { action: "REACTIVATE", submissionVersion: 1 },
          at,
        )
      ).status,
      200,
    );
    assert.ok(
      await prisma.auditLog.count({
        where: { targetId: p.id, action: "MECHANIC_TEST_REVIEWED" },
      }),
    );
    // Old test must be invalid after the mechanic resubmits a new application version.
    await prisma.mechanicProfile.update({
      where: { id: p.id },
      data: {
        verificationStatus: "PENDING",
        submissionVersion: 2,
        interviewResult: null,
      },
    });
    assert.equal(
      (
        await api(
          "/api/mechanic-workflow/tests/" + t.id + "/review",
          "POST",
          {
            assessment: "PASSED",
            notes: "Old result cannot approve a new submission.",
          },
          at,
        )
      ).status,
      409,
    );
  } finally {
    await prisma.notification.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { relatedUserId: { in: ids } }] },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: ids } },
          { targetId: { in: [...pids, ...qids] } },
        ],
      },
    });
    await prisma.mechanicQuestion.deleteMany({ where: { id: { in: qids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await new Promise((r) => server.close(r));
    await prisma.$disconnect();
  }
});
