import { isMessageEventEmitter, createMessageEmitter } from "../event-emitter";

describe("MessageEventEmitter", () => {
  const originalWindow = window;

  beforeEach(() => {
    // Clean up window object
    Object.defineProperty(window, "addEventListener", { value: undefined });
    Object.defineProperty(window, "removeEventListener", { value: undefined });
    Object.defineProperty(window, "postMessage", { value: undefined });
  });

  afterEach(() => {
    // Restore original window properties
    Object.defineProperty(window, "addEventListener", {
      value: originalWindow.addEventListener,
    });
    Object.defineProperty(window, "removeEventListener", {
      value: originalWindow.removeEventListener,
    });
    Object.defineProperty(window, "postMessage", {
      value: originalWindow.postMessage,
    });
  });

  describe("isMessageEventEmitter", () => {
    it("should return true for valid message emitter", () => {
      const validEmitter = {
        addEventListener: () => {},
        removeEventListener: () => {},
        postMessage: () => {},
      };
      expect(isMessageEventEmitter(validEmitter)).toBe(true);
    });

    it("should return false for invalid message emitter", () => {
      const invalidEmitter = {
        addEventListener: () => {},
        // Missing required methods
      };
      expect(isMessageEventEmitter(invalidEmitter)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isMessageEventEmitter(undefined)).toBe(false);
    });
  });

  describe("createMessageEmitter", () => {
    it("should create custom emitter when no global emitter exists", () => {
      const emitter = createMessageEmitter();
      expect(isMessageEventEmitter(emitter)).toBe(true);
    });

    it("should throw error when autoCustomEmitter is false and no global emitter exists", () => {
      expect(() => {
        createMessageEmitter({ enableAutoCustomEmitter: false });
      }).toThrow("No valid message emitter found");
    });

    it("should use window when available", () => {
      const mockFns = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        postMessage: jest.fn(),
      };

      Object.defineProperty(window, "addEventListener", {
        value: mockFns.addEventListener,
      });
      Object.defineProperty(window, "removeEventListener", {
        value: mockFns.removeEventListener,
      });
      Object.defineProperty(window, "postMessage", {
        value: mockFns.postMessage,
      });

      const emitter = createMessageEmitter();
      expect(emitter.addEventListener).toBe(mockFns.addEventListener);
      expect(emitter.removeEventListener).toBe(mockFns.removeEventListener);
      expect(emitter.postMessage).toBe(mockFns.postMessage);
    });
  });
});
