export type HubContext = {
  soft: boolean;
  url: URL;
};

export type HubModule = {
  mount: (ctx: HubContext) => Promise<void>;
  unmount: () => void;
};
