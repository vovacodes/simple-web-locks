type Mode = "exclusive" | "shared";

class Lock {
  constructor(public name: string, public mode: Mode) {}
}

interface LockRequest<R> {
  name: string;
  mode: Mode;
  callback: LockGrantedCallback<R>;
  promise: PromiseWithHandles<R>;
}

// TODO: support all of the options: https://wicg.github.io/web-locks/#dictdef-lockoptions
interface LockOptions {
  mode?: "exclusive";
  signal?: AbortSignal;
}

type LockGrantedCallback<R> = (lock: Lock) => R | Promise<R>;

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

type PromiseWithHandles<T> = Promise<T> & {
  resolve: (value: T) => void;
  reject: (err: Error) => void;
};

class LockManager<T> {
  private heldLocks = new Set<string>();
  private lockRequestQueueMap = new Map<
    string,
    LockRequest<unknown>[]
  >();

  public request<R>(
    name: string,
    callback: LockGrantedCallback<R>,
  ): Promise<R>;
  public request<R>(
    name: string,
    options: LockOptions,
    callback: LockGrantedCallback<R>,
  ): Promise<R>;
  public request<R>(
    name: string,
    optionsOrCallback: LockOptions | LockGrantedCallback<R>,
    callback?: LockGrantedCallback<R>,
  ): Promise<R> {
    const { options, callback: cb } = this.getOptionsAndCallback(
      optionsOrCallback,
      callback,
    );

    // TODO: use options.mode
    const mode = "exclusive";
    const releasedPromise = promiseWithHandles<R>();
    const lockRequest: LockRequest<R> = {
      name,
      mode,
      promise: releasedPromise,
      callback: cb,
    };
    const requestQueue = this.ensureRequestQueue<R>(name);

    if (options.signal) {
      if (options.signal.aborted) {
        return Promise.reject(abortError());
      }

      options.signal.addEventListener("abort", () => {
        const index = requestQueue.indexOf(lockRequest);
        if (index === -1) return;

        const [abortedRequest] = requestQueue.splice(index, 1);
        abortedRequest.promise.reject(abortError());
      });
    }

    requestQueue.push(lockRequest);
    this.processRequestQueue(name);

    return releasedPromise;
  }

  private processRequestQueue(
    name: string,
  ) {
    const requestQueue = this.ensureRequestQueue(name);
    if (requestQueue.length === 0) return;
    if (this.heldLocks.has(name)) return;

    const request = requestQueue.shift();
    assert(request);

    const lock = new Lock(name, request.mode);
    const waitingPromise = Promise.resolve().then(() => request.callback(lock));

    waitingPromise.then((result) => {
      request.promise.resolve(result);
    }, (reason) => {
      request.promise.reject(reason);
    }).finally(() => {
      this.heldLocks.delete(name);
      this.processRequestQueue(name);
    });

    this.heldLocks.add(name);
  }

  private ensureRequestQueue<T>(name: string): LockRequest<T>[] {
    const existingQueue = this.lockRequestQueueMap
      .get(name) as (LockRequest<T>[]) | undefined;
    if (existingQueue) return existingQueue;

    const newQueue: LockRequest<T>[] = [];
    this.lockRequestQueueMap.set(name, newQueue as LockRequest<unknown>[]);

    return newQueue;
  }

  private getOptionsAndCallback<R>(
    optionsOrCallback: LockOptions | LockGrantedCallback<R>,
    callback?: LockGrantedCallback<R>,
  ): {
    options: LockOptions;
    callback: LockGrantedCallback<R>;
  } {
    if (typeof optionsOrCallback === "object") {
      if (!callback) throw new TypeError("callback must not be undefined");
      return {
        options: optionsOrCallback,
        callback: callback,
      };
    } else {
      return {
        options: { mode: "exclusive" }, // default options
        callback: optionsOrCallback,
      };
    }
  }
}

function promiseWithHandles<T>(): PromiseWithHandles<T> {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((err: Error) => void) | undefined;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  }) as PromiseWithHandles<T>;
  promise.resolve = resolve!;
  promise.reject = reject!;

  return promise;
}

function abortError(): Error {
  const abortError = new Error(
    "Failed to execute 'request' on 'LockManager': The request was aborted.",
  );
  abortError.name = "AbortError";
  return abortError;
}

function assert(expr: unknown, msg = ""): asserts expr {
  if (!expr) {
    throw new AssertionError(msg);
  }
}

/**
 * This object implements a small subset of Web Locks API described here:
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API.
 * Unlike the proposal, this implementation doesn't work across browser tabs or workers,
 * and only suitable for use within a single realm.
 */
export const locks = new LockManager();
