import React from "react";

interface Book01Props extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const Book01: React.FC<Book01Props> = ({
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
      <path d="M20 22H6C4.89543 22 4 21.1046 4 20M4 20C4 18.8954 4.89543 18 6 18H18C19.1046 18 20 17.1046 20 16V2C20 3.10457 19.1046 4 18 4L10 4C7.17157 4 5.75736 4 4.87868 4.87868C4 5.75736 4 7.17157 4 10V20Z" />
      <path d="M18.5 18C18.5 18 17.5 18.7628 17.5 20C17.5 21.2372 18.5 22 18.5 22" />
      <path d="M9 4V8" />
    </svg>
  );
  return content;
};

Book01.displayName = "Book01";
