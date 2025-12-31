import { ArrowRightLeft, Package, ChevronRight } from "lucide-react";

interface ProductExchangeCardProps {
  fromProduct: string;
  toProduct: string;
  priceDifference: number;
}

export function ProductExchangeCard({
  fromProduct,
  toProduct,
  priceDifference,
}: ProductExchangeCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="w-5 h-5 text-primary" />
        <span className="font-semibold text-foreground">Product Exchange</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-1">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <span className="text-xs text-muted-foreground">{fromProduct}</span>
        </div>
        <ChevronRight className="w-6 h-6 text-primary" />
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-1">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">{toProduct}</span>
        </div>
      </div>
      {priceDifference !== 0 && (
        <div className="text-center text-sm">
          <span
            className={
              priceDifference > 0 ? "text-destructive" : "text-green-500"
            }
          >
            {priceDifference > 0
              ? `+$${priceDifference.toFixed(2)} to pay`
              : `$${Math.abs(priceDifference).toFixed(2)} refund`}
          </span>
        </div>
      )}
    </div>
  );
}
