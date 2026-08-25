# Node 24 / Windows Fix

The original build failed because `better-sqlite3` attempted a native C++ build under Node 24.

This fixed build:
- has NO `better-sqlite3`
- has NO `node-gyp` database compilation
- has NO Visual Studio C++ requirement
- uses `server/data.json`
- uses Node's built-in `crypto` for password hashing
- is compatible with Node 24.x

Clean install:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
npm run dev
```

Do not copy an old `node_modules` folder into this project.
