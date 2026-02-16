import { createContext, useContext, type ReactNode } from "react";

export interface CustomerRouteContextValue {
  customerId: string;
  basePath: string;
}

const CustomerRouteContext = createContext<CustomerRouteContextValue | null>(null);

export function CustomerRouteProvider({
  customerId,
  children,
}: {
  customerId: string;
  children: ReactNode;
}) {
  const basePath = `/${encodeURIComponent(customerId)}`;
  return (
    <CustomerRouteContext.Provider value={{ customerId, basePath }}>
      {children}
    </CustomerRouteContext.Provider>
  );
}

export function useCustomerRoute(): CustomerRouteContextValue {
  const ctx = useContext(CustomerRouteContext);
  if (!ctx) throw new Error("useCustomerRoute must be used within CustomerRouteProvider");
  return ctx;
}

export function useCustomerRouteOrNull(): CustomerRouteContextValue | null {
  return useContext(CustomerRouteContext);
}
