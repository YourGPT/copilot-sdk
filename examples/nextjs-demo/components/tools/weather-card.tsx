"use client";

import type { ToolRendererProps } from "@yourgpt/copilot-sdk-ui";
import type { WeatherData } from "@/lib/tools/weather";

/**
 * Weather condition icons
 */
const WeatherIcon = ({
  condition,
}: {
  condition: WeatherData["condition"];
}) => {
  const icons: Record<WeatherData["condition"], string> = {
    sunny: "☀️",
    cloudy: "☁️",
    rainy: "🌧️",
    foggy: "🌫️",
    snowy: "❄️",
  };
  return <span className="text-4xl">{icons[condition] || "🌤️"}</span>;
};

/**
 * Loading skeleton for weather card
 */
function WeatherCardSkeleton({ city }: { city?: string }) {
  return (
    <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 w-[280px] animate-pulse">
      <div className="flex items-start justify-between">
        <div>
          <div className="h-5 w-24 bg-blue-200 dark:bg-blue-800 rounded mb-2" />
          <div className="h-8 w-20 bg-blue-200 dark:bg-blue-800 rounded" />
        </div>
        <div className="h-12 w-12 bg-blue-200 dark:bg-blue-800 rounded-full" />
      </div>
      {city && (
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
          Getting weather for {city}...
        </p>
      )}
    </div>
  );
}

/**
 * Error state for weather card
 */
function WeatherCardError({ error }: { error?: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950 p-4 w-[280px]">
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <span>⚠️</span>
        <span className="text-sm font-medium">Weather unavailable</span>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

/**
 * WeatherCard - Generative UI component for weather tool results
 *
 * @example
 * ```tsx
 * <CopilotChat
 *   toolRenderers={{
 *     get_weather: WeatherCard,
 *   }}
 * />
 * ```
 */
export function WeatherCard({ execution }: ToolRendererProps) {
  // Loading state
  if (execution.status === "pending" || execution.status === "executing") {
    const city = execution.args?.city as string | undefined;
    return <WeatherCardSkeleton city={city} />;
  }

  // Error state
  if (execution.status === "error" || execution.status === "failed") {
    return <WeatherCardError error={execution.error} />;
  }

  // Rejected state
  if (execution.status === "rejected") {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 p-4 w-[280px]">
        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
          <span>🚫</span>
          <span className="text-sm font-medium">Weather request declined</span>
        </div>
      </div>
    );
  }

  // Success - render weather data
  // Guard against undefined result (race condition safety)
  if (!execution.result) {
    return <WeatherCardSkeleton />;
  }

  // execution.result is { success, data, _aiContext?, _aiResponseMode? }
  const result = execution.result as { success: boolean; data: WeatherData };
  const data = result.data;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 w-[280px] shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">
            {data.city}
          </h3>
          <p className="text-3xl font-bold text-blue-800 dark:text-blue-200 mt-1">
            {data.temperature}°F
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 capitalize mt-1">
            {data.condition}
          </p>
        </div>
        <WeatherIcon condition={data.condition} />
      </div>

      <div className="flex gap-4 mt-4 pt-3 border-t border-blue-200 dark:border-blue-800">
        <div className="text-center">
          <p className="text-xs text-blue-500 dark:text-blue-400">Humidity</p>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {data.humidity}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-blue-500 dark:text-blue-400">Wind</p>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {data.wind} mph
          </p>
        </div>
      </div>
    </div>
  );
}
