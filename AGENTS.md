# AGENTS

## Goal

Build a serverless, client-side web portal for real-time visualization of virtualized datasets on S3 using Kerchunk and direct HTTP range queries.

## Architecture

- Pure Svelte-Vite client app
- Chunks are decompressed client-side using numcodecs
- The browser issues HTTP GET range requests using the .json references under `web-app/public/refs/`.

## Security constraints

- No backend proxy: do not expose S3 keys on the frontend.
- Prefer anonymous kwargs to read the Acacia S3 bucket.

## Agent constraint

- You are running in WSL, looking at the user's development environment running on Windows.
- You do not have access to .exe commands like uv, python, npm, npx, pnpm. If these are needed, tell the user to use the command and a brief reasoning of why it is needed
- You do have access to in-built linux commands like ls, grep, glob and etc.

1. decodeBase64FixedUTFLE representative fixture contract: exact strings, null padding, malformed input
   behavior.
2. LRU cache contract: evict by entry count or byte budget first, and what counts as “recently used.”
3. DPIRD vs ECMWF separate tests: what must be separate beyond map rendering, especially dimensions and time/
   step semantics.
4. Codec integration boundary: when to test shuffle/zlib metadata validation versus actual zarrita decode.
