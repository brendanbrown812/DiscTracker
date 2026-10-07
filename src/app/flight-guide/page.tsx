import type { Metadata } from "next";
import FlightGuide from "@/components/flight-guide";
import "./flight-guide.css";

export const metadata: Metadata = {
  title: "Flight guide — DiscTracker",
  description: "Compare your discs by speed, stability, glide, turn, and fade.",
};

export default function FlightGuidePage() {
  return <FlightGuide />;
}
