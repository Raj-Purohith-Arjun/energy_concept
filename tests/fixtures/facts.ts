// Obviously fake fixtures. Never EnergyX data.

export function fakeFact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "fake-widgets",
    label: "Fake widgets",
    value: "123 widgets",
    numeric: 123,
    unit: "widgets",
    basis: "Fixture basis for tests.",
    basisSource: "stated",
    kind: "actual",
    source: { title: "Fixture source", url: "https://example.com/fixture", accessed: "2026-01-01" },
    owner: "Test fixture",
    approvedAt: null,
    verified: true,
    ...overrides,
  };
}

export function fakeAlso(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    value: "456 widgets",
    basis: "Fixture alternate basis.",
    basisSource: "inferred",
    url: "https://example.com/other",
    accessed: "2026-01-01",
    ...overrides,
  };
}

export function fakeFile(...facts: Record<string, unknown>[]): Record<string, unknown> {
  return { $comment: ["fixture"], facts };
}
