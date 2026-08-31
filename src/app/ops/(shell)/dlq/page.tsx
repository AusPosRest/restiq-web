import { Suspense } from "react";
import { DlqTable } from "./dlq-table";

export default function OpsDlqPage() {
  return (
    <Suspense>
      <DlqTable />
    </Suspense>
  );
}
