import { MessageEventEmitter } from "../event-emitter";
import { Entity } from "../bom-message";

describe("Entity", () => {
  let mockMessageEmitter: MessageEventEmitter;
  const originalCrypto = global.crypto;

  beforeEach(() => {
    // Mock entire crypto object
    global.crypto = {
      ...originalCrypto,
      randomUUID: () => "123e4567-e89b-12d3-a456-426614174000",
    } as Crypto;

    // Create mock message emitter before destroying Entity
    mockMessageEmitter = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      postMessage: jest.fn(),
    };

    // Set up window mock
    Object.defineProperty(window, "addEventListener", {
      value: mockMessageEmitter.addEventListener,
    });
    Object.defineProperty(window, "removeEventListener", {
      value: mockMessageEmitter.removeEventListener,
    });
    Object.defineProperty(window, "postMessage", {
      value: mockMessageEmitter.postMessage,
    });

    // Now safe to destroy and reinit
    Entity.destroy();
    Entity.init({ verbose: false });
  });

  afterEach(() => {
    // Restore original crypto
    global.crypto = originalCrypto;

    jest.clearAllMocks();
    Entity.destroy();
  });

  describe("constructor", () => {
    it("should create a new entity with given ID", () => {
      const entity = new Entity("test-entity");
      expect(entity.id).toBe("test-entity");
      expect(Entity.getById("test-entity")).toBe(entity);
    });

    it("should return existing entity if ID exists and errorOnDuplicate is false", () => {
      const entity1 = new Entity("test-entity");
      const entity2 = new Entity("test-entity", { errorOnDuplicate: false });
      expect(entity1).toBe(entity2);
    });

    it("should throw error if ID exists and errorOnDuplicate is true", () => {
      new Entity("test-entity");
      expect(() => {
        new Entity("test-entity", { errorOnDuplicate: true });
      }).toThrow("Entity with ID 'test-entity' already exists.");
    });
  });

  describe("message handling", () => {
    it("should handle incoming messages and trigger handlers", () => {
      const entity = new Entity("receiver");
      const mockHandler = jest.fn();

      entity.subscribeMessage(mockHandler);

      // Simulate incoming message
      const mockMessage = {
        data: {
          via: "bom-message",
          type: "request",
          messageId: "123",
          from: "sender",
          to: "receiver",
          payload: { test: true },
          timestamp: Date.now(),
        },
      };

      // Get the message listener that was registered
      const messageListener = (mockMessageEmitter.addEventListener as jest.Mock)
        .mock.calls[0][1];
      messageListener(mockMessage);

      expect(mockHandler).toHaveBeenCalledWith(
        { id: "sender" },
        { test: true },
        expect.any(Function)
      );
    });

    it("should send messages and handle responses", async () => {
      const sender = new Entity("sender");
      const responseData = { success: true };

      // Mock postMessage to simulate response
      (mockMessageEmitter.postMessage as jest.Mock).mockImplementation(
        (message) => {
          // Simulate response after a tick
          setTimeout(() => {
            const messageListener = (
              mockMessageEmitter.addEventListener as jest.Mock
            ).mock.calls[0][1];
            messageListener({
              data: {
                via: "bom-message",
                type: "response",
                messageId: message.messageId,
                from: "receiver",
                to: "sender",
                payload: responseData,
                timestamp: Date.now(),
              },
            });
          }, 0);
        }
      );

      const response = await sender.sendMessage("receiver", { test: true });
      expect(response).toEqual(responseData);
    });
  });

  describe("cleanup", () => {
    it("should properly clean up when destroyed", () => {
      const entity = new Entity("test");
      entity.destroy();
      expect(Entity.getById("test")).toBeUndefined();
    });

    it("should remove all entities when Entity.destroy is called", () => {
      new Entity("test1");
      new Entity("test2");
      Entity.destroy();
      expect(Entity.getById("test1")).toBeUndefined();
      expect(Entity.getById("test2")).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should handle invalid message format", () => {
      const entity = new Entity("test");
      const mockHandler = jest.fn();
      entity.subscribeMessage(mockHandler);

      const messageListener = (mockMessageEmitter.addEventListener as jest.Mock)
        .mock.calls[0][1];
      messageListener({ data: { invalid: "format" } });

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe("message subscription", () => {
    it("should handle multiple subscribers", () => {
      const entity = new Entity("test");
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      entity.subscribeMessage(handler1);
      entity.subscribeMessage(handler2);

      const message = {
        data: {
          via: "bom-message",
          type: "request",
          messageId: "123",
          from: "sender",
          to: "test",
          payload: { test: true },
          timestamp: Date.now(),
        },
      };

      const messageListener = (mockMessageEmitter.addEventListener as jest.Mock)
        .mock.calls[0][1];
      messageListener(message);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("should unsubscribe message handler", () => {
      const entity = new Entity("test");
      const handler = jest.fn();

      const unsubscribe = entity.subscribeMessage(handler);
      unsubscribe();

      const message = {
        data: {
          via: "bom-message",
          type: "request",
          messageId: "123",
          from: "sender",
          to: "test",
          payload: { test: true },
          timestamp: Date.now(),
        },
      };

      const messageListener = (mockMessageEmitter.addEventListener as jest.Mock)
        .mock.calls[0][1];
      messageListener(message);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("initialization", () => {
    it("should handle multiple init calls", () => {
      Entity.init({ verbose: true });
      Entity.init({ verbose: false });

      const entity = new Entity("test");
      expect(entity.id).toBe("test");
    });
  });

  describe("response handling", () => {
    it("should handle response with error", async () => {
      const sender = new Entity("sender");

      (mockMessageEmitter.postMessage as jest.Mock).mockImplementation(
        (message) => {
          setTimeout(() => {
            const messageListener = (
              mockMessageEmitter.addEventListener as jest.Mock
            ).mock.calls[0][1];
            messageListener({
              data: {
                via: "bom-message",
                type: "response",
                messageId: message.messageId,
                from: "receiver",
                to: "sender",
                payload: "Test error",
                timestamp: Date.now(),
              },
            });
          }, 0);
        }
      );

      await expect(
        sender.sendMessage("receiver", { test: true })
      ).resolves.toEqual("Test error");
    });

    it("should handle response cancellation", () => {
      const sender = new Entity("sender");

      sender.destroy();
      const promise = sender.sendMessage("receiver", { test: true });

      return expect(promise).rejects.toThrow("Entity is destroyed");
    });
  });

  describe("verbose logging", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "log").mockImplementation();
      Entity.destroy();
      Entity.init({ verbose: true });
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should log messages in verbose mode", () => {
      const entity = new Entity("test");
      entity.sendMessage("receiver", { test: true });

      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
