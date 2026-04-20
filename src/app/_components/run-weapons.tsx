"use client";

import Image from "next/image";

type RunWeaponsProps = {
  primaryWeaponKey: string;
  secondaryWeaponKey?: string | null;
  className?: string;
  iconClassName?: string;
  iconSize?: number;
};

export default function RunWeapons({
  primaryWeaponKey,
  secondaryWeaponKey,
  className = "gap-2",
  iconClassName = "h-7 w-7 object-contain",
  iconSize = 28
}: RunWeaponsProps) {
  const finalClassName = `flex items-center ${className}`;

  return (
    <div className={finalClassName}>
      <Image
        src={`/weapons/${primaryWeaponKey}.png`}
        alt={primaryWeaponKey.toUpperCase()}
        title={primaryWeaponKey.toUpperCase()}
        width={iconSize}
        height={iconSize}
        className={iconClassName}
      />
      {secondaryWeaponKey ? (
        <Image
          src={`/weapons/${secondaryWeaponKey}.png`}
          alt={secondaryWeaponKey.toUpperCase()}
          title={secondaryWeaponKey.toUpperCase()}
          width={iconSize}
          height={iconSize}
          className={iconClassName}
        />
      ) : null}
    </div>
  );
}
