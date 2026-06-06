type WorkerLike = {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
};

export function createWorkerClient(worker: WorkerLike) {
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void }
  >();

  worker.addEventListener("message", (event) => {
    const message = event.data as {
      id?: number;
      type?: string;
      payload?: unknown;
    };
    const id = message.id;

    if (typeof id !== "number") return;

    const entry = pending.get(id);
    if (!entry) return;

    pending.delete(id);

    if (message.type === "success") {
      entry.resolve(message.payload);
      return;
    }

    const payload = (message.payload ?? {}) as {
      name?: string;
      message?: string;
      stack?: string;
    };
    const error = new Error(payload.message ?? "Worker error") as Error & {
      name: string;
    };
    error.name = payload.name ?? "Error";
    if (payload.stack) error.stack = payload.stack;
    entry.reject(error);
  });

  return {
    request(type: string, payload: unknown) {
      const id = nextId++;
      const promise = new Promise<unknown>((resolve, reject) =>
        pending.set(id, { resolve, reject }),
      );
      worker.postMessage({ id, type, payload });
      return promise;
    },
  };
}
