import path from "path";
import fs from "fs-extra";
import { fileURLToPath } from "url";
import type { UserChoices, Provider, Framework } from "./prompts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ProviderConfig {
  envKey: string;
  defaultModel: string;
  importName: string;
  className: string;
  sdkPackage: string;
  sdkVersion: string;
}

const PROVIDER_CONFIGS: Record<Provider, ProviderConfig> = {
  openai: {
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-5.2",
    importName: "openai",
    className: "OpenAI",
    sdkPackage: "openai",
    sdkVersion: "^4.77.0",
  },
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-haiku-4-5",
    importName: "anthropic",
    className: "Anthropic",
    sdkPackage: "@anthropic-ai/sdk",
    sdkVersion: "^0.39.0",
  },
  google: {
    envKey: "GOOGLE_API_KEY",
    defaultModel: "gemini-2.0-flash",
    importName: "google",
    className: "Google",
    sdkPackage: "@google/generative-ai",
    sdkVersion: "^0.21.0",
  },
  xai: {
    envKey: "XAI_API_KEY",
    defaultModel: "grok-3-fast",
    importName: "xai",
    className: "XAI",
    sdkPackage: "openai",
    sdkVersion: "^4.77.0",
  },
};

export async function scaffoldProject(choices: UserChoices): Promise<void> {
  const targetDir = path.join(process.cwd(), choices.projectName);
  const templateDir = path.join(
    __dirname,
    "..",
    "templates",
    choices.framework,
  );

  // Check if template exists
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template not found: ${choices.framework}`);
  }

  // Copy template
  await fs.copy(templateDir, targetDir, {
    overwrite: false,
    errorOnExist: true,
  });

  // Get provider config
  const providerConfig = PROVIDER_CONFIGS[choices.provider];

  // Process template files
  await processTemplateFiles(targetDir, choices, providerConfig);

  // Update package.json
  await updatePackageJson(targetDir, choices.projectName);

  // Add provider SDK dependency
  await addProviderDependency(targetDir, providerConfig);

  // Create .env file
  await createEnvFile(targetDir, choices, providerConfig);

  // Rename gitignore
  const gitignorePath = path.join(targetDir, "_gitignore");
  if (fs.existsSync(gitignorePath)) {
    await fs.rename(gitignorePath, path.join(targetDir, ".gitignore"));
  }

  // Apply feature-specific modifications (only for frontend frameworks)
  if (choices.framework !== "express") {
    if (choices.features.tools) {
      await addToolsSetup(targetDir, choices.framework);
    }
    if (choices.features.persistence) {
      await addPersistenceSetup(targetDir, choices.framework);
    }
  }
}

async function processTemplateFiles(
  dir: string,
  choices: UserChoices,
  config: ProviderConfig,
): Promise<void> {
  const files = await fs.readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dir, file.name);

    if (file.isDirectory()) {
      await processTemplateFiles(filePath, choices, config);
    } else if (
      file.name.endsWith(".ts") ||
      file.name.endsWith(".tsx") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".html")
    ) {
      let content = await fs.readFile(filePath, "utf-8");

      // Replace placeholders
      content = content
        .replace(/\{\{provider\}\}/g, config.importName)
        .replace(/\{\{providerClass\}\}/g, config.className)
        .replace(/\{\{model\}\}/g, config.defaultModel)
        .replace(/\{\{envKey\}\}/g, config.envKey)
        .replace(/\{\{projectName\}\}/g, choices.projectName);

      await fs.writeFile(filePath, content, "utf-8");
    }
  }
}

async function updatePackageJson(
  dir: string,
  projectName: string,
): Promise<void> {
  const packageJsonPath = path.join(dir, "package.json");

  if (fs.existsSync(packageJsonPath)) {
    const pkg = await fs.readJson(packageJsonPath);
    pkg.name = projectName;
    await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
  }
}

async function createEnvFile(
  dir: string,
  choices: UserChoices,
  config: ProviderConfig,
): Promise<void> {
  const envContent = choices.apiKey
    ? `${config.envKey}=${choices.apiKey}\n`
    : `${config.envKey}=your_api_key_here\n`;

  await fs.writeFile(path.join(dir, ".env"), envContent, "utf-8");

  // Also create .env.example
  const envExampleContent = `# ${choices.provider.toUpperCase()} API Key
${config.envKey}=your_api_key_here
`;

  await fs.writeFile(
    path.join(dir, ".env.example"),
    envExampleContent,
    "utf-8",
  );
}

async function addProviderDependency(
  dir: string,
  config: ProviderConfig,
): Promise<void> {
  const packageJsonPath = path.join(dir, "package.json");

  if (fs.existsSync(packageJsonPath)) {
    const pkg = await fs.readJson(packageJsonPath);
    pkg.dependencies[config.sdkPackage] = config.sdkVersion;
    await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
  }
}

async function addToolsSetup(dir: string, framework: Framework): Promise<void> {
  // Determine the API route file path
  const routeFile =
    framework === "nextjs"
      ? path.join(dir, "app", "api", "chat", "route.ts")
      : path.join(dir, "server", "index.ts");

  if (!fs.existsSync(routeFile)) return;

  let content = await fs.readFile(routeFile, "utf-8");

  // Add ToolDefinition import
  content = content.replace(
    /import { createRuntime } from '@yourgpt\/llm-sdk';/,
    `import { createRuntime, type ToolDefinition } from '@yourgpt/llm-sdk';`,
  );

  // Add sample weather tool before the runtime creation
  const weatherTool = `
const serverTools: ToolDefinition[] = [
  {
    name: 'getWeather',
    description: 'Get current weather for a city',
    location: 'server',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' },
      },
      required: ['city'],
    },
    handler: async (params) => {
      const { city } = params as { city: string };
      // Demo implementation - replace with real weather API
      return { temperature: 22, condition: 'sunny', city };
    },
  },
];

`;

  // Find the runtime creation and add tools config
  content = content.replace(
    /const runtime = createRuntime\(\{/,
    `${weatherTool}const runtime = createRuntime({`,
  );

  // Add tools to runtime config
  content = content.replace(
    /systemPrompt: 'You are a helpful AI assistant.',\n\}\);/,
    `systemPrompt: 'You are a helpful AI assistant.',
  tools: serverTools,
});`,
  );

  await fs.writeFile(routeFile, content, "utf-8");
}

async function addPersistenceSetup(
  dir: string,
  framework: Framework,
): Promise<void> {
  // Determine the page file path
  const pageFile =
    framework === "nextjs"
      ? path.join(dir, "app", "components", "copilot-sidebar.tsx")
      : path.join(dir, "src", "components", "copilot-sidebar.tsx");

  if (!fs.existsSync(pageFile)) return;

  let content = await fs.readFile(pageFile, "utf-8");

  // Add persistence props to CopilotChat
  content = content.replace(
    /<CopilotChat\s*\n\s*className="h-full"/,
    `<CopilotChat
        className="h-full"
        persistence={true}
        showThreadPicker={true}`,
  );

  await fs.writeFile(pageFile, content, "utf-8");
}
