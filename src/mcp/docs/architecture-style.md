# Architecture & code style

- **Layering:** Business logic belongs in **use cases**, not routers. Routers are thin HTTP layers only. Flow: **Router → Use case → Repository / service**.
- **Abstractions:** Build abstractions generically from the start. Do not require multiple correction cycles to generalize.
- **Conventions:** Before writing new code, find and follow conventions already in the project (naming, structure, error handling, testing style).
- **Size:** Keep files under **500** lines.
- **APIs:** Use **typed interfaces** for all public APIs.