import { KnowledgeBaseDemo } from "./knowledge-base-demo";

// Server component - reads env and passes to client
export default function Page() {
  const envApiKey = process.env.YOURGPT_KB_API_KEY || "";

  return <KnowledgeBaseDemo initialApiKey={envApiKey} />;
}
