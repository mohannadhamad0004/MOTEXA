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
    // Test grading is independent: no interview fields or interview audit entry.
    let interviewProfile=await prisma.mechanicProfile.findUniqueOrThrow({where:{id:p.id}});
    assert.equal(interviewProfile.interviewResult,null);
    assert.equal(interviewProfile.interviewedAt,null);
    assert.equal((await api(decision,'POST',approve,at)).status,400);
    let progress=await api('/api/mechanics/me/progress','GET',undefined,mt);
    assert.equal(progress.body.progress.stage,'INTERVIEW_REVIEW');
    assert.equal(progress.body.progress.interview.recorded,false);
    // Reproduce the former automatic grading side effect on this isolated fixture.
    // It must not unlock approval without a dedicated interview event.
    await prisma.mechanicProfile.update({where:{id:p.id},data:{interviewResult:'PASSED',interviewNotes:'Old automatic assessment result',interviewedAt:new Date(),interviewedById:admin.id}});
    assert.equal((await api(decision,'POST',approve,at)).status,400);
    progress=await api('/api/mechanics/me/progress','GET',undefined,mt);
    assert.equal(progress.body.progress.interview.recorded,false);
    const interview='/api/mechanics/admin/'+owner.id+'/interview';
    const outcome={result:'PASSED',notes:'Completed an independent demo professional interview.',submissionVersion:1};
    assert.equal((await api(interview,'POST',outcome,at)).status,409);
    const schedulePath=interview+'/schedule';
    const appointment={scheduledAt:new Date(Date.now()+3600000).toISOString(),method:'ONLINE',location:'https://example.invalid/demo-meeting',timeZone:'Asia/Jerusalem',simulation:false,submissionVersion:1};
    assert.equal((await api(schedulePath,'POST',appointment,mt)).status,403);
    assert.equal((await api(schedulePath,'POST',appointment,wt)).status,403);
    assert.equal((await api(schedulePath,'POST',{...appointment,scheduledAt:'bad date'},at)).status,400);
    assert.equal((await api(schedulePath,'POST',{...appointment,scheduledAt:new Date(Date.now()-60000).toISOString()},at)).status,400);
    assert.equal((await api(schedulePath,'POST',{...appointment,timeZone:'Invalid/Zone'},at)).status,400);
    assert.equal((await api(schedulePath,'POST',{...appointment,submissionVersion:0},at)).status,409);
    // Zoom HTTP is isolated: no real external meetings or trial account changes.
    const realFetch=globalThis.fetch;
    const keys=['ZOOM_ACCOUNT_ID','ZOOM_CLIENT_ID','ZOOM_CLIENT_SECRET','ZOOM_HOST_USER_ID'];
    const previous=keys.map(k=>process.env[k]);
    const automatic={...appointment,location:'',createZoom:true,expectedScheduleId:null};
    const notificationsBefore=await prisma.notification.count({where:{userId:owner.id,kind:'INTERVIEW_SCHEDULED'}});
    try{
      keys.forEach(k=>delete process.env[k]);
      assert.equal((await api(schedulePath,'POST',automatic,at)).status,503);
      assert.equal(await prisma.notification.count({where:{userId:owner.id,kind:'INTERVIEW_SCHEDULED'}}),notificationsBefore);
      assert.equal((await prisma.mechanicProfile.findUnique({where:{id:p.id}})).interviewScheduleId,null);
      keys.forEach(k=>process.env[k]='isolated-test');
      let providerFailure=true, conflict=false, deleted=0, created=0;
      globalThis.fetch=async(url,options)=>{
        if(String(url).startsWith('https://zoom.us/oauth/token'))return Response.json({access_token:'private-zoom-token'});
        if(String(url).startsWith('https://api.zoom.us/')){
          if(options.method==='DELETE'){deleted++;return new Response(null,{status:204});}
          if(providerFailure)return Response.json({message:'secret-provider-message'},{status:403});
          created++;
          if(conflict)await prisma.mechanicProfile.update({where:{id:p.id},data:{interviewScheduleId:'concurrent-booking'}});
          return Response.json({id:123456789,join_url:'https://us06web.zoom.us/j/123456789?pwd=isolated',start_url:'private-host-url'});
        }
        return realFetch(url,options);
      };
      assert.equal((await api(schedulePath,'POST',automatic,mt)).status,403);
      assert.equal((await api(schedulePath,'POST',{...automatic,submissionVersion:0},at)).status,409);
      assert.equal(created,0);
      const failed=await api(schedulePath,'POST',automatic,at);assert.equal(failed.status,502);assert.equal(JSON.stringify(failed.body).includes('secret-provider-message'),false);
      providerFailure=false;conflict=true;
      assert.equal((await api(schedulePath,'POST',automatic,at)).status,409);assert.equal(deleted,1);
      assert.equal(await prisma.notification.count({where:{userId:owner.id,kind:'INTERVIEW_SCHEDULED'}}),notificationsBefore);
      await prisma.mechanicProfile.update({where:{id:p.id},data:{interviewScheduleId:null}});conflict=false;
      const zoomBooking=await api(schedulePath,'POST',automatic,at);assert.equal(zoomBooking.status,200);
      assert.equal(zoomBooking.body.profile.interviewLocation,'https://us06web.zoom.us/j/123456789?pwd=isolated');
      assert.equal(JSON.stringify(zoomBooking.body).includes('private-host-url'),false);
      const invitation=await prisma.notification.findFirst({where:{userId:owner.id,kind:'INTERVIEW_SCHEDULED'},orderBy:{createdAt:'desc'}});
      assert.ok(invitation.body.includes('https://us06web.zoom.us/j/123456789'));
      assert.equal((await api(schedulePath,'POST',automatic,at)).status,409,'Retry with stale appointment cannot create a second meeting');
      assert.equal(created,2,'One conflicted meeting and one committed meeting');
    }finally{
      globalThis.fetch=realFetch;
      keys.forEach((k,i)=>{if(previous[i]===undefined)delete process.env[k];else process.env[k]=previous[i];});
    }
    let booking=await api(schedulePath,'POST',appointment,at);assert.equal(booking.status,200);
    const oldId=booking.body.profile.interviewScheduleId;
    const confirm='/api/mechanics/me/interview/confirm';
    assert.equal((await api(confirm,'POST',{scheduleId:oldId,submissionVersion:1},at)).status,403);
    assert.equal((await api(confirm,'POST',{scheduleId:'stale-id',submissionVersion:1},mt)).status,409);
    assert.equal((await api(confirm,'POST',{scheduleId:oldId,submissionVersion:1},mt)).status,200);
    assert.equal((await api(confirm,'POST',{scheduleId:oldId,submissionVersion:1},mt)).status,200);
    assert.equal(await prisma.auditLog.count({where:{targetId:p.id,action:'MECHANIC_INTERVIEW_CONFIRMED'}}),1,'Confirmation is idempotent');
    assert.equal((await api(interview,'POST',{...outcome,scheduleId:oldId},at)).status,409,'Real interviews cannot be marked complete early');
    booking=await api(schedulePath,'POST',{...appointment,simulation:true},at);assert.equal(booking.status,200);
    const scheduleId=booking.body.profile.interviewScheduleId;
    assert.notEqual(scheduleId,oldId);assert.equal(booking.body.profile.interviewConfirmedAt,null);assert.equal(booking.body.profile.interviewResult,null);
    assert.equal((await api(confirm,'POST',{scheduleId:oldId,submissionVersion:1},mt)).status,409);
    assert.equal((await api(interview,'POST',{...outcome,scheduleId:oldId},at)).status,409);
    assert.equal((await api(interview,'POST',{...outcome,scheduleId},at)).status,409,'Confirmation is required even in simulation');
    assert.equal((await api(confirm,'POST',{scheduleId,submissionVersion:1},mt)).status,200);
    const passedInterview={...outcome,scheduleId};
    assert.equal((await api(interview,'POST',passedInterview,mt)).status,403);
    assert.equal((await api(interview,'POST',passedInterview,wt)).status,403);
    assert.equal((await api(interview,'POST',{...passedInterview,submissionVersion:0},at)).status,409);
    assert.equal((await api(interview,'POST',{...passedInterview,notes:''},at)).status,400);
    assert.equal((await api(interview,'POST',{...passedInterview,result:'FAILED'},at)).status,200);
    assert.equal((await api(decision,'POST',approve,at)).status,400);
    // Regrading the test must not overwrite the separately recorded interview.
    assert.equal((await api('/api/mechanic-workflow/tests/'+t.id+'/review','POST',{assessment:'PASSED',notes:'Independent test review repeated.'},at)).status,200);
    interviewProfile=await prisma.mechanicProfile.findUniqueOrThrow({where:{id:p.id}});
    assert.equal(interviewProfile.interviewResult,'FAILED');
    assert.equal((await api(decision,'POST',approve,at)).status,400);
    assert.equal((await api(interview,'POST',passedInterview,at)).status,200);
    progress=await api('/api/mechanics/me/progress','GET',undefined,mt);
    assert.equal((await prisma.mechanicProfile.findUniqueOrThrow({where:{id:p.id}})).interviewNotes.startsWith('[SIMULATION]'),true);
    assert.equal(progress.body.progress.interview.recorded,true);
    assert.equal(progress.body.progress.interview.passed,true);
    assert.equal(progress.body.progress.stage,'AWAITING_DECISION');
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
