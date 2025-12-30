import type { ToolDefinition } from "@yourgpt/copilot-sdk-core";

/**
 * Weather data returned by the tool
 */
export interface WeatherData {
  city: string;
  temperature: number;
  condition: "sunny" | "cloudy" | "rainy" | "foggy" | "snowy";
  humidity: number;
  wind: number;
}

/**
 * Mock weather data for different cities
 */
const MOCK_WEATHER: Record<string, Omit<WeatherData, "city">> = {
  "san francisco": {
    temperature: 65,
    condition: "foggy",
    humidity: 78,
    wind: 12,
  },
  "new york": { temperature: 42, condition: "cloudy", humidity: 55, wind: 8 },
  miami: { temperature: 82, condition: "sunny", humidity: 70, wind: 6 },
  seattle: { temperature: 52, condition: "rainy", humidity: 85, wind: 10 },
  denver: { temperature: 35, condition: "snowy", humidity: 45, wind: 15 },
  "los angeles": { temperature: 75, condition: "sunny", humidity: 40, wind: 5 },
  chicago: { temperature: 38, condition: "cloudy", humidity: 60, wind: 18 },
  boston: { temperature: 40, condition: "cloudy", humidity: 62, wind: 14 },
};

/**
 * Weather tool definition
 *
 * AI can call this to get current weather for a city.
 * Returns mock data for demo purposes.
 */
export const weatherTool: ToolDefinition = {
  name: "get_weather",
  description:
    "Get the current weather for a city. Returns temperature, conditions, humidity, and wind speed.",
  location: "client",
  inputSchema: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description:
          "The city name to get weather for (e.g., 'San Francisco', 'New York')",
      },
    },
    required: ["city"],
  },
  handler: async ({ city }: { city: string }) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const normalizedCity = city.toLowerCase().trim();
    const data = MOCK_WEATHER[normalizedCity];

    const weatherData: WeatherData = data
      ? { city, ...data }
      : { city, temperature: 70, condition: "sunny", humidity: 50, wind: 8 };

    // AI Response Control: Use brief mode - UI shows weather card, AI gives minimal response
    return {
      success: true,
      data: weatherData,
      _aiResponseMode: "brief" as const,
      _aiContext: `[Weather displayed: ${city} - ${weatherData.temperature}°F, ${weatherData.condition}]`,
    };
  },
};
