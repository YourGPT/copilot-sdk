import { Copy, CheckCircle2, Mail, Phone, ExternalLink } from "lucide-react";
import { useState } from "react";

interface Customer {
  name: string;
  email: string;
  phone: string;
  tier: string;
  totalOrders: number;
  lifetimeValue: string;
}

interface CustomerProfileCardProps {
  customer: Customer;
}

export function CustomerProfileCard({ customer }: CustomerProfileCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
          {customer.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-foreground">{customer.name}</h4>
          <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
            {customer.tier} Customer
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 bg-muted rounded">
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-foreground truncate">
              {customer.email}
            </span>
          </div>
          <button
            onClick={() => handleCopy(customer.email, "email")}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            title="Copy email"
          >
            {copiedField === "email" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between p-2 bg-muted rounded">
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-foreground">{customer.phone}</span>
          </div>
          <button
            onClick={() => handleCopy(customer.phone, "phone")}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            title="Copy phone"
          >
            {copiedField === "phone" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="p-2 bg-muted rounded">
          <span className="text-muted-foreground text-xs">Total Orders</span>
          <p className="text-foreground font-semibold">
            {customer.totalOrders}
          </p>
        </div>
        <div className="p-2 bg-muted rounded">
          <span className="text-muted-foreground text-xs">Lifetime Value</span>
          <p className="text-foreground font-semibold">
            {customer.lifetimeValue}
          </p>
        </div>
      </div>
      <button className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border text-foreground rounded-lg hover:bg-accent transition-colors text-sm">
        <ExternalLink className="w-4 h-4" />
        View Full Profile
      </button>
    </div>
  );
}
