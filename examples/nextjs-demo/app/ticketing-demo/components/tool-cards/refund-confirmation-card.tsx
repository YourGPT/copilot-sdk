import { CheckCircle2 } from "lucide-react";

interface RefundConfirmationCardProps {
  orderId: string;
  amount: number;
  reason: string;
}

export function RefundConfirmationCard({
  orderId,
  amount,
  reason,
}: RefundConfirmationCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
        <span className="font-semibold text-green-500">Refund Processed</span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Order ID</span>
          <span className="font-mono text-foreground">{orderId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Refund Amount</span>
          <span className="font-semibold text-green-500">
            ${amount.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Reason</span>
          <span className="text-foreground">{reason}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Processing Time</span>
          <span className="text-foreground">3-5 business days</span>
        </div>
      </div>
    </div>
  );
}
