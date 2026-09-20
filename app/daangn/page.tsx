import Topbar from "@/components/Topbar";
import PopularDaangn from "@/components/PopularDaangn";
export default function DaangnPage() {
  return <div className="app-root"><Topbar title="당근 인기 소식" sub="조회수를 확인하고 우리 가게의 다음 주제를 찾아보세요." /><main id="main-content" className="studio-main"><PopularDaangn /></main></div>;
}
