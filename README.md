<h1 align="center">bom-message</h1>

[![codecov](https://codecov.io/gh/shuo-s-feng/bom-message/branch/main/graph/badge.svg)](https://codecov.io/gh/shuo-s-feng/bom-message) [![Test](https://github.com/shuo-s-feng/bom-message/actions/workflows/test.yml/badge.svg)](https://github.com/shuo-s-feng/bom-message/actions/workflows/test.yml)

<div align="center">
  A TypeScript library for cross-window message communication, designed by
  <a href="https://gravatar.com/shuosfeng/">Shuo Feng</a>
</div>

<br />

## Installation

```bash
yarn add bom-message
```

Or

```bash
npm install bom-message
```

## Usage

### Basic Example

```typescript
import { Entity } from "bom-message";

// Initialize the Entity system
Entity.init();

// Create entities
const entity1 = new Entity("1");
const entity2 = new Entity("2");

// Subscribe to messages
entity2.subscribeMessage((sender, payload, reply) => {
  console.log(`Received: ${payload}`);
  reply("Hi"); // Send reply
});

// Send message and handle response
entity1.sendMessage("2", "Hello").then((response) => {
  console.log(`Got response: ${response}`); // "Hi"
});
```

### Features

- Bidirectional communication between entities
- Promise-based message handling
- Built-in reply mechanism
- Cross-window communication support
- TypeScript support

### API Reference

#### Methods

| Method                      | Description                                                   | Parameters                                                                                                                 | Return Type           |
| --------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `Entity.init()`             | Initialize the Entity system. Must be called first.           | `config?: { sourceEntityIds?: string[], enableAutoCustomEmitter?: boolean, globalEmitterKey?: string, verbose?: boolean }` | `void`                |
| `Entity.getById()`          | Retrieve an entity instance by its ID.                        | `id: string`                                                                                                               | `Entity \| undefined` |
| `Entity.destroy()`          | Clean up all entities and event listeners.                    | none                                                                                                                       | `void`                |
| `new Entity()`              | Create new entity instance.                                   | `id: string, options?: { verbose?: boolean, errorOnDuplicate?: boolean }`                                                  | `Entity`              |
| `entity.destroy()`          | Remove this specific entity instance.                         | none                                                                                                                       | `void`                |
| `entity.subscribeMessage()` | Subscribe to incoming messages. Returns unsubscribe function. | `handler: (sender: { id: string }, payload: unknown, reply: (response?: unknown) => void) => void`                         | `() => void`          |
| `entity.sendMessage()`      | Send message to another entity. Returns promise with reply.   | `targetId: string, message: unknown`                                                                                       | `Promise<unknown>`    |

## License

This library is [MIT](LICENSE) licensed.

[build-badge]: https://github.com/shuo-s-feng/bom-message/workflows/main/badge.svg
[build]: https://github.com/shuo-s-feng/bom-message/actions
[coverage-badge]: https://img.shields.io/codecov/c/github/shuo-s-feng/bom-message.svg
