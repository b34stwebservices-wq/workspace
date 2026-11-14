import { describe, expect, it } from "vitest";
import {
  deptForRole,
  generatePassword,
  validateAccessChange,
  validateHrInput,
  validateNewUserInput,
  validateProfileInput,
} from "./userManagement";

describe("user registration validation", () => {
  it("accepts valid admin-created account details", () => {
    expect(
      validateNewUserInput({
        email: "new.person@example.test",
        name: "New Person",
        password: "StrongPassword123",
        confirmPassword: "StrongPassword123",
      }),
    ).toBe("");
  });

  it("rejects weak or mismatched passwords", () => {
    expect(
      validateNewUserInput({
        email: "person@example.test",
        name: "Person",
        password: "short",
        confirmPassword: "short",
      }),
    ).toBe("Use at least 14 characters.");
    expect(
      validateNewUserInput({
        email: "person@example.test",
        name: "Person",
        password: "StrongPassword123",
        confirmPassword: "DifferentPassword123",
      }),
    ).toBe("Passwords do not match.");
  });
});

describe("profile and HR validation", () => {
  it("validates profile fields", () => {
    expect(
      validateProfileInput({ name: "A", jobTitle: "", workEmail: "a@b.co" }),
    ).toMatch(/at least 2/);
    expect(
      validateProfileInput({ name: "Ann", jobTitle: "", workEmail: "nope" }),
    ).toMatch(/valid work email/);
    expect(
      validateProfileInput({ name: "Ann", jobTitle: "Dev", workEmail: "a@b.co" }),
    ).toBe("");
  });

  it("rejects self-reporting and bad dates", () => {
    const base = {
      phone: "",
      employmentType: "Full-time",
      reportsTo: "",
      startDate: "2026-01-05",
      emergencyContact: "",
      hrNotes: "",
      selfUid: "u1",
    };
    expect(validateHrInput(base)).toBe("");
    expect(validateHrInput({ ...base, reportsTo: "u1" })).toMatch(/themselves/);
    expect(validateHrInput({ ...base, startDate: "" })).toMatch(/start date/);
    expect(validateHrInput({ ...base, startDate: "2026-13-45" })).toMatch(
      /valid start date/,
    );
  });
});

describe("access change guard", () => {
  const rows = [
    { uid: "a1", role: "admin" as const, active: true },
    { uid: "a2", role: "admin" as const, active: true },
    { uid: "e1", role: "employee" as const, active: true },
  ];
  it("blocks changing your own access", () => {
    expect(
      validateAccessChange(rows, { uid: "a1", role: "employee", active: true }, "a1"),
    ).toMatch(/own access/);
  });
  it("allows demoting an admin while another remains", () => {
    expect(
      validateAccessChange(rows, { uid: "a2", role: "employee", active: true }, "a1"),
    ).toBe("");
  });
  it("blocks removing the last active admin", () => {
    const solo = [
      { uid: "a1", role: "admin" as const, active: true },
      { uid: "a2", role: "admin" as const, active: false },
    ];
    expect(
      validateAccessChange(solo, { uid: "a2", role: "admin", active: false }, "a1"),
    ).toBe("");
    const only = [
      { uid: "a2", role: "admin" as const, active: true },
      { uid: "e1", role: "employee" as const, active: true },
    ];
    expect(
      validateAccessChange(only, { uid: "a2", role: "admin", active: false }, "x9"),
    ).toMatch(/At least one active admin/);
  });
});

describe("helpers", () => {
  it("fixes department for non-employee roles", () => {
    expect(deptForRole("bizops", "creative")).toBe("business");
    expect(deptForRole("employee", "creative")).toBe("creative");
  });
  it("generates passwords that satisfy the policy", () => {
    const a = generatePassword();
    expect(a.length).toBeGreaterThanOrEqual(14);
    expect(a).not.toBe(generatePassword());
  });
});
