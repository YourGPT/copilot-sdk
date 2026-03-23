import { Hash, ChevronDown, Plus, Bell } from "lucide-react";

interface Channel {
  id: string;
  name: string;
}

interface SidebarProps {
  channels: Channel[];
  activeChannel: string;
  onChannelSelect: (id: string) => void;
}

export default function Sidebar({
  channels,
  activeChannel,
  onChannelSelect,
}: SidebarProps) {
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
        {/* Browsed channels */}
        <div className="mb-1">
          <SidebarSection label="Channels" />
          {channels.map((ch) => (
            <SidebarItem
              key={ch.id}
              icon={<Hash size={15} />}
              label={ch.name}
              active={ch.id === activeChannel}
              onClick={() => onChannelSelect(ch.id)}
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
