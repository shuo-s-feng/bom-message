# bom-message

A TypeScript library for cross-window message communication.

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

| Method                      | Parameters                                                                                                                 | Return Type           | Description                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------- |
| `Entity.init()`             | `config?: { sourceEntityIds?: string[], enableAutoCustomEmitter?: boolean, globalEmitterKey?: string, verbose?: boolean }` | `void`                | Initialize the Entity system. Must be called first.           |
| `Entity.getById()`          | `id: string`                                                                                                               | `Entity \| undefined` | Retrieve an entity instance by its ID.                        |
| `Entity.destroy()`          | none                                                                                                                       | `void`                | Clean up all entities and event listeners.                    |
| `new Entity()`              | `id: string, options?: { verbose?: boolean, errorOnDuplicate?: boolean }`                                                  | `Entity`              | Create new entity instance.                                   |
| `entity.destroy()`          | none                                                                                                                       | `void`                | Remove this specific entity instance.                         |
| `entity.subscribeMessage()` | `handler: (sender: { id: string }, payload: unknown, reply: (response?: unknown) => void) => void`                         | `() => void`          | Subscribe to incoming messages. Returns unsubscribe function. |
| `entity.sendMessage()`      | `targetId: string, message: unknown`                                                                                       | `Promise<unknown>`    | Send message to another entity. Returns promise with reply.   |

## License

[MIT](LICENSE)
