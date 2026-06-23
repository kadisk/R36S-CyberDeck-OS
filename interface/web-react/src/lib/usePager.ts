// usePager.ts — paginação ligada ao L1/R1 (registra um pager no store). Porta da lógica
// UI.pager + view.lr da web-vanilla. apply(count,size) -> { total, page (clampada) }.
import { useState, useEffect, useRef } from "react";
import { actions } from "../store";

export function usePager() {
  const [page, setPage] = useState(0);
  const totalRef = useRef(1);
  useEffect(() => {
    actions.registerPager((dir: number) => setPage((p) => {
      const n = p + dir;
      return n < 0 ? 0 : (n >= totalRef.current ? totalRef.current - 1 : n);
    }));
    return () => actions.registerPager(null);
  }, []);
  const apply = (count: number, size: number) => {
    const total = Math.max(1, Math.ceil(count / size));
    totalRef.current = total;
    return { total, page: Math.min(page, total - 1) };
  };
  return { page, setPage, apply };
}
