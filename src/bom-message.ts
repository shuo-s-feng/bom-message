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
const createMessageEmitter = (props?: {
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

  const emitter = globalThis[globalEmitterKey] ?? new EventEmitter();
  globalThis[globalEmitterKey] = emitter;

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

/**
 * Handler function for processing messages between entities
 * @template Payload - Type of the message payload
 * @template Response - Type of the response payload
 */
export type MessageHandler<Payload = unknown, Response = unknown> = (
  sender: { id: string },
  payload: Payload,
  reply: (response?: Response) => void
) => void;

/**
 * Structure of messages passed between entities
 * @template Payload - Type of the message payload
 */
interface MessageData<Payload = unknown> {
  /**
   * The protocol used to send the message
   */
  via: "bom-message";
  type: "request" | "response";
  messageId: string;
  from: string; // Sender entity’s ID
  to: string; // Target entity’s ID
  payload: Payload;
  timestamp: number;
}

/**
 * Type guard to verify if an unknown object is a valid MessageData
 * @param data - Object to verify
 * @returns boolean indicating if the object is valid MessageData
 */
const isMessageData = (data: unknown): data is MessageData => {
  return (
    typeof data === "object" &&
    data !== null &&
    "via" in data &&
    typeof data.via === "string" &&
    data.via === "bom-message" &&
    "type" in data &&
    typeof data.type === "string" &&
    ["request", "response"].includes(data.type) &&
    "messageId" in data &&
    typeof data.messageId === "string" &&
    "from" in data &&
    typeof data.from === "string" &&
    "to" in data &&
    typeof data.to === "string" &&
    "payload" in data &&
    "timestamp" in data &&
    typeof data.timestamp === "number"
  );
};

const generateUniqueId = (): string => {
  return crypto.randomUUID();
};

/**
 * Entity class for handling cross-window/iframe communication.
 * Implements a request-response pattern for message passing between entities.
 */
export class Entity {
  /** Set of source entity IDs to ignore messages from */
  public static sourceEntityIdSet: Set<string> = new Set();

  /** Map of all active Entity instances, keyed by their IDs */
  public static instances = new Map<string, Entity>();

  /** Flag indicating if the Entity system has been initialized */
  private static isInitialized = false;

  /** Global verbose logging flag */
  private static globalVerbose = false;

  /** Global message emitter instance */
  private static messageEmitter: MessageEventEmitter;

  /**
   * Initialize the Entity message handling system.
   * Must be called before creating any Entity instances.
   *
   * @param props - Initialization options
   * @param props.sourceEntityIds - Array of entity IDs to ignore messages from
   * @param props.enableAutoCustomEmitter - Whether to create a custom emitter if no global one exists
   * @param props.globalEmitterKey - Key to store/retrieve custom emitter on global object
   * @param props.verbose - Enable detailed logging for all entities
   * @throws Error if no valid message emitter is found and autoCustomEmitter is false
   */
  public static init(props?: {
    /**
     * Array of source entity IDs to ignore messages from
     * @default []
     */
    sourceEntityIds?: Array<string>;

    /**
     * Whether to create a custom emitter if no global one exists
     * @default true
     */
    enableAutoCustomEmitter?: boolean;

    /**
     * Key to store/retrieve custom emitter on global object
     * @default "bmCustomEventEmitter"
     */
    globalEmitterKey?: string;

    /**
     * Enable detailed logging for all entities
     * @default false
     */
    verbose?: boolean;
  }) {
    const {
      sourceEntityIds,
      enableAutoCustomEmitter = true,
      globalEmitterKey = "bmCustomEventEmitter",
      verbose = false,
    } = props ?? {};

    if (!Entity.isInitialized) {
      Entity.instances = new Map<string, Entity>();
      Entity.sourceEntityIdSet = new Set(sourceEntityIds);
      Entity.isInitialized = true;
      Entity.globalVerbose = verbose;
      Entity.messageEmitter = createMessageEmitter({
        enableAutoCustomEmitter,
        globalEmitterKey,
      });
      Entity.messageEmitter.addEventListener("message", Entity.onWindowMessage);

      if (Entity.globalVerbose) {
        console.log("[Entity.init] Message listener registered.");
      }
    }
  }

  /**
   * Cleanup the Entity system.
   * Removes all event listeners and clears all entity instances.
   */
  public static destroy() {
    Entity.messageEmitter.removeEventListener(
      "message",
      Entity.onWindowMessage
    );
    Entity.instances = new Map<string, Entity>();
    Entity.sourceEntityIdSet = new Set();
    Entity.isInitialized = false;

    if (Entity.globalVerbose) {
      console.log("[Entity.destroy] Message listener removed.");
    }
  }

  /**
   * Global message event handler for all Entity instances.
   * Processes incoming messages and routes them to the appropriate Entity instance.
   *
   * This handler:
   * 1. Validates the message data structure
   * 2. Filters out messages from ignored source entities
   * 3. Routes messages to target Entity instances
   *
   * @internal
   * @param event - The message event received from the message emitter
   * @remarks
   * - Messages with invalid data structure are silently ignored
   * - Messages from source entities in sourceEntityIdSet are ignored
   * - Messages for non-existent entities are ignored
   * - When verbose logging is enabled, all routing decisions are logged
   */
  private static onWindowMessage(event: MessageEvent) {
    // Validate event data
    if (!event.data || !isMessageData(event.data)) {
      return;
    }

    // Ignore message from source entity
    if (Entity.sourceEntityIdSet.has(event.data.from)) {
      return;
    }

    if (Entity.globalVerbose) {
      console.log("[Entity.onWindowMessage] Event received", event);
    }

    const { data } = event;

    // Find the target Entity instance
    const targetEntity = Entity.getById(data.to);
    if (!targetEntity) {
      // No entity with that ID; ignore
      if (Entity.globalVerbose) {
        console.log(
          "[Entity.onWindowMessage] No target entity found for ID:",
          data.to
        );
      }
      return;
    }

    // Delegate to the entity
    if (Entity.globalVerbose) {
      console.log(
        `[Entity.onWindowMessage] Delegating ${data.type} to Entity(${data.to}).`
      );
    }
    targetEntity.handleIncomingMessage(data);
  }

  /**
   * Retrieve an Entity instance by its ID
   * @param id - The ID of the entity to retrieve
   * @returns The Entity instance or undefined if not found
   */
  public static getById(id: string): Entity | undefined {
    return Entity.instances.get(id);
  }

  /** Unique identifier for this entity */
  public id: string;

  /** Array of message handlers registered to this entity */
  public messageHandlers: Array<MessageHandler> = [];

  /** Map of pending request resolvers, keyed by message ID */
  private pendingRequests = new Map<string, (value: unknown) => void>();

  /** Instance-specific verbose logging flag */
  private verbose: boolean;

  /**
   * Creates a new Entity instance for message handling.
   * If an entity with the same ID exists, either returns the existing instance
   * or throws an error based on the errorOnDuplicate flag.
   *
   * @param id - Unique identifier for this entity
   * @param props - Configuration options
   * @param props.verbose - Enable detailed logging for this instance
   * @param props.errorOnDuplicate - Throw error if entity with ID already exists
   * @throws Error when errorOnDuplicate is true and entity ID already exists
   */
  constructor(
    id: string,
    props?: { verbose?: boolean; errorOnDuplicate?: boolean }
  ) {
    const { verbose, errorOnDuplicate = false } = props ?? {};

    this.id = id;
    this.verbose = verbose ?? Entity.globalVerbose;

    if (Entity.instances.has(id)) {
      if (errorOnDuplicate) {
        throw new Error(`Entity with ID '${id}' already exists.`);
      } else {
        if (this.verbose) {
          console.log(
            `[Entity ${id}] Duplicate entity detected; returning existing instance.`
          );
        }
        return Entity.getById(id)!;
      }
    }

    // Register this instance in the static map
    Entity.instances.set(id, this);

    if (this.verbose) {
      console.log(`[Entity ${this.id}] Created.`);
    }
  }

  /**
   * Removes this entity instance from the global registry.
   * Call this when the entity is no longer needed to prevent memory leaks.
   */
  public destroy() {
    Entity.instances.delete(this.id);
    if (this.verbose) {
      console.log(`[Entity ${this.id}] destroyed.`);
    }
  }

  /**
   * Subscribe to incoming messages for this entity.
   *
   * @param handler - Function to handle incoming messages
   * @returns Unsubscribe function to remove the handler
   *
   * @example
   * ```typescript
   * const unsubscribe = entity.subscribeMessage((sender, payload, reply) => {
   *   console.log(`Got message from ${sender.id}:`, payload);
   *   reply('Acknowledged');
   * });
   *
   * // Later: cleanup
   * unsubscribe();
   * ```
   */
  public subscribeMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);

    if (this.verbose) {
      console.log(`[Entity ${this.id}] Handler subscribed.`);
    }

    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
      if (this.verbose) {
        console.log(`[Entity ${this.id}] Handler unsubscribed.`);
      }
    };
  }

  /**
   * Send a message to another entity and wait for its response.
   *
   * @param targetId - ID of the target entity
   * @param message - Message payload to send
   * @returns Promise that resolves with the response from the target entity
   *
   * @example
   * ```typescript
   * const response = await entity.sendMessage('target-id', { type: 'ping' });
   * console.log('Got response:', response);
   * ```
   */
  public sendMessage(targetId: string, message: unknown): Promise<unknown> {
    return new Promise((resolve) => {
      const messageId = generateUniqueId();
      this.pendingRequests.set(messageId, resolve);

      const data: MessageData = {
        via: "bom-message",
        type: "request",
        messageId,
        from: this.id,
        to: targetId,
        payload: message,
        timestamp: Date.now(),
      };

      if (this.verbose) {
        console.log(`[Entity ${this.id}] Sending message:`, data);
      }

      Entity.messageEmitter.postMessage(data, "*");
    });
  }

  /**
   * Internal method to process incoming messages for this entity.
   * Handles both request and response type messages.
   *
   * @internal
   * @param data - The message data to process
   */
  private handleIncomingMessage(data: MessageData) {
    if (data.from === this.id) {
      if (this.verbose) {
        console.log(`[Entity ${this.id}] Ignoring message from self:`, data);
      }
      return;
    }

    if (this.verbose) {
      console.log(`[Entity ${this.id}] Handling incoming:`, data);
    }

    if (data.type === "request") {
      // It's a request
      const { from, payload, messageId } = data;
      this.messageHandlers.forEach((handler) => {
        handler({ id: from }, payload, (response) => {
          // Send a response back to the sender
          const responseData: MessageData = {
            via: "bom-message",
            type: "response",
            messageId, // same ID for correlation
            from: this.id,
            to: from,
            payload: response,
            timestamp: Date.now(),
          };

          if (this.verbose) {
            console.log(`[Entity ${this.id}] Replying with:`, responseData);
          }

          Entity.messageEmitter.postMessage(responseData, "*");
        });
      });
    } else if (data.type === "response") {
      // It's a response to our earlier request
      const resolver = this.pendingRequests.get(data.messageId);
      if (resolver) {
        resolver(data.payload);
        this.pendingRequests.delete(data.messageId);

        if (this.verbose) {
          console.log(
            `[Entity ${this.id}] Request ${data.messageId} resolved with:`,
            data.payload
          );
        }
      } else {
        if (this.verbose) {
          console.log(
            `[Entity ${this.id}] No resolver found for message ${data.messageId}`
          );
        }
      }
    }
  }
}
