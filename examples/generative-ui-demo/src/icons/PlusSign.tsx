import React from "react";

interface PlusSignProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const PlusSign: React.FC<PlusSignProps> = ({
  size = 24,
  strokeWidth = 1.5,
  className,
  ...props
}) => {
  const content = (
    <svg
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 4V20M20 12H4" />
    </svg>
  );
  return content;
};

PlusSign.displayName = "PlusSign";
