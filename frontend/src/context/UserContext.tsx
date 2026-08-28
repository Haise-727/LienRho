"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export type UserRole = "supplier" | "lender";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  orgName: string;
  orgSlug: string;
  role: UserRole;
}

interface UserContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  user: UserProfile;
  activeInvoiceId: string;
  setActiveInvoiceId: (id: string) => void;
}

const DEFAULT_USER: UserProfile = {
  id: "usr-vertex-01",
  name: "Rajesh Sharma",
  email: "ops@vertexcomponents.example",
  orgName: "Vertex Components Pvt Ltd",
  orgSlug: "vertex-components",
  role: "supplier",
};

const LENDER_USER: UserProfile = {
  id: "usr-kaveri-01",
  name: "Vikram Menon",
  email: "desk@kavericapital.example",
  orgName: "Kaveri Capital (NBFC)",
  orgSlug: "kaveri-capital",
  role: "lender",
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("supplier");
  const [activeInvoiceId, setActiveInvoiceId] = useState<string>("inv-seed-001");
  const router = useRouter();
  const pathname = usePathname();

  // Keep role synced with URL if route explicitly mentions supplier or lender
  useEffect(() => {
    if (pathname.includes("/lender") && role !== "lender") {
      setRoleState("lender");
    } else if (pathname.includes("/supplier") && role !== "supplier") {
      setRoleState("supplier");
    }
  }, [pathname]);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole === "supplier") {
      router.push("/dashboard/supplier");
    } else {
      router.push("/dashboard/lender");
    }
  };

  const user = role === "supplier" ? DEFAULT_USER : LENDER_USER;

  return (
    <UserContext.Provider
      value={{
        role,
        setRole,
        user,
        activeInvoiceId,
        setActiveInvoiceId,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
