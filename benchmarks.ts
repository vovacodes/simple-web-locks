import {
  bench,
  runBenchmarks,
} from "https://deno.land/std@0.79.0/testing/bench.ts";
import { locks } from "./mod.ts";

// WARM UP
for (let i = 0; i < 100000; i++) {
  await locks.request(String.fromCharCode(i), task);
  await locks.request("a", task);
}

bench({
  name: "100 calls - no locking",
  runs: 100,
  async func(b) {
    b.start();
    for (let i = 0; i < 100; i++) {
      await task();
    }
    b.stop();
  },
});

bench({
  name: "100 calls - single lock",
  runs: 100,
  async func(b) {
    b.start();
    for (let i = 0; i < 100; i++) {
      await locks.request("a", task);
    }
    b.stop();
  },
});

bench({
  name: "100 calls - separate locks",
  runs: 100,
  async func(b) {
    b.start();
    for (let i = 0; i < 100; i++) {
      await locks.request(String.fromCharCode(i), task);
    }
    b.stop();
  },
});

bench({
  name: "1000 calls - no locking",
  runs: 100,
  async func(b) {
    b.start();
    for (let i = 0; i < 1000; i++) {
      await task();
    }
    b.stop();
  },
});

bench({
  name: "1000 calls - single lock",
  runs: 100,
  async func(b) {
    b.start();
    for (let i = 0; i < 1000; i++) {
      await locks.request("a", task);
    }
    b.stop();
  },
});

bench({
  name: "1000 calls - separate locks",
  runs: 100,
  async func(b) {
    b.start();
    for (let i = 0; i < 1000; i++) {
      await locks.request(String.fromCharCode(i), task);
    }
    b.stop();
  },
});

async function task() {
  return Promise.resolve(Math.floor(Math.random() * 100));
}

runBenchmarks();
