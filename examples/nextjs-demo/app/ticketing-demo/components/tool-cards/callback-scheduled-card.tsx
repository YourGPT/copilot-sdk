import {
  PhoneCall,
  Clock,
  Phone,
  Calendar,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";

interface CallbackScheduledCardProps {
  date: string;
  time: string;
  phone: string;
}

export function CallbackScheduledCard({
  date,
  time,
  phone,
}: CallbackScheduledCardProps) {
  const [copied, setCopied] = useState(false);
  const [addedToCalendar, setAddedToCalendar] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `Callback: ${date} at ${time}\nPhone: ${phone}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddToCalendar = () => {
    // In real app, this would open calendar or create .ics file
    setAddedToCalendar(true);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PhoneCall className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">
            Callback Scheduled
          </span>
        </div>
        {addedToCalendar && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Added
          </span>
        )}
      </div>
      <div className="text-sm space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-foreground">
            {date} at {time}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <span className="text-foreground">{phone}</span>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleAddToCalendar}
          disabled={addedToCalendar}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <Calendar className="w-4 h-4" />
          {addedToCalendar ? "Added to Calendar" : "Add to Calendar"}
        </button>
        <button
          onClick={handleCopy}
          className="px-3 py-2 border border-border text-foreground rounded-lg hover:bg-accent transition-colors text-sm"
        >
          {copied ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
