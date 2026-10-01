import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
  fullWidth?: boolean;
}

const sizeClasses = {
  xs: "px-2 py-1 text-xs",
  sm: "px-4 py-2 text-xs",
  md: "px-5 py-2 text-sm",
  lg: "px-6 py-3 text-base",
  xl: "px-8 py-4 text-lg",
};

const variantClasses = {
  primary:
    "bg-gray-900 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-500",
  secondary:
    "bg-gray-600 text-white hover:bg-gray-700 focus:ring-2 focus:ring-gray-500",
  outline:
    "border border-gray-400 bg-transparent text-gray-500 focus:ring-2 focus:ring-gray-500",
  ghost:
    "border-transparent bg-transparent text-gray-500",
  danger:
    "border-transparent bg-transparent text-red-600 hover:text-red-700",
};

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  size = "md",
  variant = "primary",
  icon,
  iconPosition = "left",
  loading = false,
  disabled,
  fullWidth,
  ...props
}: ButtonProps) => {
  const renderIcon = () => {
    if (loading) {
      return (
        <div className="w-4 h-4 border-2 border-gray-900 border-t-white rounded-full animate-spin" />
      );
    }
    return icon;
  };

  const iconElement = renderIcon();
  const showLeftIcon = iconElement && iconPosition === "left";
  const showRightIcon = iconElement && iconPosition === "right";
  const buttonClassName = fullWidth ? "w-full" : "";

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${sizeClasses[size]
        } ${variantClasses[variant]} ${className} ${buttonClassName}`}
      disabled={disabled || loading}
      {...props}
    >
      {showLeftIcon && <span className="shrink-0">{iconElement}</span>}
      {children}
      {showRightIcon && <span className="shrink-0">{iconElement}</span>}
    </button>
  );
};