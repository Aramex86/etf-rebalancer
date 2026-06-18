// src/shared/lib/mastra.ts

import { Mastra } from "@mastra/core/mastra";

// Mastra instance — композиция агентов из features

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mastraConfig = (agents: Record<string, any>) => {
  const mastra = new Mastra({
    agents: agents,
  });

  return mastra;
};
