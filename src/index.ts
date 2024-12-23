export type MessageHandler<Payload = unknown, Response = unknown> = (
  sender: { id: string },
  payload: Payload,
  reply: (response?: Response) => void
) => void;

export interface MessageData<Payload = unknown> {
  type: "request" | "response";
  messageId: string;
  from: string; // Sender entity’s ID
  to: string; // Target entity’s ID
  payload: Payload;
  timestamp: number;
}

export const isMessageData = (data: unknown): data is MessageData => {
  return (
    typeof data === "object" &&
    data !== null &&
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

function generateUniqueId(): string {
  return crypto.randomUUID();
}

export class Entity {
  // **** Static members for shared usage ****
  public static sourceEntityId: string | undefined = undefined;
  private static instances = new Map<string, Entity>();
  private static isInitialized = false;
  private static globalVerbose = false;

  /**
   * Initialize the single message listener.
   * You must call Entity.init() before creating your Entity instances.
   * Pass `verbose: true` to enable console logs for global events.
   */
  public static init(sourceEntityId?: string, verbose = false) {
    if (!Entity.isInitialized) {
      Entity.sourceEntityId = sourceEntityId;
      Entity.isInitialized = true;
      Entity.globalVerbose = verbose;

      window.addEventListener("message", Entity.onWindowMessage);

      if (Entity.globalVerbose) {
        console.log("[Entity.init] Window message listener registered.");
      }
    }
  }

  public static destroy() {
    window.removeEventListener("message", Entity.onWindowMessage);
    Entity.instances.clear();
    Entity.sourceEntityId = undefined;
    Entity.isInitialized = false;

    if (Entity.globalVerbose) {
      console.log("[Entity.destroy] Window message listener removed.");
    }
  }

  public static getById(id: string): Entity | undefined {
    return Entity.instances.get(id);
  }

  /**
   * The single, static event listener that delegates to the correct Entity.
   */
  private static onWindowMessage(event: MessageEvent) {
    // Validate event data
    if (!event.data || !isMessageData(event.data)) {
      return;
    }

    // Ignore message from source entity
    if (
      Entity.sourceEntityId !== undefined &&
      Entity.sourceEntityId === event.data.from
    ) {
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

  // **** Instance members ****
  public id: string;
  public messageHandlers: Array<MessageHandler> = [];
  private pendingRequests = new Map<string, (value: unknown) => void>();
  private verbose: boolean;

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
   * Clean up if desired. Removes this instance from the static map.
   */
  public destroy() {
    Entity.instances.delete(this.id);
    if (this.verbose) {
      console.log(`[Entity ${this.id}] destroyed.`);
    }
  }

  /**
   * Subscribe a handler for incoming requests; returns an unsubscribe function.
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
   * Send a message to another entity, returning a Promise that resolves
   * when the target entity replies.
   */
  public sendMessage(targetId: string, message: unknown): Promise<unknown> {
    return new Promise((resolve) => {
      const messageId = generateUniqueId();
      this.pendingRequests.set(messageId, resolve);

      const data: MessageData = {
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

      window.postMessage(data, "*");
    });
  }

  /**
   * Handle an incoming postMessage event directed to this Entity.
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

          window.postMessage(responseData, "*");
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
