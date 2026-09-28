import { useEffect, useState, useCallback } from "react";
import {
  MasterStore,
  type ProductItem,
  type ZoneItem,
  type CategoryItem,
  type UnitItem,
  type PurchaseOrderRecord,
  type StockMovementLog,
} from "@/lib/store";

/**
 * Custom hook to subscribe to real-time changes in MasterStore
 * across all tabs, windows, and store mutations.
 */
export function useRealtimeStore() {
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const handleStoreChange = () => {
      refresh();
    };

    window.addEventListener("minimark_store_change", handleStoreChange);
    window.addEventListener("storage", handleStoreChange);

    return () => {
      window.removeEventListener("minimark_store_change", handleStoreChange);
      window.removeEventListener("storage", handleStoreChange);
    };
  }, [refresh]);

  return {
    version,
    refresh,
    getProducts: useCallback(() => MasterStore.getProducts(), [version]),
    getZones: useCallback(() => MasterStore.getZones(), [version]),
    getCategories: useCallback(() => MasterStore.getCategories(), [version]),
    getUnits: useCallback(() => MasterStore.getUnits(), [version]),
    getPurchaseOrders: useCallback(() => MasterStore.getPurchaseOrders(), [version]),
    getMovements: useCallback(() => MasterStore.getMovements(), [version]),
    getReceives: useCallback(() => MasterStore.getReceives(), [version]),
  };
}
