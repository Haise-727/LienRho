"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";

export default function RootHomePage() {
  const router = useRouter();
  const { role } = useUser();

  useEffect(() => {
    if (role === "lender") {
      router.replace("/dashboard/lender");
    } else {
      router.replace("/dashboard/supplier");
    }
  }, [role, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-sm shadow-md animate-pulse">
          LR
        </div>
        <p className="text-xs text-slate-500 font-medium">Entering LienRho Clearinghouse...</p>
      </div>
    </div>
  );
}
