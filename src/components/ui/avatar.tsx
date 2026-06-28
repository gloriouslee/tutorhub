import * as React from "react";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
};

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full",
        sizeMap[size],
        className
      )}
      {...props}
    />
  )
);
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, alt = "", ...props }, ref) => (
  <img
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    alt={alt}
    {...props}
  />
));
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { name?: string }
>(({ className, name, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full gradient-primary text-white font-semibold",
      className
    )}
    {...props}
  >
    {name ? getInitials(name) : children}
  </div>
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
