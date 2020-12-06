declare type Mode = "exclusive" | "shared";
declare class Lock {
    name: string;
    mode: Mode;
    constructor(name: string, mode: Mode);
}
interface LockOptions {
    mode: "exclusive";
}
declare type LockGrantedCallback<R> = (lock: Lock) => R | Promise<R>;
declare class LockManager<T> {
    private heldLocks;
    private lockRequestQueueMap;
    request<R>(name: string, callback: LockGrantedCallback<R>): Promise<R>;
    request<R>(name: string, options: LockOptions, callback: LockGrantedCallback<R>): Promise<R>;
    private processRequestQueue;
    private ensureRequestQueue;
    private getOptionsAndCallback;
}
/**
 * This object implements a small subset of Web Locks API described here:
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API.
 * Unlike the proposal, this implementation doesn't work across browser tabs or workers,
 * and only suitable for use within a single realm.
 */
export declare const locks: LockManager<unknown>;
export {};
