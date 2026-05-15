const CDP = "http://127.0.0.1:9222";
const targets = await fetch(`${CDP}/json/list`).then((response) => response.json());
const target = targets.find((item) => item.type === "page" && item.url.includes("system-project-math-sci"));
if (!target) throw new Error("No app target.");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(JSON.stringify(message.error)));
  else resolve(message.result);
};
await new Promise((resolve, reject) => {
  ws.onerror = reject;
  ws.onopen = resolve;
});
const send = (method, params = {}) => {
  const messageId = ++id;
  ws.send(JSON.stringify({ id: messageId, method, params }));
  return new Promise((resolve, reject) => pending.set(messageId, { resolve, reject }));
};
const result = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const fields = [...document.querySelectorAll('input, textarea, select')].map((el) => ({
      tag: el.tagName,
      name: el.name,
      type: el.type || '',
      required: el.required,
      disabled: el.disabled,
      valid: typeof el.checkValidity === 'function' ? el.checkValidity() : true,
      validationMessage: el.validationMessage || '',
      value: String(el.value || '').slice(0, 100)
    }));
    const buttons = [...document.querySelectorAll('button')].map((el) => ({
      text: el.innerText.trim(),
      type: el.type,
      disabled: el.disabled
    }));
    return { url: location.href, invalid: fields.filter((field) => !field.valid), fields, buttons };
  })()`,
});
console.log(JSON.stringify(result.result.value, null, 2));
ws.close();
