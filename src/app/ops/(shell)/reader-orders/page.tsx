import { Suspense } from "react";
import { ReaderOrdersIndex } from "./reader-orders-index";

export default function OpsReaderOrdersPage() {
  return (
    <Suspense>
      <ReaderOrdersIndex />
    </Suspense>
  );
}
