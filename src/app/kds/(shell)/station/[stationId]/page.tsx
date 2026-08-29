import { StationQueueScreen } from "../station-queue-screen";

export default async function KdsStationPage({ params }: { params: Promise<{ stationId: string }> }) {
  const { stationId } = await params;
  return <StationQueueScreen stationId={stationId} />;
}
