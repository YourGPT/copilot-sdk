// @ts-nocheck
import { browser } from "fumadocs-mdx/runtime/browser";
import type * as Config from "../source.config";

const create = browser<
  typeof Config,
  import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
    DocData: {};
  }
>();
const browserCollections = {
  docs: create.doc("docs", {
    "index.mdx": () => import("../content/docs/index.mdx?collection=docs"),
    "installation.mdx": () =>
      import("../content/docs/installation.mdx?collection=docs"),
    "message-persistence.mdx": () =>
      import("../content/docs/message-persistence.mdx?collection=docs"),
    "runtime/index.mdx": () =>
      import("../content/docs/runtime/index.mdx?collection=docs"),
    "tools/index.mdx": () =>
      import("../content/docs/tools/index.mdx?collection=docs"),
    "ui/index.mdx": () =>
      import("../content/docs/ui/index.mdx?collection=docs"),
    "react/index.mdx": () =>
      import("../content/docs/react/index.mdx?collection=docs"),
  }),
};
export default browserCollections;
