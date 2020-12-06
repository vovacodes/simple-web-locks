import {
  assertEquals,
  assertThrowsAsync,
} from "https://deno.land/std@0.79.0/testing/asserts.ts";
import { locks } from "./mod.ts";

Deno.test("should request a Lock object with the provided name", async () => {
  await locks.request("resource:a", async (lock) => {
    assertEquals(lock.name, "resource:a");
  });
});

Deno.test("should provide an `exclusive` lock by default", async () => {
  await locks.request("resource:a", async (lock) => {
    assertEquals(lock.mode, "exclusive");
  });
});

Deno.test("should execute the callback not sooner than the next microtask", async () => {
  let acquired = false;
  locks.request("resource:a", () => {
    acquired = true;
  });

  assertEquals(acquired, false);

  await Promise.resolve();
  assertEquals(acquired, true);
});

Deno.test("should return the value returned by the callback", async () => {
  const result = await locks.request("resource:a", () => {
    return 42;
  });

  assertEquals(result, 42);

  const result2 = await locks.request("resource:a", () => {
    return Promise.resolve(13);
  });

  assertEquals(result2, 13);
});

Deno.test("should return rejected promise if the callback fails", async () => {
  const promise = locks.request("resource:a", () => {
    return Promise.reject(new Error("Oops..."));
  });

  assertThrowsAsync(() => promise, Error, "Oops...");

  const promise2 = locks.request("resource:a", () => {
    throw new Error("SNAFU");
  });

  assertThrowsAsync(() => promise2, Error, "SNAFU");
});

Deno.test("should wait until the lock is released before granting it to someone else", async () => {
  let resolveTask1: ((v?: unknown) => void) | undefined;
  const task1 = new Promise((resolve) => {
    resolveTask1 = resolve;
  });
  let resolveTask2: ((v?: unknown) => void) | undefined;
  const task2 = new Promise((resolve) => {
    resolveTask2 = resolve;
  });

  locks.request("resource:a", async () => {
    await task1;
  });
  let acquired2 = false;
  locks.request("resource:a", async () => {
    acquired2 = true;
    await task2;
  });
  let acquired3 = false;
  const finalPromise = locks.request("resource:a", async () => {
    acquired3 = true;
    return acquired3;
  });
  await exhaustMicrotaskQueue();
  assertEquals(acquired2, false);
  assertEquals(acquired3, false);

  resolveTask1?.();
  await exhaustMicrotaskQueue();
  assertEquals(acquired2, true);
  assertEquals(acquired3, false);

  resolveTask2?.();
  await exhaustMicrotaskQueue();
  assertEquals(acquired2, true);
  assertEquals(acquired3, true);

  assertEquals(await finalPromise, true);
});

Deno.test("should immediately abort the request if the provided signal already is aborted", async () => {
  let resolveTask1: ((v?: unknown) => void) | undefined;
  const task1 = new Promise((resolve) => {
    resolveTask1 = resolve;
  });
  const controller = new AbortController();
  controller.abort();

  locks.request("resource:a", async () => {
    await task1;
  });
  let acquired2 = false;
  const request2 = locks.request(
    "resource:a",
    { signal: controller.signal },
    async () => {
      acquired2 = true;
    },
  );
  let acquired3 = false;
  locks.request("resource:a", async () => {
    acquired3 = true;
    return acquired3;
  });
  try {
    await request2;
    throw "absurd";
  } catch (err) {
    if (err === "absurd") throw err;
    assertEquals(err.name, "AbortError");
    assertEquals(
      err.message,
      "Failed to execute 'request' on 'LockManager': The request was aborted.",
    );
  }
  assertEquals(acquired2, false);
  assertEquals(acquired3, false);

  resolveTask1?.();
  await exhaustMicrotaskQueue();
  assertEquals(acquired2, false);
  assertEquals(acquired3, true);
});

Deno.test("should abort the request if the provided signal is aborted before the lock is acquired", async () => {
  let resolveTask1: ((v?: unknown) => void) | undefined;
  const task1 = new Promise((resolve) => {
    resolveTask1 = resolve;
  });
  const controller = new AbortController();

  locks.request("resource:a", async () => {
    await task1;
  });
  let acquired2 = false;
  const request2 = locks.request(
    "resource:a",
    { signal: controller.signal },
    async () => {
      acquired2 = true;
    },
  );
  let acquired3 = false;
  locks.request("resource:a", async () => {
    acquired3 = true;
    return acquired3;
  });
  controller.abort();
  try {
    await request2;
    throw "absurd";
  } catch (err) {
    if (err === "absurd") throw err;
    assertEquals(err.name, "AbortError");
    assertEquals(
      err.message,
      "Failed to execute 'request' on 'LockManager': The request was aborted.",
    );
  }

  resolveTask1?.();
  await exhaustMicrotaskQueue();
  assertEquals(acquired2, false);
  assertEquals(acquired3, true);
});

Deno.test("should not do anything if the provided signal is aborted after the lock is acquired", async () => {
  let resolveTask1: ((v?: unknown) => void) | undefined;
  const task1 = new Promise((resolve) => {
    resolveTask1 = resolve;
  });
  let resolveTask2: ((v?: unknown) => void) | undefined;
  const task2 = new Promise((resolve) => {
    resolveTask2 = resolve;
  });
  const controller = new AbortController();

  locks.request("resource:a", async () => {
    await task1;
  });
  let acquired2 = false;
  const request2 = locks.request(
    "resource:a",
    { signal: controller.signal },
    async () => {
      acquired2 = true;
      await task2;
      return "OK";
    },
  );
  let acquired3 = false;
  locks.request("resource:a", async () => {
    acquired3 = true;
    return acquired3;
  });

  resolveTask1?.();
  await exhaustMicrotaskQueue();
  assertEquals(acquired2, true);
  assertEquals(acquired3, false);

  controller.abort();
  await exhaustMicrotaskQueue();
  resolveTask2?.();
  await exhaustMicrotaskQueue();
  assertEquals(await request2, "OK");
  assertEquals(acquired3, true);
});

function exhaustMicrotaskQueue() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
