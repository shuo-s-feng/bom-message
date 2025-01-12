import EventEmitter from "events";

/**
 * Interface defining the required methods for a message event emitter
 */
export interface MessageEventEmitter {
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
  removeEventListener: (
    type: string,
    listener: (event: unknown) => void
  ) => void;
  postMessage: (message: unknown, targetOrigin: string) => void;
}

/**
 * Verifies if a context object implements the required MessageEventEmitter methods
 * @param context - The object to verify
 * @returns boolean indicating if the context is valid
 */
export const isMessageEventEmitter = (
  context: any
): context is MessageEventEmitter => {
  return (
    typeof context !== "undefined" &&
    typeof context.addEventListener === "function" &&
    typeof context.removeEventListener === "function" &&
    typeof context.postMessage === "function"
  );
};

/**
 * Creates a message emitter instance based on the available global context
 * @param props - Configuration options
 * @param props.enableAutoCustomEmitter - Whether to create a custom emitter if no global one exists
 * @param props.globalEmitterKey - Key to store/retrieve custom emitter on global object
 * @returns A MessageEventEmitter instance
 */
export const createMessageEmitter = (props?: {
  enableAutoCustomEmitter?: boolean;
  globalEmitterKey?: string;
}): MessageEventEmitter => {
  if (typeof global !== "undefined" && isMessageEventEmitter(global)) {
    return global;
  }

  if (typeof globalThis !== "undefined" && isMessageEventEmitter(globalThis)) {
    return globalThis;
  }

  if (typeof window !== "undefined" && isMessageEventEmitter(window)) {
    return window;
  }

  const {
    enableAutoCustomEmitter = true,
    globalEmitterKey = "bmCustomEventEmitter",
  } = props ?? {};

  if (!enableAutoCustomEmitter) {
    throw new Error("No valid message emitter found");
  }

  const emitter = (globalThis as any)[globalEmitterKey] ?? new EventEmitter();
  (globalThis as any)[globalEmitterKey] = emitter;

  return {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      emitter.on(type, listener);
    },
    removeEventListener: (type: string, listener: (event: unknown) => void) => {
      emitter.off(type, listener);
    },
    postMessage: (message: unknown) => {
      // Simulate async behavior
      setTimeout(() => {
        emitter.emit("message", { data: message });
      }, 0);
    },
  };
};
