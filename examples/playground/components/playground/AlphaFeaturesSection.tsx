"use client";

import {
  GitBranch,
  MessageSquare,
  BookOpen,
  Archive,
  HardDrive,
  EyeOff,
  Zap,
  LayoutList,
  BarChart2,
  ChevronRight,
  Layers,
  KeyRound,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AlphaConfig, CompactionStrategy } from "@/lib/types";

interface AlphaFeaturesSectionProps {
  alphaConfig: AlphaConfig;
  onUpdate: <K extends keyof AlphaConfig>(
    key: K,
    value: AlphaConfig[K],
  ) => void;
}

function FeatureRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  id,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex items-start gap-2 min-w-0">
        <div className="mt-0.5 w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
        </div>
        <div className="min-w-0">
          <Label
            htmlFor={id}
            className="text-xs font-medium cursor-pointer leading-tight"
          >
            {label}
          </Label>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-snug">
            {description}
          </p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="flex-shrink-0 mt-0.5 scale-90"
      />
    </div>
  );
}

export function AlphaFeaturesSection({
  alphaConfig,
  onUpdate,
}: AlphaFeaturesSectionProps) {
  return (
    <div className="space-y-1">
      {/* Header badge */}
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800 mb-3">
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 h-4 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0"
        >
          Beta
        </Badge>
        <span className="text-[10px] text-zinc-400">
          These features are in active development
        </span>
      </div>

      {/* Message Actions */}
      <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
        <MessageSquare className="w-3 h-3" /> Message Actions
      </p>
      <FeatureRow
        id="alpha-copy"
        icon={ChevronRight}
        label="Copy Action"
        description="Copy button on assistant messages"
        checked={alphaConfig.messageActions.copyEnabled}
        onCheckedChange={(v) =>
          onUpdate("messageActions", {
            ...alphaConfig.messageActions,
            copyEnabled: v,
          })
        }
      />
      <FeatureRow
        id="alpha-edit"
        icon={ChevronRight}
        label="Edit Action"
        description="Edit button on user messages (creates branch)"
        checked={alphaConfig.messageActions.editEnabled}
        onCheckedChange={(v) =>
          onUpdate("messageActions", {
            ...alphaConfig.messageActions,
            editEnabled: v,
          })
        }
      />
      <FeatureRow
        id="alpha-feedback"
        icon={ChevronRight}
        label="Feedback Action"
        description="Thumbs up/down on assistant messages"
        checked={alphaConfig.messageActions.feedbackEnabled}
        onCheckedChange={(v) =>
          onUpdate("messageActions", {
            ...alphaConfig.messageActions,
            feedbackEnabled: v,
          })
        }
      />

      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />

      {/* Branching */}
      <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
        <GitBranch className="w-3 h-3" /> Branching
      </p>
      <FeatureRow
        id="alpha-branching"
        icon={GitBranch}
        label="Conversation Branching"
        description="Edit messages to create parallel conversation paths"
        checked={alphaConfig.branchingEnabled}
        onCheckedChange={(v) => onUpdate("branchingEnabled", v)}
      />

      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />

      {/* Skills */}
      <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
        <BookOpen className="w-3 h-3" /> Skills
      </p>
      <FeatureRow
        id="alpha-brand-voice"
        icon={BookOpen}
        label="Brand Voice"
        description="Eager skill — always active, sets response tone"
        checked={alphaConfig.brandVoiceSkill}
        onCheckedChange={(v) => onUpdate("brandVoiceSkill", v)}
      />
      <FeatureRow
        id="alpha-code-review"
        icon={BookOpen}
        label="Code Review"
        description="Auto skill — AI loads when code review is requested"
        checked={alphaConfig.codeReviewSkill}
        onCheckedChange={(v) => onUpdate("codeReviewSkill", v)}
      />

      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />

      {/* Context Management */}
      <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
        <Archive className="w-3 h-3" /> Context Management
      </p>
      <div className="space-y-1.5">
        <Label className="text-[10px] text-zinc-500">Compaction Strategy</Label>
        <Select
          value={alphaConfig.compactionStrategy}
          onValueChange={(v) =>
            onUpdate("compactionStrategy", v as CompactionStrategy)
          }
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">
              None (default)
            </SelectItem>
            <SelectItem value="sliding-window" className="text-xs">
              Sliding Window
            </SelectItem>
            <SelectItem value="selective-prune" className="text-xs">
              Selective Prune
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <FeatureRow
        id="alpha-session"
        icon={HardDrive}
        label="Session Persistence"
        description="Survive page reloads via IndexedDB"
        checked={alphaConfig.sessionPersistence}
        onCheckedChange={(v) => onUpdate("sessionPersistence", v)}
      />
      <FeatureRow
        id="alpha-ctx-stats"
        icon={BarChart2}
        label="Context Stats"
        description="Show token usage bar in the chat sidebar"
        checked={alphaConfig.contextStats}
        onCheckedChange={(v) => onUpdate("contextStats", v)}
      />

      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />

      {/* Threads */}
      <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
        <Layers className="w-3 h-3" /> Threads
      </p>
      <FeatureRow
        id="alpha-concurrent-threads"
        icon={Layers}
        label="Concurrent Threads"
        description="Each thread streams independently — switch away mid-response"
        checked={alphaConfig.concurrentThreads}
        onCheckedChange={(v) => onUpdate("concurrentThreads", v)}
      />

      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />

      {/* YourGPT Auth */}
      <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
        <KeyRound className="w-3 h-3" /> YourGPT Auth
      </p>
      <FeatureRow
        id="alpha-ygpt-auth"
        icon={KeyRound}
        label="Use yourgptConfig"
        description="Creates sessions via YourGPT createSession API (overrides onCreateSession)"
        checked={alphaConfig.yourgptAuthEnabled}
        onCheckedChange={(v) => onUpdate("yourgptAuthEnabled", v)}
      />
      {alphaConfig.yourgptAuthEnabled && (
        <div className="space-y-1.5 pl-8 pr-1 pb-1">
          <Label className="text-[10px] text-zinc-500">API Key</Label>
          <Input
            type="password"
            value={alphaConfig.yourgptApiKey}
            onChange={(e) => onUpdate("yourgptApiKey", e.target.value)}
            placeholder="ygpt_..."
            className="h-7 text-xs"
          />
          <Label className="text-[10px] text-zinc-500">Widget UID</Label>
          <Input
            value={alphaConfig.yourgptWidgetUid}
            onChange={(e) => onUpdate("yourgptWidgetUid", e.target.value)}
            placeholder="wgt_..."
            className="h-7 text-xs"
          />
          <p className="text-[9px] text-zinc-400">
            Stored in localStorage. Reload chat after saving.
          </p>
        </div>
      )}

      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />

      {/* Tools */}
      <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
        <Zap className="w-3 h-3" /> Advanced Tools
      </p>
      <FeatureRow
        id="alpha-hidden"
        icon={EyeOff}
        label="Hidden Analytics Tool"
        description="Silent tool — runs without showing in chat UI"
        checked={alphaConfig.hiddenAnalytics}
        onCheckedChange={(v) => onUpdate("hiddenAnalytics", v)}
      />
      <FeatureRow
        id="alpha-deferred"
        icon={Zap}
        label="Deferred Search Tool"
        description="Only injected when query is relevant (saves tokens)"
        checked={alphaConfig.deferredSearch}
        onCheckedChange={(v) => onUpdate("deferredSearch", v)}
      />

      <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />

      {/* Custom Message View */}
      <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1 flex items-center gap-1">
        <LayoutList className="w-3 h-3" /> Custom Message View
      </p>
      <FeatureRow
        id="alpha-msg-view"
        icon={LayoutList}
        label="Custom messageView"
        description="Inject custom footer below message list"
        checked={alphaConfig.customMessageView}
        onCheckedChange={(v) => onUpdate("customMessageView", v)}
      />
    </div>
  );
}
