import test from "node:test";
import assert from "node:assert/strict";
import {
  zoomClient,
  zoomConfig,
  ZoomError,
} from "../dist/services/zoom-meeting.js";
const config = {
  accountId: "test-account",
  clientId: "test-client",
  clientSecret: "test-secret",
  host: "host@example.invalid",
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
test("Zoom requires all server credentials", () => {
  assert.throws(
    () => zoomConfig({}),
    (e) => e instanceof ZoomError && e.status === 503,
  );
});
test("Zoom creates a scheduled meeting and returns participant data only", async () => {
  const calls = [];
  const client = zoomClient(config, async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1
      ? json({ access_token: "private-token" })
      : json({
          id: 123456789,
          join_url: "https://us06web.zoom.us/j/123456789?pwd=test",
          start_url: "private-host-url",
          password: "private-passcode",
        });
  });
  const start = new Date("2026-12-01T12:30:00Z");
  const result = await client.create(start, "Asia/Jerusalem");
  assert.deepEqual(result, {
    id: "123456789",
    joinUrl: "https://us06web.zoom.us/j/123456789?pwd=test",
  });
  assert.equal(calls[0].url, "https://zoom.us/oauth/token");
  assert.equal(calls[0].options.body.get("grant_type"), "account_credentials");
  assert.equal(
    calls[0].options.headers.Authorization,
    "Basic " + Buffer.from("test-client:test-secret").toString("base64"),
  );
  assert.equal(
    calls[1].url,
    "https://api.zoom.us/v2/users/host%40example.invalid/meetings",
  );
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.start_time, start.toISOString());
  assert.equal(body.duration, 30);
  assert.equal(body.settings.waiting_room, true);
  assert.equal(body.settings.use_pmi, false);
  assert.equal(JSON.stringify(result).includes("private-"), false);
});
test("Zoom failures never expose provider response secrets or produce fake links", async () => {
  for (const kind of ["auth", "create", "network"]) {
    let calls = 0;
    const client = zoomClient(config, async () => {
      calls++;
      if (kind === "network") throw Error("private-secret");
      if (kind === "auth" || calls === 2)
        return json({ message: "private-secret" }, 403);
      return json({ access_token: "private-token" });
    });
    await assert.rejects(
      client.create(new Date(), "UTC"),
      (e) => e.status === 502 && !e.message.includes("private-secret"),
    );
  }
});
test("Invalid participant URLs trigger deletion rather than notification", async () => {
  for (const link of [
    "http://zoom.us/j/123",
    "https://evil.invalid/j/123",
    "https://zoom.us.evil.invalid/j/123",
    "https://zoom.us/s/123",
    "https://name:secret@zoom.us/j/123",
  ]) {
    const methods = [];
    const client = zoomClient(config, async (url, o) => {
      methods.push(o.method);
      if (url.includes("oauth/token"))
        return json({ access_token: "test-token" });
      if (o.method === "DELETE") return new Response(null, { status: 204 });
      return json({ id: 123, join_url: link });
    });
    await assert.rejects(
      client.create(new Date(), "UTC"),
      (e) => e.status === 502,
    );
    assert.deepEqual(methods, ["POST", "POST", "POST", "DELETE"]);
  }
});
