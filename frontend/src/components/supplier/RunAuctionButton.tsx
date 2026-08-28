"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

interface RunAuctionButtonProps {
  invoiceId: string;
}

export function RunAuctionButton({ invoiceId }: RunAuctionButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/dashboard/supplier/invoice/${invoiceId}/auction`);
  };

  return (
    <div className="flex justify-end pt-2">
      <button
        type="button"
        onClick={handleClick}
        className="group relative inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#0047FF] hover:bg-[#0038D1] active:bg-[#002FA8] px-8 py-4 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
      >
        <Sparkles className="h-4 w-4 text-blue-200 group-hover:scale-110 transition-transform" />
        <span>View Market Offers</span>
        <ArrowRight className="h-4 w-4 text-white group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
