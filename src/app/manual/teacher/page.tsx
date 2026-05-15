import { ManualGuidePage } from "../ManualGuidePage";
import { teacherManualGuide } from "../manualContent";

export const metadata = {
  title: "คู่มืออาจารย์ | ระบบประเมินการนำเสนอโครงงาน",
  description: "คู่มือการใช้งานสำหรับอาจารย์"
};

export default function TeacherManualPage() {
  return <ManualGuidePage guide={teacherManualGuide} />;
}
