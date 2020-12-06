class Lock {
    constructor(name, mode) {
        this.name = name;
        this.mode = mode;
    }
}
class AssertionError extends Error {
    constructor(message) {
        super(message);
        this.name = "AssertionError";
    }
}
class LockManager {
    constructor() {
        this.heldLocks = new Set();
        this.lockRequestQueueMap = new Map();
    }
    request(name, optionsOrCallback, callback) {
        const { options, callback: cb } = this.getOptionsAndCallback(optionsOrCallback, callback);
        // TODO: use options.mode
        const mode = "exclusive";
        const releasedPromise = promiseWithHandles();
        const lockRequest = {
            name,
            mode,
            promise: releasedPromise,
            callback: cb,
        };
        const requestQueue = this.ensureRequestQueue(name);
        if (options.signal) {
            if (options.signal.aborted) {
                return Promise.reject(abortError());
            }
            options.signal.addEventListener("abort", () => {
                const index = requestQueue.indexOf(lockRequest);
                if (index === -1)
                    return;
                const [abortedRequest] = requestQueue.splice(index, 1);
                abortedRequest.promise.reject(abortError());
            });
        }
        requestQueue.push(lockRequest);
        this.processRequestQueue(name);
        return releasedPromise;
    }
    processRequestQueue(name) {
        const requestQueue = this.ensureRequestQueue(name);
        if (requestQueue.length === 0)
            return;
        if (this.heldLocks.has(name))
            return;
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
    ensureRequestQueue(name) {
        const existingQueue = this.lockRequestQueueMap
            .get(name);
        if (existingQueue)
            return existingQueue;
        const newQueue = [];
        this.lockRequestQueueMap.set(name, newQueue);
        return newQueue;
    }
    getOptionsAndCallback(optionsOrCallback, callback) {
        if (typeof optionsOrCallback === "object") {
            if (!callback)
                throw new TypeError("callback must not be undefined");
            return {
                options: optionsOrCallback,
                callback: callback,
            };
        }
        else {
            return {
                options: { mode: "exclusive" },
                callback: optionsOrCallback,
            };
        }
    }
}
function promiseWithHandles() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    promise.resolve = resolve;
    promise.reject = reject;
    return promise;
}
function abortError() {
    const abortError = new Error("Failed to execute 'request' on 'LockManager': The request was aborted.");
    abortError.name = "AbortError";
    return abortError;
}
function assert(expr, msg = "") {
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
//# sourceMappingURL=mod.js.map