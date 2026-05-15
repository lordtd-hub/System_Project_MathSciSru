import { ManualGuidePage } from "../ManualGuidePage";
import { studentManualGuide } from "../manualContent";

export const metadata = {
  title: "คู่มือนักศึกษา | ระบบประเมินการนำเสนอโครงงาน",
  description: "คู่มือการใช้งานสำหรับนักศึกษา"
};

export default function StudentManualPage() {
  return <ManualGuidePage guide={studentManualGuide} />;
}
