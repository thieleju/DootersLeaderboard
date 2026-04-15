import { Medal, Trophy } from "lucide-react";

import { getPlacementBadgeClass } from "./data-table";

interface PlacementBadgesProps {
  first: number;
  second: number;
  third: number;
  className?: string;
}

export default function PlacementBadges({
  first,
  second,
  third,
  className = "",
}: PlacementBadgesProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {[
        { placement: 1, icon: Trophy, value: first },
        { placement: 2, icon: Medal, value: second },
        { placement: 3, icon: Medal, value: third },
      ].map(({ placement, icon: PlacementIcon, value }) => (
        <div
          key={placement}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${getPlacementBadgeClass(
            placement,
          )}`}
        >
          <PlacementIcon className="h-3 w-3" />
          <span className="font-semibold">{value}</span>
        </div>
      ))}
    </div>
  );
}
