import React from "react";

interface Add01Props extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const Add01: React.FC<Add01Props> = ({
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
      <path d="M12.001 5.00003V19.002" />
      <path d="M19.002 12.002L4.99998 12.002" />
    </svg>
  );
  return content;
};

Add01.displayName = "Add01";
