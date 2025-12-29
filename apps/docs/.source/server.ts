// @ts-nocheck
import { default as __fd_glob_11 } from "../content/docs/tools/meta.json?collection=docs";
import { default as __fd_glob_10 } from "../content/docs/runtime/meta.json?collection=docs";
import { default as __fd_glob_9 } from "../content/docs/react/meta.json?collection=docs";
import { default as __fd_glob_8 } from "../content/docs/ui/meta.json?collection=docs";
import { default as __fd_glob_7 } from "../content/docs/meta.json?collection=docs";
import * as __fd_glob_6 from "../content/docs/ui/index.mdx?collection=docs";
import * as __fd_glob_5 from "../content/docs/tools/index.mdx?collection=docs";
import * as __fd_glob_4 from "../content/docs/runtime/index.mdx?collection=docs";
import * as __fd_glob_3 from "../content/docs/react/index.mdx?collection=docs";
import * as __fd_glob_2 from "../content/docs/message-persistence.mdx?collection=docs";
import * as __fd_glob_1 from "../content/docs/installation.mdx?collection=docs";
import * as __fd_glob_0 from "../content/docs/index.mdx?collection=docs";
import { server } from "fumadocs-mdx/runtime/server";
import type * as Config from "../source.config";

const create = server<
  typeof Config,
  import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
    DocData: {};
  }
>({ doc: { passthroughs: ["extractedReferences"] } });

export const docs = await create.docs(
  "docs",
  "content/docs",
  {
    "meta.json": __fd_glob_7,
    "ui/meta.json": __fd_glob_8,
    "react/meta.json": __fd_glob_9,
    "runtime/meta.json": __fd_glob_10,
    "tools/meta.json": __fd_glob_11,
  },
  {
    "index.mdx": __fd_glob_0,
    "installation.mdx": __fd_glob_1,
    "message-persistence.mdx": __fd_glob_2,
    "react/index.mdx": __fd_glob_3,
    "runtime/index.mdx": __fd_glob_4,
    "tools/index.mdx": __fd_glob_5,
    "ui/index.mdx": __fd_glob_6,
  },
);
