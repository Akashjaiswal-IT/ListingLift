import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  find: vi.fn(),
  updateOne: vi.fn(),
  enqueue: vi.fn(),
  getGenJob: vi.fn(),
  getReEditJob: vi.fn(),
  refundListingCharge: vi.fn(),
  refundReEditCharge: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  ListingObject: {
    find: (q: any) => ({ limit: () => Promise.resolve(m.find(q)) }),
    updateOne: (...a: unknown[]) => m.updateOne(...a),
  },
}));
vi.mock("../queue/queue.service", () => ({
  enqueueImageGeneration: (...a: unknown[]) => m.enqueue(...a),
  getImageGenerationQueue: () => ({ getJob: (id: string) => m.getGenJob(id) }),
  getReEditQueue: () => ({ getJob: (id: string) => m.getReEditJob(id) }),
}));
vi.mock("../charges.service", () => ({
  refundListingCharge: (...a: unknown[]) => m.refundListingCharge(...a),
  refundReEditCharge: (...a: unknown[]) => m.refundReEditCharge(...a),
}));
vi.mock("../credit.service", () => ({ RE_EDIT_CREDIT_COST: 1 }));

import { reconcileStuckWork } from "../maintenance/reconcile.service";

const job = (state: string) => ({ getState: async () => state });
// Route each query to its result by the status it asks for
function stub(results: { queued?: any[]; processing?: any[]; failed?: any[]; reEdit?: any[] }) {
  m.find.mockImplementation((q: any) => {
    if (q["reEditStatus.status"] === "processing") return results.reEdit ?? [];
    if (q.status === "queued") return results.queued ?? [];
    if (q.status === "processing") return results.processing ?? [];
    if (q.status === "failed") return results.failed ?? [];
    return [];
  });
}

describe("reconcileStuckWork", () => {
  beforeEach(() => {
    for (const fn of Object.values(m)) fn.mockReset();
    m.enqueue.mockResolvedValue("job-new");
    m.updateOne.mockResolvedValue({});
    m.refundListingCharge.mockResolvedValue({ refunded: true, amount: 6 });
    m.refundReEditCharge.mockResolvedValue({ refunded: true });
  });

  it("re-queues a listing stuck in 'queued' with no live job, but leaves a waiting one alone", async () => {
    stub({ queued: [{ _id: "dead", bullmqJobId: "j1" }, { _id: "waiting", bullmqJobId: "j2" }] });
    m.getGenJob.mockImplementation(async (id: string) => (id === "j2" ? job("waiting") : null));

    const s = await reconcileStuckWork();

    expect(s.requeued).toBe(1);
    expect(m.enqueue).toHaveBeenCalledWith("dead");
    expect(m.updateOne).toHaveBeenCalledWith({ _id: "dead", status: "queued" }, { $set: { bullmqJobId: "job-new" } });
  });

  it("refunds a listing stuck in 'processing' whose job is gone, never one whose job is still active", async () => {
    stub({ processing: [{ _id: "crashed", bullmqJobId: "j1" }, { _id: "running", bullmqJobId: "j2" }] });
    m.getGenJob.mockImplementation(async (id: string) => (id === "j2" ? job("active") : job("failed")));

    const s = await reconcileStuckWork();

    expect(s.refundedStuck).toBe(1);
    expect(m.refundListingCharge).toHaveBeenCalledTimes(1);
    expect(m.refundListingCharge).toHaveBeenCalledWith(expect.objectContaining({ listingObjectId: "crashed", reason: "stuck" }));
  });

  it("refunds a failed listing whose refund never happened", async () => {
    stub({ failed: [{ _id: "f1" }] });
    const s = await reconcileStuckWork();
    expect(s.refundedFailed).toBe(1);
    expect(m.refundListingCharge).toHaveBeenCalledWith({ listingObjectId: "f1", reason: "failed" });
  });

  it("refunds a stuck re-edit by its chargeId (exactly-once key)", async () => {
    stub({ reEdit: [{ _id: "l1", userId: "u1", userTitle: "Bag", reEditStatus: { status: "processing", chargeId: "c1", jobId: "r1" } }] });
    m.getReEditJob.mockResolvedValue(null);
    const s = await reconcileStuckWork();
    expect(s.refundedReEdits).toBe(1);
    expect(m.refundReEditCharge).toHaveBeenCalledWith(expect.objectContaining({ listingObjectId: "l1", chargeId: "c1", credits: 1 }));
  });
});
