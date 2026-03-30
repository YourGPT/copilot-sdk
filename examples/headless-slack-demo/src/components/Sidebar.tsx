import { Hash, ChevronDown, Plus, Bell, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearMessages, loadMessages } from "../lib/storage";

interface Channel {
  id: string;
  name: string;
}

interface SidebarProps {
  channels: Channel[];
  activeChannel: string;
}

export default function Sidebar({ channels, activeChannel }: SidebarProps) {
  const navigate = useNavigate();

  return (
    <div
      className="w-64 shrink-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: "var(--sidebar-bg)" }}
    >
      {/* Workspace header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-1 cursor-pointer group">
          <span className="text-white font-bold text-base tracking-tight">
            YourGPT
          </span>
          <ChevronDown
            size={14}
            className="text-white/60 group-hover:text-white transition-colors"
          />
        </div>
        <button className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
          <Plus size={16} className="text-white" />
        </button>
      </div>

      {/* Scrollable area */}
      <div className="flex-1 overflow-y-auto py-2 slack-scroll">
        {/* Channels */}
        <div className="mb-1">
          <SidebarSection label="Channels" />
          {channels.map((ch) => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              active={ch.id === activeChannel}
              onClick={() => navigate(`/channel/${ch.id}`)}
              onClear={() => {
                clearMessages(ch.id);
                window.location.reload();
              }}
            />
          ))}
          <button
            className="flex items-center gap-2 w-full px-3 py-1 text-sm hover:bg-white/10 rounded mx-1 transition-colors"
            style={{ color: "var(--sidebar-text)" }}
          >
            <Plus size={15} />
            <span>Add channels</span>
          </button>
        </div>

        {/* DMs */}
        <div className="mt-2">
          <SidebarSection label="Direct messages" />
          {["Alice", "Bob", "Carol"].map((name) => (
            <SidebarItem
              key={name}
              icon={
                <span className="w-4 h-4 rounded-sm bg-green-400 text-white text-[9px] flex items-center justify-center font-bold shrink-0">
                  {name[0]}
                </span>
              }
              label={name}
              active={false}
              onClick={() => {}}
            />
          ))}
        </div>
      </div>

      {/* Bottom user bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10">
        <div className="w-8 h-8 rounded-lg bg-purple-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
          Y
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">You</p>
          <p className="text-white/50 text-xs">Active</p>
        </div>
        <Bell
          size={16}
          className="text-white/50 hover:text-white cursor-pointer"
        />
      </div>
    </div>
  );
}

function ChannelItem({
  channel,
  active,
  onClick,
  onClear,
}: {
  channel: Channel;
  active: boolean;
  onClick: () => void;
  onClear: () => void;
}) {
  const hasMessages = loadMessages(channel.id).length > 0;

  return (
    <div className="group/item relative mx-1">
      <button
        onClick={onClick}
        className="flex items-center gap-2 w-full px-3 py-1 rounded text-sm transition-colors"
        style={{
          color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
          backgroundColor: active ? "var(--sidebar-active)" : "transparent",
        }}
        onMouseEnter={(e) => {
          if (!active)
            (e.currentTarget as HTMLElement).style.backgroundColor =
              "var(--sidebar-hover)";
        }}
        onMouseLeave={(e) => {
          if (!active)
            (e.currentTarget as HTMLElement).style.backgroundColor =
              "transparent";
        }}
      >
        <span className="shrink-0">
          <Hash size={15} />
        </span>
        <span className="truncate flex-1 text-left">{channel.name}</span>
        {hasMessages && (
          <span
            className="w-2 h-2 rounded-full bg-green-400 shrink-0"
            title="Has saved messages"
          />
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        title="Clear history"
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/20"
        style={{ color: "var(--sidebar-text)" }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1 px-3 py-1 mb-0.5">
      <ChevronDown size={12} style={{ color: "var(--sidebar-text)" }} />
      <span
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--sidebar-text)" }}
      >
        {label}
      </span>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-1 rounded mx-1 text-sm transition-colors"
      style={{
        color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
        backgroundColor: active ? "var(--sidebar-active)" : "transparent",
        width: "calc(100% - 8px)",
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLElement).style.backgroundColor =
            "var(--sidebar-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLElement).style.backgroundColor =
            "transparent";
      }}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
