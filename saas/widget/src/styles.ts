// Scoped inside the widget's Shadow DOM — never leaks into (or is affected
// by) the host page's own stylesheet.
export const WIDGET_STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }

.saas-widget-bubble {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #6366f1;
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483000;
}

.saas-widget-panel {
  position: fixed;
  bottom: 88px;
  right: 20px;
  width: 340px;
  max-width: calc(100vw - 40px);
  height: 460px;
  max-height: calc(100vh - 120px);
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 2147483000;
}

.saas-widget-panel[hidden],
.saas-widget-bubble[hidden] {
  display: none;
}

.saas-widget-header {
  background: #6366f1;
  color: #fff;
  padding: 14px 16px;
  font-weight: 600;
  font-size: 14px;
}

.saas-widget-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.saas-widget-msg {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.saas-widget-msg.user {
  align-self: flex-end;
  background: #6366f1;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.saas-widget-msg.assistant {
  align-self: flex-start;
  background: #f1f2f6;
  color: #1f2937;
  border-bottom-left-radius: 4px;
}

.saas-widget-msg.error {
  align-self: center;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 12px;
}

.saas-widget-form {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid #e5e7eb;
}

.saas-widget-input {
  flex: 1;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.saas-widget-send {
  border: none;
  background: #6366f1;
  color: #fff;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 13px;
  cursor: pointer;
}

.saas-widget-send:disabled {
  opacity: 0.6;
  cursor: default;
}
`;
