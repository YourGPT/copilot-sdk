import React from "react";

interface ArrowRight01Props extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const ArrowRight01: React.FC<ArrowRight01Props> = ({
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
      <path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" />
    </svg>
  );
  return content;
};

ArrowRight01.displayName = "ArrowRight01";
