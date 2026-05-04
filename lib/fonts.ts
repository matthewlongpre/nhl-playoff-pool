import { Fraunces } from "next/font/google";

/** Soft serif for pool UI headlines — pairs with Geist for body. */
export const poolDisplay = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pool-display",
  weight: ["500", "600", "700"],
});
