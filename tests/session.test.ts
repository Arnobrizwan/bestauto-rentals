/**
 * The session cookie and the password hash.
 *
 * These are the two things standing between the public internet and every
 * admin route, and neither had a test. The revocation guarantee in particular
 * is a claim the README makes — "sign out everywhere takes effect on the next
 * request, not at cookie expiry" — and a claim about security that nothing
 * checks is a claim, not a guarantee.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import {
  createSessionToken,
  isSessionCurrent,
  readSessionToken,
  type SessionClaims,
} from "../src/lib/auth/session";

const CLAIMS: Omit<SessionClaims, "exp"> = {
  sub: "adm_1",
  email: "ops@bestauto.test",
  name: "Ops",
  role: "admin",
  ver: 3,
};

/** Re-encodes a payload onto a token, leaving the original signature in place. */
function tamperPayload(token: string, mutate: (claims: SessionClaims) => SessionClaims) {
  const separator = token.lastIndexOf(".");
  const [encoded, signature] = [token.slice(0, separator), token.slice(separator + 1)];
  const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionClaims;
  const forged = Buffer.from(JSON.stringify(mutate(claims)), "utf8").toString("base64url");
  return `${forged}.${signature}`;
}

describe("session tokens", () => {
  it("verifies a token it just signed", async () => {
    const token = await createSessionToken(CLAIMS);
    const claims = await readSessionToken(token);

    assert.ok(claims, "a freshly signed token must verify");
    assert.equal(claims.sub, "adm_1");
    assert.equal(claims.email, "ops@bestauto.test");
    assert.equal(claims.role, "admin");
    assert.equal(claims.ver, 3);
  });

  it("rejects an expired token", async () => {
    // Minted with a TTL already in the past, which is what an eight-hour-old
    // cookie looks like on arrival.
    const token = await createSessionToken(CLAIMS, -1);
    assert.equal(await readSessionToken(token), null);
  });

  it("rejects a tampered payload", async () => {
    const token = await createSessionToken({ ...CLAIMS, role: "viewer" });
    // The obvious attack: promote yourself without re-signing.
    const forged = tamperPayload(token, (claims) => ({ ...claims, role: "admin" }));

    assert.notEqual(forged, token, "the payload must actually differ");
    assert.equal(await readSessionToken(forged), null);
  });

  it("rejects a token with no signature at all", async () => {
    const token = await createSessionToken(CLAIMS);
    const payload = token.slice(0, token.lastIndexOf("."));

    assert.equal(await readSessionToken(payload), null);
    assert.equal(await readSessionToken(undefined), null);
    assert.equal(await readSessionToken(""), null);
  });
});

describe("session revocation", () => {
  const account = { active: true, sessionVersion: 3 };

  it("accepts a token signed with the account's current version", async () => {
    const claims = await readSessionToken(await createSessionToken(CLAIMS));
    assert.ok(claims);
    assert.equal(isSessionCurrent(claims, account), true);
  });

  it("rejects a token minted before a sessionVersion bump", async () => {
    // The token is authentic and unexpired — this is exactly the case a
    // signature check alone waves through, and it is the whole point of the
    // version column.
    const claims = await readSessionToken(await createSessionToken(CLAIMS));
    assert.ok(claims, "the token itself is authentic and unexpired");

    const afterBump = { active: true, sessionVersion: account.sessionVersion + 1 };
    assert.equal(isSessionCurrent(claims, afterBump), false);
  });

  it("rejects a token for a deactivated account", async () => {
    const claims = await readSessionToken(await createSessionToken(CLAIMS));
    assert.ok(claims);
    assert.equal(isSessionCurrent(claims, { active: false, sessionVersion: 3 }), false);
  });

  it("treats a token with no version as version zero", async () => {
    const legacy = await readSessionToken(
      await createSessionToken({ ...CLAIMS, ver: undefined as unknown as number }),
    );
    assert.ok(legacy);
    assert.equal(isSessionCurrent(legacy, { active: true, sessionVersion: 0 }), true);
    assert.equal(isSessionCurrent(legacy, { active: true, sessionVersion: 1 }), false);
  });
});

describe("password hashing", () => {
  it("round-trips a password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword("correct horse battery staple", stored), true);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("same-password", a), true);
    assert.equal(await verifyPassword("same-password", b), true);
  });

  it("fails a wrong password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    for (const wrong of ["", "Correct horse battery staple", "correct horse battery stapl"]) {
      assert.equal(await verifyPassword(wrong, stored), false, `"${wrong}" must not verify`);
    }
  });

  it("fails a malformed stored hash rather than throwing", async () => {
    const malformed = [
      "",
      "not-a-hash",
      "pbkdf2-sha256$210000$onlythreeparts",
      "bcrypt$210000$c2FsdA==$aGFzaA==", // wrong algorithm prefix
      "pbkdf2-sha256$10$c2FsdA==$aGFzaA==", // iteration count below the floor
      "pbkdf2-sha256$210000$!!!not-base64!!!$aGFzaA==",
    ];
    for (const stored of malformed) {
      assert.equal(await verifyPassword("anything", stored), false, `"${stored}" must not verify`);
    }
  });
});
