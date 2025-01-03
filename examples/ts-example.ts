import { Entity } from "../src/bom-message";

/**
 * Initialize Entity system with default configuration
 */
Entity.init({
  // We only have one scope (window/global/globalThis), then we don't need to filter messages.
  // If multiple scopes (like cross-window communication) are used, messages are broadcasted to all scopes,
  // then we can filter messages sent by itself to avoid duplicate messages.
  sourceEntityIds: [],
  verbose: false,
});

// Create two entities
new Entity("1");
new Entity("2");

/**
 * Demonstrates message passing between two entities
 */
const run = async (entityId1: string, entityId2: string, verbose = false) => {
  const entity1 = Entity.getById(entityId1)!;
  const entity2 = Entity.getById(entityId2)!;

  // Listen for messages from entity 1
  entity2.subscribeMessage((sender, payload, reply) => {
    if (verbose) {
      console.log(
        `Entity(${entityId2}) received message from Entity(${sender.id}) with payload`,
        payload
      );
    }

    // Reply a "Hi" message
    reply("Hi");

    if (verbose) {
      console.log(
        `Entity(${entityId2}) replied to Entity(${sender.id}) with payload`,
        "Hi"
      );
    }
  });

  // Send a "Hello" message from entity 1 to entity 2
  const promise = entity1.sendMessage(entityId2, "Hello");
  if (verbose) {
    console.log(
      `Entity(${entityId1}) sent message to Entity(${entityId2}) with payload`,
      "Hello"
    );
  }

  // Get the response from entity 2
  promise.then((response) => {
    if (verbose) {
      console.log(
        `Entity(${entityId1}) received response from Entity(${entityId2}) with payload`,
        response
      );
    }
  });

  // Wait for 1 second to ensure the message is received
  await new Promise((resolve) => setTimeout(resolve, 1000));

  Entity.destroy();
};

// Demonstrate bidirectional communication
//
// Example output:
//
// Entity(1) sent message to Entity(2) with payload Hello
// Entity(2) sent message to Entity(1) with payload Hello
// Entity(2) received message from Entity(1) with payload Hello
// Entity(2) replied to Entity(1) with payload Hi
// Entity(1) received message from Entity(2) with payload Hello
// Entity(1) replied to Entity(2) with payload Hi
// Entity(1) received response from Entity(2) with payload Hi
// Entity(2) received response from Entity(1) with payload Hi
run("1", "2", true);
run("2", "1", true);
