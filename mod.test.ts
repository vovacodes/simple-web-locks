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
  let executed = false;
  locks.request("resource:a", () => {
    executed = true;
  });

  assertEquals(executed, false);

  await Promise.resolve();
  assertEquals(executed, true);
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
  let resolveTask1: (() => void) | undefined;
  const task1 = new Promise((resolve) => {
    resolveTask1 = resolve;
  });
  let resolveTask2: (() => void) | undefined;
  const task2 = new Promise((resolve) => {
    resolveTask2 = resolve;
  });

  locks.request("resource:a", async () => {
    await task1;
  });

  let called2 = false;
  locks.request("resource:a", async () => {
    called2 = true;
    await task2;
  });

  let called3 = false;
  const finalPromise = locks.request("resource:a", async () => {
    called3 = true;
    return called3;
  });

  await exhaustMicrotaskQueue();

  assertEquals(called2, false);
  assertEquals(called3, false);

  resolveTask1?.();
  await exhaustMicrotaskQueue();
  assertEquals(called2, true);
  assertEquals(called3, false);

  resolveTask2?.();
  await exhaustMicrotaskQueue();
  assertEquals(called2, true);
  assertEquals(called3, true);

  assertEquals(await finalPromise, true);
});

function exhaustMicrotaskQueue() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
