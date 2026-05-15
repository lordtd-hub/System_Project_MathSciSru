const CDP = "http://127.0.0.1:9222";

async function getTarget() {
  const targets = await fetch(`${CDP}/json/list`).then((response) => response.json());
  return targets.find((target) => target.type === "page" && target.url.includes("system-project-math-sci"));
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  };
  return new Promise((resolve, reject) => {
    ws.onerror = reject;
    ws.onopen = () =>
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((resolveMessage, rejectMessage) => pending.set(messageId, { resolve: resolveMessage, reject: rejectMessage }));
        },
        close() {
          ws.close();
        },
      });
  });
}

async function main() {
  const target = await getTarget();
  if (!target) throw new Error("No app page target.");
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  const result = await client.send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      const setValue = (name, value) => {
        const el = document.querySelector('[name="' + name + '"]');
        if (!el) return false;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };

      const timelineRows = [
        { startWeek: 1, endWeek: 4, activity: 'ศึกษาที่มาและเอกสารที่เกี่ยวข้อง', deliverable: 'สรุปเอกสารอ้างอิง' },
        { startWeek: 5, endWeek: 8, activity: 'ออกแบบวิธีดำเนินงาน', deliverable: 'แบบจำลองหรือแผนวิเคราะห์' },
        { startWeek: 9, endWeek: 12, activity: 'ทดลองและรวบรวมผล', deliverable: 'ผลการทดลองเบื้องต้น' },
        { startWeek: 13, endWeek: 16, activity: 'สรุปผลและจัดทำรายงาน', deliverable: 'ร่างรายงานและสไลด์นำเสนอ' },
      ];
      const timelineMarkdown = [
        '| ลำดับ | งาน | ช่วงสัปดาห์ | ผลลัพธ์/หลักฐานที่คาดว่าจะได้ |',
        '|---:|---|---:|---|',
        ...timelineRows.map((row, index) => '| ' + (index + 1) + ' | ' + row.activity + ' | สัปดาห์ ' + row.startWeek + '-' + row.endWeek + ' | ' + row.deliverable + ' |'),
      ].join('\\n');

      setValue('project_title_th', 'ตัวอย่างโครงงานสำหรับคู่มือการใช้งาน');
      setValue('project_title_en', 'User Manual Demonstration Project');
      setValue('abstract_of_talk', 'ตัวอย่างบทคัดย่อสำหรับคู่มือการใช้งาน อธิบายปัญหา วัตถุประสงค์ และแนวทางดำเนินโครงงานแบบย่อ');
      setValue('motivation_background', 'หัวข้อนี้ใช้เป็นข้อมูลตัวอย่างสำหรับสาธิตขั้นตอนการส่งเอกสาร Proposal ในระบบ');
      setValue('objectives', '1. แสดงตัวอย่างการส่งเอกสารเสนอหัวข้อ\\n2. ใช้ประกอบคู่มือการใช้งานนักศึกษา');
      setValue('proposed_methods', 'รวบรวมข้อมูลตัวอย่าง ตรวจสอบขั้นตอนในระบบ และบันทึกหลักฐานประกอบการนำเสนอ');
      setValue('expected_outcomes', 'ได้ตัวอย่างโครงงานที่ใช้ถ่ายภาพคู่มือและตรวจสอบ workflow การเสนอหัวข้อ');
      setValue('questions_for_teachers', 'ต้องการคำแนะนำเรื่องขอบเขตงานและความเหมาะสมของวิธีดำเนินงาน');
      setValue('material_link', 'https://drive.google.com/drive/folders/manual-proposal-demo');
      setValue('timeline', timelineMarkdown);

      const timelineJson = document.querySelector('[name="timeline_items_json"]');
      if (timelineJson) {
        timelineJson.value = JSON.stringify(timelineRows);
        timelineJson.dispatchEvent(new Event('input', { bubbles: true }));
        timelineJson.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const unnamedRequired = [...document.querySelectorAll('input[required]:not([name]), input[required][name=""]')];
      unnamedRequired.forEach((input, index) => {
        if (!input.value) {
          input.value = timelineRows[index]?.activity ?? 'ข้อมูลตัวอย่างสำหรับแผนงาน';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      const declaration = document.querySelector('[name="student_declaration"]');
      if (declaration) {
        declaration.checked = true;
        declaration.dispatchEvent(new Event('input', { bubbles: true }));
        declaration.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const invalid = [...document.querySelectorAll('input, textarea, select')]
        .filter((el) => !el.checkValidity())
        .map((el) => ({ name: el.name || '(unnamed)', type: el.type, message: el.validationMessage }));
      if (invalid.length) return { submitted: false, reason: 'invalid fields', invalid };

      const buttons = [...document.querySelectorAll('button')];
      const submit = buttons.find((button) => button.innerText.includes('ส่งเอกสารเสนอหัวข้อ'));
      if (!submit) return { submitted: false, reason: 'missing submit', buttons: buttons.map((button) => button.innerText) };
      submit.scrollIntoView({ block: 'center' });
      submit.click();
      return { submitted: true, url: location.href };
    })()`,
  });
  console.log(JSON.stringify(result.result.value, null, 2));
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const after = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `({ url: location.href, text: document.body.innerText.slice(0, 1200) })`,
  });
  console.log(JSON.stringify(after.result.value, null, 2));
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
