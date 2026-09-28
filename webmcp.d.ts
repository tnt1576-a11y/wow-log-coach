interface Document {
  modelContext?: {
    registerTool(
      tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        execute(input: unknown): Promise<unknown>;
        annotations?: {
          readOnlyHint?: boolean;
          untrustedContentHint?: boolean;
        };
      },
      options?: { signal?: AbortSignal },
    ): void | Promise<void>;
  };
}
