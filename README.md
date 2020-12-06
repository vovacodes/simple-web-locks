# 🔐 simple-web-locks
A single threaded implementation of [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API). Works across runtimes (Browser, Deno, Node).

## Status

This package is 🚧 _work-in-progress_ so the API is not fully implemented:

- [ ] [`locks.request()`](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request)
    - [x] "exclusive" locks
    - [ ] "shared" locks
    - [ ] `options.signal`
    - [ ] `options.ifAvailable`
    - [ ] `options.steal`
- [ ] [`locks.query()`](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/query)

## Usage

### Browser
```js
import { locks } from "https://jspm.dev/simple-web-locks/mod.js"
// or
import { locks } from "https://deno.land/x/simple_web_locks/mod.js"
```

### Deno
```js
import { locks } from "https://deno.land/x/simple_web_locks/mod.ts"
```

### Node
```typescript
import { locks } from "simple-web-locks"
```


## Documentation
For the documentation please refer to the [MDN article](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

## Contributing
This project uses [Deno](https://deno.land/) and [TypeScript](https://www.typescriptlang.org/) as a development toolchain.

### Tests
```sh
deno test
```

### Build JS
```sh
yarn build
```
