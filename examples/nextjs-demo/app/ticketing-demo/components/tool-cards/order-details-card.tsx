import { Package, MapPin } from "lucide-react";

interface Order {
  id: string;
  product: string;
  price: number;
  status: string;
  date: string;
  shippingAddress: string;
}

interface OrderDetailsCardProps {
  order: Order;
}

export function OrderDetailsCard({ order }: OrderDetailsCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">Order Details</span>
        </div>
        <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-600 rounded-full font-medium">
          {order.status}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Order ID</span>
          <span className="font-mono text-foreground">{order.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Product</span>
          <span className="text-foreground">{order.product}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Price</span>
          <span className="font-semibold text-foreground">${order.price}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Order Date</span>
          <span className="text-foreground">{order.date}</span>
        </div>
      </div>
      <div className="pt-2 border-t border-border">
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
          <span className="text-muted-foreground">{order.shippingAddress}</span>
        </div>
      </div>
    </div>
  );
}
