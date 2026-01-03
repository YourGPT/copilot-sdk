import {
  AlertTriangle,
  MessageSquare,
  Copy,
  CheckCircle2,
  ChevronDown,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

// Mock supervisors/managers with roles
export const availableSupervisors = [
  { name: "Sarah Mitchell", role: "Senior Support Lead", avatar: "SM" },
  { name: "David Chen", role: "Support Manager", avatar: "DC" },
  { name: "Emily Roberts", role: "Customer Success Lead", avatar: "ER" },
  { name: "James Wilson", role: "Retention Specialist", avatar: "JW" },
];

export type Supervisor = (typeof availableSupervisors)[0];

interface EscalationCardProps {
  reason: string;
  priority: string;
  onAssign?: (supervisor: Supervisor) => void;
  onCancel?: () => void;
  initialAssigned?: boolean;
  initialSupervisor?: string;
}

export function EscalationCard({
  reason,
  priority,
  onAssign,
  onCancel,
  initialAssigned = false,
  initialSupervisor,
}: EscalationCardProps) {
  const [copied, setCopied] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [assigned, setAssigned] = useState(initialAssigned);
  const [messageSent, setMessageSent] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState<Supervisor>(
    availableSupervisors.find((s) => s.name === initialSupervisor) ||
      availableSupervisors[0],
  );
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = () => {
    const text = `Escalation Details
━━━━━━━━━━━━━━━━━━━━
Assigned To: ${selectedSupervisor.name} (${selectedSupervisor.role})
Priority: ${priority}
Reason: ${reason}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMessage = () => {
    setMessageSent(true);
    setTimeout(() => setMessageSent(false), 2000);
  };

  const handleSelectSupervisor = (sup: Supervisor) => {
    setSelectedSupervisor(sup);
    setShowUserMenu(false);
  };

  const handleAssign = () => {
    setAssigned(true);
    onAssign?.(selectedSupervisor);
  };

  const handleCancel = () => {
    setCancelled(true);
    onCancel?.();
  };

  // Cancelled state
  if (cancelled) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-semibold text-muted-foreground line-through">
            Escalation Cancelled
          </span>
        </div>
      </div>
    );
  }

  // Pending state - user needs to select and assign
  if (!assigned) {
    return (
      <div className="bg-card border border-yellow-500/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-yellow-500" />
            <span className="text-sm font-semibold text-foreground">
              Escalate Ticket
            </span>
          </div>
          <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-600 rounded text-xs font-medium uppercase">
            {priority}
          </span>
        </div>

        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          {reason}
        </div>

        <div className="space-y-2">
          <span className="text-xs text-muted-foreground">
            Select supervisor to assign:
          </span>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-muted rounded-lg hover:bg-accent transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium">
                {selectedSupervisor.avatar}
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-medium text-foreground">
                  {selectedSupervisor.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedSupervisor.role}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {showUserMenu && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                {availableSupervisors.map((sup) => (
                  <button
                    key={sup.name}
                    onClick={() => handleSelectSupervisor(sup)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium">
                      {sup.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {sup.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {sup.role}
                      </div>
                    </div>
                    {selectedSupervisor.name === sup.name && (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleCancel}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-border text-foreground rounded-lg hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <ArrowRight className="w-3 h-3" />
            Assign
          </button>
        </div>
      </div>
    );
  }

  // Assigned state - escalation completed
  return (
    <div className="bg-card border border-green-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <span className="text-sm font-semibold text-green-600">
            Ticket Escalated
          </span>
        </div>
        <span className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-xs font-medium uppercase">
          {priority}
        </span>
      </div>

      <div className="flex items-center gap-3 p-2 bg-green-500/5 rounded-lg border border-green-500/20">
        <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-600 flex items-center justify-center text-xs font-medium">
          {selectedSupervisor.avatar}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">
            {selectedSupervisor.name}
          </div>
          <div className="text-xs text-muted-foreground">
            {selectedSupervisor.role}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
        {reason}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <button
          onClick={handleMessage}
          disabled={messageSent}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {messageSent ? (
            <>
              <CheckCircle2 className="w-3 h-3" />
              Sent
            </>
          ) : (
            <>
              <MessageSquare className="w-3 h-3" />
              Message {selectedSupervisor.name.split(" ")[0]}
            </>
          )}
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1.5 text-xs border border-border text-foreground rounded hover:bg-accent transition-colors ml-auto"
          title="Copy details"
        >
          {copied ? (
            <CheckCircle2 className="w-3 h-3 text-green-500" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      </div>
    </div>
  );
}
