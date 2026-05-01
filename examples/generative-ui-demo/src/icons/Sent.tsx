import React from "react";

interface SentProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const Sent: React.FC<SentProps> = ({
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
      <path d="M21.0477 3.05293C18.8697 0.707363 2.48648 6.4532 2.50001 8.551C2.51535 10.9299 8.89809 11.6617 10.6672 12.1581C11.7311 12.4565 12.016 12.7625 12.2613 13.8781C13.3723 18.9305 13.9301 21.4435 15.2014 21.4996C17.2278 21.5892 23.1733 5.342 21.0477 3.05293Z" />
      <path d="M11.4999 12.5L14.9999 9" />
    </svg>
  );
  return content;
};

Sent.displayName = "Sent";
