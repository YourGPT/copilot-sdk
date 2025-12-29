import { ProviderCard } from "@/components/provider-card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-center">
            Multi-Provider AI Demo
          </h1>
          <p className="text-center text-muted-foreground text-sm mt-1">
            Compare responses from OpenAI, Anthropic Claude, and Google Gemini
          </p>
        </div>
      </header>

      {/* Main Content - 3 Column Grid */}
      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-[calc(100vh-120px)]">
          {/* OpenAI */}
          <ProviderCard
            name="OpenAI"
            model="GPT-4o"
            endpoint="/api/chat/openai"
            color="green"
            capabilities={{
              supportsVision: true,
              supportsTools: true,
              supportsStreaming: true,
            }}
          />

          {/* Anthropic */}
          <ProviderCard
            name="Anthropic"
            model="Claude 3.5 Sonnet"
            endpoint="/api/chat/anthropic"
            color="orange"
            capabilities={{
              supportsVision: true,
              supportsTools: true,
              supportsThinking: true,
              supportsStreaming: true,
              supportsPDF: true,
            }}
          />

          {/* Google */}
          <ProviderCard
            name="Google"
            model="Gemini 2.0 Flash"
            endpoint="/api/chat/google"
            color="blue"
            capabilities={{
              supportsVision: true,
              supportsTools: true,
              supportsStreaming: true,
              supportsPDF: true,
              supportsAudio: true,
              supportsVideo: true,
            }}
          />
        </div>
      </main>
    </div>
  );
}
